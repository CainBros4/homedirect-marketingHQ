import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Layers, Plus, Pencil, Trash2, Star, Circle, ChevronDown,
  FileText, Film, Image, BookOpen, Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Asset {
  id: number;
  name: string;
  format: string;
  icp: string;
  platform: string;
  status: string;
  hook: string | null;
  angle: string | null;
  fileUrl: string | null;
  notes: string | null;
  linkedBriefId: number | null;
  createdAt: number;
  updatedAt: number;
}

interface AssetStats {
  byStatus: Record<string, number>;
  byFormat: Record<string, number>;
  byIcp: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot?: string; icon?: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "bg-zinc-700/60 text-zinc-300 border-zinc-600/40" },
  ready:    { label: "Ready",    color: "bg-blue-900/60 text-blue-300 border-blue-700/40" },
  live:     { label: "Live",     color: "bg-emerald-900/60 text-emerald-300 border-emerald-700/40", dot: "bg-emerald-400 animate-pulse" },
  paused:   { label: "Paused",   color: "bg-yellow-900/60 text-yellow-300 border-yellow-700/40" },
  winner:   { label: "Winner",   color: "bg-amber-900/60 text-amber-300 border-amber-700/40" },
  loser:    { label: "Loser",    color: "bg-red-900/60 text-red-300 border-red-700/40" },
  archived: { label: "Archived", color: "bg-zinc-800/40 text-zinc-500 border-zinc-700/30" },
};

const ICP_CONFIG: Record<string, { label: string; color: string }> = {
  buyer:     { label: "Buyer",     color: "bg-blue-900/50 text-blue-300 border-blue-700/40" },
  seller:    { label: "Seller",    color: "bg-emerald-900/50 text-emerald-300 border-emerald-700/40" },
  concierge: { label: "Concierge", color: "bg-amber-900/50 text-amber-300 border-amber-700/40" },
};

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  carousel: { label: "Carousel", icon: <BookOpen className="h-3 w-3" /> },
  reel:     { label: "Reel",     icon: <Film className="h-3 w-3" /> },
  static:   { label: "Static",   icon: <Image className="h-3 w-3" /> },
  story:    { label: "Story",    icon: <Circle className="h-3 w-3" /> },
  email:    { label: "Email",    icon: <Mail className="h-3 w-3" /> },
};

const PLATFORM_CONFIG: Record<string, string> = {
  meta:      "Meta",
  instagram: "Instagram",
  tiktok:    "TikTok",
  google:    "Google",
  email:     "Email",
};

const ANGLE_LABELS: Record<string, string> = {
  pain:         "Pain",
  savings:      "Savings",
  curiosity:    "Curiosity",
  social_proof: "Social Proof",
  urgency:      "Urgency",
};

const STATUSES = Object.keys(STATUS_CONFIG);
const FORMATS  = Object.keys(FORMAT_CONFIG);
const ICPS     = Object.keys(ICP_CONFIG);
const PLATFORMS = Object.keys(PLATFORM_CONFIG);
const ANGLES   = Object.keys(ANGLE_LABELS);

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border", cfg.color)}>
      {cfg.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
      {status === "winner" && <Star className="h-2.5 w-2.5 shrink-0 fill-current" />}
      {cfg.label}
    </span>
  );
}

function IcpBadge({ icp }: { icp: string }) {
  const cfg = ICP_CONFIG[icp] || { label: icp, color: "bg-zinc-700/60 text-zinc-300 border-zinc-600/40" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border", cfg.color)}>
      {cfg.label}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  const cfg = FORMAT_CONFIG[format] || { label: format, icon: null };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function KpiChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium", color)}>
      <span className="font-bold text-base tabular-nums leading-none">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/40 mb-4">
        <Layers className="h-8 w-8 text-zinc-500" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No assets yet</h3>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">
        Add your first creative asset to start tracking it through its lifecycle — draft, live, winner, loser.
      </p>
      <Button size="sm" className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,35%)] text-black font-semibold" onClick={onAdd} data-testid="empty-add-asset">
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add your first creative asset
      </Button>
    </div>
  );
}

// ── Add / Edit Form ────────────────────────────────────────────────────────────

interface AssetFormData {
  name: string;
  format: string;
  icp: string;
  platform: string;
  status: string;
  hook: string;
  angle: string;
  notes: string;
  fileUrl: string;
}

const EMPTY_FORM: AssetFormData = {
  name: "", format: "", icp: "", platform: "",
  status: "draft", hook: "", angle: "", notes: "", fileUrl: "",
};

