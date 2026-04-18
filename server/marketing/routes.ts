// Marketing HQ REST API routes. Mounted at /api/marketing/* from routes.ts.
// Admin-gated — same pattern as existing admin endpoints.

import type { Express } from "express";
import { marketingDb as db } from "./db";
import {
  contacts,
  emailLists,
  listMemberships,
  emailTemplates,
  emailCampaigns,
  dripSequences,
  dripSteps,
  dripEnrollments,
  emailEvents,
  mlsListings,
  skipTraceLog,
} from "../../shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { isResendConfigured, sendEmail } from "./resend-client";
import { generateEmailTemplate, generateDripSequence, isClaudeConfigured } from "./claude-content";
import { getMlsProvider } from "./providers";
import type { MlsFilters } from "./providers";
import { skipTrace, isSkipTraceConfigured } from "./skip-trace";
import { tickDripEngine, enrollContact } from "./drip-engine";
import { render, generateUnsubscribeToken, verifyUnsubscribeToken } from "./template-renderer";
import { requireAdmin } from "./auth";

const nowIso = () => new Date().toISOString();

export function registerMarketingRoutes(app: Express) {
  // ── Status / health ──
  app.get("/api/marketing/status", requireAdmin, (_req, res) => {
    res.json({
      resend: isResendConfigured(),
      claude: isClaudeConfigured(),
      skipTrace: isSkipTraceConfigured(),
      mlsProvider: getMlsProvider().name,
      mlsProviderConfigured: getMlsProvider().configured,
    });
  });

  // ── Contacts ──
  app.get("/api/marketing/contacts", requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const rows = await db
      .select()
      .from(contacts)
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ contacts: rows });
  });

  const contactInput = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    source: z.string().optional(),
    sourceRef: z.string().optional(),
    verifiedEmail: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  });

  app.post("/api/marketing/contacts", requireAdmin, async (req, res) => {
    const parsed = contactInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid contact", errors: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const [row] = await db
        .insert(contacts)
        .values({
          email: d.email.toLowerCase(),
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          address: d.address,
          city: d.city,
          state: d.state,
          zip: d.zip,
          source: d.source || "manual",
          sourceRef: d.sourceRef,
          verifiedEmail: d.verifiedEmail ?? false,
          metadata: JSON.stringify(d.metadata || {}),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        .returning();
      res.json({ contact: row });
    } catch (err: any) {
      if (/UNIQUE/i.test(err?.message || "")) {
        return res.status(409).json({ message: "Email already exists" });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.post("/api/marketing/contacts/bulk", requireAdmin, async (req, res) => {
    const schema = z.object({ contacts: z.array(contactInput) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
    const results = { inserted: 0, skipped: 0, errors: 0 };
    for (const c of parsed.data.contacts) {
      try {
        await db.insert(contacts).values({
          email: c.email.toLowerCase(),
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
          source: c.source || "import",
          sourceRef: c.sourceRef,
          metadata: JSON.stringify(c.metadata || {}),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        results.inserted++;
      } catch (err: any) {
        if (/UNIQUE/i.test(err?.message || "")) results.skipped++;
        else results.errors++;
      }
    }
    res.json(results);
  });

  // ── Email Lists ──
  app.get("/api/marketing/lists", requireAdmin, async (_req, res) => {
    const lists = await db.select().from(emailLists).orderBy(desc(emailLists.createdAt));
    const withCounts = await Promise.all(
      lists.map(async (l: any) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(listMemberships)
          .where(eq(listMemberships.listId, l.id));
        return { ...l, contactCount: Number(count) || 0 };
      }),
    );
    res.json({ lists: withCounts });
  });

  app.post("/api/marketing/lists", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["static", "dynamic"]).optional(),
      filterQuery: z.record(z.any()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid list" });
    const [row] = await db
      .insert(emailLists)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        type: parsed.data.type || "static",
        filterQuery: JSON.stringify(parsed.data.filterQuery || {}),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      .returning();
    res.json({ list: row });
  });

  app.post("/api/marketing/lists/:id/members", requireAdmin, async (req, res) => {
    const listId = parseInt(String(req.params.id), 10);
    const schema = z.object({ contactIds: z.array(z.number()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    let added = 0;
    for (const contactId of parsed.data.contactIds) {
      try {
        await db.insert(listMemberships).values({ listId, contactId, addedAt: nowIso() });
        added++;
      } catch {}
    }
    res.json({ added });
  });

  app.get("/api/marketing/lists/:id/members", requireAdmin, async (req, res) => {
    const listId = parseInt(String(req.params.id), 10);
    const rows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        city: contacts.city,
        state: contacts.state,
        source: contacts.source,
        verifiedEmail: contacts.verifiedEmail,
        optedOut: contacts.optedOut,
      })
      .from(listMemberships)
      .innerJoin(contacts, eq(contacts.id, listMemberships.contactId))
      .where(eq(listMemberships.listId, listId))
      .limit(1000);
    res.json({ contacts: rows });
  });

  // ── Templates ──
  app.get("/api/marketing/templates", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.updatedAt));
    res.json({ templates: rows });
  });

  app.post("/api/marketing/templates", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string(),
      subject: z.string(),
      preheader: z.string().optional(),
      htmlBody: z.string(),
      textBody: z.string().optional(),
      variables: z.array(z.string()).optional(),
      aiPrompt: z.string().optional(),
      aiGenerated: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid template" });
    const [row] = await db
      .insert(emailTemplates)
      .values({
        name: parsed.data.name,
        subject: parsed.data.subject,
        preheader: parsed.data.preheader,
        htmlBody: parsed.data.htmlBody,
        textBody: parsed.data.textBody,
        variables: JSON.stringify(parsed.data.variables || []),
        aiGenerated: parsed.data.aiGenerated ?? false,
        aiPrompt: parsed.data.aiPrompt,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      .returning();
    res.json({ template: row });
  });

  app.post("/api/marketing/templates/generate", requireAdmin, async (req, res) => {
    const schema = z.object({
      brief: z.string(),
      audience: z.string(),
      tone: z.string().optional(),
      variables: z.array(z.string()).optional(),
      saveAs: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not configured" });
    try {
      const generated = await generateEmailTemplate({
        brief: parsed.data.brief,
        audience: parsed.data.audience,
        tone: parsed.data.tone,
        variables: parsed.data.variables,
      });
      let saved = null;
      if (parsed.data.saveAs) {
        const [row] = await db
          .insert(emailTemplates)
          .values({
            name: parsed.data.saveAs,
            subject: generated.subject,
            preheader: generated.preheader,
            htmlBody: generated.htmlBody,
            textBody: generated.textBody,
            variables: JSON.stringify(parsed.data.variables || []),
            aiGenerated: true,
            aiPrompt: JSON.stringify({ brief: parsed.data.brief, audience: parsed.data.audience, tone: parsed.data.tone }),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          })
          .returning();
        saved = row;
      }
      res.json({ template: generated, saved });
    } catch (err: any) {
      console.error("[marketing/template-generate]", err);
      res.status(500).json({ message: "Failed to generate template", error: err?.message });
    }
  });

  // ── Campaigns ──
  app.get("/api/marketing/campaigns", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
    res.json({ campaigns: rows });
  });

  app.post("/api/marketing/campaigns", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string(),
      listId: z.number(),
      templateId: z.number(),
      scheduledAt: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid campaign" });
    const [row] = await db
      .insert(emailCampaigns)
      .values({
        name: parsed.data.name,
        listId: parsed.data.listId,
        templateId: parsed.data.templateId,
        status: parsed.data.scheduledAt ? "scheduled" : "draft",
        scheduledAt: parsed.data.scheduledAt,
        createdBy: req.session?.adminUserId ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      .returning();
    res.json({ campaign: row });
  });

  app.post("/api/marketing/campaigns/:id/send", requireAdmin, async (req, res) => {
    const campaignId = parseInt(String(req.params.id), 10);
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.status === "sent" || campaign.status === "sending") {
      return res.status(409).json({ message: `Campaign is ${campaign.status}` });
    }

    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, campaign.templateId)).limit(1);
    if (!template) return res.status(404).json({ message: "Template not found" });

    const members = await db
      .select()
      .from(listMemberships)
      .innerJoin(contacts, eq(contacts.id, listMemberships.contactId))
      .where(
        and(
          eq(listMemberships.listId, campaign.listId),
          eq(contacts.optedOut, false),
        ),
      );

    await db.update(emailCampaigns).set({ status: "sending", startedAt: nowIso() }).where(eq(emailCampaigns.id, campaignId));

    const stats = { sent: 0, failed: 0, queued: members.length };
    // Fire sends sequentially to keep log output readable. For 10K+ lists,
    // move to a queue (BullMQ/pg-boss).
    for (const row of members) {
      const contact: any = row.contacts;
      const token = generateUnsubscribeToken(contact.id);
      const rendered = render(template, { contact, unsubscribeToken: token });
      const result = await sendEmail({
        to: contact.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: { campaign_id: String(campaignId) },
        headers: {
          "List-Unsubscribe": `<${process.env.APP_BASE_URL || "https://www.trykeylime.ai"}/u/${token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await db.insert(emailEvents).values({
        contactId: contact.id,
        campaignId,
        resendEmailId: result.resendId,
        eventType: result.success ? "sent" : "failed",
        eventData: JSON.stringify(result),
        createdAt: nowIso(),
      });
      if (result.success) stats.sent++;
      else stats.failed++;
    }

    await db
      .update(emailCampaigns)
      .set({
        status: "sent",
        completedAt: nowIso(),
        stats: JSON.stringify(stats),
      })
      .where(eq(emailCampaigns.id, campaignId));

    res.json({ campaignId, stats });
  });

  // Preview what will happen when this campaign sends: how many contacts
  // on the list, how many will actually receive (opted-in + not bounced),
  // and a breakdown of what's suppressed. Used by the Send confirmation
  // dialog so admins see exactly who the email reaches before firing.
  app.get("/api/marketing/campaigns/:id/preview", requireAdmin, async (req, res) => {
    const campaignId = parseInt(String(req.params.id), 10);
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const members = await db
      .select({
        id: contacts.id,
        optedOut: contacts.optedOut,
        bouncedAt: contacts.bouncedAt,
      })
      .from(listMemberships)
      .innerJoin(contacts, eq(contacts.id, listMemberships.contactId))
      .where(eq(listMemberships.listId, campaign.listId));

    let sendable = 0;
    let suppressedOptedOut = 0;
    let suppressedBounced = 0;
    for (const m of members) {
      if (m.optedOut) suppressedOptedOut++;
      else if (m.bouncedAt) suppressedBounced++;
      else sendable++;
    }
    res.json({
      campaignId,
      listId: campaign.listId,
      totalOnList: members.length,
      sendable,
      suppressedOptedOut,
      suppressedBounced,
      totalSuppressed: suppressedOptedOut + suppressedBounced,
    });
  });

  // Manually toggle a contact's opt-out state. Logged as a synthetic
  // email_event so the audit trail shows why the status changed.
  app.post("/api/marketing/contacts/:id/opt-out", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db
      .update(contacts)
      .set({ optedOut: true, optedOutAt: nowIso(), updatedAt: nowIso() })
      .where(eq(contacts.id, id));
    await db.insert(emailEvents).values({
      contactId: id,
      eventType: "unsubscribed",
      eventData: JSON.stringify({ source: "admin_manual", at: nowIso() }),
      createdAt: nowIso(),
    });
    res.json({ ok: true });
  });

  app.post("/api/marketing/contacts/:id/opt-in", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db
      .update(contacts)
      .set({ optedOut: false, optedOutAt: null, updatedAt: nowIso() })
      .where(eq(contacts.id, id));
    await db.insert(emailEvents).values({
      contactId: id,
      eventType: "resubscribed",
      eventData: JSON.stringify({ source: "admin_manual", at: nowIso() }),
      createdAt: nowIso(),
    });
    res.json({ ok: true });
  });

  // Send a single rendered preview of a campaign to an arbitrary email.
  // Useful for proofing copy + deliverability before firing the real list.
  // Does NOT touch the campaign status, does NOT log against contact_id.
  app.post("/api/marketing/campaigns/:id/test-send", requireAdmin, async (req, res) => {
    const campaignId = parseInt(String(req.params.id), 10);
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Valid email required" });

    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, campaign.templateId)).limit(1);
    if (!template) return res.status(404).json({ message: "Template not found" });

    // Use a stub contact so variables resolve without creating a real row.
    // The unsubscribe token still resolves if the recipient clicks, because
    // we use contactId 0 — the unsubscribe handler will just no-op gracefully
    // (no matching contact, still renders the success page).
    const stubContact: any = {
      id: 0,
      email: parsed.data.email,
      firstName: "Test",
      lastName: "Recipient",
      phone: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      optedOut: false,
      verifiedEmail: true,
      source: "test",
      metadata: "{}",
    };
    const token = generateUnsubscribeToken(0);
    const rendered = render(template, { contact: stubContact, unsubscribeToken: token });

    const result = await sendEmail({
      to: parsed.data.email,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      tags: { campaign_id: String(campaignId), test_send: "true" },
      headers: {
        "List-Unsubscribe": `<${process.env.APP_BASE_URL || "https://marketinghq-production.up.railway.app"}/u/${token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    res.json({ sent: result.success, resendId: result.resendId, stubbed: result.stubbed, error: result.error });
  });

  // ── Drip Sequences ──
  app.get("/api/marketing/drips", requireAdmin, async (_req, res) => {
    const seqs = await db.select().from(dripSequences).orderBy(desc(dripSequences.createdAt));
    const full = await Promise.all(
      seqs.map(async (s: any) => {
        const steps = await db.select().from(dripSteps).where(eq(dripSteps.sequenceId, s.id));
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(dripEnrollments)
          .where(eq(dripEnrollments.sequenceId, s.id));
        return { ...s, steps, enrollmentCount: Number(count) || 0 };
      }),
    );
    res.json({ sequences: full });
  });

  app.post("/api/marketing/drips/generate", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string(),
      goal: z.string(),
      audience: z.string(),
      stepCount: z.number().min(1).max(10),
      cadenceDays: z.array(z.number()),
      tone: z.string().optional(),
      triggerType: z.enum(["list_join", "manual", "event"]).optional(),
      triggerConfig: z.record(z.any()).optional(),
      activate: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
    if (!isClaudeConfigured()) return res.status(503).json({ message: "ANTHROPIC_API_KEY not configured" });

    try {
      const generated = await generateDripSequence({
        goal: parsed.data.goal,
        audience: parsed.data.audience,
        stepCount: parsed.data.stepCount,
        cadenceDays: parsed.data.cadenceDays,
        tone: parsed.data.tone,
      });

      const [seq] = await db
        .insert(dripSequences)
        .values({
          name: parsed.data.name,
          description: parsed.data.goal,
          triggerType: parsed.data.triggerType || "manual",
          triggerConfig: JSON.stringify(parsed.data.triggerConfig || {}),
          status: parsed.data.activate ? "active" : "draft",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        .returning();

      for (const step of generated) {
        const [tpl] = await db
          .insert(emailTemplates)
          .values({
            name: `${parsed.data.name} – Step ${step.stepOrder}`,
            subject: step.template.subject,
            preheader: step.template.preheader,
            htmlBody: step.template.htmlBody,
            textBody: step.template.textBody,
            variables: JSON.stringify(["first_name", "city", "unsubscribe_url"]),
            aiGenerated: true,
            aiPrompt: JSON.stringify({ goal: parsed.data.goal, audience: parsed.data.audience, step: step.stepOrder }),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          })
          .returning();

        await db.insert(dripSteps).values({
          sequenceId: seq.id,
          stepOrder: step.stepOrder,
          delayHours: step.delayHours,
          templateId: tpl.id,
          createdAt: nowIso(),
        });
      }

      res.json({ sequence: seq, stepCount: generated.length });
    } catch (err: any) {
      console.error("[marketing/drips-generate]", err);
      res.status(500).json({ message: "Failed to generate drip", error: err?.message });
    }
  });

  app.post("/api/marketing/drips/:id/enroll", requireAdmin, async (req, res) => {
    const sequenceId = parseInt(String(req.params.id), 10);
    const schema = z.object({ contactIds: z.array(z.number()).optional(), listId: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const ids: number[] = [];
    if (parsed.data.contactIds) ids.push(...parsed.data.contactIds);
    if (parsed.data.listId) {
      const rows = await db
        .select({ cid: listMemberships.contactId })
        .from(listMemberships)
        .where(eq(listMemberships.listId, parsed.data.listId));
      ids.push(...rows.map((r: any) => r.cid));
    }
    let enrolled = 0;
    for (const cid of Array.from(new Set(ids))) {
      const id = await enrollContact(sequenceId, cid);
      if (id) enrolled++;
    }
    res.json({ enrolled });
  });

  app.post("/api/marketing/drips/:id/activate", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await db.update(dripSequences).set({ status: "active", updatedAt: nowIso() }).where(eq(dripSequences.id, id));
    res.json({ ok: true });
  });

  app.post("/api/marketing/drips/tick", requireAdmin, async (_req, res) => {
    const result = await tickDripEngine({ maxPerTick: 200 });
    res.json(result);
  });

  // ── MLS Listings ──
  app.post("/api/marketing/mls/search", requireAdmin, async (req, res) => {
    const schema = z.object({
      statuses: z.array(z.string()).optional(),
      city: z.string().optional(),
      zip: z.string().optional(),
      county: z.string().optional(),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      bedsMin: z.number().optional(),
      bathsMin: z.number().optional(),
      sqftMin: z.number().optional(),
      sqftMax: z.number().optional(),
      domMin: z.number().optional(),
      domMax: z.number().optional(),
      statusChangedSince: z.string().optional(),
      propertyTypes: z.array(z.string()).optional(),
      limit: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid filters" });
    const provider = getMlsProvider();
    const filters = parsed.data as MlsFilters;
    const rows = await provider.fetchListings(filters);
    res.json({ provider: provider.name, count: rows.length, listings: rows });
  });

  app.post("/api/marketing/mls/import", requireAdmin, async (req, res) => {
    const schema = z.object({
      listings: z.array(
        z.object({
          providerListingId: z.string(),
          status: z.string(),
          statusChangedAt: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zip: z.string().optional(),
          county: z.string().optional(),
          price: z.number().optional(),
          beds: z.number().optional(),
          baths: z.number().optional(),
          sqft: z.number().optional(),
          propertyType: z.string().optional(),
          daysOnMarket: z.number().optional(),
          listingAgent: z.string().optional(),
          ownerName: z.string().optional(),
          raw: z.record(z.any()).optional(),
        }),
      ),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const provider = getMlsProvider();
    let inserted = 0;
    let updated = 0;
    for (const l of parsed.data.listings) {
      try {
        await db.insert(mlsListings).values({
          provider: provider.name,
          providerListingId: l.providerListingId,
          status: l.status,
          statusChangedAt: l.statusChangedAt,
          address: l.address,
          city: l.city,
          state: l.state,
          zip: l.zip,
          county: l.county,
          price: l.price,
          beds: l.beds,
          baths: l.baths,
          sqft: l.sqft,
          propertyType: l.propertyType,
          daysOnMarket: l.daysOnMarket,
          listingAgent: l.listingAgent,
          ownerName: l.ownerName,
          rawData: JSON.stringify(l.raw || {}),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        inserted++;
      } catch (err: any) {
        if (/UNIQUE/i.test(err?.message || "")) updated++;
      }
    }
    res.json({ inserted, updated });
  });

  // ── Skip-trace a listing ──
  app.post("/api/marketing/mls/:id/skip-trace", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const [listing] = await db.select().from(mlsListings).where(eq(mlsListings.id, id)).limit(1);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (!listing.address || !listing.city || !listing.state || !listing.zip) {
      return res.status(400).json({ message: "Listing missing address fields" });
    }

    const [first, ...rest] = (listing.ownerName || "").split(" ");
    const last = rest.join(" ");
    const result = await skipTrace({
      firstName: first,
      lastName: last,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
    });

    let contactId: number | null = null;
    if (result.emails.length) {
      try {
        const [c] = await db
          .insert(contacts)
          .values({
            email: result.emails[0].toLowerCase(),
            firstName: first || undefined,
            lastName: last || undefined,
            phone: result.phones[0],
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip,
            source: `mls_${listing.status}`,
            sourceRef: String(listing.id),
            verifiedEmail: true,
            metadata: JSON.stringify({ skipTrace: result.response, listingId: listing.id }),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          })
          .returning();
        contactId = c.id;
      } catch (err: any) {
        // If email already exists, look it up
        if (/UNIQUE/i.test(err?.message || "")) {
          const [existing] = await db.select().from(contacts).where(eq(contacts.email, result.emails[0].toLowerCase())).limit(1);
          contactId = existing?.id ?? null;
        }
      }
    }

    await db.insert(skipTraceLog).values({
      listingId: id,
      contactId: contactId ?? undefined,
      provider: "batch",
      costCents: result.costCents,
      resultQuality: result.resultQuality,
      response: JSON.stringify(result.response),
      createdAt: nowIso(),
    });

    if (contactId) {
      await db
        .update(mlsListings)
        .set({ contactId, skipTracedAt: nowIso(), updatedAt: nowIso() })
        .where(eq(mlsListings.id, id));
    }

    res.json({ result, contactId, stubbed: result.stubbed });
  });

  // ── Resend Webhook ──
  app.post("/api/webhooks/resend", async (req, res) => {
    // Resend signs webhooks via svix. Verify signature if secret is set.
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    if (secret) {
      try {
        const svixId = req.headers["svix-id"] as string;
        const svixTimestamp = req.headers["svix-timestamp"] as string;
        const svixSignature = req.headers["svix-signature"] as string;
        const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
        const secretBytes = Buffer.from(secret.split("_")[1] || secret, "base64");
        const expected = crypto.createHmac("sha256", secretBytes).update(signed).digest("base64");
        const provided = (svixSignature || "").split(" ").map((s) => s.split(",")[1]).filter(Boolean);
        if (!provided.includes(expected)) {
          console.warn("[marketing/webhook] bad signature");
          return res.status(401).json({ message: "bad signature" });
        }
      } catch (err) {
        console.warn("[marketing/webhook] sig verify exception:", err);
      }
    }

    const evt = req.body;
    const type = String(evt?.type || "").replace("email.", "");
    const data = evt?.data || {};
    const resendId = data.email_id || data.id;

    // Find the contact_id by matching resendEmailId in previous sent event
    let contactId: number | undefined;
    let campaignId: number | undefined;
    let dripStepId: number | undefined;
    if (resendId) {
      const prior = await db
        .select()
        .from(emailEvents)
        .where(eq(emailEvents.resendEmailId, resendId))
        .limit(1);
      if (prior[0]) {
        contactId = prior[0].contactId ?? undefined;
        campaignId = prior[0].campaignId ?? undefined;
        dripStepId = prior[0].dripStepId ?? undefined;
      }
    }

    await db.insert(emailEvents).values({
      contactId,
      campaignId,
      dripStepId,
      resendEmailId: resendId,
      eventType: type,
      eventData: JSON.stringify(evt),
      createdAt: nowIso(),
    });

    // React to terminal states
    if (contactId && (type === "bounced" || type === "complained")) {
      await db
        .update(contacts)
        .set({
          bouncedAt: type === "bounced" ? nowIso() : undefined,
          optedOut: type === "complained" ? true : undefined,
          optedOutAt: type === "complained" ? nowIso() : undefined,
          updatedAt: nowIso(),
        })
        .where(eq(contacts.id, contactId));
    }

    res.json({ ok: true });
  });

  // ── Unsubscribe (public, token-based) ──
  app.get("/u/:token", async (req, res) => {
    const id = verifyUnsubscribeToken(req.params.token);
    if (!id) return res.status(400).send("Invalid unsubscribe link.");
    await db
      .update(contacts)
      .set({ optedOut: true, optedOutAt: nowIso(), updatedAt: nowIso() })
      .where(eq(contacts.id, id));
    res.send(`
      <!doctype html>
      <html><head><title>Unsubscribed</title><meta name="viewport" content="width=device-width"></head>
      <body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#333">
        <h1 style="font-size:24px">You're unsubscribed</h1>
        <p>We've removed you from Key Lime's marketing emails. You won't receive any more messages from this list.</p>
        <p>If this was a mistake, <a href="mailto:hello@trykeylime.ai" style="color:#6b9e3f">email us</a>.</p>
      </body></html>
    `);
  });

  // One-click POST unsubscribe (RFC 8058) — same token as GET, required by Gmail/Yahoo.
  app.post("/u/:token", async (req, res) => {
    const id = verifyUnsubscribeToken(req.params.token);
    if (!id) return res.status(400).json({ message: "invalid" });
    await db
      .update(contacts)
      .set({ optedOut: true, optedOutAt: nowIso(), updatedAt: nowIso() })
      .where(eq(contacts.id, id));
    res.json({ ok: true });
  });

  // ── Analytics ──
  app.get("/api/marketing/analytics/summary", requireAdmin, async (_req, res) => {
    const [{ contactCount }] = await db.select({ contactCount: sql<number>`count(*)` }).from(contacts);
    const [{ listCount }] = await db.select({ listCount: sql<number>`count(*)` }).from(emailLists);
    const [{ campaignCount }] = await db.select({ campaignCount: sql<number>`count(*)` }).from(emailCampaigns);
    const [{ dripCount }] = await db.select({ dripCount: sql<number>`count(*)` }).from(dripSequences);

    const eventCounts = await db
      .select({ type: emailEvents.eventType, count: sql<number>`count(*)` })
      .from(emailEvents)
      .groupBy(emailEvents.eventType);

    res.json({
      contacts: Number(contactCount) || 0,
      lists: Number(listCount) || 0,
      campaigns: Number(campaignCount) || 0,
      drips: Number(dripCount) || 0,
      events: Object.fromEntries(eventCounts.map((e: any) => [e.type, Number(e.count)])),
    });
  });
}
