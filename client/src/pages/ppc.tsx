import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, KeyRound, MapPin, Target, Rocket, AlertCircle, RefreshCw, CheckCircle2, XCircle, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TacticWorkspace, { Placeholder } from "@/components/tactic-workspace";
import EmbeddedCopyGenerator from "@/components/embedded-copy-generator";

// ─── Shared campaign config used across Plan, Deploy, Monitor ────────────────

const TIER_1_KEYWORDS = [
  "buy a house without a realtor Tampa",
  "buy house directly from owner Tampa",
  "no commission home buying Tampa",
  "buy home without agent Tampa",
  "FSBO buyer Tampa",
];

const TIER_2_KEYWORDS = [
  "FSBO homes Tampa Bay",
  "for sale by owner Tampa",
  "FSBO listings Tampa FL",
  "do I need a buyer's agent Florida",
];

const NEGATIVE_KEYWORDS = [
  "sell", "selling", "seller", "we buy houses", "cash buyer", "cash offer",
  "jobs", "career", "salary", "free", "rent", "rental", "for rent",
  "foreclosure", "auction", "short sale", "commercial", "real estate license",
];

const DEFAULT_HEADLINES = [
  "Buy a Home Without a Realtor",
  "Tampa Bay — No Agent Needed",
  "1% Fee, No Agent BS",
  "AI Handles Everything",
  "Tour Any Home for $20",
  "Save $9,800 on $430K Home",
  "FSBO Without the Stress",
  "Skip the Commission Trap",
];

const DEFAULT_DESCRIPTIONS = [
  "AI guides you from search to close. No agent, no commission games. Tampa Bay only.",
  "Book $20 chaperone walkthroughs. No pressure. AI handles negotiation + paperwork.",
  "Post-NAR settlement made it clear: you don't need a buyer's agent. Try the smarter way.",
  "Built for Tampa Bay buyers who want transparency, not commission theater.",
];

const DEFAULT_FINAL_URL = "https://homedirect-production.up.railway.app/";

// ─── Plan section ────────────────────────────────────────────────────────────