function AddAssetDialog({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (data: AssetFormData) => void }) {
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM);

  function handleSave() {
    if (!form.name || !form.format || !form.icp || !form.platform) return;
    onSave(form);
    setForm(EMPTY_FORM);
    onOpenChange(false);
  }

  const set = (field: keyof AssetFormData) => (v: string) =>
    setForm(prev => ({ ...prev, [field]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border" data-testid="add-asset-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Layers className="h-4 w-4 text-[hsl(152,100%,39%)]" /> Add Asset
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input
              className="mt-1 bg-background border-border text-foreground"
              placeholder="e.g. Buyer Carousel v1 — Pain Angle"
              value={form.name}
              onChange={e => set("name")(e.target.value)}
              data-testid="asset-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Format *</Label>
              <Select value={form.format} onValueChange={set("format")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="asset-format-select">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map(f => (
                    <SelectItem key={f} value={f}>{FORMAT_CONFIG[f].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ICP *</Label>
              <Select value={form.icp} onValueChange={set("icp")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="asset-icp-select">
                  <SelectValue placeholder="Select ICP" />
                </SelectTrigger>
                <SelectContent>
                  {ICPS.map(i => (
                    <SelectItem key={i} value={i}>{ICP_CONFIG[i].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Platform *</Label>
              <Select value={form.platform} onValueChange={set("platform")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="asset-platform-select">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="asset-status-select">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Angle</Label>
            <Select value={form.angle} onValueChange={set("angle")}>
              <SelectTrigger className="mt-1 bg-background border-border" data-testid="asset-angle-select">
                <SelectValue placeholder="Select angle (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {ANGLES.map(a => (
                  <SelectItem key={a} value={a}>{ANGLE_LABELS[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Hook</Label>
            <Textarea
              className="mt-1 bg-background border-border text-foreground text-sm resize-none"
              placeholder="The hook/headline used in this asset…"
              rows={2}
              value={form.hook}
              onChange={e => set("hook")(e.target.value)}
              data-testid="asset-hook-textarea"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              className="mt-1 bg-background border-border text-foreground text-sm resize-none"
              placeholder="Any notes, context, or links…"
              rows={2}
              value={form.notes}
              onChange={e => set("notes")(e.target.value)}
              data-testid="asset-notes-textarea"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-add-asset">
            Cancel
          </Button>
          <Button
            className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,35%)] text-black font-semibold"
            onClick={handleSave}
            disabled={!form.name || !form.format || !form.icp || !form.platform}
            data-testid="save-add-asset"
          >
            Save Asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Sheet ───────────────────────────────────────────────────────────────

function AssetDetailSheet({
  asset, open, onOpenChange, onSave,
}: { asset: Asset | null; open: boolean; onOpenChange: (v: boolean) => void; onSave: (id: number, data: Partial<AssetFormData>) => void }) {
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  // Sync form when asset changes
  useState(() => {
    if (asset) {
      setForm({
        name: asset.name,
        format: asset.format,
        icp: asset.icp,
        platform: asset.platform,
        status: asset.status,
        hook: asset.hook || "",
        angle: asset.angle || "",
        notes: asset.notes || "",
        fileUrl: asset.fileUrl || "",
      });
      setDirty(false);
    }
  });

  // Re-sync when asset prop changes
  const prevAssetId = useMemo(() => asset?.id, [asset]);
  useMemo(() => {
    if (asset) {
      setForm({
        name: asset.name,
        format: asset.format,
        icp: asset.icp,
        platform: asset.platform,
        status: asset.status,
        hook: asset.hook || "",
        angle: asset.angle || "",
        notes: asset.notes || "",
        fileUrl: asset.fileUrl || "",
      });
      setDirty(false);
    }
  }, [prevAssetId]);

  const set = (field: keyof AssetFormData) => (v: string) => {
    setForm(prev => ({ ...prev, [field]: v }));
    setDirty(true);
  };

  function handleSave() {
    if (!asset) return;
    onSave(asset.id, form);
    setDirty(false);
  }

  if (!asset) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[520px] bg-card border-border overflow-y-auto" data-testid="asset-detail-sheet">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground text-sm">
            <Layers className="h-4 w-4 text-[hsl(152,100%,39%)]" />
            Edit Asset
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <StatusBadge status={asset.status} />
            <FormatBadge format={asset.format} />
            <IcpBadge icp={asset.icp} />
          </div>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              className="mt-1 bg-background border-border text-foreground"
              value={form.name}
              onChange={e => set("name")(e.target.value)}
              data-testid="sheet-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={form.format} onValueChange={set("format")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="sheet-format-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map(f => (
                    <SelectItem key={f} value={f}>{FORMAT_CONFIG[f].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ICP</Label>
              <Select value={form.icp} onValueChange={set("icp")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="sheet-icp-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICPS.map(i => (
                    <SelectItem key={i} value={i}>{ICP_CONFIG[i].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <Select value={form.platform} onValueChange={set("platform")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="sheet-platform-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger className="mt-1 bg-background border-border" data-testid="sheet-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Angle</Label>
            <Select value={form.angle || ""} onValueChange={set("angle")}>
              <SelectTrigger className="mt-1 bg-background border-border" data-testid="sheet-angle-select">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {ANGLES.map(a => (
                  <SelectItem key={a} value={a}>{ANGLE_LABELS[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Hook</Label>
            <Textarea
              className="mt-1 bg-background border-border text-foreground text-sm resize-none"
              placeholder="Hook or headline…"
              rows={3}
              value={form.hook}
              onChange={e => set("hook")(e.target.value)}
              data-testid="sheet-hook-textarea"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">File URL</Label>
            <Input
              className="mt-1 bg-background border-border text-foreground text-sm"
              placeholder="https://…"
              value={form.fileUrl}
              onChange={e => set("fileUrl")(e.target.value)}
              data-testid="sheet-fileurl-input"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              className="mt-1 bg-background border-border text-foreground text-sm resize-none"
              placeholder="Notes, context, or links…"
              rows={3}
              value={form.notes}
              onChange={e => set("notes")(e.target.value)}
              data-testid="sheet-notes-textarea"
            />
          </div>

          <div className="text-[10px] text-muted-foreground/60 pt-1">
            Created {new Date(asset.createdAt).toLocaleDateString()} · ID #{asset.id}
            {asset.linkedBriefId && ` · Brief #${asset.linkedBriefId}`}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            className="w-full bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,35%)] text-black font-semibold"
            onClick={handleSave}
            disabled={!dirty}
            data-testid="sheet-save-btn"
          >
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Asset Card ─────────────────────────────────────────────────────────────────

function AssetCard({
  asset, onEdit, onStatusChange, onDelete,
}: {
  asset: Asset;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className="bg-card border-border hover:border-zinc-600/60 transition-all cursor-pointer group"
      onClick={onEdit}
      data-testid={`asset-card-${asset.id}`}
    >
      <CardContent className="p-4">
        {/* Top row: status + format + ICP */}
        <div className="flex items-start justify-between mb-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={asset.status} />
            <FormatBadge format={asset.format} />
          </div>
          <IcpBadge icp={asset.icp} />
        </div>

        {/* Name */}
        <p className="text-sm font-semibold text-foreground leading-tight mb-1.5 line-clamp-2">
          {asset.name}
        </p>

        {/* Hook */}
        {asset.hook && (
          <p className="text-xs text-muted-foreground truncate mb-2" title={asset.hook}>
            {asset.hook}
          </p>
        )}

        {/* Platform + Angle row */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 font-medium">
            {PLATFORM_CONFIG[asset.platform] || asset.platform}
          </span>
          {asset.angle && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-500 border border-zinc-700/40">
              {ANGLE_LABELS[asset.angle] || asset.angle}
            </span>
          )}
        </div>

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(asset.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Edit button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              data-testid={`edit-asset-${asset.id}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>

            {/* Status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-0.5"
                  data-testid={`status-dropdown-${asset.id}`}
                >
                  Status <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {STATUSES.map(s => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => onStatusChange(s)}
                    className={cn("text-xs", asset.status === s && "font-semibold")}
                    data-testid={`status-option-${asset.id}-${s}`}
                  >
                    {STATUS_CONFIG[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`delete-asset-${asset.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Filter bar helpers ────────────────────────────────────────────────────────

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
      )}
    >
      {children}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetLibrary() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters (all client-side)
  const [filterIcp, setFilterIcp] = useState("");
  const [filterFormat, setFilterFormat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => apiRequest("GET", "/api/assets").then(r => r.json()),
  });

  const { data: stats } = useQuery<AssetStats>({
    queryKey: ["/api/assets/stats"],
    queryFn: () => apiRequest("GET", "/api/assets/stats").then(r => r.json()),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: AssetFormData) =>
      apiRequest("POST", "/api/assets", {
        ...data,
        hook: data.hook || null,
        angle: data.angle || null,
        notes: data.notes || null,
        fileUrl: data.fileUrl || null,
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      qc.invalidateQueries({ queryKey: ["/api/assets/stats"] });
      toast({ title: "Asset created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssetFormData> }) =>
      apiRequest("PATCH", `/api/assets/${id}`, {
        ...data,
        hook: data.hook || null,
        angle: data.angle || null,
        notes: data.notes || null,
        fileUrl: data.fileUrl || null,
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      qc.invalidateQueries({ queryKey: ["/api/assets/stats"] });
      toast({ title: "Asset updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assets/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      qc.invalidateQueries({ queryKey: ["/api/assets/stats"] });
      toast({ title: "Asset deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAdd(data: AssetFormData) {
    createMutation.mutate(data);
  }

  function handleSaveEdit(id: number, data: Partial<AssetFormData>) {
    updateMutation.mutate({ id, data });
    setSheetOpen(false);
  }

  function handleStatusChange(id: number, status: string) {
    updateMutation.mutate({ id, data: { status } });
  }

  function handleDelete(id: number) {
    if (selectedAsset?.id === id) setSheetOpen(false);
    deleteMutation.mutate(id);
  }

  function openDetail(asset: Asset) {
    setSelectedAsset(asset);
    setSheetOpen(true);
  }

  // ── Filtered assets (all client-side) ─────────────────────────────────────

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (filterIcp    && a.icp    !== filterIcp)    return false;
      if (filterFormat && a.format !== filterFormat) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });
  }, [assets, filterIcp, filterFormat, filterStatus]);

  // ── KPI counts ─────────────────────────────────────────────────────────────

  const draftCount  = stats?.byStatus?.draft  || 0;
  const readyCount  = stats?.byStatus?.ready  || 0;
  const liveCount   = stats?.byStatus?.live   || 0;
  const winnerCount = stats?.byStatus?.winner || 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-700/30">
            <Layers className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Asset Library</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track creative assets through their lifecycle — draft, live, winner, loser.
            </p>
          </div>
        </div>
        <Button
          className="bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,35%)] text-black font-semibold"
          onClick={() => setShowAdd(true)}
          data-testid="add-asset-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Asset
        </Button>
      </div>

      {/* KPI chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap" data-testid="kpi-strip">
        <KpiChip label="Draft"  count={draftCount}  color="bg-zinc-800/60 text-zinc-400 border-zinc-700/40" />
        <KpiChip label="Ready"  count={readyCount}  color="bg-blue-900/40 text-blue-300 border-blue-800/40" />
        <KpiChip label="Live"   count={liveCount}   color="bg-emerald-900/40 text-emerald-300 border-emerald-800/40" />
        <KpiChip label="Winner" count={winnerCount} color="bg-amber-900/40 text-amber-300 border-amber-800/40" />
        <span className="text-xs text-muted-foreground/50 ml-1">{assets.length} total</span>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap" data-testid="filter-row">
        {/* ICP */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mr-1">ICP</span>
          <FilterBtn active={filterIcp === ""} onClick={() => setFilterIcp("")} data-testid="filter-icp-all">All</FilterBtn>
          {ICPS.map(i => (
            <FilterBtn key={i} active={filterIcp === i} onClick={() => setFilterIcp(i)} data-testid={`filter-icp-${i}`}>
              {ICP_CONFIG[i].label}
            </FilterBtn>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Format */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mr-1">Format</span>
          <FilterBtn active={filterFormat === ""} onClick={() => setFilterFormat("")} data-testid="filter-format-all">All</FilterBtn>
          {FORMATS.map(f => (
            <FilterBtn key={f} active={filterFormat === f} onClick={() => setFilterFormat(f)} data-testid={`filter-format-${f}`}>
              {FORMAT_CONFIG[f].label}
            </FilterBtn>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Status */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mr-1">Status</span>
          <FilterBtn active={filterStatus === ""} onClick={() => setFilterStatus("")} data-testid="filter-status-all">All</FilterBtn>
          {STATUSES.filter(s => s !== "archived").map(s => (
            <FilterBtn key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} data-testid={`filter-status-${s}`}>
              {STATUS_CONFIG[s].label}
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 && assets.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No assets match your current filters.</p>
          <button
            className="text-xs text-primary underline mt-2"
            onClick={() => { setFilterIcp(""); setFilterFormat(""); setFilterStatus(""); }}
            data-testid="clear-filters-btn"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="asset-grid">
          {filtered.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={() => openDetail(asset)}
              onStatusChange={status => handleStatusChange(asset.id, status)}
              onDelete={() => handleDelete(asset.id)}
            />
          ))}
        </div>
      )}

      {/* Dialogs / Sheets */}
      <AddAssetDialog open={showAdd} onOpenChange={setShowAdd} onSave={handleAdd} />
      <AssetDetailSheet
        asset={selectedAsset}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
