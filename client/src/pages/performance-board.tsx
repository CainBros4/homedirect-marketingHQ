import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart2, DollarSign, TrendingUp, Users, ChevronDown, ChevronUp,
  Plus, Trash2, Sparkles, Loader2, Copy, Check, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  icp: string;
  platform: string;
  status: string;
  startDate: number | null;
  budget: number | null;
  createdAt: number;
}

interface AdPerformanceRecord {
  id: number;
  campaignId: number;
  adName: string;
  format: string;
  icp: string;
  hook: string | null;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  date: number;
  notes: string | null;
}

interface PerformanceSummary {
  totalSpend: number;
  totalLeads: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgCPL: number;
  topPerformers: AdPerformanceRecord[];
  worstPerformers: AdPerformanceRecord[];
  byFormat: { format: string; impressions: number; clicks: number; leads: number; spend: number; ctr: number; cpl: number }[];
}

interface AnalysisResult {
  winners: { adName: string; metric: string; value: string; insight: string }[];
  losers: { adName: string; metric: string; value: string; insight: string }[];
  patterns: string[];
  recommendations: string[];
  generatedAt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCTR(impressions: number, clicks: number) {
  if (impressions === 0) return "0.00%";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

function formatCPL(spend: number, leads: number) {
  if (leads === 0) return "—";
  return formatCurrency(spend / leads);
}

const ICP_COLORS: Record<string, string> = {
  buyer: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  seller: "bg-[hsl(152,100%,39%)]/20 text-[hsl(152,100%,39%)] border-[hsl(152,100%,39%)]/30",
  concierge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const PLATFORM_BADGE: Record<string, string> = {
  meta: "bg-blue-500/20 text-blue-300",
  google: "bg-red-500/20 text-red-300",
  tiktok: "bg-pink-500/20 text-pink-300",
  organic: "bg-purple-500/20 text-purple-300",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[hsl(152,100%,39%)]/20 text-[hsl(152,100%,39%)]",
  paused: "bg-amber-500/20 text-amber-300",
  completed: "bg-muted text-muted-foreground",
};

const CHART_COLORS = {
  carousel: "#00C47A",
  reel: "#00D4FF",
  static: "#f59e0b",
  story: "#a855f7",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, colorClass, subtext,
}: {
  label: string; value: string; icon: React.ElementType; colorClass: string; subtext?: string;
}) {
  return (
    <Card className="border border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg bg-background/50 ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {subtext && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

// ── New Campaign Dialog ───────────────────────────────────────────────────────

function NewCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icp, setIcp] = useState("");
  const [platform, setPlatform] = useState("");
  const [budget, setBudget] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/campaigns", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created" });
      setOpen(false);
      setName(""); setIcp(""); setPlatform(""); setBudget("");
      onCreated();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !icp || !platform) return;
    mutation.mutate({
      name,
      icp,
      platform,
      budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,34%)] text-black font-semibold"
          data-testid="new-campaign-btn"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              placeholder="e.g. Seller Commission Awareness Q1"
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="campaign-name-input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ICP</Label>
              <Select value={icp} onValueChange={setIcp} required>
                <SelectTrigger data-testid="campaign-icp-select">
                  <SelectValue placeholder="Select ICP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="concierge">Concierge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform} required>
                <SelectTrigger data-testid="campaign-platform-select">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-budget">Budget (USD, optional)</Label>
            <Input
              id="campaign-budget"
              type="number"
              placeholder="e.g. 2500"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              data-testid="campaign-budget-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,34%)] text-black font-semibold"
              disabled={mutation.isPending}
              data-testid="campaign-submit-btn"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Performance Record Panel ──────────────────────────────────────────────

