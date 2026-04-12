import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw, Sparkles, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Copy, Check, Plus, Trash2, Edit2, ExternalLink, Info,
  Instagram, Linkedin, Mail, Monitor, Layers,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackBrief {
  icp: string;
  format: string;
  angle: string;
  recommendedHook: string;
  rationale: string;
}

interface WinnerLoser {
  adName: string;
  hook: string;
  ctr: number;
  cpl: number;
  why: string;
}

interface FeedbackReportData {
  weekOf: string;
  performanceSummary: {
    totalSpend: number;
    totalLeads: number;
    avgCTR: number;
    avgCPL: number;
  };
  winners: WinnerLoser[];
  losers: WinnerLoser[];
  patterns: string[];
  newBriefs: FeedbackBrief[];
  competitorContext: string;
  generatedAt: number;
}

interface FeedbackReportRow {
  id: number;
  generatedAt: number;
  weekOf: string;
  summary: FeedbackReportData;
  newBriefsCount: number;
  status: string;
}

interface QueueItem {
  id: number;
  assetId?: number;
  platform: string;
  contentType: string;
  caption: string;
  icp: string;
  scheduledFor?: number;
  status: string;
  bufferJobId?: string;
  publishedAt?: number;
  createdAt: number;
  notes?: string;
}

interface QueueStats {
  queued: number;
  published: number;
  failed: number;
  cancelled: number;
  byPlatform: Record<string, number>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ICP_COLORS: Record<string, string> = {
  buyer:     "bg-[hsl(152,100%,39%)]/15 text-[hsl(152,100%,39%)] border-[hsl(152,100%,39%)]/30",
  seller:    "bg-[hsl(192,100%,50%)]/15 text-[hsl(192,100%,50%)] border-[hsl(192,100%,50%)]/30",
  concierge: "bg-[hsl(45,90%,61%)]/15 text-[hsl(45,90%,61%)] border-[hsl(45,90%,61%)]/30",
};

const STATUS_COLORS: Record<string, string> = {
  queued:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  published: "bg-[hsl(152,100%,39%)]/15 text-[hsl(152,100%,39%)] border-[hsl(152,100%,39%)]/30",
  failed:    "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-muted/50 text-muted-foreground border-border",
  new:       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reviewed:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  actioned:  "bg-[hsl(152,100%,39%)]/15 text-[hsl(152,100%,39%)] border-[hsl(152,100%,39%)]/30",
};

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  meta:      Monitor,
  instagram: Instagram,
  tiktok:    Layers,
  linkedin:  Linkedin,
  email:     Mail,
};

