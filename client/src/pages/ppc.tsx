import { Search, KeyRound, MapPin, Target, Rocket, BarChart2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TacticWorkspace, { Placeholder } from "@/components/tactic-workspace";
import EmbeddedCopyGenerator from "@/components/embedded-copy-generator";

// ─── Plan section ────────────────────────────────────────────────────────────

function PpcPlan() {
  const keywordTiers = [
    {
      tier: "Tier 1 — Low Competition, High Intent",
      budget: "~60%",
      color: "border-signal/40 bg-signal/10 text-signal",
      keywords: [
        "buy a house without a realtor Tampa",
        "buy house directly from owner Tampa",
        "no commission home buying Tampa",
        "buy home without agent Tampa",
        "FSBO buyer Tampa",
      ],
    },
    {
      tier: "Tier 2 — Medium Competition, High Volume",
      budget: "~30%",
      color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      keywords: [
        "FSBO homes Tampa Bay",
        "for sale by owner Tampa",
        "FSBO listings Tampa FL",
        "do I need a buyer's agent Florida",
      ],
    },
    {
      tier: "Tier 3 — Avoid (Zillow/Redfin dominate)",
      budget: "0%",
      color: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
      keywords: [
        "homes for sale Tampa",
        "home buying without real estate agent",
      ],
    },
  ];

  const negatives = [
    "sell", "selling", "seller", "we buy houses", "cash buyer", "cash offer",
    "jobs", "career", "salary", "free", "rent", "rental", "for rent",
    "foreclosure", "auction", "short sale", "commercial", "real estate license",
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Monthly Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">$500</p>
            <p className="text-xs text-muted-foreground mt-1">~90–200 clicks at $2.50–$5.50 CPC</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Geo Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-signal" />
              <p className="text-sm font-semibold">Tampa-St. Pete-Clearwater</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Radius targeting, exclude search partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Primary Goal
            </CardTitle>
          </CardHeader>
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
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-signal" />
            Keyword Strategy (Tampa Bay)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {keywordTiers.map(tier => (
            <div key={tier.tier}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`text-[10px] ${tier.color}`}>{tier.budget}</Badge>
                <p className="text-xs font-semibold text-foreground">{tier.tier}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tier.keywords.map(kw => (
                  <span
                    key={kw}
                    className="px-2 py-1 rounded-md text-[11px] font-mono bg-muted/40 border border-border text-foreground"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Negative Keywords (block waste)
            </p>
            <div className="flex flex-wrap gap-1">
              {negatives.map(n => (
                <span key={n} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-950/20 border border-red-900/30 text-red-300/80">
                  -{n}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-[#00D4FF]/20 bg-[#00D4FF]/5">
            <AlertCircle className="h-3.5 w-3.5 text-[#00D4FF] mt-0.5 shrink-0" />
            <p className="text-xs text-[#00D4FF]/80 leading-relaxed">
              <strong>Volume not yet validated.</strong> These keywords are based on SERP research, not
              Google Keyword Planner data. Run the Keyword Validation action in Deploy tab before committing spend.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campaign Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "Search — High Intent Buyer", budget: "$350/mo", tier: "T1 keywords, tight match types" },
            { name: "Search — FSBO Research/Education", budget: "$150/mo", tier: "T2 keywords, broader match" },
          ].map(c => (
            <div key={c.name} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-muted/20">
              <Search className="h-4 w-4 text-signal shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.tier}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{c.budget}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Deploy section ──────────────────────────────────────────────────────────

function PpcDeploy() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-signal" />
            Google Ads API Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Credential Status
            </p>
            <div className="space-y-2">
              {[
                { name: "OAuth Client ID", status: "ready", note: "344138019385-c8r71...apps.googleusercontent.com" },
                { name: "OAuth Client Secret", status: "pending", note: "Add to .env" },
                { name: "Developer Token", status: "pending", note: "Google Ads → Tools → API Center" },
                { name: "Customer ID", status: "pending", note: "10-digit from Ads dashboard" },
                { name: "Refresh Token", status: "auto", note: "Auto-generated on first run" },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-3 text-xs">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    c.status === "ready" ? "bg-signal" :
                    c.status === "pending" ? "bg-amber-400" :
                    "bg-muted-foreground/40"
                  }`} />
                  <span className="text-foreground font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto font-mono text-[10px]">{c.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled className="h-auto py-3 flex flex-col items-start gap-1">
              <span className="text-xs font-semibold">1. Validate Keywords</span>
              <span className="text-[10px] text-muted-foreground font-normal">Pull Tampa Bay volume + CPC</span>
            </Button>
            <Button variant="outline" disabled className="h-auto py-3 flex flex-col items-start gap-1">
              <span className="text-xs font-semibold">2. Deploy Campaign</span>
              <span className="text-[10px] text-muted-foreground font-normal">Create all ad groups + ads</span>
            </Button>
          </div>

          <Placeholder
            title="Google Ads API integration"
            description="Both actions require the credentials above. Validate Keywords calls the KeywordPlanService to pull real Tampa Bay search volume and CPC estimates for the target keywords. Deploy Campaign uses CampaignService + AdGroupService + AdGroupAdService to build the full account structure programmatically."
            status="needs-key"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Monitor section ─────────────────────────────────────────────────────────

function PpcMonitor() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Impressions", value: "—", trend: "" },
          { label: "Clicks", value: "—", trend: "" },
          { label: "CTR", value: "—", trend: "" },
          { label: "Conversions", value: "—", trend: "" },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold mt-1 text-muted-foreground/60">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Placeholder
        title="Live Google Ads metrics"
        description="Once campaigns are deployed, this surface pulls performance data from the Google Ads API (GoogleAdsService.search) — impressions, clicks, CTR, avg CPC, conversions, and conversion value. Drilldown by campaign, ad group, and keyword. Auto-refreshes every 15 minutes during active hours."
        status="needs-key"
      />
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
        create: (
          <EmbeddedCopyGenerator
            defaultIcp="buyer"
            channelFormat="search"
            channelLabel="Google Ads"
          />
        ),
        deploy: <PpcDeploy />,
        monitor: <PpcMonitor />,
      }}
    />
  );
}