function AddRecordPanel({
  campaigns,
  onAdded,
}: {
  campaigns: Campaign[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    campaignId: "", adName: "", format: "", icp: "", hook: "",
    impressions: "", clicks: "", leads: "", spend: "", date: "", notes: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/performance", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/summary"] });
      toast({ title: "Record added" });
      setForm({ campaignId: "", adName: "", format: "", icp: "", hook: "", impressions: "", clicks: "", leads: "", spend: "", date: "", notes: "" });
      onAdded();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      campaignId: Number(form.campaignId),
      adName: form.adName,
      format: form.format,
      icp: form.icp,
      hook: form.hook || undefined,
      impressions: Number(form.impressions) || 0,
      clicks: Number(form.clicks) || 0,
      leads: Number(form.leads) || 0,
      spend: Math.round(parseFloat(form.spend || "0") * 100),
      date: form.date ? new Date(form.date).getTime() : Date.now(),
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors rounded-lg"
        onClick={() => setOpen(o => !o)}
        data-testid="add-record-toggle"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-[hsl(152,100%,39%)]" />
          Add Performance Record
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Campaign */}
              <div className="space-y-1.5">
                <Label>Campaign</Label>
                <Select value={form.campaignId} onValueChange={v => setForm(f => ({ ...f, campaignId: v }))}>
                  <SelectTrigger data-testid="record-campaign-select">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Ad Name */}
              <div className="space-y-1.5">
                <Label>Ad Name</Label>
                <Input
                  placeholder="e.g. Seller Pain Reel v1"
                  value={form.adName}
                  onChange={set("adName")}
                  data-testid="record-adname-input"
                  required
                />
              </div>
              {/* Format */}
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                  <SelectTrigger data-testid="record-format-select">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carousel">Carousel</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="static">Static</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* ICP */}
              <div className="space-y-1.5">
                <Label>ICP</Label>
                <Select value={form.icp} onValueChange={v => setForm(f => ({ ...f, icp: v }))}>
                  <SelectTrigger data-testid="record-icp-select">
                    <SelectValue placeholder="ICP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="concierge">Concierge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Date */}
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={set("date")}
                  data-testid="record-date-input"
                  required
                />
              </div>
              {/* Spend */}
              <div className="space-y-1.5">
                <Label>Spend ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={form.spend}
                  onChange={set("spend")}
                  data-testid="record-spend-input"
                />
              </div>
              {/* Impressions */}
              <div className="space-y-1.5">
                <Label>Impressions</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.impressions}
                  onChange={set("impressions")}
                  data-testid="record-impressions-input"
                />
              </div>
              {/* Clicks */}
              <div className="space-y-1.5">
                <Label>Clicks</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.clicks}
                  onChange={set("clicks")}
                  data-testid="record-clicks-input"
                />
              </div>
              {/* Leads */}
              <div className="space-y-1.5">
                <Label>Leads</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.leads}
                  onChange={set("leads")}
                  data-testid="record-leads-input"
                />
              </div>
            </div>
            {/* Hook */}
            <div className="space-y-1.5">
              <Label>Hook (opening line)</Label>
              <Input
                placeholder="e.g. You paid your agent AND the buyer's agent..."
                value={form.hook}
                onChange={set("hook")}
                data-testid="record-hook-input"
              />
            </div>
            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this ad..."
                value={form.notes}
                onChange={set("notes")}
                data-testid="record-notes-input"
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,34%)] text-black font-semibold"
                disabled={mutation.isPending || !form.campaignId || !form.adName || !form.format || !form.icp}
                data-testid="record-submit-btn"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Record
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Campaign Row ─────────────────────────────────────────────────────────────

