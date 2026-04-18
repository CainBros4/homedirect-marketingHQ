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

const DEFAULT_BRAND_VOICE = `You are writing for Key Lime, a real-estate platform that helps homeowners sell without a traditional agent. Brand voice: direct, plainspoken, empathetic, zero realtor-speak, zero hype. Key Lime saves sellers the 3% listing commission (~$18,000 on a $600K home). The physical address for CAN-SPAM compliance is Key Lime, Tampa FL.`;

export async function generateEmailTemplate(args: GenerateTemplateArgs): Promise<GeneratedTemplate> {
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const variablesHint = args.variables?.length
    ? `Allowed template variables (use {{name}} syntax): ${args.variables.join(", ")}.`
    : "Do not use template variables unless explicitly listed.";

  const systemPrompt = `${args.brandVoice || DEFAULT_BRAND_VOICE}

You produce marketing email templates. Rules:
- Subject line: under 55 characters, specific, no emojis, no ALL CAPS, no "!!!"
- Preheader: 70-110 characters, extends the subject, answers "why should I open this"
- Body: 120-200 words, scannable, one clear CTA, one link max per email
- Every email MUST include an unsubscribe footer with {{unsubscribe_url}}
- Every email MUST include a physical address footer ("Key Lime, Tampa FL")
- Never make claims about specific savings amounts — use ranges or "up to"
- Tone: ${args.tone || "direct, warm, consultative"}
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

  const systemPrompt = `${args.brandVoice || DEFAULT_BRAND_VOICE}

You design multi-email drip sequences. Each sequence has a clear narrative arc:
- Step 1: Acknowledge their situation, establish relevance, no ask
- Middle steps: Build trust with specifics, proof, or useful info (no ask or soft ask)
- Final step: Clear CTA with reason to act now

Each email must stand alone (recipient may have skipped prior emails). Each email must include {{unsubscribe_url}} and "Key Lime, Tampa FL" address footer. Subjects under 55 chars, bodies 120-200 words.

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
