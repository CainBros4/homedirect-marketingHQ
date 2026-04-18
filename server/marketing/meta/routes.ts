// Meta creative pipeline routes.
//
// Flow: user enters a brief → generate N copy variants (Claude) → pick one
// and optionally generate image (DALL-E) → save as draft → admin reviews
// → approve (moves to ready-to-launch queue). Actual launch to Meta
// Marketing API happens once user's Meta account is connected (separate
// ticket, stubbed here with a 503 so the UI can show "Connect Meta first").

import type { Express } from "express";
import { marketingDb as db } from "../db";
import { metaAdCreatives } from "../../../shared/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth";
import {
  generateAdCopy,
  generateImage,
  isClaudeConfigured,
  isOpenAiConfigured,
} from "./creative-generator";

const nowIso = () => new Date().toISOString();

export function registerMetaRoutes(app: Express) {
  // ── Status — used by the Meta tab to show connection state ──
  app.get("/api/marketing/meta/status", requireAdmin, (_req, res) => {
    res.json({
      claude: isClaudeConfigured(),
      openai: isOpenAiConfigured(),
      metaConnected: !!process.env.META_ACCESS_TOKEN, // set once OAuth flow lands
      metaAccountId: process.env.META_AD_ACCOUNT_ID || null,
      metaPageId: process.env.META_PAGE_ID || null,
      housingSacEnforced: true,
      dailyBudgetCapCents: parseInt(process.env.META_DAILY_BUDGET_CAP_CENTS || "1700", 10), // $17/day ~ $500/mo
    });
  });

  // ── Generate copy (no image yet, cheap iteration) ──
  app.post("/api/marketing/meta/creatives/generate-copy", requireAdmin, async (req, res) => {
    const schema = z.object({
      icp: z.enum(["buyer", "seller", "general"]),
      brief: z.string().min(1),
      audienceNote: z.string().optional(),
      objective: z.enum(["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_AWARENESS"]).optional(),
      landingUrl: z.string().url().optional(),
      variantCount: z.number().min(1).max(5).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not set" });

    try {
      const result = await generateAdCopy(parsed.data);
      res.json(result);
    } catch (err: any) {
      console.error("[meta/generate-copy]", err);
      res.status(500).json({ message: "Copy generation failed", error: err?.message });
    }
  });

  // ── Generate + save a draft creative (copy + optional image) ──
  app.post("/api/marketing/meta/creatives/generate", requireAdmin, async (req, res) => {
    const schema = z.object({
      icp: z.enum(["buyer", "seller", "general"]),
      brief: z.string().min(1),
      audienceNote: z.string().optional(),
      objective: z.enum(["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_AWARENESS"]).optional(),
      landingUrl: z.string().url().optional(),
      aspectRatio: z.enum(["1:1", "4:5", "9:16"]).optional(),
      withImage: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not set" });

    const objective = parsed.data.objective ?? "OUTCOME_TRAFFIC";
    const landingUrl = parsed.data.landingUrl || "https://www.trykeylime.ai";
    const aspectRatio = parsed.data.aspectRatio ?? "1:1";
    const withImage = parsed.data.withImage ?? true;

    try {
      const copy = await generateAdCopy({ ...parsed.data, variantCount: 1 });
      const variant = copy.variants[0];
      if (!variant) throw new Error("No copy variants returned");

      let imageUrl: string | null = null;
      let imagePrompt: string | null = variant.imagePrompt || null;
      let imageProvider: string | null = null;
      let costCents = 0;

      if (withImage) {
        if (!isOpenAiConfigured()) {
          return res.status(503).json({ message: "OPENAI_API_KEY not set. Add it or pass withImage=false for copy-only." });
        }
        try {
          const img = await generateImage(variant.imagePrompt || "warm Tampa Bay home exterior, cream and lime-green palette", aspectRatio);
          imageUrl = img.imageUrl;
          imagePrompt = img.imagePrompt;
          imageProvider = "dall-e-3";
          costCents = img.costCents;
        } catch (imgErr: any) {
          console.warn("[meta/generate] image gen failed, saving copy-only:", imgErr?.message);
        }
      }

      const [row] = await db
        .insert(metaAdCreatives)
        .values({
          icp: parsed.data.icp,
          brief: parsed.data.brief,
          audienceNote: parsed.data.audienceNote,
          objective,
          primaryText: variant.primaryText,
          headline: variant.headline,
          description: variant.description,
          ctaButton: variant.ctaButton,
          landingUrl,
          aspectRatio,
          imageUrl,
          imagePrompt,
          imageProvider,
          generationCostCents: costCents,
          status: "draft",
          rationale: variant.rationale,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        .returning();

      res.json({ creative: row });
    } catch (err: any) {
      console.error("[meta/generate]", err);
      res.status(500).json({ message: "Generation failed", error: err?.message });
    }
  });

  // ── Regenerate just the image for an existing draft ──
  app.post("/api/marketing/meta/creatives/:id/regenerate-image", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.id, id)).limit(1);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!isOpenAiConfigured()) return res.status(503).json({ message: "OPENAI_API_KEY not set" });

    const bodySchema = z.object({ prompt: z.string().optional(), aspectRatio: z.enum(["1:1", "4:5", "9:16"]).optional() });
    const parsed = bodySchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

    try {
      const aspect = parsed.data.aspectRatio || (row.aspectRatio as "1:1" | "4:5" | "9:16") || "1:1";
      const prompt = parsed.data.prompt || row.imagePrompt || "warm Tampa Bay home, cream and lime-green palette";
      const img = await generateImage(prompt, aspect);
      await db
        .update(metaAdCreatives)
        .set({
          imageUrl: img.imageUrl,
          imagePrompt: img.imagePrompt,
          imageProvider: "dall-e-3",
          aspectRatio: aspect,
          generationCostCents: (row.generationCostCents || 0) + img.costCents,
          updatedAt: nowIso(),
        })
        .where(eq(metaAdCreatives.id, id));
      res.json({ imageUrl: img.imageUrl, costCents: img.costCents });
    } catch (err: any) {
      console.error("[meta/regenerate-image]", err);
      res.status(500).json({ message: "Image regeneration failed", error: err?.message });
    }
  });

  // ── List creatives (filter by status) ──
  app.get("/api/marketing/meta/creatives", requireAdmin, async (req, res) => {
    const statusParam = typeof req.query.status === "string" ? req.query.status : null;
    const rows = statusParam && statusParam !== "all"
      ? await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.status, statusParam)).orderBy(desc(metaAdCreatives.updatedAt))
      : await db.select().from(metaAdCreatives).orderBy(desc(metaAdCreatives.updatedAt));
    res.json({ creatives: rows });
  });

  // ── Edit a draft ──
  app.patch("/api/marketing/meta/creatives/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const schema = z.object({
      primaryText: z.string().optional(),
      headline: z.string().optional(),
      description: z.string().optional(),
      ctaButton: z.enum(["LEARN_MORE", "SIGN_UP", "GET_OFFER", "APPLY_NOW"]).optional(),
      landingUrl: z.string().url().optional(),
      aspectRatio: z.enum(["1:1", "4:5", "9:16"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    await db.update(metaAdCreatives).set({ ...parsed.data, updatedAt: nowIso() }).where(eq(metaAdCreatives.id, id));
    res.json({ ok: true });
  });

  // ── Approve / reject / archive ──
  app.post("/api/marketing/meta/creatives/:id/approve", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = req.session?.adminUserId ?? null;
    await db
      .update(metaAdCreatives)
      .set({ status: "approved", reviewedBy: userId as any, reviewedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(metaAdCreatives.id, id));
    res.json({ ok: true });
  });

  app.post("/api/marketing/meta/creatives/:id/reject", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = req.session?.adminUserId ?? null;
    await db
      .update(metaAdCreatives)
      .set({ status: "rejected", reviewedBy: userId as any, reviewedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(metaAdCreatives.id, id));
    res.json({ ok: true });
  });

  app.delete("/api/marketing/meta/creatives/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(metaAdCreatives).where(eq(metaAdCreatives.id, id));
    res.json({ ok: true });
  });

  // ── Launch to Meta (stub until OAuth + Marketing API wiring) ──
  app.post("/api/marketing/meta/creatives/:id/launch", requireAdmin, async (req, res) => {
    if (!process.env.META_ACCESS_TOKEN) {
      return res.status(503).json({
        message: "Meta account not connected. Complete the Business Manager + Ad Account setup, then paste a META_ACCESS_TOKEN in Railway.",
        nextStep: "connect_meta",
      });
    }
    // TODO: implement Meta Marketing API call once OAuth + Ad Account ID + Page ID are wired.
    res.status(501).json({ message: "Meta launch integration coming in next ship. Creative is approved and ready." });
  });
}