function CampaignRow({ campaign, records }: { campaign: Campaign; records: AdPerformanceRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const campaignRecords = records.filter(r => r.campaignId === campaign.id);
  const totalSpend = campaignRecords.reduce((s, r) => s + r.spend, 0);
  const totalLeads = campaignRecords.reduce((s, r) => s + r.leads, 0);

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteRecord = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/performance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/summary"] });
    },
  });

  const nextStatus = campaign.status === "active" ? "paused" : campaign.status === "paused" ? "active" : "active";

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
        <button
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(e => !e)}
          data-testid={`expand-campaign-${campaign.id}`}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ICP_COLORS[campaign.icp] || "bg-muted text-muted-foreground"}`}>
              {campaign.icp}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_BADGE[campaign.platform] || "bg-muted text-muted-foreground"}`}>
              {campaign.platform}
            </span>
          </div>
        </div>
        <button
          onClick={() => statusMutation.mutate(nextStatus)}
          className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[campaign.status] || ""}`}
          data-testid={`toggle-status-${campaign.id}`}
          title={`Click to set ${nextStatus}`}
        >
          {campaign.status}
        </button>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-foreground">{formatCurrency(totalSpend)}</p>
          <p className="text-[10px] text-muted-foreground">{totalLeads} leads</p>
        </div>
      </div>

      {expanded && campaignRecords.length > 0 && (
        <div className="bg-background/50 border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Ad Name</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Format</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Impr.</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Clicks</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">CTR</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Leads</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Spend</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">CPL</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {campaignRecords.map(r => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2 text-foreground font-medium max-w-[180px] truncate">{r.adName}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground capitalize">{r.format}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.impressions.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-[hsl(192,100%,50%)] font-medium">{formatCTR(r.impressions, r.clicks)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.leads}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(r.spend)}</td>
                    <td className="px-3 py-2 text-right text-[hsl(152,100%,39%)] font-medium">{formatCPL(r.spend, r.leads)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteRecord.mutate(r.id)}
                        className="text-muted-foreground/40 hover:text-red-400 transition-colors"
                        data-testid={`delete-record-${r.id}`}
                        aria-label="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expanded && campaignRecords.length === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground bg-background/50 border-t border-border">
          No performance records for this campaign yet.
        </div>
      )}
    </div>
  );
}

// ── Chart metric toggle ────────────────────────────────────────────────────────

type ChartMetric = "ctr" | "cpl" | "impressions";

function PerformanceChart({ summary }: { summary: PerformanceSummary }) {
  const [metric, setMetric] = useState<ChartMetric>("ctr");

  const data = summary.byFormat.map(f => ({
    format: f.format,
    ctr: parseFloat(f.ctr.toFixed(2)),
    cpl: parseFloat((f.cpl / 100).toFixed(2)),
    impressions: f.impressions,
  }));

  const METRIC_LABELS: Record<ChartMetric, string> = {
    ctr: "CTR (%)",
    cpl: "CPL ($)",
    impressions: "Impressions",
  };

  const formatYAxis = (v: number) => {
    if (metric === "ctr") return `${v}%`;
    if (metric === "cpl") return `$${v}`;
    return v > 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
  };

  const formatTooltip = (v: number) => {
    if (metric === "ctr") return [`${v}%`, "CTR"];
    if (metric === "cpl") return [`$${v}`, "CPL"];
    return [v.toLocaleString(), "Impressions"];
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-foreground">Performance by Format</p>
        <div className="flex gap-1">
          {(["ctr", "cpl", "impressions"] as ChartMetric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`text-[10px] px-2.5 py-1 rounded font-semibold uppercase tracking-wide transition-colors ${
                metric === m
                  ? "bg-[hsl(192,100%,50%)]/20 text-[hsl(192,100%,50%)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              data-testid={`chart-toggle-${m}`}
            >
              {m === "impressions" ? "Impr." : m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          No data yet
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="format"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                width={50}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                labelStyle={{ color: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                formatter={formatTooltip}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={60}>
                {data.map((entry) => (
                  <Cell
                    key={entry.format}
                    fill={CHART_COLORS[entry.format as keyof typeof CHART_COLORS] || "#00C47A"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-[10px] text-muted-foreground mt-1">{METRIC_LABELS[metric]}</p>
        </div>
      )}
    </div>
  );
}

// ── AI Analysis Section ───────────────────────────────────────────────────────

function CopyableRec({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-start gap-2 group">
      <p className="text-sm text-foreground flex-1 leading-relaxed">{text}</p>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 text-muted-foreground/40 hover:text-[hsl(192,100%,50%)] transition-colors opacity-0 group-hover:opacity-100"
        title="Copy"
        data-testid="copy-rec-btn"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function AiAnalysisSection() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/performance/analyze", {}).then(r => {
      if (!r.ok) return r.json().then((e: { error: string }) => { throw new Error(e.error); });
      return r.json();
    }),
    onSuccess: (data: AnalysisResult) => setResult(data),
    onError: (err: Error) => toast({ title: "Analysis failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(192,100%,50%)]" />
            AI Performance Analysis
          </CardTitle>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-[hsl(192,100%,50%)]/20 hover:bg-[hsl(192,100%,50%)]/30 text-[hsl(192,100%,50%)] border border-[hsl(192,100%,50%)]/30 font-semibold text-sm"
            variant="outline"
            data-testid="analyze-btn"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                Analyze Performance
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!result && !mutation.isPending && (
          <div className="text-sm text-muted-foreground py-2">
            Click "Analyze Performance" to get AI-powered insights on your top and bottom performers, patterns, and next-week recommendations.
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(192,100%,50%)]" />
            Processing performance data…
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Winners */}
            {result.winners?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(152,100%,39%)] mb-2">Winners</p>
                <div className="space-y-2">
                  {result.winners.map((w, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-[hsl(152,100%,39%)]/10 border border-[hsl(152,100%,39%)]/20">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{w.adName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.insight}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-[hsl(152,100%,39%)]">{w.value}</p>
                        <p className="text-[10px] text-muted-foreground">{w.metric}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Losers */}
            {result.losers?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">Underperformers</p>
                <div className="space-y-2">
                  {result.losers.map((l, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{l.adName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{l.insight}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-red-400">{l.value}</p>
                        <p className="text-[10px] text-muted-foreground">{l.metric}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patterns */}
            {result.patterns?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Patterns</p>
                <ul className="space-y-1.5">
                  {result.patterns.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-[hsl(192,100%,50%)] mt-0.5 shrink-0">›</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Next Week's Actions</p>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <CopyableRec key={i} text={rec} />
                  ))}
                </div>
              </div>
            )}

            {result.generatedAt && (
              <p className="text-[10px] text-muted-foreground/50 pt-2 border-t border-border">
                Generated at {new Date(result.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PerformanceBoard() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => apiRequest("GET", "/api/campaigns").then(r => r.json()),
  });

  const { data: records = [] } = useQuery<AdPerformanceRecord[]>({
    queryKey: ["/api/performance"],
    queryFn: () => apiRequest("GET", "/api/performance").then(r => r.json()),
  });

  const { data: summary } = useQuery<PerformanceSummary>({
    queryKey: ["/api/performance/summary"],
    queryFn: () => apiRequest("GET", "/api/performance/summary").then(r => r.json()),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/performance/summary"] });
  };

  const isEmpty = campaigns.length === 0 && records.length === 0;

  return (
    <div className="px-8 py-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BarChart2 className="h-5 w-5 text-[hsl(192,100%,50%)]" />
            <h1 className="text-xl font-bold text-foreground">Performance Board</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Track CTR, CPL, ROAS, and spend by creative, ICP, and format.
          </p>
        </div>
        <NewCampaignDialog onCreated={refreshAll} />
      </div>

      {/* Empty state */}
      {isEmpty && !loadingCampaigns && (
        <Card className="border border-dashed border-border bg-card/50">
          <CardContent className="py-16 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No performance data yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              Add your first campaign and start tracking results.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Spend"
            value={formatCurrency(summary.totalSpend)}
            icon={DollarSign}
            colorClass="text-amber-400"
            subtext={`${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}`}
          />
          <KpiCard
            label="Average CTR"
            value={`${summary.avgCTR.toFixed(2)}%`}
            icon={TrendingUp}
            colorClass="text-[hsl(192,100%,50%)]"
            subtext={`${summary.totalImpressions.toLocaleString()} impressions`}
          />
          <KpiCard
            label="Cost Per Lead"
            value={summary.totalLeads > 0 ? formatCurrency(summary.avgCPL) : "—"}
            icon={TrendingUp}
            colorClass="text-[hsl(152,100%,39%)]"
            subtext={`${summary.totalClicks.toLocaleString()} clicks`}
          />
          <KpiCard
            label="Total Leads"
            value={summary.totalLeads.toLocaleString()}
            icon={Users}
            colorClass="text-foreground"
            subtext={`from ${records.length} ad record${records.length !== 1 ? "s" : ""}`}
          />
        </div>
      )}

      {/* Campaigns + Chart */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Campaign list */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Campaigns</CardTitle>
                <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {campaigns.map(c => (
                  <CampaignRow key={c.id} campaign={c} records={records} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="border border-border bg-card">
            <CardContent className="p-5 h-72">
              {summary && summary.byFormat.length > 0 ? (
                <PerformanceChart summary={summary} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Add performance records to see the chart.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Record Panel */}
      {campaigns.length > 0 && (
        <AddRecordPanel campaigns={campaigns} onAdded={refreshAll} />
      )}

      {/* AI Analysis */}
      <AiAnalysisSection />
    </div>
  );
}
