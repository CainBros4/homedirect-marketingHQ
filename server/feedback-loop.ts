import { storage } from "./storage";

export interface FeedbackReport {
  weekOf: string;
  performanceSummary: {
    totalSpend: number;
    totalLeads: number;
    avgCTR: number;
    avgCPL: number;
  };
  winners: Array<{ adName: string; hook: string; ctr: number; cpl: number; why: string }>;
  losers: Array<{ adName: string; hook: string; ctr: number; cpl: number; why: string }>;
  patterns: string[];
  newBriefs: Array<{
    icp: string;
    format: string;
    angle: string;
    recommendedHook: string;
    rationale: string;
  }>;
  competitorContext: string;
  generatedAt: number;
}

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",     defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
  deepseek:  { baseUrl: "https://api.deepseek.com",                  defaultModel: "deepseek-chat" },
  openai:    { baseUrl: "https://api.openai.com/v1",                 defaultModel: "gpt-4o-mini" },
};

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<string | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 3500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || null;
}

function getWeekOf(): string {
  const now = new Date();
  // Get the most recent Monday
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function generateWeeklyFeedback(
  apiKey: string,
  provider: string,
  model: string
): Promise<FeedbackReport> {
  const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
  const resolvedModel = model || defaultModel;

  // 1. Gather data
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allPerformance = storage.getAdPerformance(undefined, 500);
  const recentPerformance = allPerformance.filter(r => r.date >= sevenDaysAgo);

  const latestDigests = storage.getAdDigests(3);
  const competitorSummary = latestDigests.length > 0
    ? latestDigests.map(d => {
        try { return JSON.stringify(JSON.parse(d.summary), null, 2); }
        catch { return d.summary; }
      }).join("\n\n---\n\n")
    : "No competitor data available yet.";

  const hasPerformanceData = recentPerformance.length > 0;
  const weekOf = getWeekOf();

  // 2. Build performance context
  let performanceContext = "";
  if (hasPerformanceData) {
    const totalSpend = recentPerformance.reduce((s, r) => s + r.spend, 0);
    const totalLeads = recentPerformance.reduce((s, r) => s + r.leads, 0);
    const totalClicks = recentPerformance.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = recentPerformance.reduce((s, r) => s + r.impressions, 0);
    const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";
    const avgCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(0) : "0";

    performanceContext = `
LAST 7 DAYS PERFORMANCE DATA (${recentPerformance.length} ad records):
Total Spend: $${(totalSpend / 100).toFixed(2)}
Total Leads: ${totalLeads}
Total Clicks: ${totalClicks}
Total Impressions: ${totalImpressions}
Avg CTR: ${avgCTR}%
Avg CPL: $${(Number(avgCPL) / 100).toFixed(2)}

Individual Ad Records:
${recentPerformance.slice(0, 30).map(r => {
  const ctr = r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(2) : "0";
  const cpl = r.leads > 0 ? (r.spend / r.leads / 100).toFixed(2) : "N/A";
  return `- ${r.adName} | ICP: ${r.icp} | Format: ${r.format} | Hook: ${r.hook || "N/A"} | CTR: ${ctr}% | CPL: $${cpl} | Leads: ${r.leads} | Spend: $${(r.spend/100).toFixed(2)}`;
}).join("\n")}`;
  } else {
    performanceContext = "NO PERFORMANCE DATA YET — This is a pre-launch recommendations report based on ICP profiles and competitor intelligence only.";
  }

  // 3. Craft the LLM prompt
  const systemPrompt = `You are a senior performance marketing analyst for HomeDirectAI, an AI-powered real estate platform in Tampa Bay, FL.

HomeDirectAI serves three ICPs:
- buyer: Home buyers who save ~$9,818 on a $430K home using 1% buyer agent fee model
- seller: Home sellers who keep ~$19,000 more vs. traditional 5% commission
- concierge: Gig workers who earn $20/showing (~$40/hr) as home showing chaperones

Your job: analyze ad performance data and competitor context, then generate actionable weekly intelligence including new creative brief recommendations.

IMPORTANT: Respond with valid JSON only. No markdown fences, no explanation outside the JSON.`;

  const userPrompt = `Generate a weekly feedback intelligence report for the week of ${weekOf}.

${performanceContext}

LATEST COMPETITOR INTELLIGENCE:
${competitorSummary}

${hasPerformanceData ? "" : "Since there is no performance data yet, base your winners/losers/patterns on industry benchmarks and ICP profiles. Label this clearly in the patterns section."}

Return ONLY this exact JSON structure (no other text):
{
  "weekOf": "${weekOf}",
  "performanceSummary": {
    "totalSpend": <number in cents, 0 if no data>,
    "totalLeads": <number>,
    "avgCTR": <number as percentage e.g. 2.34>,
    "avgCPL": <number in cents>
  },
  "winners": [
    {
      "adName": "<ad name or 'N/A — no data'>",
      "hook": "<hook text or recommended hook>",
      "ctr": <number>,
      "cpl": <number in cents>,
      "why": "<explanation of why this worked or benchmark rationale>"
    }
  ],
  "losers": [
    {
      "adName": "<ad name or 'N/A — no data'>",
      "hook": "<hook text>",
      "ctr": <number>,
      "cpl": <number in cents>,
      "why": "<explanation of why this underperformed or risk to avoid>"
    }
  ],
  "patterns": [
    "<pattern 1 — specific and actionable>",
    "<pattern 2>",
    "<pattern 3>"
  ],
  "newBriefs": [
    {
      "icp": "buyer|seller|concierge",
      "format": "carousel|reel|static|story",
      "angle": "pain|savings|curiosity|social_proof|urgency",
      "recommendedHook": "<specific hook text ready to use>",
      "rationale": "<why this brief is recommended this week>"
    },
    {
      "icp": "buyer|seller|concierge",
      "format": "carousel|reel|static|story",
      "angle": "pain|savings|curiosity|social_proof|urgency",
      "recommendedHook": "<specific hook text ready to use>",
      "rationale": "<why this brief is recommended this week>"
    },
    {
      "icp": "buyer|seller|concierge",
      "format": "carousel|reel|static|story",
      "angle": "pain|savings|curiosity|social_proof|urgency",
      "recommendedHook": "<specific hook text ready to use>",
      "rationale": "<why this brief is recommended this week>"
    },
    {
      "icp": "buyer|seller|concierge",
      "format": "carousel|reel|static|story",
      "angle": "pain|savings|curiosity|social_proof|urgency",
      "recommendedHook": "<specific hook text ready to use>",
      "rationale": "<why this brief is recommended this week>"
    },
    {
      "icp": "buyer|seller|concierge",
      "format": "carousel|reel|static|story",
      "angle": "pain|savings|curiosity|social_proof|urgency",
      "recommendedHook": "<specific hook text ready to use>",
      "rationale": "<why this brief is recommended this week>"
    }
  ],
  "competitorContext": "<2-3 sentence summary of what competitors are doing that's relevant to our strategy this week>",
  "generatedAt": ${Date.now()}
}`;

  const raw = await callLLM(systemPrompt, userPrompt, apiKey, baseUrl, resolvedModel);
  if (!raw) throw new Error("LLM returned empty response");

  const cleaned = raw.replace(/```json\n?|```/g, "").trim();
  const report = JSON.parse(cleaned) as FeedbackReport;

  return report;
}

export async function runFeedbackLoop(): Promise<FeedbackReport | null> {
  const provider = storage.getSetting("provider")?.value || "together";
  const model = storage.getSetting("model")?.value || "";

  // Resolve API key from env
  const envMap: Record<string, string> = {
    together:  process.env.TOGETHER_API_KEY  || "",
    openai:    process.env.OPENAI_API_KEY    || "",
    deepseek:  process.env.DEEPSEEK_API_KEY  || "",
    fireworks: process.env.FIREWORKS_API_KEY || "",
  };
  const apiKey = envMap[provider] || storage.getSetting("api_key")?.value || "";

  if (!apiKey) {
    console.error("[FeedbackLoop] No API key configured.");
    return null;
  }

  try {
    console.log("[FeedbackLoop] Generating weekly feedback report...");
    const report = await generateWeeklyFeedback(apiKey, provider, model);

    // Persist to database
    storage.saveFeedbackReport({
      generatedAt: report.generatedAt,
      weekOf: report.weekOf,
      summary: JSON.stringify(report),
      newBriefsCount: report.newBriefs?.length || 0,
      status: "new",
    });

    console.log(`[FeedbackLoop] Report saved for week of ${report.weekOf}`);
    return report;
  } catch (err: any) {
    console.error("[FeedbackLoop] Error:", err.message);
    return null;
  }
}
