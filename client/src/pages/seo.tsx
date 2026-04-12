import { Globe, FileText, Link2, TrendingUp, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TacticWorkspace, { Placeholder } from "@/components/tactic-workspace";
import EmbeddedCopyGenerator from "@/components/embedded-copy-generator";

// ─── Plan section ────────────────────────────────────────────────────────────

function SeoPlan() {
  const topicClusters = [
    {
      pillar: "Buy a House Without a Realtor in Florida",
      difficulty: "Medium",
      intent: "Informational → Commercial",
      color: "border-signal/40 bg-signal/10 text-signal",
      subtopics: [
        "buy a house without a realtor in Florida",
        "FSBO buyer guide Tampa Bay",
        "post-NAR settlement buyer rights Florida",
        "buyer broker agreement Florida explained",
        "how much do buyers agents really cost",
      ],
    },
    {
      pillar: "Sell FSBO Tampa — The Smart Way",
      difficulty: "Hard",
      intent: "Commercial",
      color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      subtopics: [
        "sell your home without an agent Tampa",
        "Tampa FSBO fees vs agent commission",
        "flat fee MLS Tampa comparison",
        "1% listing fee Tampa",
        "how to price your home FSBO",
      ],
    },
    {
      pillar: "Tampa Bay Real Estate Intelligence",
      difficulty: "Easy",
      intent: "Informational",
      color: "border-blue-500/40 bg-blue-500/10 text-blue-300",
      subtopics: [
        "Tampa Bay home prices 2026",
        "best neighborhoods Tampa first-time buyer",
        "Tampa closing costs breakdown",
        "Florida homestead exemption guide",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Primary Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">Organic leads</p>
            <p className="text-xs text-muted-foreground mt-1">Long-tail buyer/seller intent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Target Market
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">Tampa Bay + Florida</p>
            <p className="text-xs text-muted-foreground mt-1">City + state-level queries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Content Cadence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">2 posts / week</p>
            <p className="text-xs text-muted-foreground mt-1">1 pillar, 1 supporting</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-signal" />
            Topic Clusters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topicClusters.map(c => (
            <div key={c.pillar}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`text-[10px] ${c.color}`}>{c.difficulty}</Badge>
                <p className="text-sm font-semibold text-foreground flex-1">{c.pillar}</p>
                <Badge variant="outline" className="text-[10px]">{c.intent}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-1">
                {c.subtopics.map(s => (
                  <span
                    key={s}
                    className="px-2 py-1 rounded-md text-[11px] font-mono bg-muted/40 border border-border text-foreground"
                  >
                    {s}
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
            <Link2 className="h-4 w-4 text-signal" />
            Competitive Gap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            From SERP research: <strong className="text-foreground">8 of 10 "without a realtor" queries return
            seller content, not buyer content.</strong> Google conflates buyer intent with FSBO seller intent. This is
            a wide-open content gap — HomeDirect can own buyer-side "without a realtor" queries by producing
            comprehensive, transparent guides that the agent-referral sites (Clever, HomeLight) refuse to write.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Deploy section ──────────────────────────────────────────────────────────

function SeoDeploy() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-signal" />
            Content Publishing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Integration Status
            </p>
            <div className="space-y-2">
              {[
                { name: "CMS connection", status: "pending", note: "Ghost / WordPress / Sanity" },
                { name: "Google Search Console", status: "pending", note: "Verify domain ownership" },
                { name: "Sitemap generator", status: "pending", note: "Auto-submit to GSC" },
                { name: "Schema.org markup", status: "pending", note: "Article + BreadcrumbList" },
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
              <span className="text-xs font-semibold">Publish Draft</span>
              <span className="text-[10px] text-muted-foreground font-normal">Push generated post to CMS</span>
            </Button>
            <Button variant="outline" disabled className="h-auto py-3 flex flex-col items-start gap-1">
              <span className="text-xs font-semibold">Request Indexing</span>
              <span className="text-[10px] text-muted-foreground font-normal">Google Search Console API</span>
            </Button>
          </div>

          <Placeholder
            title="Publishing pipeline"
            description="Once a CMS is connected, generated content flows from Create tab → Publish → Schema injection → Search Console indexing request. Draft history + edit flow supported."
            status="planned"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Monitor section ─────────────────────────────────────────────────────────

function SeoMonitor() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Organic Sessions", value: "—" },
          { label: "Ranking Keywords", value: "—" },
          { label: "Top 10 Rankings", value: "—" },
          { label: "Backlinks", value: "—" },
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
        title="Search Console + GA4 Organic"
        description="Pulls query rankings, CTR, impressions, and position data from Google Search Console API. Cross-references with GA4 for organic session → conversion tracking. Weekly keyword tracking with rank changes highlighted."
        status="needs-key"
      />
      <Placeholder
        title="Competitive Rankings"
        description="Track where Clever, Houzeo, reAlpha, Homa, Beycome are ranking for our target keywords. Surface new competitor content within 24 hours of publication."
        status="planned"
      />
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function Seo() {
  return (
    <TacticWorkspace
      title="SEO"
      subtitle="Organic search — own buyer-intent 'without a realtor' queries Google currently mis-serves"
      icon={<Globe className="h-5 w-5" />}
      accentColor="text-signal"
      sections={{
        plan: <SeoPlan />,
        create: (
          <EmbeddedCopyGenerator
            defaultIcp="buyer"
            channelFormat="content"
            channelLabel="SEO Content"
          />
        ),
        deploy: <SeoDeploy />,
        monitor: (
          <>
            <SeoMonitor />
          </>
        ),
      }}
    />
  );
}
