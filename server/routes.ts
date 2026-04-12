import type { Express } from "express";
import type { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { runCompetitorMonitor } from "./competitor-monitor";
import { runFeedbackLoop, generateWeeklyFeedback } from "./feedback-loop";
import { startVideoJob } from "./video-generator";

// ── ICP Context (full brand + ICP data embedded) ──────────────────────────────

const ICP_CONTEXT: Record<string, string> = {
  buyer: `
TARGET: Home Buyers in Tampa Bay, FL
CORE OFFER: Buy a home for just 1% at closing. AI handles negotiations, paperwork, and everything through closing. Human chaperone shows homes on demand.

KEY PAIN POINTS:
- Buyer agents charge ~$9,818 on a median $430K Tampa home — paid by buyer via inflated offer price
- Post-NAR settlement, agents still average 5.44% combined — buyers have no real alternative yet
- Agents are incentivized to close fast, not optimally — buyers want transparency
- Paperwork designed to confuse; buyers want 24/7 access to status and docs

SAVINGS MESSAGE: On a $430,000 home, saves buyers approximately $9,818 vs. traditional buyer's agent.

BUYER PERSONAS:
1. Out-of-State Digital Relocator — moving from NY/CA/NJ to Tampa, research-forward, digital-first
2. Move-Up Millennial — owns a home, has equity, resents last commission, financially savvy (age 32–42, HHI $90K–$160K)
3. First-Time Tampa Buyer — budget-conscious, wants every dollar, fears the unknown

EMOTIONAL DRIVERS: Financial autonomy, feeling smart, transparency, cutting out the middleman
BRAND VOICE: "Alex" — knowledgeable friend, shows the math without condescension. No jargon. Direct. Lead with numbers.
COMPETITORS: Zillow, Redfin, Opendoor — none actually cut the commission, they just digitize the same model.
`,
  seller: `
TARGET: Home Sellers in Tampa Bay, FL
CORE OFFER: Sell your home for 1% at closing. Keep ~$19,000 more on a $430K sale. AI handles negotiations, docs, disclosures, title coordination. Chaperones show your home on demand.

KEY PAIN POINTS:
- Tampa average commission is 5.57% — on a $430K home that's ~$23,950 out of pocket
- Most sellers didn't know they were paying the buyer's agent too — until the 2024 NAR settlement
- Tampa inventory at 36% YoY high — sellers under pressure; "can't sell house" Google searches hit all-time high March 2026
- Agents incentivized to take any offer and close fast, not maximize seller net

SAVINGS MESSAGE: Sellers keep ~$19,000 more on a $430,000 sale vs. traditional 5% commission.

SELLER PERSONAS:
1. Commission-Awakened Seller — just learned about NAR settlement, righteous anger, ready to act now
2. Equity-Motivated Move-Up Millennial — bought 2019–2022, significant equity, won't give $20K to an agent
3. Accidental Landlord — tried to sell, couldn't, now renting, still wants out

EMOTIONAL DRIVERS: Righteous anger at commission structure, financial empowerment, "this is MY money", proving financial savvy
BRAND VOICE: "Alex" base + "Rebel" spike — names the injustice, offers the third option. The NAR settlement is the match. HomeDirectAI is the accelerant.
COMPETITORS: FSBO.com, Houzeo, Redfin. FSBO homes sell 15–29% less — this is NOT FSBO. AI negotiation closes the gap.
`,
  concierge: `
TARGET: Concierge / Home Showing Chaperones (Gig Worker Recruitment) — Tampa Bay, FL
CORE OFFER: Earn $20 per home showing. ~30 minutes. Use your Tampa neighborhood knowledge. Work your own schedule. No clients, no sales, no pressure.

KEY VALUE PROPOSITIONS:
- $20/showing = effective $40/hr rate — 2x what DoorDash pays in Tampa ($19–25/hr)
- No vehicle wear — show homes in your own neighborhood
- No sales pressure — open the door, facilitate the tour, report back. That's it.
- App-dispatched — same UX as DoorDash or Uber; accept what you want, skip what you don't
- Professional context — showing homes is more impressive than delivering food

CONCIERGE PERSONAS:
1. Current Gig Worker Upgrade — DoorDash/Uber/Instacart driver wanting better pay with less vehicle wear
2. Real Estate Aspirant — wants to break into real estate; this is the perfect low-risk entry point
3. Neighborhood Expert — retired, part-time, or stay-at-home parent with deep local knowledge; wants flexible supplemental income

EMOTIONAL DRIVERS: Pride in local knowledge, upgrading from delivery work, professional identity, flexible income
BRAND VOICE: HERO archetype — the concierge is the hero of their own story. HomeDirectAI is the tool that unlocks the opportunity.
COMP: DoorDash, Uber, TaskRabbit — same flexibility, double the hourly rate, no car abuse.
`,
};

async function callLLM(systemPrompt: string, userPrompt: string, apiKey: string, baseUrl: string, model: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2800,
      temperature: 0.75,
    }),
  });
  if (!res.ok) throw new Error(`LLM API error: ${res.status}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || null;
}

// ── Env-based key resolution ─────────────────────────────────────────────────
// API keys come from environment variables only — never stored in the database.
// Set them in .env locally or in Railway's environment variable store.
// Env var takes priority; falls back to DB-stored key (for Perplexity-hosted version)
function resolveApiKey(provider: string): string | undefined {
  const envMap: Record<string, string> = {
    together:  process.env.TOGETHER_API_KEY  || "",
    openai:    process.env.OPENAI_API_KEY    || "",
    deepseek:  process.env.DEEPSEEK_API_KEY  || "",
    fireworks: process.env.FIREWORKS_API_KEY || "",
  };
  return envMap[provider] || storage.getSetting("api_key")?.value || undefined;
}

// Resolve ElevenLabs / Pexels keys: env var first, then SQLite fallback
export function resolveServiceKey(name: "elevenlabs" | "pexels"): string | undefined {
  const envMap: Record<string, string> = {
    elevenlabs: process.env.ELEVENLABS_API_KEY || "",
    pexels:     process.env.PEXELS_API_KEY     || "",
  };
  return envMap[name] || storage.getSetting(`${name}_api_key`)?.value || undefined;
}

export async function registerRoutes(_httpServer: Server, app: Express) {

  // ── Settings ─────────────────────────────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const provider = storage.getSetting("provider")?.value || "together";
    const model    = storage.getSetting("model")?.value    || "";
    const apiKey   = resolveApiKey(provider);
    // Report which env vars are detected (without exposing the values)
    const envStatus = {
      TOGETHER_API_KEY:   !!process.env.TOGETHER_API_KEY,
      OPENAI_API_KEY:     !!process.env.OPENAI_API_KEY,
      DEEPSEEK_API_KEY:   !!process.env.DEEPSEEK_API_KEY,
      FIREWORKS_API_KEY:  !!process.env.FIREWORKS_API_KEY,
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
      PEXELS_API_KEY:     !!process.env.PEXELS_API_KEY,
    };
    const elevenlabsKey = process.env.ELEVENLABS_API_KEY || storage.getSetting("elevenlabs_api_key")?.value;
    const pexelsKey     = process.env.PEXELS_API_KEY     || storage.getSetting("pexels_api_key")?.value;
    res.json({
      hasKey: !!apiKey,
      hasElevenlabs: !!elevenlabsKey,
      hasPexels: !!pexelsKey,
      provider, model, envStatus
    });
  });

  app.post("/api/settings", (req, res) => {
    const { provider, model, apiKey } = req.body;
    if (provider !== undefined) storage.setSetting("provider", provider);
    if (model    !== undefined) storage.setSetting("model",    model);
    if (apiKey   !== undefined && apiKey !== "") storage.setSetting("api_key", apiKey);
    const { elevenlabsKey, pexelsKey } = req.body;
    if (elevenlabsKey !== undefined && elevenlabsKey !== "") storage.setSetting("elevenlabs_api_key", elevenlabsKey);
    if (pexelsKey     !== undefined && pexelsKey     !== "") storage.setSetting("pexels_api_key", pexelsKey);
    res.json({ ok: true });
  });

  // ── Copy Generation ───────────────────────────────────────────────────────────
  app.post("/api/generate-copy", async (req, res) => {
    const { icp, angle, context } = req.body;

    if (!icp || !["buyer", "seller", "concierge"].includes(icp)) {
      return res.status(400).json({ error: "icp must be buyer | seller | concierge" });
    }

    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }
    const modelSetting = storage.getSetting("model");

    const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
      together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",     defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
      deepseek:  { baseUrl: "https://api.deepseek.com",                  defaultModel: "deepseek-chat" },
      openai:    { baseUrl: "https://api.openai.com/v1",                 defaultModel: "gpt-4o-mini" },
    };

    const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
    const model = modelSetting?.value || defaultModel;
    const apiKeySetting = { value: apiKey };

    const systemPrompt = `You are an expert direct-response advertising copywriter for HomeDirectAI, an AI-powered real estate platform in Tampa Bay, FL.

BRAND VOICE RULES:
- Voice: "Alex" — knowledgeable friend who shows the math, never a salesperson
- Lead with specific numbers ($19,000 beats "significant savings")
- No jargon. No corporate speak. No exclamation points.
- Be direct, specific, human. Acknowledge skepticism.
- For sellers: righteous anger tone ("You paid their agent too and nobody told you")
- For concierges: hero/pride narrative ("Your Tampa knowledge pays $20 every door you open")
- Never use: "game-changer", "revolutionary", "seamless", "innovative", "cutting-edge", "disrupting"

${ICP_CONTEXT[icp]}
${angle && angle !== "all" ? `FOCUS ANGLE: ${angle.toUpperCase()} — weight all copy toward this emotional angle` : ""}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

    const userPrompt = `Generate a complete set of ad copy. Return this exact JSON structure:
{
  "headlines": ["8 punchy headlines, under 9 words each, lead with numbers where possible"],
  "hooks": [
    {"angle":"pain","hook":"1-2 sentence hook opening with the pain point"},
    {"angle":"savings","hook":"1-2 sentence hook leading with the dollar savings"},
    {"angle":"curiosity","hook":"1-2 sentence hook that opens a loop"},
    {"angle":"social_proof","hook":"1-2 sentence hook using market data"},
    {"angle":"urgency","hook":"1-2 sentence hook creating time/market urgency"}
  ],
  "bodyVariants": [
    "Variant A (100-130 words): Pain → Agitate → Solution",
    "Variant B (80-100 words): Lead with savings math, then explain how",
    "Variant C (60-80 words): Short punchy narrative, strong CTA setup"
  ],
  "videoScript30": "[HOOK] ... [PROBLEM] ... [SOLUTION] ... [CTA] — 30-second UGC-style, conversational, no teleprompter feel",
  "videoScript60": "[HOOK] ... [STORY] ... [SOLUTION] ... [CTA] — 60-second UGC with a specific Tampa local detail",
  "socialCaptions": [
    "IG/FB storytelling format, ends with CTA",
    "Question-led, conversational",
    "TikTok: hook-first, 3-5 punchy lines",
    "LinkedIn: professional, data-led",
    "UGC-style: sounds like a real person sharing their experience"
  ],
  "emailSubject": "Under 50 chars, high open-rate style",
  "emailPreview": "80-90 chars, deepens the subject line",
  "ctaVariants": ["6 CTA button texts, under 5 words each"],
  "objectionHandlers": ["3 one-liner responses to the top objections — direct, not defensive"]
}`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, apiKeySetting.value, baseUrl, model);
      if (!raw) return res.status(503).json({ error: "LLM returned empty response" });

      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Save to history
      storage.saveGeneration({
        icp,
        angle: angle || null,
        context: context || null,
        result: JSON.stringify(parsed),
        createdAt: Date.now(),
      });

      res.json(parsed);
    } catch (err: any) {
      console.error("[Copy Gen] Error:", err.message);
      res.status(500).json({ error: err.message || "Generation failed" });
    }
  });

  // ── Brief Generation ─────────────────────────────────────────────────────────
  app.post("/api/generate-brief", async (req, res) => {
    const { icp, format, copyInput } = req.body;

    if (!icp || !["buyer", "seller", "concierge"].includes(icp)) {
      return res.status(400).json({ error: "icp must be buyer | seller | concierge" });
    }
    if (!format || !["carousel", "reel", "static", "all"].includes(format)) {
      return res.status(400).json({ error: "format must be carousel | reel | static | all" });
    }
    if (!copyInput) {
      return res.status(400).json({ error: "copyInput is required" });
    }

    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }
    const modelSetting = storage.getSetting("model");

    const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
      together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",     defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
      deepseek:  { baseUrl: "https://api.deepseek.com",                  defaultModel: "deepseek-chat" },
      openai:    { baseUrl: "https://api.openai.com/v1",                 defaultModel: "gpt-4o-mini" },
    };

    const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
    const model = modelSetting?.value || defaultModel;

    const systemPrompt = `You are a creative director and production specialist for HomeDirectAI, an AI-powered real estate platform in Tampa Bay, FL.

BRAND DESIGN SYSTEM:
- Colors: Dark Slate Midnight (#0D1B2A) background, Forest Signal green (#00C47A) primary accent, Electric Teal (#00D4FF) secondary accent
- Typography: Manrope Bold for headlines, Manrope Regular for body text
- Tone: Direct, confident, data-forward. Real-person voice. No jargon.
- Visual style: Dark, premium, high-contrast. Green/teal CTAs on dark backgrounds.

${ICP_CONTEXT[icp]}

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON. Ensure all JSON strings are properly escaped.`;

    const formatsRequested = format === "all" ? ["carousel", "reel", "static"] : [format];

    const copyContext = typeof copyInput === "string" ? copyInput : JSON.stringify(copyInput, null, 2);

    const carouselPrompt = `
Generate a 5-slide carousel creative brief using this copy input:
${copyContext}

Return ONLY this JSON (no other text):
{
  "carousel": {
    "slideCount": 5,
    "slides": [
      {"slideNumber": 1, "role": "Hook", "headline": "...", "bodyText": "...", "visualDirection": "...", "textOverlay": "..."},
      {"slideNumber": 2, "role": "Problem", "headline": "...", "bodyText": "...", "visualDirection": "...", "textOverlay": "..."},
      {"slideNumber": 3, "role": "Proof", "headline": "...", "bodyText": "...", "visualDirection": "...", "textOverlay": "..."},
      {"slideNumber": 4, "role": "Solution", "headline": "...", "bodyText": "...", "visualDirection": "...", "textOverlay": "..."},
      {"slideNumber": 5, "role": "CTA", "headline": "...", "bodyText": "...", "visualDirection": "...", "textOverlay": "..."}
    ],
    "dimensions": "1080x1080px",
    "fontRecommendation": "Manrope Bold for headlines, Manrope Regular for body",
    "colorDirection": "Dark slate background (#0D1B2A), Forest Signal green (#00C47A) accents",
    "musicMood": null
  }
}`;

    const reelPrompt = `
Generate a 30-second Reel/Video creative brief using this copy input:
${copyContext}

Return ONLY this JSON (no other text):
{
  "reel": {
    "duration": "30s",
    "hook": "...",
    "scenes": [
      {"timestamp": "0-3s", "visual": "...", "voiceover": "...", "textOverlay": "...", "action": "..."},
      {"timestamp": "3-10s", "visual": "...", "voiceover": "...", "textOverlay": "...", "action": "..."},
      {"timestamp": "10-20s", "visual": "...", "voiceover": "...", "textOverlay": "...", "action": "..."},
      {"timestamp": "20-27s", "visual": "...", "voiceover": "...", "textOverlay": "...", "action": "..."},
      {"timestamp": "27-30s", "visual": "CTA screen with green button", "voiceover": "...", "textOverlay": "...", "action": "Cut to brand end card"}
    ],
    "musicMood": "Upbeat, confident, modern — no lyrics",
    "captionStyle": "Bold white text, bottom third, 3-5 words per line",
    "dimensions": "1080x1920px (9:16)"
  }
}`;

    const staticPrompt = `
Generate a static ad creative brief using this copy input:
${copyContext}

Return ONLY this JSON (no other text):
{
  "static": {
    "dimensions": "1200x628px (Facebook/Meta feed)",
    "heroHeadline": "...",
    "subheadline": "...",
    "visualDirection": "...",
    "ctaButton": "...",
    "colorScheme": "Dark slate bg, green CTA button",
    "copyPlacement": "Headline top-left, visual right 60%, CTA bottom-right",
    "variants": [
      {"name": "Variant A", "headline": "...", "visual": "..."},
      {"name": "Variant B", "headline": "...", "visual": "..."}
    ]
  }
}`;

    try {
      const results: Record<string, any> = {};

      // Call LLM for each requested format
      for (const fmt of formatsRequested) {
        let prompt = "";
        if (fmt === "carousel") prompt = carouselPrompt;
        else if (fmt === "reel") prompt = reelPrompt;
        else if (fmt === "static") prompt = staticPrompt;

        const raw = await callLLM(systemPrompt, prompt, apiKey, baseUrl, model);
        if (!raw) throw new Error(`LLM returned empty response for ${fmt}`);

        const cleaned = raw.replace(/```json\n?|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        Object.assign(results, parsed);
      }

      // Save to history using context field to distinguish brief type
      storage.saveGeneration({
        icp,
        angle: `brief:${format}`,
        context: `type=brief format=${format}`,
        result: JSON.stringify(results),
        createdAt: Date.now(),
      });

      res.json(results);
    } catch (err: any) {
      console.error("[Brief Gen] Error:", err.message);
      res.status(500).json({ error: err.message || "Brief generation failed" });
    }
  });

  // ── Competitor Monitor ──────────────────────────────────────────────────────

  // List tracked competitors
  app.get("/api/competitor-monitor/competitors", (_req, res) => {
    try {
      const comps = storage.getCompetitors();
      res.json(comps);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // List recent digests
  app.get("/api/competitor-monitor/digests", (_req, res) => {
    try {
      const digests = storage.getAdDigests(20);
      res.json(digests.map(d => ({
        id: d.id,
        generatedAt: d.generatedAt,
        rawAdsCount: d.rawAdsCount,
        summary: JSON.parse(d.summary),
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger a new analysis
  app.post("/api/competitor-monitor/run", async (_req, res) => {
    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }
    const model = storage.getSetting("model")?.value || "";
    try {
      const result = await runCompetitorMonitor(apiKey, provider, model);
      res.json(result);
    } catch (err: any) {
      console.error("[Competitor Monitor] Error:", err.message);
      res.status(500).json({ error: err.message || "Analysis failed" });
    }
  });

  // ── Campaigns ─────────────────────────────────────────────────────────────────
  app.get("/api/campaigns", (_req, res) => {
    try {
      const list = storage.getCampaigns();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns", (req, res) => {
    const { name, icp, platform, status, startDate, budget } = req.body;
    if (!name || !icp || !platform) {
      return res.status(400).json({ error: "name, icp, and platform are required" });
    }
    try {
      const campaign = storage.createCampaign({
        name,
        icp,
        platform,
        status: status || "active",
        startDate: startDate || null,
        budget: budget || null,
        createdAt: Date.now(),
      });
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/campaigns/:id", (req, res) => {
    const id = Number(req.params.id);
    try {
      const updated = storage.updateCampaign(id, req.body);
      if (!updated) return res.status(404).json({ error: "Campaign not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Performance Records ───────────────────────────────────────────────────────
  app.get("/api/performance/summary", (_req, res) => {
    try {
      const summary = storage.getPerformanceSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/performance", (req, res) => {
    try {
      const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const records = storage.getAdPerformance(campaignId, limit);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/performance", (req, res) => {
    const { campaignId, adName, format, icp, hook, impressions, clicks, leads, spend, date, notes } = req.body;
    if (!campaignId || !adName || !format || !icp || date === undefined) {
      return res.status(400).json({ error: "campaignId, adName, format, icp, and date are required" });
    }
    try {
      const record = storage.addAdPerformance({
        campaignId: Number(campaignId),
        adName,
        format,
        icp,
        hook: hook || null,
        impressions: Number(impressions) || 0,
        clicks: Number(clicks) || 0,
        leads: Number(leads) || 0,
        spend: Number(spend) || 0,
        date: Number(date),
        notes: notes || null,
      });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/performance/:id", (req, res) => {
    try {
      storage.deleteAdPerformance(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/performance/analyze", async (_req, res) => {
    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }

    const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
      together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",     defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
      deepseek:  { baseUrl: "https://api.deepseek.com",                  defaultModel: "deepseek-chat" },
      openai:    { baseUrl: "https://api.openai.com/v1",                 defaultModel: "gpt-4o-mini" },
    };
    const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
    const model = storage.getSetting("model")?.value || defaultModel;

    const records = storage.getAdPerformance();
    const campaigns_list = storage.getCampaigns();
    const summary = storage.getPerformanceSummary();

    if (records.length === 0) {
      return res.status(400).json({ error: "No performance data to analyze. Add some records first." });
    }

    const dataContext = JSON.stringify({
      summary: {
        totalSpend: `$${(summary.totalSpend / 100).toFixed(2)}`,
        totalLeads: summary.totalLeads,
        avgCTR: `${summary.avgCTR.toFixed(2)}%`,
        avgCPL: `$${(summary.avgCPL / 100).toFixed(2)}`,
      },
      campaigns: campaigns_list.map(c => ({ id: c.id, name: c.name, icp: c.icp, platform: c.platform })),
      performanceRecords: records.map(r => ({
        id: r.id,
        campaignId: r.campaignId,
        adName: r.adName,
        format: r.format,
        icp: r.icp,
        hook: r.hook,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.leads,
        spendDollars: `$${(r.spend / 100).toFixed(2)}`,
        ctr: r.impressions > 0 ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : "0%",
        cpl: r.leads > 0 ? `$${(r.spend / r.leads / 100).toFixed(2)}` : "N/A",
      })),
    }, null, 2);

    const systemPrompt = `You are a performance marketing analyst for HomeDirectAI, a real estate platform in Tampa Bay, FL. 
Analyze ad performance data and provide actionable insights. Be specific and data-driven.
Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

    const userPrompt = `Analyze this ad performance data and return insights:
${dataContext}

Return exactly this JSON structure:
{
  "winners": [
    {"adName": "...", "metric": "CTR or CPL", "value": "...", "insight": "why it's winning"}
  ],
  "losers": [
    {"adName": "...", "metric": "CTR or CPL", "value": "...", "insight": "why it's underperforming"}
  ],
  "patterns": [
    "Pattern 1: ...",
    "Pattern 2: ...",
    "Pattern 3: ..."
  ],
  "recommendations": [
    "1. Specific action to take next week",
    "2. Specific action to take next week",
    "3. Specific action to take next week"
  ],
  "generatedAt": ${Date.now()}
}`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, apiKey, baseUrl, model);
      if (!raw) return res.status(503).json({ error: "LLM returned empty response" });
      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      parsed.generatedAt = parsed.generatedAt || Date.now();
      res.json(parsed);
    } catch (err: any) {
      console.error("[Performance Analyze] Error:", err.message);
      res.status(500).json({ error: err.message || "Analysis failed" });
    }
  });

  // ── Assets ────────────────────────────────────────────────────────────────────
  // Stats must be registered before /:id to avoid route conflict
  app.get("/api/assets/stats", (_req, res) => {
    try {
      const stats = storage.getAssetStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets", (req, res) => {
    try {
      const { icp, format, status, platform } = req.query as Record<string, string>;
      const filters: Record<string, string> = {};
      if (icp)      filters.icp = icp;
      if (format)   filters.format = format;
      if (status)   filters.status = status;
      if (platform) filters.platform = platform;
      const list = storage.getAssets(Object.keys(filters).length ? filters : undefined);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/assets", (req, res) => {
    try {
      const now = Date.now();
      const asset = storage.createAsset({
        ...req.body,
        status: req.body.status || "draft",
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json(asset);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/assets/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = storage.updateAsset(id, { ...req.body, updatedAt: Date.now() });
      if (!updated) return res.status(404).json({ error: "Asset not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/assets/:id", (req, res) => {
    try {
      storage.deleteAsset(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Feedback Loop ──────────────────────────────────────────────────────────

  // Trigger weekly feedback loop manually
  app.post("/api/feedback/run", async (_req, res) => {
    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }
    const model = storage.getSetting("model")?.value || "";
    try {
      const report = await generateWeeklyFeedback(apiKey, provider, model);
      // Save to database
      storage.saveFeedbackReport({
        generatedAt: report.generatedAt,
        weekOf: report.weekOf,
        summary: JSON.stringify(report),
        newBriefsCount: report.newBriefs?.length || 0,
        status: "new",
      });
      res.json(report);
    } catch (err: any) {
      console.error("[Feedback Loop] Error:", err.message);
      res.status(500).json({ error: err.message || "Feedback generation failed" });
    }
  });

  // List past reports
  app.get("/api/feedback/reports", (_req, res) => {
    try {
      const reports = storage.getFeedbackReports(20);
      res.json(reports.map(r => ({
        ...r,
        summary: JSON.parse(r.summary),
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific report
  app.get("/api/feedback/reports/:id", (req, res) => {
    try {
      const reports = storage.getFeedbackReports(100);
      const report = reports.find(r => r.id === Number(req.params.id));
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json({ ...report, summary: JSON.parse(report.summary) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update report status
  app.patch("/api/feedback/reports/:id", (req, res) => {
    try {
      const updated = storage.updateFeedbackReport(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Report not found" });
      res.json({ ...updated, summary: JSON.parse(updated.summary) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Publish Queue ─────────────────────────────────────────────────────────────

  // Get queue stats
  app.get("/api/publish-queue/stats", (_req, res) => {
    try {
      res.json(storage.getQueueStats());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send to Buffer (stub)
  app.post("/api/publish-queue/send-to-buffer", (_req, res) => {
    const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
    if (!bufferToken) {
      return res.json({
        status: "buffer_not_connected",
        message: "Add BUFFER_ACCESS_TOKEN to your environment to enable auto-publishing",
      });
    }
    // Future: integrate with Buffer API
    res.json({ status: "connected", message: "Buffer integration ready" });
  });

  // List queue items
  app.get("/api/publish-queue", (req, res) => {
    try {
      const { platform, status, icp } = req.query as Record<string, string>;
      const items = storage.getPublishQueue({ platform, status, icp });
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add to queue
  app.post("/api/publish-queue", (req, res) => {
    try {
      const data = req.body;
      if (!data.platform || !data.contentType || !data.caption || !data.icp) {
        return res.status(400).json({ error: "platform, contentType, caption, and icp are required" });
      }
      const item = storage.addToPublishQueue({ ...data, createdAt: Date.now() });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update queue item
  app.patch("/api/publish-queue/:id", (req, res) => {
    try {
      const updated = storage.updateQueueItem(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Queue item not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete queue item
  app.delete("/api/publish-queue/:id", (req, res) => {
    try {
      storage.deleteQueueItem(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── History ───────────────────────────────────────────────────────────────────
  app.get("/api/history", (_req, res) => {
    const gens = storage.getGenerations(20);
    res.json(gens.map(g => ({
      id: g.id,
      icp: g.icp,
      angle: g.angle,
      context: g.context,
      createdAt: g.createdAt,
      result: JSON.parse(g.result),
    })));
  });

  app.delete("/api/history/:id", (req, res) => {
    storage.deleteGeneration(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Video Generator ───────────────────────────────────────────────────────────

  app.post("/api/video/generate", async (req, res) => {
    const elevenKey = process.env.ELEVENLABS_API_KEY || storage.getSetting("elevenlabs_api_key")?.value;
    const pexelsKey = process.env.PEXELS_API_KEY || storage.getSetting("pexels_api_key")?.value;
    if (!elevenKey || !pexelsKey) {
      return res.status(503).json({
        error: "Missing ELEVENLABS_API_KEY or PEXELS_API_KEY environment variables",
      });
    }

    const {
      script,
      hookText,
      ctaText,
      voiceId,
      aspectRatio,
      searchTerms,
      icp,
    } = req.body;

    if (!script || !script.trim()) {
      return res.status(400).json({ error: "script is required" });
    }

    try {
      const jobId = await startVideoJob({
        script: script.trim(),
        hookText: hookText || null,
        ctaText: ctaText || null,
        voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM",
        aspectRatio: aspectRatio || "9:16",
        searchTerms: Array.isArray(searchTerms) ? searchTerms.join(",") : (searchTerms || null),
        icp: icp || null,
        status: "pending",
        outputPath: null,
        audioDuration: null,
        errorMessage: null,
        createdAt: Date.now(),
        completedAt: null,
      });
      res.json({ jobId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to start video job" });
    }
  });

  app.get("/api/video/jobs", (_req, res) => {
    try {
      const jobs = storage.getVideoJobs(20);
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/video/jobs/:id", (req, res) => {
    try {
      const job = storage.getVideoJob(Number(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/video/jobs/:id/download", (req, res) => {
    try {
      const job = storage.getVideoJob(Number(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.status !== "done" || !job.outputPath) {
        return res.status(400).json({ error: "Video not ready" });
      }
      const absPath = path.isAbsolute(job.outputPath)
        ? job.outputPath
        : path.resolve(job.outputPath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ error: "Video file not found on disk" });
      }
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'attachment; filename="homedirectai-reel.mp4"');
      res.sendFile(absPath);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/video/jobs/:id", (req, res) => {
    try {
      const job = storage.getVideoJob(Number(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      // Delete output file if it exists
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        try { fs.unlinkSync(job.outputPath); } catch (_) {}
      }
      storage.deleteVideoJob(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Pipeline buffer — passes data between tools ───────────────────────────────
  app.post("/api/pipeline/set-script", (req, res) => {
    const { script, icp } = req.body;
    if (script) {
      storage.setSetting("pipeline_script", script);
      storage.setSetting("pipeline_icp", icp || "seller");
    }
    res.json({ ok: true });
  });

  app.get("/api/pipeline/get-script", (req, res) => {
    const script = storage.getSetting("pipeline_script");
    const icp    = storage.getSetting("pipeline_icp");
    if (script?.value) {
      // Clear after reading (one-time use)
      storage.setSetting("pipeline_script", "");
      res.json({ script: script.value, icp: icp?.value || "seller" });
    } else {
      res.json({ script: null, icp: null });
    }
  });
}
