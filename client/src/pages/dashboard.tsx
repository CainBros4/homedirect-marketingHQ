import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Globe, Target, Search, ArrowRight, AlertCircle, CheckCircle2, Lightbulb, Sparkles, Rocket, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Tactic {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  description: string;
  status: {
    plan: "ready" | "draft" | "empty";
    create: "ready" | "draft" | "empty";
    deploy: "ready" | "draft" | "empty";
    monitor: "ready" | "draft" | "empty";
  };
  accent: string;
  bg: string;
}

const TACTICS: Tactic[] = [
  {
    href: "/seo",
    label: "SEO",
    icon: Globe,
    tagline: "Own 'without a realtor' buyer queries",
    description: "Topic clusters, content generation, CMS publishing, and Search Console rank tracking — all in one place.",
    status: { plan: "ready", create: "ready", deploy: "empty", monitor: "empty" },
    accent: "text-signal",
    bg: "bg-[hsl(152,100%,39%)]/10 border-[hsl(152,100%,39%)]/20",
  },
  {
    href: "/meta",
    label: "Meta",
    icon: Target,
    tagline: "Facebook & Instagram paid social",
    description: "Audience planning, social copy generation, Meta Marketing API deployment, and Insights API performance tracking.",
    status: { plan: "ready", create: "ready", deploy: "empty", monitor: "empty" },
    accent: "text-[hsl(192,100%,50%)]",
    bg: "bg-[hsl(192,100%,50%)]/10 border-[hsl(192,100%,50%)]/20",
  },
  {
    href: "/ppc",
    label: "PPC",
    icon: Search,
    tagline: "Google Ads — high-intent search",
    description: "Keyword tiers, negative lists, Google Ads API campaign deployment, and live performance metrics from Ads API.",
    status: { plan: "ready", create: "ready", deploy: "draft", monitor: "empty" },
    accent: "text-[hsl(45,90%,61%)]",
    bg: "bg-[hsl(45,90%,61%)]/10 border-[hsl(45,90%,61%)]/20",
  },
];

const STAGE_ICONS = {
  plan: Lightbulb,
  create: Sparkles,
  deploy: Rocket,
  monitor: BarChart2,
} as const;

function StageDot({ status }: { status: "ready" | "draft" | "empty" }) {
  const color =
    status === "ready" ? "bg-signal" :
    status === "draft" ? "bg-amber-400" :
    "bg-muted-foreground/30";
  return <div className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

export default function Dashboard() {
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
  });

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Marketing Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          HomeDirectAI's end-to-end marketing command center. Plan, create, deploy, and monitor across every channel.
        </p>
      </div>

      {/* API key warning */}
      {settings && !settings.hasKey && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">No AI API key configured</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Add your Together AI, OpenAI, or DeepSeek key in{" "}
              <Link href="/settings"><a className="underline hover:text-amber-300">Settings</a></Link>
              {" "}to enable copy generation across all channels.
            </p>
          </div>
        </div>
      )}

      {settings?.hasKey && (
        <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(152,100%,39%)]/30 bg-[hsl(152,100%,39%)]/10 w-fit">
          <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
          <p className="text-xs text-signal font-medium">AI key connected · {settings.provider}</p>
        </div>
      )}

      {/* Channels grid */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Channels</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {TACTICS.map(({ href, icon: Icon, label, tagline, description, status, accent, bg }) => (
          <Link key={label} href={href}>
            <a className="block group">
              <Card className={`border cursor-pointer transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 h-full ${bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-background/50 ${accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">{label}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide mb-2">
                    {tagline}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>

                  {/* Stage readiness */}
                  <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                    {(Object.keys(status) as Array<keyof typeof status>).map(stage => {
                      const StageIcon = STAGE_ICONS[stage];
                      return (
                        <div key={stage} className="flex items-center gap-1 flex-1">
                          <StageIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[9px] uppercase tracking-wide text-muted-foreground capitalize flex-1">{stage}</span>
                          <StageDot status={status[stage]} />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>

      {/* Legend + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Pipeline Legend
            </p>
            <div className="space-y-2">
              {[
                { stage: "Plan", icon: Lightbulb, desc: "Strategy, audiences, keywords, topics" },
                { stage: "Create", icon: Sparkles, desc: "Generate copy, briefs, creatives" },
                { stage: "Deploy", icon: Rocket, desc: "Push live via platform APIs" },
                { stage: "Monitor", icon: BarChart2, desc: "Pull metrics, track performance" },
              ].map(({ stage, icon: Icon, desc }) => (
                <div key={stage} className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium w-16">{stage}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-signal" />
                <span>Ready</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Draft</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                <span>Not started</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Active Campaign
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Google Ads Buyer Acquisition</p>
                <p className="text-xs text-muted-foreground">$500/mo · Tampa Bay · Buyer ICP</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Pre-launch</Badge>
                <Badge className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300">
                  Awaiting credentials
                </Badge>
              </div>
              <div className="pt-3 border-t border-border">
                <Link href="/ppc">
                  <a className="text-xs text-signal hover:underline inline-flex items-center gap-1">
                    Open PPC workspace <ArrowRight className="h-3 w-3" />
                  </a>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