function PlatformIcon({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICONS[platform.toLowerCase()] || Monitor;
  return <Icon className="h-4 w-4" />;
}

function IcpBadge({ icp }: { icp: string }) {
  return (
    <Badge className={cn("text-[10px] font-semibold border capitalize", ICP_COLORS[icp] || "bg-muted")}>
      {icp}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("text-[10px] font-semibold border capitalize", STATUS_COLORS[status] || "bg-muted")}>
      {status}
    </Badge>
  );
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="Copy hook"
      data-testid="copy-hook-btn"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border bg-card/60">
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Report Display ────────────────────────────────────────────────────────────

function ReportDisplay({ report, status }: { report: FeedbackReportData; status?: string }) {
  const perf = report.performanceSummary;
  const hasData = perf.totalLeads > 0 || perf.totalSpend > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Week of {report.weekOf}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated {formatDateTime(report.generatedAt)}
          </p>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Spend"
          value={hasData ? formatCurrency(perf.totalSpend) : "$0.00"}
          sub={hasData ? undefined : "No data yet"}
        />
        <KpiCard
          label="Total Leads"
          value={String(perf.totalLeads)}
        />
        <KpiCard
          label="Avg CTR"
          value={`${Number(perf.avgCTR).toFixed(2)}%`}
        />
        <KpiCard
          label="Avg CPL"
          value={perf.totalLeads > 0 ? formatCurrency(perf.avgCPL) : "—"}
        />
      </div>

      {/* Winners */}
      {report.winners?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-signal" /> What Worked
          </p>
          <div className="space-y-2">
            {report.winners.map((w, i) => (
              <div key={i} className="border-l-2 border-[hsl(152,100%,39%)] pl-3 py-2 rounded-r-md bg-[hsl(152,100%,39%)]/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{w.adName}</span>
                  <span className="text-[10px] text-muted-foreground">CTR {Number(w.ctr).toFixed(2)}%</span>
                  {w.cpl > 0 && <span className="text-[10px] text-muted-foreground">CPL {formatCurrency(w.cpl)}</span>}
                </div>
                {w.hook && w.hook !== "N/A" && (
                  <p className="text-xs text-muted-foreground italic mb-1">"{w.hook}"</p>
                )}
                <p className="text-xs text-foreground/80">{w.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Losers */}
      {report.losers?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-400" /> What Didn't Work
          </p>
          <div className="space-y-2">
            {report.losers.map((l, i) => (
              <div key={i} className="border-l-2 border-red-500/60 pl-3 py-2 rounded-r-md bg-red-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{l.adName}</span>
                  <span className="text-[10px] text-muted-foreground">CTR {Number(l.ctr).toFixed(2)}%</span>
                </div>
                {l.hook && l.hook !== "N/A" && (
                  <p className="text-xs text-muted-foreground italic mb-1">"{l.hook}"</p>
                )}
                <p className="text-xs text-foreground/80">{l.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {report.patterns?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Patterns Detected</p>
          <ul className="space-y-1.5">
            {report.patterns.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="text-signal mt-0.5 shrink-0">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* New Briefs */}
      {report.newBriefs?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">New Briefs for Next Week</p>
          <div className="space-y-3">
            {report.newBriefs.map((brief, i) => (
              <Card key={i} className="border bg-card/40">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <IcpBadge icp={brief.icp} />
                    <Badge variant="outline" className="text-[10px] capitalize">{brief.format}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{brief.angle}</Badge>
                  </div>
                  <div className="flex items-start gap-1 mb-2">
                    <p className="text-sm font-medium text-foreground flex-1">"{brief.recommendedHook}"</p>
                    <CopyButton text={brief.recommendedHook} />
                  </div>
                  <p className="text-xs text-muted-foreground">{brief.rationale}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Context */}
      {report.competitorContext && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Competitor Context</p>
          <p className="text-sm text-foreground/80 leading-relaxed bg-card/40 border rounded-lg p-3">
            {report.competitorContext}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Add to Queue Dialog ───────────────────────────────────────────────────────

interface QueueFormData {
  platform: string;
  contentType: string;
  caption: string;
  icp: string;
  scheduledFor: string;
  notes: string;
}

const EMPTY_FORM: QueueFormData = {
  platform: "",
  contentType: "",
  caption: "",
  icp: "",
  scheduledFor: "",
  notes: "",
};

function AddToQueueDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initial?: Partial<QueueFormData>;
}) {
  const [form, setForm] = useState<QueueFormData>(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);

  const set = (k: keyof QueueFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.platform || !form.contentType || !form.caption || !form.icp) return;
    const payload: any = {
      platform: form.platform,
      contentType: form.contentType,
      caption: form.caption,
      icp: form.icp,
      notes: form.notes || null,
      scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).getTime() : null,
    };
    onSave(payload);
    setForm(EMPTY_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="add-to-queue-dialog">
        <DialogHeader>
          <DialogTitle>Add to Publish Queue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => set("platform", v)}>
                <SelectTrigger data-testid="platform-select">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content Type</Label>
              <Select value={form.contentType} onValueChange={v => set("contentType", v)}>
                <SelectTrigger data-testid="content-type-select">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ICP Audience</Label>
            <Select value={form.icp} onValueChange={v => set("icp", v)}>
              <SelectTrigger data-testid="icp-select">
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="concierge">Concierge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Textarea
              value={form.caption}
              onChange={e => set("caption", e.target.value)}
              placeholder="Post caption or ad copy..."
              rows={4}
              data-testid="caption-textarea"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Schedule Date & Time</Label>
            <Input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={e => set("scheduledFor", e.target.value)}
              data-testid="schedule-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any notes for this post..."
              data-testid="notes-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!form.platform || !form.contentType || !form.caption || !form.icp}
            data-testid="save-queue-item-btn"
          >
            Add to Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab 1: Weekly Intelligence ────────────────────────────────────────────────

function WeeklyIntelligenceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeReport, setActiveReport] = useState<FeedbackReportData | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>("new");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: reports = [], isLoading: reportsLoading } = useQuery<FeedbackReportRow[]>({
    queryKey: ["/api/feedback/reports"],
    queryFn: () => apiRequest("GET", "/api/feedback/reports").then(r => r.json()),
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feedback/run").then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      setActiveReport(data as FeedbackReportData);
      setActiveStatus("new");
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/reports"] });
      toast({ title: "Report generated", description: `Week of ${data.weekOf}` });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Weekly Intelligence Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyzes ad performance + competitor activity to generate next week's brief recommendations.
          </p>
        </div>
        <Button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="bg-signal hover:bg-signal/90 text-black font-semibold gap-2"
          data-testid="generate-report-btn"
        >
          <Sparkles className="h-4 w-4" />
          {runMutation.isPending ? "Analyzing..." : "Generate This Week's Report"}
        </Button>
      </div>

      {/* Loading state */}
      {runMutation.isPending && (
        <Card className="border border-signal/30 bg-signal/5">
          <CardContent className="p-6 flex items-center gap-4">
            <RefreshCw className="h-5 w-5 text-signal animate-spin" />
            <div>
              <p className="text-sm font-medium text-signal">Analyzing performance data and competitor activity...</p>
              <p className="text-xs text-muted-foreground mt-0.5">This usually takes 15–30 seconds</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active report */}
      {activeReport && !runMutation.isPending && (
        <Card className="border border-signal/20 bg-card/60">
          <CardContent className="p-6">
            <ReportDisplay report={activeReport} status={activeStatus} />
          </CardContent>
        </Card>
      )}

      {/* Past Reports */}
      {reports.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Past Reports</p>
          <div className="space-y-2">
            {reports.map(r => (
              <Card key={r.id} className="border bg-card/40 cursor-pointer hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    data-testid={`past-report-${r.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Week of {r.weekOf}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(r.generatedAt)} · {r.newBriefsCount} briefs generated
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-muted-foreground">{expandedId === r.id ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>
                  {expandedId === r.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <ReportDisplay report={r.summary} status={r.status} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && !runMutation.isPending && !activeReport && (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No reports yet. Click "Generate This Week's Report" to start.</p>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Publish Queue ──────────────────────────────────────────────────────

function PublishQueueTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<QueueItem | null>(null);

  const { data: queueItems = [], isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/publish-queue"],
    queryFn: () => apiRequest("GET", "/api/publish-queue").then(r => r.json()),
  });

  const { data: stats } = useQuery<QueueStats>({
    queryKey: ["/api/publish-queue/stats"],
    queryFn: () => apiRequest("GET", "/api/publish-queue/stats").then(r => r.json()),
  });

  const { data: bufferStatus } = useQuery({
    queryKey: ["/api/publish-queue/send-to-buffer"],
    queryFn: () => apiRequest("POST", "/api/publish-queue/send-to-buffer").then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/publish-queue", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue/stats"] });
      setAddOpen(false);
      toast({ title: "Added to queue" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/publish-queue/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue/stats"] });
      setEditItem(null);
      toast({ title: "Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/publish-queue/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue/stats"] });
      toast({ title: "Removed from queue" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markPublished = (id: number) => {
    updateMutation.mutate({ id, data: { status: "published", publishedAt: Date.now() } });
  };

  const bufferConnected = bufferStatus?.status !== "buffer_not_connected";

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats?.queued ?? 0}</span> queued
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-signal" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats?.published ?? 0}</span> published
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats?.failed ?? 0}</span> failed
            </span>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="gap-2 font-semibold"
          data-testid="add-to-queue-btn"
        >
          <Plus className="h-4 w-4" />
          Add to Queue
        </Button>
      </div>

      {/* Buffer notice */}
      {!bufferConnected && (
        <Card className="border border-border bg-card/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Connect Buffer to auto-publish</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add <code className="bg-muted px-1 py-0.5 rounded text-[10px]">BUFFER_ACCESS_TOKEN</code> to your
                environment variables to enable automatic publishing to social media.
              </p>
            </div>
            <a
              href="https://buffer.com/developers/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-signal flex items-center gap-1 hover:underline shrink-0"
              data-testid="buffer-link"
            >
              Get Buffer token <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* Queue table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : queueItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No items in queue. Add your first post above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queueItems.map(item => (
            <Card key={item.id} className="border bg-card/40 hover:bg-card/60 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Platform icon */}
                  <div className="p-2 rounded-md bg-muted/50 text-muted-foreground shrink-0">
                    <PlatformIcon platform={item.platform} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-foreground capitalize">{item.platform}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">· {item.contentType}</span>
                      <IcpBadge icp={item.icp} />
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{item.caption}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {item.scheduledFor && (
                        <span className="text-[11px] text-muted-foreground">
                          Scheduled: {formatDateTime(item.scheduledFor)}
                        </span>
                      )}
                      {item.notes && (
                        <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">
                          {item.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "queued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-signal border-signal/30 hover:bg-signal/10"
                        onClick={() => markPublished(item.id)}
                        data-testid={`mark-published-${item.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Published
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditItem(item)}
                      data-testid={`edit-queue-${item.id}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`delete-queue-${item.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <AddToQueueDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={data => addMutation.mutate(data)}
      />

      {/* Edit dialog */}
      {editItem && (
        <AddToQueueDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onSave={data => updateMutation.mutate({ id: editItem.id, data })}
          initial={{
            platform: editItem.platform,
            contentType: editItem.contentType,
            caption: editItem.caption,
            icp: editItem.icp,
            scheduledFor: editItem.scheduledFor
              ? new Date(editItem.scheduledFor).toISOString().slice(0, 16)
              : "",
            notes: editItem.notes || "",
          }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FeedbackLoop() {
  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Page Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-[hsl(192,100%,50%)]/10">
            <RefreshCw className="h-5 w-5 text-[hsl(192,100%,50%)]" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Feedback Loop</h1>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
            <span className="text-[10px] text-signal font-semibold uppercase tracking-wide">Live</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground ml-11">
          Weekly automated analysis of ad performance → generates new creative briefs and queues content for next week.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="intelligence" className="space-y-6">
        <TabsList className="bg-card border border-border" data-testid="feedback-tabs">
          <TabsTrigger value="intelligence" className="gap-2" data-testid="tab-intelligence">
            <Sparkles className="h-3.5 w-3.5" />
            Weekly Intelligence
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2" data-testid="tab-queue">
            <Layers className="h-3.5 w-3.5" />
            Publish Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <WeeklyIntelligenceTab />
        </TabsContent>

        <TabsContent value="queue">
          <PublishQueueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
