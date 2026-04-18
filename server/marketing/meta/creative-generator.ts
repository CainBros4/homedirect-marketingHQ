// Meta (Facebook + Instagram) ad creative generator.
//
// Two steps: Claude generates ad copy + a DALL-E 3 image prompt, then DALL-E
// produces the actual image. Image URL is returned as-is from OpenAI — it's
// a pre-signed URL valid for ~2 hours. For durable storage we'd re-host to
// R2/S3 post-generation; TBD once we're sending volume.
//
// HOUSING SAC (Special Ad Category) compliance is baked into the prompts:
//   - Visual must not imply age, gender, race, family status, disability, etc.
//   - Copy must not mention demographic preferences or restrictions.
//   - Focus on the product + lifestyle signals (homes, keys, hands, warm light,
//     Tampa-palette colors) — never specific people identifiable by protected
//     class.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const defaultClaudeModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const claude = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

const ICP_HUB_URL = process.env.ICP_HUB_URL || "https://icp-hub-production.up.railway.app";
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedPromptPack: { text: string; expiresAt: number } | null = null;

async function getBrandPromptPack(): Promise<string> {
  const now = Date.now();
  if (cachedPromptPack && cachedPromptPack.expiresAt > now) return cachedPromptPack.text;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${ICP_HUB_URL}/brand/prompt-pack`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    cachedPromptPack = { text, expiresAt: now + CACHE_TTL_MS };
    return text;
  } catch {
    return "BRAND: Key Lime — Tampa Bay real-estate platform. 1% closing fee. Voice: confident inevitability.";
  }
}

export interface GenerateAdArgs {
  icp: "buyer" | "seller" | "general";
  brief: string; // what the ad should accomplish
  audienceNote?: string;
  objective?: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_AWARENESS";
  landingUrl?: string;
  aspectRatio?: "1:1" | "4:5" | "9:16";
  variantCount?: number; // how many copy variants to propose; default 3
  skipImage?: boolean; // generate copy only (saves money when iterating)
}

export interface GeneratedCopyVariant {
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: "LEARN_MORE" | "SIGN_UP" | "GET_OFFER" | "APPLY_NOW";
  imagePrompt: string; // prompt for DALL-E to render
  rationale: string;
}

export interface GeneratedAdCreative {
  variants: GeneratedCopyVariant[];
}

export interface GeneratedImage {
  imageUrl: string;
  imagePrompt: string;
  costCents: number;
}

export function isClaudeConfigured(): boolean { return !!claude; }
export function isOpenAiConfigured(): boolean { return !!openai; }

// ── Copy generation (Claude) ──

export async function generateAdCopy(args: GenerateAdArgs): Promise<GeneratedAdCreative> {
  if (!claude) throw new Error("ANTHROPIC_API_KEY not set");

  const brand = await getBrandPromptPack();
  const variantCount = Math.min(Math.max(args.variantCount ?? 3, 1), 5);
  const objective = args.objective ?? "OUTCOME_TRAFFIC";
  const landingUrl = args.landingUrl || "https://www.trykeylime.ai";

  const systemPrompt = `${brand}

=== META AD COPY TASK ===
You produce Facebook + Instagram ad copy for Key Lime. The ad will be placed in Meta's HOUSING Special Ad Category (mandatory for all real-estate-adjacent ads in the US), which means:
- Copy CANNOT mention or imply any protected demographic: age, gender, race, religion, national origin, family status, disability, marital status.
- Copy CANNOT say "perfect for families" or "great for retirees" or similar demographic framing.
- Copy CAN focus on: the product, the math (1% vs 6%), the outcome ("keep the difference"), geographic relevance ("Tampa Bay"), and inclusive "you" framing.

CONSTRAINTS (Meta limits):
- primaryText: ~125 characters (hard max 2200 but first 125 is what users see). First sentence must hook.
- headline: ≤40 characters. Where the CTA earns the click.
- description: ≤30 characters. Optional secondary line under the headline.
- ctaButton: pick the best of LEARN_MORE | SIGN_UP | GET_OFFER | APPLY_NOW for the ${objective} objective.

ICP: ${args.icp}
OBJECTIVE: ${objective} (${objective === "OUTCOME_LEADS" ? "drive form fills" : objective === "OUTCOME_TRAFFIC" ? "drive clicks to trykeylime.ai" : objective === "OUTCOME_ENGAGEMENT" ? "drive post engagement" : "drive awareness"})
LANDING: ${landingUrl}

VOICE reminder: confident inevitability. Outlaw framing (the system is broken, here's the math), Magician proof (here's the tool that makes it irrelevant), Everyperson tone (anyone can do this). Use "your advisor" — never "AI" / "algorithm" / "robot". Never "FSBO" / "cheap" / "discount" / "easy" / "cut out the middleman".

IMAGE PROMPT rules:
- Static image, 1:1 or 4:5 or 9:16 aspect. Key Lime brand palette: Graham Crust brown (#3E2C1C), Cream (#FFF8ED), Key Lime green (#A8C856), Savings Gold (#E8A317 for money contexts only).
- Show: warm Tampa light, real (un-stock) homes, neighborhoods, keys, hands with keys, living spaces, phone screens, coastal/suburban vibe, plants.
- NEVER show: specific identifiable people (Housing SAC), children (age compliance), corporate handshakes, SOLD signs, luxury mansions, sterile empty interiors, agents in suits.
- Photography style: natural light, documentary feel, shallow depth of field. NOT stock photography, NOT AI-generated-looking.

Generate ${variantCount} distinct copy variants. Each must angle differently (e.g., savings-math, outcome-emotion, curiosity-hook). Return ONLY JSON:

{
  "variants": [
    {
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "ctaButton": "LEARN_MORE",
      "imagePrompt": "Detailed visual prompt for DALL-E 3. Include composition, lighting, color palette, subject, mood. No specific people.",
      "rationale": "One sentence on why this angle works for this ICP + objective."
    }
  ]
}`;

  const userPrompt = `BRIEF: ${args.brief}
${args.audienceNote ? `AUDIENCE NOTE (internal, not targeting): ${args.audienceNote}` : ""}

Generate the ${variantCount} copy variants now. Return only JSON, no preamble.`;

  const response = await claude.messages.create({
    model: defaultClaudeModel,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse JSON: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);
  const variants = (parsed.variants || []) as GeneratedCopyVariant[];
  return { variants: variants.map(normalizeCopyVariant) };
}

function normalizeCopyVariant(v: GeneratedCopyVariant): GeneratedCopyVariant {
  const validCta = ["LEARN_MORE", "SIGN_UP", "GET_OFFER", "APPLY_NOW"];
  return {
    primaryText: String(v.primaryText || "").slice(0, 2200),
    headline: String(v.headline || "").slice(0, 40),
    description: String(v.description || "").slice(0, 30),
    ctaButton: (validCta.includes(v.ctaButton) ? v.ctaButton : "LEARN_MORE") as GeneratedCopyVariant["ctaButton"],
    imagePrompt: String(v.imagePrompt || "").slice(0, 1500),
    rationale: String(v.rationale || "").slice(0, 400),
  };
}

// ── Image generation (DALL-E 3) ──

export async function generateImage(
  prompt: string,
  aspectRatio: "1:1" | "4:5" | "9:16" = "1:1",
): Promise<GeneratedImage> {
  if (!openai) throw new Error("OPENAI_API_KEY not set");

  // DALL-E 3 supports: 1024x1024, 1024x1792 (9:16-ish), 1792x1024 (16:9).
  // For 4:5 we approximate with 1024x1792 then note the aspect mismatch.
  const size: "1024x1024" | "1024x1792" | "1792x1024" =
    aspectRatio === "9:16" || aspectRatio === "4:5" ? "1024x1792" : "1024x1024";

  // Pre-prepend Housing-SAC-safe guardrails + Key Lime visual identity.
  const safePrompt = `${prompt}

NON-NEGOTIABLE CONSTRAINTS:
- NO specific identifiable people (no faces). Hands, silhouettes, back-of-head OK.
- NO children.
- Authentic photographic style, NOT illustration, NOT CGI-looking.
- Color palette hints: warm cream background (#FFF8ED), Graham Crust brown tones (#3E2C1C) in shadows, Key Lime green (#A8C856) as an accent only (one small prop, plant, or garment).
- Natural Tampa Bay light (warm, golden-hour, or bright overcast). Documentary style.
- Shallow depth of field. Real textures.`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: safePrompt,
    n: 1,
    size,
    quality: "standard",
    style: "natural",
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error("DALL-E returned no image URL");

  // Approximate cost: standard 1024x1024 = $0.040, 1024x1792 = $0.080.
  const costCents = size === "1024x1024" ? 4 : 8;

  return {
    imageUrl,
    imagePrompt: safePrompt,
    costCents,
  };
}
