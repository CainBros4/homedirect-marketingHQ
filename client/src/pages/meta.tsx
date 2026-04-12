import { Target, Users, Layers, Rocket, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TacticWorkspace, { Placeholder } from "@/components/tactic-workspace";
import EmbeddedCopyGenerator from "@/components/embedded-copy-generator";

// ─── Plan section ────────────────────────────────────────────────────────────

function MetaPlan() {
  const audiences = [
    {
      name: "NAR-Aware Sellers",
      size: "~85K",
      icp: "Seller",
      color: "border-signal/40 bg-signal/10 text-signal",
      definition: "Tampa Bay homeowners, 35–65, owned 3+ yrs, high equity, recently engaged with NAR settlement news",
      interests: ["Real estate news", "Home selling", "NAR lawsuit", "Redfin", "Zillow"],
    },
    {
      name: "Move-Up Millennials",
      size: "~120K",
      icp: "Buyer/Seller",
      color: "border-blue-500/40 bg-blue-500/10 text-blue-300",
      definition: "Tampa Bay, 32–42, HHI $90K–$160K, homeowners with equity, engaged with home upgrade content",
      interests: ["Home renovation", "First-time home buyer", "House hunters", "Mortgage calculator"],
    },
    {
      name: "Gig Worker Chaperones",
      size: "~45K",
      icp: "Concierge",
      color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      definition: "Tampa Bay, 21–55, engaged with DoorDash/Uber/Instacart driver content, flexible schedule seekers",
      interests: ["DoorDash", "Uber", "Gig work", "Side hustle", "Real estate"],
    },
  ];

  const placements = [
    { name: "Instagram Feed", format: "1:1 Static / 9:16 Reel", icp: "All" },
    { name: "Instagram Stories", format: "9:16 Static / Video", icp: "Buyer / Seller" },
    { name: "Facebook Feed", format: "1:1 / 4:5 Static", icp: "Seller (older skew)" },
    { name: "Instagram Reels", format: "9:16 Video", icp: "Buyer / Concierge" },
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
            <p className="text-2xl font-bold">$—</p>
            <p className="text-xs text-muted-foreground mt-1">Set budget in Deploy tab</p>
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
              <p className="text-sm font-semibold">Tampa Bay DMA</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Hillsborough, Pinellas, Pasco</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-signal" />
              <p className="text-sm font-semibold">Leads</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Conversions API + Pixel</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-signal" />
            Target Audiences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audiences.map(a => (
            <div key={a.name} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`text-[10px] ${a.color}`}>{a.icp}</Badge>
                <p className="text-sm font-semibold flex-1">{a.name}</p>
                <span className="text-xs text-muted-foreground font-mono">{a.size}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{a.definition}</p>
              <div className="flex flex-wrap gap-1">
                {a.interests.map(i => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-muted-foreground">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-signal" />
            Placement Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {placements.map(p => (
            <div key={p.name} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-muted/20">
              <div className="flex-1">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.format}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{p.icp}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Deploy section ──────────────────────────────────────────────────────────

function MetaDeploy() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-signal" />
            Meta Marketing API Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Credential Status
            </p>
            <div className="space-y-2">
              {[
                { name: "Meta App ID", status: "pending", note: "developers.facebook.com" },
                { name: "App Secret", status: "pending", note: "Add to .env" },
                { name: "Access Token (long-lived)", status: "pending", note: "Graph API Explorer" },
                { name: "Ad Account ID", status: "pending", note: "Business Manager" },
                { name: "Pixel ID", status: "pending", note: "For conversion tracking" },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-3 text-xs">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    c.status === "ready" ? "bg-signal" :
                    c.status === "pending" ? "bg-amber-400" : "bg-muted-foreground/40"
                  }`} />
                  <span className="text-foreground font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto font-mono text-[10px]">{c.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled className="h-auto py-3 flex flex-col items-start gap-1">
              <span className="text-xs font-semibold">1. Upload Audiences</span>
              <span className="text-[10px] text-muted-foreground font-normal">Create custom + lookalike audiences</span>
            </Button>
            <Button variant="outline" disabled className="h-auto py-3 flex flex-col items-start gap-1">
              <span className="text-xs font-semibold">2. Deploy Ad Sets</span>
              <span className="text-[10px] text-muted-foreground font-normal">Campaign → AdSet → Ad creation</span>
            </Button>
          </div>

          <Placeholder
            title="Meta Marketing API integration"
            description="Actions above will use the Meta Marketing API (Campaign, AdSet, AdCreative endpoints) to programmatically build campaigns. Audience upload uses CustomAudience API. Conversions API pushes events from the site's Pixel for iOS14+ tracking."
            status="needs-key"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Monitor section ─────────────────────────────────────────────────────────

function MetaMonitor() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Reach", value: "—" },
          { label: "Impressions", value: "—" },
          { label: "CPM", value: "—" },
          { label: "Leads", value: "—" },
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
        title="Meta Ads Insights"
        description="Once deployed, pulls performance from the Meta Insights API — reach, impressions, frequency, CPM, CTR, CPC, results, cost per result. Drilldown by audience, placement, creative. Ad Library data also surfaces here to compare our ads against Zillow/Redfin/Opendoor/Homa."
        status="needs-key"
      />
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function Meta() {
  return (
    <TacticWorkspace
      title="Meta"
      subtitle="Facebook & Instagram ads — high-reach audience targeting for Tampa Bay"
      icon={<Target className="h-5 w-5" />}
      accentColor="text-signal"
      sections={{
        plan: <MetaPlan />,
        create: (
          <EmbeddedCopyGenerator
            defaultIcp="seller"
            channelFormat="social"
            channelLabel="Meta Ads"
          />
        ),
        deploy: <MetaDeploy />,
        monitor: <MetaMonitor />,
      }}
    />
  );
}
