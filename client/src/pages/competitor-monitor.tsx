import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Search, Play, ChevronDown, ChevronUp, Copy, Check,
  TrendingUp, Lightbulb, Target, Zap, Clock, BarChart2,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitorBreakdown {
  competitor: string;
  adsFound: number;
  dominantHook: string;
  dominantOffer: string;
  ctaPattern: string;
  formats: string[];
  emotionalAngle: string;
}

interface DigestResult {
  generatedAt: number;
  totalAdsFound: number;
  dataSource: "meta_api" | "fallback_positioning";
  competitorBreakdown: CompetitorBreakdown[];
  marketTrends: string[];
  topHooksInMarket: string[];
  gaps: string[];
  recommendedAngles: string[];
}

interface DigestEntry {
  id: number;
  generatedAt: number;
  rawAdsCount: number;
  summary: DigestResult;
}

interface Competitor {
  id: number;
  name: string;
  pageId: string;
  active: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      data-testid="copy-hook-button"
      className="ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      title="Copy hook"
    >
      {copied ? <Check className="h-3 w-3 text-signal" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function CompetitorCard({ breakdown }: { breakdown: CompetitorBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-border bg-card" data-testid={`competitor-card-${breakdown.competitor}`}>
      <CardHeader className="p-4 pb-0">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setExpanded(e => !e)}
          data-testid={`expand-competitor-${breakdown.competitor}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{breakdown.competitor}</span>
            <Badge variant="secondary" className="text-[10px]">
              {breakdown.adsFound > 0 ? `${breakdown.adsFound} ads` : "known positioning"}
            </Badge>
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dominant Hook</p>
              <p className="text-xs text-foreground leading-relaxed">{breakdown.dominantHook}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dominant Offer</p>
              <p className="text-xs text-foreground leading-relaxed">{breakdown.dominantOffer}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">CTA Pattern</p>
              <p className="text-xs text-foreground leading-relaxed">{breakdown.ctaPattern}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Emotional Angle</p>
              <p className="text-xs text-foreground leading-relaxed">{breakdown.emotionalAngle}</p>
            </div>
          </div>
          {breakdown.formats?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Ad Formats</p>
              <div className="flex flex-wrap gap-1">
                {breakdown.formats.map(f => (
                  <Badge key={f} variant="outline" className="text-[10px] px-2 py-0">{f}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DigestView({ digest }: { digest: DigestResult }) {
  const isFallback = digest.dataSource === "fallback_positioning";

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-border bg-muted/20">
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{digest.totalAdsFound}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Live Ads Found</p>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{digest.competitorBreakdown?.length || 0}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Competitors Scanned</p>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{formatDate(digest.generatedAt)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Analysis Date</p>
        </div>
        {isFallback && (
          <>
            <div className="w-px bg-border" />
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400 font-medium">Based on known positioning — run again with fresh API data</p>
            </div>
          </>
        )}
      </div>

      {/* Market Trends */}
      {digest.marketTrends?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-teal" />
            <p className="text-sm font-semibold text-foreground">Market Trends</p>
          </div>
          <ul className="space-y-2">
            {digest.marketTrends.map((trend, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">{trend}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Hooks */}
      {digest.topHooksInMarket?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-[hsl(45,90%,61%)]" />
            <p className="text-sm font-semibold text-foreground">Top Hooks in Market</p>
            <span className="text-[10px] text-muted-foreground">(click to copy)</span>
          </div>
          <ol className="space-y-2">
            {digest.topHooksInMarket.map((hook, i) => (
              <li key={i} className="group flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed flex-1">{hook}</p>
                <CopyButton text={hook} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Gaps */}
      {digest.gaps?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-[hsl(45,90%,61%)]" />
            <p className="text-sm font-semibold text-foreground">Opportunities / Gaps</p>
          </div>
          <div className="space-y-2">
            {digest.gaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/10">
                <span className="text-[hsl(45,90%,61%)] mt-0.5 shrink-0">○</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Angles */}
      {digest.recommendedAngles?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-signal" />
            <p className="text-sm font-semibold text-foreground">Recommended Angles for HomeDirectAI</p>
          </div>
          <div className="space-y-2">
            {digest.recommendedAngles.map((angle, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(152,100%,39%)]/20 bg-[hsl(152,100%,39%)]/5"
              >
                <span className="text-signal mt-0.5 shrink-0 text-xs font-bold">→</span>
                <p className="text-sm text-foreground leading-relaxed">{angle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Competitor Breakdown */}
      {digest.competitorBreakdown?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Per-Competitor Breakdown</p>
          </div>
          <div className="space-y-2">
            {digest.competitorBreakdown.map(breakdown => (
              <CompetitorCard key={breakdown.competitor} breakdown={breakdown} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompetitorMonitor() {
  const [activeDigest, setActiveDigest] = useState<DigestResult | null>(null);
  const [expandedDigestId, setExpandedDigestId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: competitors } = useQuery<Competitor[]>({
    queryKey: ["/api/competitor-monitor/competitors"],
    queryFn: () => apiRequest("GET", "/api/competitor-monitor/competitors").then(r => r.json()),
  });

  const { data: digests, isLoading: digestsLoading } = useQuery<DigestEntry[]>({
    queryKey: ["/api/competitor-monitor/digests"],
    queryFn: () => apiRequest("GET", "/api/competitor-monitor/digests").then(r => r.json()),
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/competitor-monitor/run").then(r => r.json()),
    onSuccess: (data: DigestResult) => {
      setActiveDigest(data);
      qc.invalidateQueries({ queryKey: ["/api/competitor-monitor/digests"] });
    },
  });

  const latestRun = digests?.[0];
  const isRunning = runMutation.isPending;

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="page-header">
            <Search className="h-5 w-5 text-teal" />
            Competitor Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pulls active ads from Meta Ad Library for key competitors and generates a strategic digest.
          </p>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 shrink-0">
          {latestRun && !isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="last-run-label">
              <Clock className="h-3.5 w-3.5" />
              Last run: {timeAgo(latestRun.generatedAt)}
            </div>
          )}
          <Button
            data-testid="run-analysis-button"
            onClick={() => runMutation.mutate()}
            disabled={isRunning}
            className="bg-teal text-background hover:bg-teal/90 font-semibold gap-2"
            style={{ backgroundColor: "hsl(192,100%,50%)", color: "#0a0e14" }}
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isRunning && (
        <div className="mb-6 p-5 rounded-lg border border-teal/30 bg-teal/5" data-testid="loading-state">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-teal animate-pulse [animation-delay:200ms]" />
            <div className="h-2 w-2 rounded-full bg-teal animate-pulse [animation-delay:400ms]" />
            <p className="text-sm text-teal font-medium ml-1">Pulling ads from Meta Ad Library...</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-7">
            Fetching active ads for {competitors?.length || 5} competitors, then running LLM analysis. This takes ~30 seconds.
          </p>
        </div>
      )}

      {/* Error state */}
      {runMutation.isError && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10" data-testid="error-state">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Analysis failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{(runMutation.error as Error)?.message}</p>
          </div>
        </div>
      )}

      {/* Active / latest result */}
      {(activeDigest || (!isRunning && latestRun && !activeDigest)) && (
        <div className="mb-8" data-testid="digest-result">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-widest text-signal">
              {activeDigest ? "Latest Analysis" : "Most Recent Analysis"}
            </p>
          </div>
          <DigestView digest={activeDigest || latestRun!.summary} />
        </div>
      )}

      {/* Empty state */}
      {!isRunning && !activeDigest && !latestRun && !digestsLoading && (
        <div
          className="mb-8 p-8 rounded-lg border border-dashed border-border text-center"
          data-testid="empty-state"
        >
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No analysis run yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click <span className="text-teal">Run Analysis</span> to pull the latest competitor ads
          </p>
        </div>
      )}

      {/* Tracked Competitors */}
      {competitors && competitors.length > 0 && (
        <div className="mb-8 pt-6 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Tracked Competitors ({competitors.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {competitors.map(c => (
              <Badge
                key={c.id}
                variant="outline"
                className="text-xs px-3 py-1 border-border text-muted-foreground"
                data-testid={`competitor-badge-${c.pageId}`}
              >
                {c.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Past Digests */}
      {digests && digests.length > 0 && (
        <div className="pt-6 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Past Analyses ({digests.length})
          </p>
          <div className="space-y-2">
            {digests.map(d => (
              <div key={d.id} className="rounded-lg border border-border bg-card overflow-hidden" data-testid={`digest-entry-${d.id}`}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedDigestId(expandedDigestId === d.id ? null : d.id)}
                  data-testid={`expand-digest-${d.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-foreground font-medium">{formatDate(d.generatedAt)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {d.rawAdsCount > 0 ? `${d.rawAdsCount} live ads` : "positioning data"}
                    </Badge>
                    {d.summary.dataSource === "fallback_positioning" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">fallback</Badge>
                    )}
                  </div>
                  {expandedDigestId === d.id
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
                {expandedDigestId === d.id && (
                  <div className="px-4 pb-4">
                    <DigestView digest={d.summary} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