function PpcPlan() {
  const keywordTiers = [
    { tier: "Tier 1 — Low Competition, High Intent", budget: "~60%", color: "border-signal/40 bg-signal/10 text-signal", keywords: TIER_1_KEYWORDS },
    { tier: "Tier 2 — Medium Competition, High Volume", budget: "~30%", color: "border-amber-500/40 bg-amber-500/10 text-amber-300", keywords: TIER_2_KEYWORDS },
    { tier: "Tier 3 — Avoid (Zillow/Redfin dominate)", budget: "0%", color: "border-muted-foreground/30 bg-muted/30 text-muted-foreground", keywords: ["homes for sale Tampa", "home buying without real estate agent"] },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Monthly Budget</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">$500</p>
            <p className="text-xs text-muted-foreground mt-1">$16.67/day · Manual CPC</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Geo Target</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-signal" />
              <p className="text-sm font-semibold">Tampa-St. Pete-Clearwater DMA</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Search only · no partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Primary Goal</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-signal" />
              <p className="text-sm font-semibold">Buyer signups</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Manual CPC → Max Conversions after 30 conv.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4 text-signal" /> Keyword Strategy (Tampa Bay)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {keywordTiers.map(tier => (
            <div key={tier.tier}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`text-[10px] ${tier.color}`}>{tier.budget}</Badge>
                <p className="text-xs font-semibold text-foreground">{tier.tier}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tier.keywords.map(kw => (
                  <span key={kw} className="px-2 py-1 rounded-md text-[11px] font-mono bg-muted/40 border border-border text-foreground">{kw}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Negative Keywords ({NEGATIVE_KEYWORDS.length})</p>
            <div className="flex flex-wrap gap-1">
              {NEGATIVE_KEYWORDS.map(n => (
                <span key={n} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-950/20 border border-red-900/30 text-red-300/80">-{n}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Deploy section ──────────────────────────────────────────────────────────

interface CredentialStatus {
  clientId: boolean;
  clientSecret: boolean;
  developerToken: boolean;
  refreshToken: boolean;
  customerId: boolean;
  loginCustomerId: boolean;
}

function PpcDeploy() {
  const { toast } = useToast();
  const [validateResult, setValidateResult] = useState<any | null>(null);
  const [deployResult, setDeployResult] = useState<any | null>(null);
  const [finalUrl, setFinalUrl] = useState(DEFAULT_FINAL_URL);

  const { data: statusData, refetch: refetchStatus } = useQuery<{ credentials: CredentialStatus }>({
    queryKey: ["/api/google-ads/status"],
    queryFn: () => apiRequest("GET", "/api/google-ads/status").then(r => r.json()),
    refetchInterval: 5000,
  });

  const creds = statusData?.credentials;
  const allReady = !!(creds && creds.clientId && creds.clientSecret && creds.developerToken && creds.refreshToken && creds.customerId);

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/google-ads/validate-keywords", {
        keywords: [...TIER_1_KEYWORDS, ...TIER_2_KEYWORDS],
        includeIdeas: true,
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || "Validation failed");
        return r.json();
      }),
    onSuccess: (data) => {
      setValidateResult(data);
      toast({ description: `Validated ${data.validated?.length || 0} keywords · ${data.ideas?.length || 0} ideas` });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const deployMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/google-ads/deploy-campaign", {
        campaignName: `HomeDirect Buyer Acquisition — ${new Date().toISOString().slice(0, 10)}`,
        dailyBudgetDollars: 16.67,
        adGroups: [
          {
            name: "T1 — High Intent Buyer",
            keywords: TIER_1_KEYWORDS,
            matchType: "PHRASE",
            cpcBidDollars: 3.5,
            headlines: DEFAULT_HEADLINES,
            descriptions: DEFAULT_DESCRIPTIONS,
            finalUrl,
          },
          {
            name: "T2 — FSBO Research",
            keywords: TIER_2_KEYWORDS,
            matchType: "BROAD",
            cpcBidDollars: 2.5,
            headlines: DEFAULT_HEADLINES,
            descriptions: DEFAULT_DESCRIPTIONS,
            finalUrl,
          },
        ],
        negativeKeywords: NEGATIVE_KEYWORDS,
        paused: true,
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || "Deploy failed");
        return r.json();
      }),
    onSuccess: (data) => {
      setDeployResult(data);
      toast({ description: `Deployed: ${data.adGroupsCreated?.length || 0} ad groups · ${data.keywordsCreated} keywords · PAUSED` });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const credRow = (name: string, label: string, env: string, ok: boolean | undefined) => (
    <div className="flex items-center gap-3 text-xs" key={name}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-signal shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      <span className="text-foreground font-medium">{label}</span>
      <span className="text-muted-foreground ml-auto font-mono text-[10px]">{env}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-signal" /> Google Ads API Deployment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credential Status</p>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => refetchStatus()}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {credRow("clientId", "OAuth Client ID", "GOOGLE_ADS_CLIENT_ID", creds?.clientId)}
              {credRow("clientSecret", "OAuth Client Secret", "GOOGLE_ADS_CLIENT_SECRET", creds?.clientSecret)}
              {credRow("developerToken", "Developer Token", "GOOGLE_ADS_DEVELOPER_TOKEN", creds?.developerToken)}
              {credRow("customerId", "Customer ID", "GOOGLE_ADS_CUSTOMER_ID", creds?.customerId)}
              {credRow("refreshToken", "Refresh Token", "GOOGLE_ADS_REFRESH_TOKEN", creds?.refreshToken)}
            </div>
            {!creds?.refreshToken && creds?.clientId && creds?.clientSecret && (
              <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11px] text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Run <code className="font-mono bg-muted/60 px-1 rounded">npm run google-ads:auth</code> in the marketing-hub folder to generate the refresh token.</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Landing Page URL (where ads send traffic)
            </label>
            <Input value={finalUrl} onChange={e => setFinalUrl(e.target.value)} className="h-8 text-xs font-mono" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={!allReady || validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
              className="h-auto py-3 flex flex-col items-start gap-1"
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                {validateMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : "1."} Validate Keywords
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Pull Tampa Bay volume + CPC</span>
            </Button>
            <Button
              disabled={!allReady || deployMutation.isPending}
              onClick={() => deployMutation.mutate()}
              className="h-auto py-3 flex flex-col items-start gap-1 bg-signal hover:bg-signal/90 text-[hsl(214,35%,8%)]"
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                {deployMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : "2."} Deploy (PAUSED)
              </span>
              <span className="text-[10px] font-normal opacity-80">Build full campaign, keep paused</span>
            </Button>
          </div>

          {!allReady && (
            <Placeholder
              title="Waiting for credentials"
              description="Fill in the missing environment variables in marketing-hub/.env and restart the dev server. The buttons above will unlock once every credential is set."
              status="needs-key"
            />
          )}
        </CardContent>
      </Card>

      {validateResult && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Keyword Validation Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <div className="col-span-6">Keyword</div>
                <div className="col-span-2 text-right">Monthly</div>
                <div className="col-span-2 text-right">Low CPC</div>
                <div className="col-span-2 text-right">High CPC</div>
              </div>
              {(validateResult.validated || []).map((k: any) => (
                <div key={k.keyword} className="grid grid-cols-12 gap-2 py-1">
                  <div className="col-span-6 truncate text-foreground">{k.keyword}</div>
                  <div className="col-span-2 text-right text-muted-foreground">{k.avgMonthlySearches.toLocaleString()}</div>
                  <div className="col-span-2 text-right text-muted-foreground">${k.lowCpcDollars.toFixed(2)}</div>
                  <div className="col-span-2 text-right text-muted-foreground">${k.highCpcDollars.toFixed(2)}</div>
                </div>
              ))}
            </div>
            {validateResult.ideas?.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border">
                + {validateResult.ideas.length} related keyword ideas surfaced by Google
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {deployResult && (
        <Card className="border-signal/40 bg-signal/5">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Pause className="h-4 w-4 text-amber-400" /> Deployed — {deployResult.status}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs space-y-1">
              <p><span className="text-muted-foreground">Campaign ID:</span> <code className="font-mono">{deployResult.campaignId}</code></p>
              <p><span className="text-muted-foreground">Ad Groups:</span> {deployResult.adGroupsCreated?.length || 0}</p>
              <p><span className="text-muted-foreground">Keywords Created:</span> {deployResult.keywordsCreated}</p>
              <p><span className="text-muted-foreground">Ads Created:</span> {deployResult.adsCreated}</p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Campaign is PAUSED. Review in the Google Ads UI, then enable it there.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Monitor section ─────────────────────────────────────────────────────────

interface CampaignMetric {
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

function PpcMonitor() {
  const { data, isLoading, error, refetch } = useQuery<{ campaigns: CampaignMetric[]; dateRange: string }>({
    queryKey: ["/api/google-ads/metrics"],
    queryFn: () => apiRequest("GET", "/api/google-ads/metrics?dateRange=LAST_7_DAYS").then(r => r.json()),
    retry: false,
    refetchInterval: 60_000,
  });

  const campaigns = data?.campaigns || [];
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      cost: acc.cost + c.costDollars,
      conversions: acc.conversions + c.conversions,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
  );
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Last 7 days · auto-refresh every 60s</p>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => refetch()}>
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Impressions</p>
          <p className="text-2xl font-bold mt-1">{totals.impressions.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clicks</p>
          <p className="text-2xl font-bold mt-1">{totals.clicks.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CTR</p>
          <p className="text-2xl font-bold mt-1">{overallCtr.toFixed(2)}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conversions</p>
          <p className="text-2xl font-bold mt-1">{totals.conversions.toFixed(1)}</p>
        </CardContent></Card>
      </div>

      {error && (
        <Placeholder
          title="Can't reach Google Ads API"
          description={(error as Error).message || "Check credentials in the Deploy tab."}
          status="needs-key"
        />
      )}

      {!error && campaigns.length === 0 && !isLoading && (
        <Placeholder
          title="No campaign data yet"
          description="Deploy a campaign from the Deploy tab to start seeing metrics. Data appears within minutes of the first ad impression."
          status="planned"
        />
      )}

      {campaigns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Campaigns</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Clicks</div>
                <div className="col-span-2 text-right">Avg CPC</div>
                <div className="col-span-2 text-right">Spend</div>
              </div>
              {campaigns.map(c => (
                <div key={c.campaignId} className="grid grid-cols-12 gap-2 py-1">
                  <div className="col-span-4 truncate text-foreground">{c.campaignName}</div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="text-[9px]">
                      {c.status === "ENABLED" ? <><Play className="h-2.5 w-2.5 mr-0.5" />{c.status}</> : <><Pause className="h-2.5 w-2.5 mr-0.5" />{c.status}</>}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">{c.clicks.toLocaleString()}</div>
                  <div className="col-span-2 text-right text-muted-foreground">${c.avgCpcDollars.toFixed(2)}</div>
                  <div className="col-span-2 text-right text-muted-foreground">${c.costDollars.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function Ppc() {
  return (
    <TacticWorkspace
      title="PPC"
      subtitle="Google Ads — paid search for high-intent buyers & sellers in Tampa Bay"
      icon={<Search className="h-5 w-5" />}
      accentColor="text-signal"
      sections={{
        plan: <PpcPlan />,
        create: <EmbeddedCopyGenerator defaultIcp="buyer" channelFormat="search" channelLabel="Google Ads" />,
        deploy: <PpcDeploy />,
        monitor: <PpcMonitor />,
      }}
    />
  );
}
