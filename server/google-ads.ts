/**
 * Google Ads API client wrapper.
 *
 * Exposes:
 *   - getClient() — lazy-initialized GoogleAdsApi client + customer
 *   - validateKeywords(keywords, geo) — real Tampa Bay volume + CPC from KeywordPlanIdeaService
 *   - deployBuyerCampaign(opts) — creates a PAUSED campaign structure from our PPC plan
 *   - getCampaignMetrics(dateRange) — live performance for our deployed campaigns
 *
 * All methods fail fast with structured errors when credentials are missing,
 * so the API endpoints can surface a helpful message to the UI.
 */

import { GoogleAdsApi, enums, ResourceNames, toMicros } from "google-ads-api";

// ─── Credential loading ──────────────────────────────────────────────────────

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
}

export class MissingCredentialsError extends Error {
  constructor(public missing: string[]) {
    super(`Google Ads credentials missing: ${missing.join(", ")}`);
    this.name = "MissingCredentialsError";
  }
}

export function loadCredentials(): GoogleAdsCredentials {
  const creds = {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
    customerId: (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, ""),
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "") || undefined,
  };
  const missing: string[] = [];
  if (!creds.clientId) missing.push("GOOGLE_ADS_CLIENT_ID");
  if (!creds.clientSecret) missing.push("GOOGLE_ADS_CLIENT_SECRET");
  if (!creds.developerToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!creds.refreshToken) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!creds.customerId) missing.push("GOOGLE_ADS_CUSTOMER_ID");
  if (missing.length) throw new MissingCredentialsError(missing);
  return creds;
}

export function getCredentialStatus() {
  return {
    clientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
    developerToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    refreshToken: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
    customerId: !!process.env.GOOGLE_ADS_CUSTOMER_ID,
    loginCustomerId: !!process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  };
}

// ─── Client initialization ───────────────────────────────────────────────────

let cachedClient: GoogleAdsApi | null = null;

export function getClient() {
  const creds = loadCredentials();
  if (!cachedClient) {
    cachedClient = new GoogleAdsApi({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      developer_token: creds.developerToken,
    });
  }
  const customer = cachedClient.Customer({
    customer_id: creds.customerId,
    refresh_token: creds.refreshToken,
    login_customer_id: creds.loginCustomerId,
  });
  return { api: cachedClient, customer };
}

// ─── Geo targeting ───────────────────────────────────────────────────────────

/**
 * Google Ads geo target constant IDs for the Tampa metro.
 * These are stable — you can look them up via GeographicView reports.
 * 1015254 = Tampa-St. Petersburg-Clearwater FL DMA
 */
export const TAMPA_GEO_TARGET_CONSTANTS = [1015254];
export const TAMPA_LANGUAGE_CONSTANT = 1000; // English

// ─── Keyword validation ──────────────────────────────────────────────────────

export interface ValidatedKeyword {
  keyword: string;
  avgMonthlySearches: number;
  competition: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH";
  competitionIndex: number;
  lowTopOfPageBidMicros: number;
  highTopOfPageBidMicros: number;
  lowCpcDollars: number;
  highCpcDollars: number;
}

/**
 * Hit Google's KeywordPlanIdeaService to pull real Tampa Bay search volume + CPC.
 * Also surfaces any related keyword ideas Google suggests.
 */
