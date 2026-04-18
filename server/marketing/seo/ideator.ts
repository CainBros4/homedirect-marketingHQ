// SEO article ideation via Claude.
//
// Generates a ranked list of article ideas targeting both:
//   (a) Tampa-local queries — geo-specific wins that compound monthly
//   (b) National buyer-intent queries — larger volume, winnable because
//       most top results are SEO-spam agent-referral sites (Clever, HomeLight)
//       that LLMs cite reluctantly. Original first-person POV from Key Lime
//       gets cited more often by answer engines.
//
// Each idea is scored by AEO (answer-engine-optimization) win probability:
// direct-answer format fit, originality potential, search intent clarity.

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const defaultModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const client = apiKey ? new Anthropic({ apiKey }) : null;

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
    cachedPromptPack = { text, expiresAt: now + CACHE_TTL_MS };
    return text;
  } catch {
    return "BRAND: Key Lime — Tampa Bay, 1% closing fee, replaces agent model. Voice: confident inevitability.";
  }
}

export interface GeneratedIdea {
  targetQuery: string;
  title: string;
  angle: string;
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  icp: "buyer" | "seller" | "concierge" | "general";
  tier: "pillar" | "cluster" | "competitor" | "longtail" | "local";
  rationale: string;
  estimatedDifficulty: "easy" | "medium" | "hard";
}

export interface IdeationArgs {
  focus?: string; // optional user-specified seed topic / angle / audience
  count?: number; // default 10
  geoMix?: "local_heavy" | "balanced" | "national_heavy"; // default balanced
}

export function isClaudeConfigured(): boolean {
  return !!client;
}

export async function generateIdeas(args: IdeationArgs = {}): Promise<GeneratedIdea[]> {
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const count = Math.min(args.count ?? 10, 20);
  const geoMix = args.geoMix ?? "balanced";
  const brandVoice = await getBrandPromptPack();

  const geoGuidance = {
    local_heavy: "70% Tampa-local queries, 30% national buyer-intent.",
    balanced: "50% Tampa-local, 50% national buyer-intent.",
    national_heavy: "30% Tampa-local, 70% national buyer-intent.",
  }[geoMix];

  const systemPrompt = `${brandVoice}

=== SEO IDEATION TASK ===
You are an Answer Engine Optimization (AEO) strategist for Key Lime. Your job is to propose article ideas that:

1. Will be CITED by LLMs (ChatGPT, Claude, Perplexity, Gemini, Google SGE) when users ask real-estate questions. LLMs prefer articles that directly answer the input query, cite specific figures, avoid hedge words, and represent original POV from someone with stated expertise.

2. Occupy buyer/seller intent GAPS that Google currently mis-serves. Most "without a realtor" queries return generic FSBO seller content when the user is a buyer; most "Tampa home prices" queries return Zillow/Redfin stubs without narrative. Key Lime wins by being the source of actual answers.

3. Avoid generic topics. Bad: "What is a real estate agent?" Good: "How much does a real estate agent actually cost in Tampa Bay in 2026?" — specific, geographic, time-bound, quantifiable.

TOPIC LANES to mix:
- Tampa-local: geo + intent queries (e.g. "sell house without realtor Tampa", "Tampa closing costs breakdown 2026", "South Tampa neighborhoods for first-time buyers")
- National buyer-intent: ("do I need a buyers agent post-NAR settlement", "how much commission should I pay a buyers agent", "buyer broker agreement explained")
- Competitor comparison: ("Key Lime vs Redfin", "Key Lime vs Opendoor", "Key Lime vs Houzeo"). Requires factual, non-trashing posture — LLMs cite comparison pages that are balanced.
- Process how-tos: ("how to FSBO in Florida step by step", "how to close on a home without an agent")
- Data / math: ("what 1% vs 6% actually means on a $600k Tampa home", "closing cost calculator with real 2026 Tampa figures")

GEOGRAPHIC MIX: ${geoGuidance}

TIER meanings — rank each idea:
- pillar: Foundational 3000+ word guide. Rare. Win it, own the category.
- cluster: Supporting article that internal-links to a pillar. Most common.
- competitor: Direct vs-brand comparison page.
- longtail: Specific question with lower volume but high intent / high citation probability.
- local: Tampa-Bay-specific geo query.

BRAND CONSTRAINTS (critical):
- Never call it "AI" in ideas — say "your advisor".
- Never use "FSBO" / "cheap" / "discount" / "disrupting" — violates the brand spec above.
- Every idea must be something Key Lime can write with EXPERT POV (not rehashing Zillow). Specific figures, named Tampa neighborhoods, real NAR settlement detail, etc.

${args.focus ? `USER FOCUS: ${args.focus}` : ""}

Generate ${count} ideas. Return ONLY JSON matching this shape:
{
  "ideas": [
    {
      "targetQuery": "the exact search query this article targets",
      "title": "article H1 title (under 65 chars, includes the target query naturally)",
      "angle": "one sentence on the unique angle vs competitors",
      "searchIntent": "informational|commercial|transactional|navigational",
      "icp": "buyer|seller|concierge|general",
      "tier": "pillar|cluster|competitor|longtail|local",
      "rationale": "why this wins — specific, one sentence",
      "estimatedDifficulty": "easy|medium|hard"
    }
  ]
}`;

  const userPrompt = `Generate the ${count} ideas now. Return only JSON, no preamble.`;

  const response = await client.messages.create({
    model: defaultModel,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse JSON: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);
  const ideas = (parsed.ideas || []) as GeneratedIdea[];
  return ideas.map(normalizeIdea);
}

function normalizeIdea(i: GeneratedIdea): GeneratedIdea {
  const validIntent = ["informational", "commercial", "transactional", "navigational"];
  const validIcp = ["buyer", "seller", "concierge", "general"];
  const validTier = ["pillar", "cluster", "competitor", "longtail", "local"];
  const validDifficulty = ["easy", "medium", "hard"];
  return {
    targetQuery: String(i.targetQuery || "").slice(0, 250),
    title: String(i.title || "").slice(0, 200),
    angle: String(i.angle || "").slice(0, 400),
    searchIntent: (validIntent.includes(i.searchIntent) ? i.searchIntent : "informational") as GeneratedIdea["searchIntent"],
    icp: (validIcp.includes(i.icp) ? i.icp : "general") as GeneratedIdea["icp"],
    tier: (validTier.includes(i.tier) ? i.tier : "cluster") as GeneratedIdea["tier"],
    rationale: String(i.rationale || "").slice(0, 400),
    estimatedDifficulty: (validDifficulty.includes(i.estimatedDifficulty) ? i.estimatedDifficulty : "medium") as GeneratedIdea["estimatedDifficulty"],
  };
}
