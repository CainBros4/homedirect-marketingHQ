import { storage } from "./storage";

// Meta Ad Library API — public, no auth required
const META_AD_LIBRARY_URL = "https://www.facebook.com/ads/library/api/";

export interface CompetitorBreakdown {
  competitor: string;
  adsFound: number;
  dominantHook: string;
  dominantOffer: string;
  ctaPattern: string;
  formats: string[];
  emotionalAngle: string;
}

export interface DigestResult {
  generatedAt: number;
  totalAdsFound: number;
  dataSource: "meta_api" | "fallback_positioning";
  competitorBreakdown: CompetitorBreakdown[];
  marketTrends: string[];
  topHooksInMarket: string[];
  gaps: string[];
  recommendedAngles: string[];
}

// ── Meta Ad Library fetch ────────────────────────────────────────────────────

async function fetchAdsForPage(pageName: string): Promise<any[]> {
  try {
    const url = `${META_AD_LIBRARY_URL}?fields=ad_data&ad_type=ALL&ad_active_status=ACTIVE&search_terms=${encodeURIComponent(pageName)}&limit=10&_reqName=ads_library`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketingHubBot/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[CompetitorMonitor] Meta API non-OK for ${pageName}: ${response.status}`);
      return [];
    }

    const text = await response.text();
    if (!text || text.trim().startsWith("<")) {
      // HTML response (login page) — API unavailable
      return [];
    }

    const data = JSON.parse(text);
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  } catch (err: any) {
    console.warn(`[CompetitorMonitor] Error fetching ads for ${pageName}:`, err.message);
    return [];
  }
}

// ── LLM helpers ──────────────────────────────────────────────────────────────

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",    defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
  deepseek:  { baseUrl: "https://api.deepseek.com",                 defaultModel: "deepseek-chat" },
  openai:    { baseUrl: "https://api.openai.com/v1",                defaultModel: "gpt-4o-mini" },
};

async function callLLM(systemPrompt: string, userPrompt: string, apiKey: string, baseUrl: string, model: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || null;
}

// ── Fallback: known positioning from ICP docs ────────────────────────────────

const KNOWN_POSITIONING = `
COMPETITOR KNOWN POSITIONING (sourced from brand research, not live ads):

Zillow:
- Dominant hook: "Find your next home" / "Zestimate tells you what it's worth"
- Offer: Free home search + Zestimate valuations
- CTA patterns: "Start searching", "See your Zestimate", "Connect with an agent"
- Formats: Image carousels of homes, video tours
- Emotional angle: Aspirational home ownership, data-backed confidence
- Key message: The largest home search portal; trusted authority on home values

Redfin:
- Dominant hook: "Pay less when you buy or sell" / "Agents who work for you"
- Offer: 1% listing fee, tech-forward search
- CTA patterns: "Tour with a Redfin agent", "List with Redfin", "Get a free home value"
- Formats: Map-based imagery, agent testimonials
- Emotional angle: Fairness/savings, tech-savvy consumer empowerment
- Key message: The lower-commission alternative — but still uses agents

Opendoor:
- Dominant hook: "Skip the showings. Sell directly." / "Get a cash offer in minutes"
- Offer: iBuying — instant cash offer, no repairs, no showings
- CTA patterns: "Get your offer", "Sell to Opendoor", "Skip the hassle"
- Formats: Before/after home imagery, simplicity messaging
- Emotional angle: Convenience, certainty, speed — "certainty vs. risk"
- Key message: Certainty over maximizing net proceeds

ForSaleByOwner.com:
- Dominant hook: "Sell your home yourself and save thousands"
- Offer: FSBO listing platform, MLS access for flat fee
- CTA patterns: "List your home", "Save the commission", "Get started free"
- Formats: Simple text-heavy ads, price-focused
- Emotional angle: DIY empowerment, skepticism of agents
- Key message: You can do it yourself and save — no AI/guided process

Houzeo:
- Dominant hook: "List on MLS for flat fee" / "90% of sellers save $10,000+"
- Offer: Technology-driven FSBO with MLS listing and forms automation
- CTA patterns: "Get listed now", "Compare plans", "Start selling"
- Formats: Comparison tables, trust badges, savings-focused
- Emotional angle: Financial savvy, modern FSBO
- Key message: Better than traditional FSBO — tech-enabled but still self-service
`;

// ── Main analysis function ────────────────────────────────────────────────────

async function analyzeAds(
  adsData: { competitor: string; ads: any[] }[],
  useFallback: boolean,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<DigestResult> {
  const totalAds = adsData.reduce((sum, c) => sum + c.ads.length, 0);
  const now = Date.now();

  const systemPrompt = `You are an expert competitive intelligence analyst and direct-response advertising strategist for HomeDirectAI — an AI-powered real estate platform in Tampa Bay, FL that charges only 1% commission (vs. industry 5-6%).

Your job: Analyze competitor ad data and identify patterns, gaps, and strategic opportunities for HomeDirectAI.

HomeDirectAI's unique position:
- Only 1% at closing (saves buyers ~$9,818, sellers ~$19,000 on a $430K home)
- AI handles negotiations, paperwork, docs — full service at 1% 
- Human "concierge" chaperones show homes on demand
- Post-NAR settlement timing: buyers/sellers are questioning commissions NOW
- Tampa Bay, FL market focus

Respond with ONLY valid JSON — no markdown, no explanation outside JSON.`;

  const userPrompt = useFallback
    ? `Based on the following known competitor positioning data (live Meta API data was unavailable), analyze the competitive landscape and generate strategic intelligence for HomeDirectAI.

${KNOWN_POSITIONING}

Return this exact JSON:
{
  "generatedAt": ${now},
  "totalAdsFound": 0,
  "dataSource": "fallback_positioning",
  "competitorBreakdown": [
    {
      "competitor": "string",
      "adsFound": 0,
      "dominantHook": "string",
      "dominantOffer": "string",
      "ctaPattern": "string",
      "formats": ["string"],
      "emotionalAngle": "string"
    }
  ],
  "marketTrends": ["trend1", "trend2", "trend3", "trend4"],
  "topHooksInMarket": ["hook1", "hook2", "hook3", "hook4", "hook5"],
  "gaps": ["gap/opportunity1", "gap/opportunity2", "gap/opportunity3"],
  "recommendedAngles": ["angle for HomeDirectAI to exploit1", "angle2", "angle3"]
}

Note: Generate 5 competitor entries (Zillow, Redfin, Opendoor, ForSaleByOwner.com, Houzeo).
The gaps and recommendedAngles should specifically call out what these competitors are NOT saying that HomeDirectAI can own.`
    : `Here is live competitor ad data pulled from Meta Ad Library:

${JSON.stringify(adsData, null, 2)}

Total ads collected: ${totalAds}

Analyze these ads and return this exact JSON:
{
  "generatedAt": ${now},
  "totalAdsFound": ${totalAds},
  "dataSource": "meta_api",
  "competitorBreakdown": [
    {
      "competitor": "string",
      "adsFound": number,
      "dominantHook": "string",
      "dominantOffer": "string",
      "ctaPattern": "string",
      "formats": ["string"],
      "emotionalAngle": "string"
    }
  ],
  "marketTrends": ["trend1", "trend2", "trend3", "trend4"],
  "topHooksInMarket": ["hook1", "hook2", "hook3", "hook4", "hook5"],
  "gaps": ["gap/opportunity1", "gap/opportunity2", "gap/opportunity3"],
  "recommendedAngles": ["angle for HomeDirectAI to exploit1", "angle2", "angle3"]
}`;

  const raw = await callLLM(systemPrompt, userPrompt, apiKey, baseUrl, model);
  if (!raw) throw new Error("LLM returned empty response");

  const cleaned = raw.replace(/```json\n?|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as DigestResult;
  return parsed;
}

// ── Env-based key resolution (mirrors routes.ts) ─────────────────────────────

function resolveApiKey(provider: string): string | undefined {
  const envMap: Record<string, string> = {
    together:  process.env.TOGETHER_API_KEY  || "",
    openai:    process.env.OPENAI_API_KEY    || "",
    deepseek:  process.env.DEEPSEEK_API_KEY  || "",
    fireworks: process.env.FIREWORKS_API_KEY || "",
  };
  return envMap[provider] || storage.getSetting("api_key")?.value || undefined;
}

// ── Main exported function ────────────────────────────────────────────────────

export async function runCompetitorMonitor(
  apiKey: string,
  provider: string,
  model: string
): Promise<DigestResult> {
  const competitorList = storage.getCompetitors();
  console.log(`[CompetitorMonitor] Running analysis for ${competitorList.length} competitors...`);

  // Try to fetch live ads from Meta Ad Library
  const adsData: { competitor: string; ads: any[] }[] = [];
  let totalLiveAds = 0;

  for (const comp of competitorList) {
    const ads = await fetchAdsForPage(comp.pageId);
    adsData.push({ competitor: comp.name, ads });
    totalLiveAds += ads.length;
    console.log(`[CompetitorMonitor] ${comp.name}: ${ads.length} ads fetched`);
  }

  const useFallback = totalLiveAds === 0;
  if (useFallback) {
    console.log("[CompetitorMonitor] No live ads retrieved — using fallback positioning analysis");
  }

  const resolvedKey = apiKey || resolveApiKey(provider) || "";
  const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
  const resolvedModel = model || defaultModel;

  const result = await analyzeAds(adsData, useFallback, resolvedKey, baseUrl, resolvedModel);

  // Save to DB
  storage.saveAdDigest({
    generatedAt: result.generatedAt || Date.now(),
    summary: JSON.stringify(result),
    rawAdsCount: totalLiveAds,
  });

  return result;
}