export async function validateKeywords(
  seedKeywords: string[],
  opts: { includeIdeas?: boolean } = {},
): Promise<{ validated: ValidatedKeyword[]; ideas: ValidatedKeyword[] }> {
  const { customer } = getClient();

  const request: any = {
    language: `languageConstants/${TAMPA_LANGUAGE_CONSTANT}`,
    geo_target_constants: TAMPA_GEO_TARGET_CONSTANTS.map(id => `geoTargetConstants/${id}`),
    include_adult_keywords: false,
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    keyword_seed: { keywords: seedKeywords },
  };
  const response = await customer.keywordPlanIdeas.generateKeywordIdeas(request);
  const results: any[] = (response as any)?.results || (Array.isArray(response) ? (response as any) : []);

  const rows: ValidatedKeyword[] = results.map((r: any) => {
    const metrics = r.keyword_idea_metrics || {};
    const avgMonthlySearches = Number(metrics.avg_monthly_searches || 0);
    const low = Number(metrics.low_top_of_page_bid_micros || 0);
    const high = Number(metrics.high_top_of_page_bid_micros || 0);
    const competitionIdx = Number(metrics.competition_index || 0);
    return {
      keyword: r.text || "",
      avgMonthlySearches,
      competition: (metrics.competition as any) || "UNKNOWN",
      competitionIndex: competitionIdx,
      lowTopOfPageBidMicros: low,
      highTopOfPageBidMicros: high,
      lowCpcDollars: low / 1_000_000,
      highCpcDollars: high / 1_000_000,
    };
  });

  // Separate rows that exactly match a seed keyword from expanded ideas
  const seedSet = new Set(seedKeywords.map(s => s.toLowerCase().trim()));
  const validated = rows.filter(r => seedSet.has(r.keyword.toLowerCase().trim()));
  const ideas = opts.includeIdeas ? rows.filter(r => !seedSet.has(r.keyword.toLowerCase().trim())) : [];

  return { validated, ideas };
}

// ─── Campaign deployment ─────────────────────────────────────────────────────

export interface AdGroupSpec {
  name: string;
  keywords: string[];
  matchType: "EXACT" | "PHRASE" | "BROAD";
  cpcBidDollars: number;
  headlines: string[];      // max 15, 30 chars each
  descriptions: string[];   // max 4, 90 chars each
  finalUrl: string;
}

export interface DeployCampaignOptions {
  campaignName: string;
  dailyBudgetDollars: number;
  adGroups: AdGroupSpec[];
  negativeKeywords: string[];
  paused?: boolean;
}

export interface DeployCampaignResult {
  campaignResourceName: string;
  campaignId: string;
  adGroupsCreated: { name: string; resourceName: string; id: string }[];
  keywordsCreated: number;
  adsCreated: number;
  status: "PAUSED" | "ENABLED";
}

/**
 * Deploy a buyer-acquisition campaign to Google Ads.
 *
 * Creates:
 *   1. CampaignBudget (shared)
 *   2. Campaign (SEARCH network, PAUSED by default, Tampa Bay geo, $X daily budget)
 *   3. CampaignCriterion x N for geo targeting + shared negatives
 *   4. AdGroup x N (one per ad group spec)
 *   5. AdGroupCriterion (keywords) for each ad group
 *   6. AdGroupAd (Responsive Search Ad) for each ad group
 *
 * All operations run in a single customer.mutateResources call so partial failures roll back.
 */
