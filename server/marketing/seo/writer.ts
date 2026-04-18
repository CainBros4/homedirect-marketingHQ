// Long-form AEO article writer.
//
// Takes an approved idea, produces a full article with:
//   - H1 + meta description + direct-answer lead (TL;DR)
//   - Scannable body with H2/H3 headings, bullet lists, data tables
//   - FAQ section — also emitted as FAQPage schema.org JSON-LD
//   - Article schema.org JSON-LD (Article type, author, datePublished, etc.)
//   - Internal linking hooks (we post-process to real URLs later)
//   - Brand voice enforced via icp-hub prompt-pack
//
// Output is both HTML (ready to serve) and markdown (for edit-ability later).

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const defaultModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const client = apiKey ? new Anthropic({ apiKey }) : null;

const ICP_HUB_URL = process.env.ICP_HUB_URL || "https://icp-hub-production.up.railway.app";
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedPromptPack: { text: string; expiresAt: number } | null = null;
const APP_BASE_URL = process.env.APP_BASE_URL || "https://www.trykeylime.ai";
const PUBLIC_AUTHOR = "Key Lime Editorial";

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

export interface ArticleIdeaShape {
  targetQuery: string;
  title: string;
  angle: string | null;
  icp: string | null;
  searchIntent: string | null;
  tier: string | null;
}

export interface GeneratedArticle {
  slug: string;
  title: string;
  metaDescription: string;
  bodyHtml: string;
  bodyMarkdown: string;
  faqs: Array<{ q: string; a: string }>;
  structuredData: Record<string, any>;
  wordCount: number;
  readingMinutes: number;
  tags: string[];
}

export function isClaudeConfigured(): boolean {
  return !!client;
}

export async function writeArticle(idea: ArticleIdeaShape): Promise<GeneratedArticle> {
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const brandVoice = await getBrandPromptPack();

  const systemPrompt = `${brandVoice}

=== ARTICLE WRITING TASK (AEO / SEO) ===
You write long-form articles optimized for BOTH Google organic ranking AND LLM citation (ChatGPT, Claude, Perplexity, Gemini, Google SGE).

STRUCTURE — REQUIRED:
1. H1 — exactly matches the article title
2. Direct-answer lead — 60-120 word TL;DR in a styled callout div. Answers the target query in the first 3 sentences. Includes the specific number / date / figure the reader wants.
3. Table of contents — auto-generated from H2s below (render as ordered list with anchor links).
4. Body — 1200-2500 words. H2 per major point. H3 for sub-points. Use lists, comparison tables, and short paragraphs. Cite official sources where real (NAR, HUD, Florida statute, ALTA). Use "your advisor" for Key Lime — never "AI".
5. FAQ section — 4-6 real questions people ask about this topic. Each answer 30-80 words. These get emitted as FAQPage JSON-LD so LLMs + Google surface them directly.
6. Takeaway / next-step block — one paragraph nudging toward a Key Lime action (book a showing, try the savings calculator, etc.) without being salesy.
7. Author byline + "last updated" date (caller will inject the date, but leave a placeholder).

HTML OUTPUT RULES:
- Clean semantic HTML: <article>, <h1>, <h2>, <p>, <ul>, <ol>, <table>, <thead>, <tbody>, <th>, <td>, <blockquote>, <strong>, <em>, <code>, <a>.
- No <script>, no inline styles except for the TL;DR callout which uses <div class="tldr">.
- Internal links use placeholder anchors like <a href="#tbd-savings-calculator">...</a> — we post-process these later. Do not invent fake URLs.
- External links only when citing official sources. Use real URLs.
- Every comparison table must have <thead> and concrete data.

MARKDOWN OUTPUT: parallel to HTML, same structure, for edit-ability.

BRAND VOICE ENFORCEMENT:
- Confident inevitability. Outlaw framing (system is broken), Magician proof (here's the math), Everyperson tone (anyone can do this).
- "your advisor" — never AI/algorithm/robot/automated.
- Never "FSBO" as a virtue; Key Lime is NOT FSBO.
- Never "cheap" / "discount" / "easy". Prefer "see the math", "1% closing fee", "own your transaction".
- Show real numbers. "$19,200 saved on a $640K sale at 3% vs 1%" — not "save thousands".

Return ONLY valid JSON matching exactly this shape:
{
  "slug": "lowercase-kebab-case-slug",
  "metaDescription": "155-char meta description optimized for the target query",
  "bodyHtml": "<article>...</article>",
  "bodyMarkdown": "# Title\\n\\n...",
  "faqs": [{"q": "...", "a": "..."}, ...],
  "tags": ["tampa-bay", "buyer-guide", ...]
}
Do not wrap JSON in markdown code fences. Do not include any preamble.`;

  const userPrompt = `TARGET QUERY: ${idea.targetQuery}
TITLE: ${idea.title}
ANGLE: ${idea.angle || "(no angle provided)"}
ICP: ${idea.icp || "general"}
INTENT: ${idea.searchIntent || "informational"}
TIER: ${idea.tier || "cluster"}

Write the full article now. Return only JSON.`;

  const response = await client.messages.create({
    model: defaultModel,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse JSON: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);

  const slug = slugify(parsed.slug || idea.title);
  const bodyHtml = String(parsed.bodyHtml || "").trim();
  const bodyMarkdown = String(parsed.bodyMarkdown || "").trim();
  const faqs = Array.isArray(parsed.faqs)
    ? parsed.faqs.map((f: any) => ({ q: String(f.q || ""), a: String(f.a || "") }))
    : [];
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];

  const wordCount = bodyMarkdown.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  const structuredData = buildStructuredData({
    title: idea.title,
    slug,
    metaDescription: String(parsed.metaDescription || "").slice(0, 200),
    faqs,
    wordCount,
  });

  return {
    slug,
    title: idea.title,
    metaDescription: String(parsed.metaDescription || "").slice(0, 200),
    bodyHtml,
    bodyMarkdown,
    faqs,
    structuredData,
    wordCount,
    readingMinutes,
    tags,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || `article-${Date.now()}`;
}

function buildStructuredData(args: {
  title: string;
  slug: string;
  metaDescription: string;
  faqs: Array<{ q: string; a: string }>;
  wordCount: number;
}): Record<string, any> {
  const url = `${APP_BASE_URL}/guides/${args.slug}`;
  const now = new Date().toISOString();
  const article: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: args.title,
    description: args.metaDescription,
    author: {
      "@type": "Organization",
      name: PUBLIC_AUTHOR,
    },
    publisher: {
      "@type": "Organization",
      name: "Key Lime",
      url: APP_BASE_URL,
    },
    datePublished: now,
    dateModified: now,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    wordCount: args.wordCount,
  };
  if (args.faqs.length === 0) return article;
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: args.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  // Return as @graph so both schemas live in one JSON-LD block.
  return {
    "@context": "https://schema.org",
    "@graph": [article, faqPage],
  };
}
