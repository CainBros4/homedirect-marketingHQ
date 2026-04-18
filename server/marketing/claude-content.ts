// Claude-powered marketing content generation.
//
// Generates email subjects, preheaders, bodies, and drip sequences from a
// campaign brief. Uses claude-sonnet-4-6 (or override via ANTHROPIC_MODEL).
// Separate from server/ai-engine.ts (Mixtral) — the existing advisor stays on
// Mixtral; only Marketing HQ talks to Claude because Mixtral can't produce
// structured JSON output or long-form copy reliably.

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const defaultModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const client = apiKey ? new Anthropic({ apiKey }) : null;

// ICP hub exposes /brand/prompt-pack — a compact text spec designed to be
// injected into AI prompts (voice, archetypes, dos/don'ts, guardrails).
// Cached for 10 minutes; falls back to a minimal embedded voice prompt if
// icp-hub is unreachable.
const ICP_HUB_URL = process.env.ICP_HUB_URL || "https://icp-hub-production.up.railway.app";
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedPromptPack: { text: string; expiresAt: number } | null = null;

async function getBrandPromptPack(): Promise<string> {
  const now = Date.now();
  if (cachedPromptPack && cachedPromptPack.expiresAt > now) return cachedPromptPack.text;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ICP_HUB_URL}/brand/prompt-pack`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 100) throw new Error("prompt-pack too short");
    cachedPromptPack = { text, expiresAt: now + CACHE_TTL_MS };
    console.log(`[marketing/claude] loaded brand prompt-pack (${text.length} chars) from ${ICP_HUB_URL}`);
    return text;
  } catch (err: any) {
    console.warn(`[marketing/claude] ICP hub fetch failed, using embedded fallback:`, err?.message);
    return EMBEDDED_FALLBACK_BRAND_VOICE;
  }
}

export function isClaudeConfigured(): boolean {
  return !!client;
}

export interface GenerateTemplateArgs {
  brief: string; // what the email should accomplish
  audience: string; // who it's going to (e.g. "cancelled MLS Tampa seller")
  tone?: string; // e.g. "warm, consultative, not salesy"
  variables?: string[]; // list of {{var}} placeholders allowed
  brandVoice?: string; // optional brand voice snippet
}

export interface GeneratedTemplate {
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  rationale: string;
}

// Fallback used if the icp-hub prompt-pack is unreachable. Brief by design —
// the real voice spec is the live /brand/prompt-pack endpoint.
const EMBEDDED_FALLBACK_BRAND_VOICE = `=== KEY LIME BRAND CONTEXT (fallback) ===
You are writing for Key Lime, a Tampa Bay real-estate platform that replaces the 6% agent commission model with a 1% closing fee.
Voice: confident inevitability — Outlaw positioning (the system is broken), Magician product (here's the tool that makes it irrelevant), Everyperson tone (anyone can use this).
USE: your advisor, 1% closing fee, see the math, own your transaction, sell smarter not cheaper.
AVOID: AI/algorithm/robot (call it "your advisor"), cheap, discount, disrupting, FSBO, no agent needed, cut out the middleman, easy (undermines perceived thoroughness).
Physical address for CAN-SPAM: Key Lime · Tampa, FL.
=== END FALLBACK ===`;

export async function generateEmailTemplate(args: GenerateTemplateArgs): Promise<GeneratedTemplate> {
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const variablesHint = args.variables?.length
    ? `Allowed template variables (use {{name}} syntax): ${args.variables.join(", ")}.`
    : "Do not use template variables unless explicitly listed.";

  const brandVoice = args.brandVoice || await getBrandPromptPack();

  const systemPrompt = `${brandVoice}

=== EMAIL TEMPLATE TASK ===
You produce marketing email templates that follow the brand context above exactly.

Rules:
- Subject line: under 55 characters, specific, no emojis, no ALL CAPS, no "!!!"
- Preheader: 70-110 characters, extends the subject, answers "why should I open this"
- Body: 120-200 words, scannable, one clear CTA, one link max per email
- Every email MUST include an unsubscribe footer with {{unsubscribe_url}}
- Every email MUST include the physical address "Key Lime · Tampa, FL"
- Never make claims about specific savings dollars — use ranges or "up to"
- Respect the brand AVOID list above (never "AI"/"algorithm"/"robot"/"FSBO"/"cheap"/"discount"/"easy" etc)
- Respect the brand USE list above (prefer "your advisor", "see the math", "1% closing fee")
- Tone: ${args.tone || "confident inevitability — warm Everyperson voice, Outlaw framing, Magician proof"}
- ${variablesHint}

Return ONLY valid JSON with this exact shape:
{
  "subject": "...",
  "preheader": "...",
  "htmlBody": "<!-- simple html --><p>...</p>...",
  "textBody": "plain text version",
  "rationale": "one sentence on why this email will convert"
}`;

  const userPrompt = `Audience: ${args.audience}

Brief: ${args.brief}

Generate the email template now. Return ONLY JSON, no preamble.`;

  const response = await client.messages.create({
    model: defaultModel,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from Claude response: ${raw.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    subject: String(parsed.subject || ""),
    preheader: String(parsed.preheader || ""),
    htmlBody: String(parsed.htmlBody || ""),
    textBody: String(parsed.textBody || ""),
    rationale: String(parsed.rationale || ""),
  };
}

export interface GenerateDripArgs {
  goal: string; // overall sequence goal
  audience: string;
  stepCount: number; // usually 3-7
  cadenceDays: number[]; // delay in days between each step; length === stepCount
  tone?: string;
  brandVoice?: string;
}

export interface GeneratedDripStep {
  stepOrder: number;
  delayHours: number;
  template: GeneratedTemplate;
}

export async function generateDripSequence(args: GenerateDripArgs): Promise<GeneratedDripStep[]> {
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");
  if (args.cadenceDays.length !== args.stepCount) {
    throw new Error(`cadenceDays length (${args.cadenceDays.length}) must equal stepCount (${args.stepCount})`);
  }

  const brandVoice = args.brandVoice || await getBrandPromptPack();

  const systemPrompt = `${brandVoice}

=== DRIP SEQUENCE TASK ===
You design multi-email drip sequences that follow the brand context above exactly.

Arc:
- Step 1: Acknowledge their situation, establish relevance, no ask
- Middle steps: Build trust with specifics, proof, or useful info (no ask or soft ask)
- Final step: Clear CTA with reason to act now

For SELLER audiences, follow the seller sequence: Mature Outlaw → Caregiver → Concrete Magician → Sovereign.
For BUYER audiences, follow the buyer sequence: Outlaw (feel) → Magician (think) → Everyperson (act).

Each email must stand alone (recipient may have skipped prior emails). Each email must include {{unsubscribe_url}} and the address "Key Lime · Tampa, FL" in its footer. Subjects under 55 chars, bodies 120-200 words. Respect the brand AVOID list above strictly (no "AI"/"algorithm"/"robot"/"FSBO"/"discount"/"easy"/etc — call it "your advisor", "see the math", "1% closing fee").

Return ONLY valid JSON matching this shape:
{
  "steps": [
    {
      "stepOrder": 1,
      "summary": "what this email does",
      "subject": "...",
      "preheader": "...",
      "htmlBody": "<p>...</p>",
      "textBody": "plain text"
    }
  ]
}`;

  const cadenceDescription = args.cadenceDays
    .map((d, i) => `Step ${i + 1}: ${d === 0 ? "sent immediately on enrollment" : `${d} day${d === 1 ? "" : "s"} after prior step`}`)
    .join("\n");

  const userPrompt = `Audience: ${args.audience}
Goal: ${args.goal}
Number of steps: ${args.stepCount}
Cadence:
${cadenceDescription}
Tone: ${args.tone || "direct, warm, consultative"}

Design the full sequence now. Return ONLY JSON, no preamble.`;

  const response = await client.messages.create({
    model: defaultModel,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse JSON: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);

  const steps: GeneratedDripStep[] = (parsed.steps || []).map((s: any, i: number) => ({
    stepOrder: i + 1,
    delayHours: (args.cadenceDays[i] || 0) * 24,
    template: {
      subject: String(s.subject || ""),
      preheader: String(s.preheader || ""),
      htmlBody: String(s.htmlBody || ""),
      textBody: String(s.textBody || ""),
      rationale: String(s.summary || ""),
    },
  }));

  return steps;
}