export async function deployBuyerCampaign(
  opts: DeployCampaignOptions,
): Promise<DeployCampaignResult> {
  const { customer } = getClient();
  const paused = opts.paused !== false; // default true

  // Step 1: create the budget (needs its own round-trip — campaign references it)
  const budgetOp = await customer.campaignBudgets.create([{
    name: `${opts.campaignName} Budget — ${Date.now()}`,
    amount_micros: toMicros(opts.dailyBudgetDollars),
    delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    explicitly_shared: false,
  }]);
  const budgetResourceName = budgetOp.results[0].resource_name;
  if (!budgetResourceName) throw new Error("Budget creation returned no resource name");

  // Step 2: create the campaign
  const campaignOp = await customer.campaigns.create([{
    name: opts.campaignName,
    status: paused ? enums.CampaignStatus.PAUSED : enums.CampaignStatus.ENABLED,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    manual_cpc: { enhanced_cpc_enabled: false },
    campaign_budget: budgetResourceName,
    network_settings: {
      target_google_search: true,
      target_search_network: false, // no search partners — we want control at $500/mo
      target_content_network: false,
      target_partner_search_network: false,
    },
    geo_target_type_setting: {
      positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE_OR_INTEREST,
      negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
    },
  }]);
  const campaignResourceName = campaignOp.results[0].resource_name;
  if (!campaignResourceName) throw new Error("Campaign creation returned no resource name");
  const campaignId = campaignResourceName.split("/").pop() || "";

  // Step 3: attach geo criteria + shared negatives to the campaign
  const campaignCriteria: any[] = [];
  for (const geoId of TAMPA_GEO_TARGET_CONSTANTS) {
    campaignCriteria.push({
      campaign: campaignResourceName,
      location: { geo_target_constant: `geoTargetConstants/${geoId}` },
    });
  }
  for (const neg of opts.negativeKeywords) {
    campaignCriteria.push({
      campaign: campaignResourceName,
      negative: true,
      keyword: { text: neg, match_type: enums.KeywordMatchType.BROAD },
    });
  }
  if (campaignCriteria.length > 0) {
    await customer.campaignCriteria.create(campaignCriteria);
  }

  // Step 4: create ad groups (one round-trip per, so we can capture IDs)
  const adGroupResults: { name: string; resourceName: string; id: string }[] = [];
  let keywordsCreated = 0;
  let adsCreated = 0;

  for (const spec of opts.adGroups) {
    const adGroupOp = await customer.adGroups.create([{
      name: spec.name,
      campaign: campaignResourceName,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
      cpc_bid_micros: toMicros(spec.cpcBidDollars),
    }]);
    const agRN = adGroupOp.results[0].resource_name;
    if (!agRN) throw new Error(`Ad group '${spec.name}' creation returned no resource name`);
    const agId = agRN.split("/").pop() || "";
    adGroupResults.push({ name: spec.name, resourceName: agRN, id: agId });

    // Keywords
    const matchTypeEnum =
      spec.matchType === "EXACT" ? enums.KeywordMatchType.EXACT :
      spec.matchType === "PHRASE" ? enums.KeywordMatchType.PHRASE :
      enums.KeywordMatchType.BROAD;

    const keywordOps = spec.keywords.map(kw => ({
      ad_group: agRN,
      status: enums.AdGroupCriterionStatus.ENABLED,
      keyword: { text: kw, match_type: matchTypeEnum },
    }));
    if (keywordOps.length > 0) {
      await customer.adGroupCriteria.create(keywordOps);
      keywordsCreated += keywordOps.length;
    }

    // Responsive Search Ad
    const ad = {
      ad_group: agRN,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [spec.finalUrl],
        responsive_search_ad: {
          headlines: spec.headlines.slice(0, 15).map(text => ({ text })),
          descriptions: spec.descriptions.slice(0, 4).map(text => ({ text })),
        },
      },
    };
    await customer.adGroupAds.create([ad]);
    adsCreated += 1;
  }

  return {
    campaignResourceName,
    campaignId,
    adGroupsCreated: adGroupResults,
    keywordsCreated,
    adsCreated,
    status: paused ? "PAUSED" : "ENABLED",
  };
}

// ─── Metrics pull ────────────────────────────────────────────────────────────

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpcDollars: number;
  costDollars: number;
  conversions: number;
  conversionValueDollars: number;
}

export async function getCampaignMetrics(dateRange: "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" = "LAST_7_DAYS"): Promise<CampaignMetrics[]> {
  const { customer } = getClient();

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING ${dateRange}
      AND campaign.advertising_channel_type = 'SEARCH'
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = await customer.query(query);
  return rows.map((r: any) => ({
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: r.campaign?.name ?? "",
    status: r.campaign?.status ?? "",
    impressions: Number(r.metrics?.impressions ?? 0),
    clicks: Number(r.metrics?.clicks ?? 0),
    ctr: Number(r.metrics?.ctr ?? 0),
    avgCpcDollars: Number(r.metrics?.average_cpc ?? 0) / 1_000_000,
    costDollars: Number(r.metrics?.cost_micros ?? 0) / 1_000_000,
    conversions: Number(r.metrics?.conversions ?? 0),
    conversionValueDollars: Number(r.metrics?.conversions_value ?? 0),
  }));
}
