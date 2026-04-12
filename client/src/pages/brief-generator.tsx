import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, RefreshCw, Copy, Home, Users, Briefcase, Layers, Film, Image, Download, Clock, History, Trash2, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

type ICP = "buyer" | "seller" | "concierge";
type Format = "all" | "carousel" | "reel" | "static";

interface CarouselSlide {
  slideNumber: number;
  role: string;
  headline: string;
  bodyText: string;
  visualDirection: string;
  textOverlay: string;
}

interface CarouselBrief {
  slideCount: number;
  slides: CarouselSlide[];
  dimensions: string;
  fontRecommendation: string;
  colorDirection: string;
  musicMood: string | null;
}

interface ReelScene {
  timestamp: string;
  visual: string;
  voiceover: string;
  textOverlay: string;
  action: string;
}

interface ReelBrief {
  duration: string;
  hook: string;
  scenes: ReelScene[];
  musicMood: string;
  captionStyle: string;
  dimensions: string;
}

interface StaticVariant {
  name: string;
  headline: string;
  visual: string;
}

interface StaticBrief {
  dimensions: string;
  heroHeadline: string;
  subheadline: string;
  visualDirection: string;
  ctaButton: string;
  colorScheme: string;
  copyPlacement: string;
  variants: StaticVariant[];
}

interface GeneratedBrief {
  carousel?: CarouselBrief;
  reel?: ReelBrief;
  static?: StaticBrief;
}

interface HistoryItem {
  id: number;
  icp: string;
  angle: string | null;
  context: string | null;
  createdAt: number;
  result: GeneratedBrief;
}

const ICP_META: Record<ICP, { label: string; sub: string; icon: React.ReactNode; color: string }> = {
  buyer:     { label: "Buyer",     sub: "Save ~$9,818 on a $430K home",  icon: <Home className="h-4 w-4" />,      color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  seller:    { label: "Seller",    sub: "Keep ~$19,000 more at closing", icon: <Users className="h-4 w-4" />,     color: "border-[#00C47A]/40 bg-[#00C47A]/10 text-[#00C47A]" },
  concierge: { label: "Concierge", sub: "$20/showing, your schedule",    icon: <Briefcase className="h-4 w-4" />, color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
};

const FORMAT_META: Record<Format, { label: string; icon: React.ReactNode }> = {
  all:      { label: "All Formats", icon: <Layers className="h-3.5 w-3.5" /> },
  carousel: { label: "Carousel",    icon: <Layers className="h-3.5 w-3.5" /> },
  reel:     { label: "Reel/Video",  icon: <Film className="h-3.5 w-3.5" /> },
  static:   { label: "Static Ad",   icon: <Image className="h-3.5 w-3.5" /> },
};

const SLIDE_ROLE_COLORS: Record<string, string> = {
  Hook:     "border-[#00D4FF]/40 bg-[#00D4FF]/10 text-[#00D4FF]",
  Problem:  "border-red-400/40 bg-red-400/10 text-red-300",
  Proof:    "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Solution: "border-[#00C47A]/40 bg-[#00C47A]/10 text-[#00C47A]",
  CTA:      "border-[#00C47A]/60 bg-[#00C47A]/20 text-[#00C47A]",
};

function FieldRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const { toast } = useToast();
  return (
    <div className="group relative">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <div className="flex items-start gap-2 bg-muted/20 border border-border rounded-md px-3 py-2 pr-9">
        <p className="text-sm text-foreground leading-relaxed flex-1">{value}</p>
        <button
          data-testid={testId || `copy-${label}`}
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ description: `${label} copied` });
          }}
          className="absolute top-7 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

function CarouselTab({ brief }: { brief: CarouselBrief }) {
  const { toast } = useToast();

  const exportText = () => {
    const lines: string[] = [
      `CAROUSEL BRIEF — ${brief.dimensions}`,
      `Font: ${brief.fontRecommendation}`,
      `Color: ${brief.colorDirection}`,
      "",
      ...brief.slides.flatMap(s => [
        `--- Slide ${s.slideNumber}: ${s.role} ---`,
        `Headline: ${s.headline}`,
        `Body: ${s.bodyText}`,
        `Visual: ${s.visualDirection}`,
        `Text Overlay: ${s.textOverlay}`,
        "",
      ]),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ description: "Carousel brief copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      {/* Specs bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-mono">{brief.dimensions}</Badge>
        <Badge variant="outline" className="text-[10px]">{brief.slideCount} slides</Badge>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5"
            data-testid="export-carousel"
            onClick={exportText}
          >
            <Download className="h-3 w-3" /> Export as Text
          </Button>
        </div>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Font:</span> {brief.fontRecommendation}</p>
        <p><span className="font-medium text-foreground">Color:</span> {brief.colorDirection}</p>
      </div>

      {/* Slides */}
      <div className="space-y-3">
        {brief.slides.map(slide => (
          <Card key={slide.slideNumber} className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                  {slide.slideNumber}
                </span>
                <Badge className={`text-[10px] font-semibold ${SLIDE_ROLE_COLORS[slide.role] || "border-border text-muted-foreground"}`}>
                  {slide.role}
                </Badge>
              </div>
              <div className="space-y-2.5">
                <FieldRow label="Headline" value={slide.headline} testId={`copy-slide-${slide.slideNumber}-headline`} />
                <FieldRow label="Body Text" value={slide.bodyText} testId={`copy-slide-${slide.slideNumber}-body`} />
                <FieldRow label="Visual Direction" value={slide.visualDirection} testId={`copy-slide-${slide.slideNumber}-visual`} />
                <FieldRow label="Text Overlay" value={slide.textOverlay} testId={`copy-slide-${slide.slideNumber}-overlay`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReelTab({ brief }: { brief: ReelBrief }) {
  const { toast } = useToast();

  const exportText = () => {
    const lines: string[] = [
      `REEL/VIDEO BRIEF — ${brief.duration} / ${brief.dimensions}`,
      `Hook: ${brief.hook}`,
      `Music: ${brief.musicMood}`,
      `Captions: ${brief.captionStyle}`,
      "",
      "SCENE BREAKDOWN:",
      ...brief.scenes.flatMap(s => [
        `[${s.timestamp}]`,
        `  Visual: ${s.visual}`,
        `  Voiceover: ${s.voiceover}`,
        `  Text Overlay: ${s.textOverlay}`,
        `  Action: ${s.action}`,
        "",
      ]),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ description: "Reel brief copied to clipboard" });
  };

  const fullScript = brief.scenes.map(s => s.voiceover).join(" ");

  return (
    <div className="space-y-4">
      {/* Specs */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-mono">{brief.dimensions}</Badge>
        <Badge variant="outline" className="text-[10px]">{brief.duration}</Badge>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5"
            data-testid="export-reel"
            onClick={exportText}
          >
            <Download className="h-3 w-3" /> Export as Text
          </Button>
        </div>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Hook:</span> {brief.hook}</p>
        <p><span className="font-medium text-foreground">Music:</span> {brief.musicMood}</p>
        <p><span className="font-medium text-foreground">Captions:</span> {brief.captionStyle}</p>
      </div>

      {/* Full script copyable */}
      <div className="group relative bg-muted/20 border border-border rounded-md p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Full Voiceover Script</p>
        <p className="text-sm text-foreground leading-relaxed pr-8">{fullScript}</p>
        <button
          data-testid="copy-full-script"
          onClick={() => { navigator.clipboard.writeText(fullScript); toast({ description: "Full script copied" }); }}
          className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Scene timeline */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scene Timeline</p>
        {brief.scenes.map((scene, i) => (
          <div key={i} className="flex gap-3 p-3 border border-border rounded-md bg-card">
            <div className="shrink-0">
              <Badge className="text-[10px] font-mono bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/30 whitespace-nowrap">
                <Clock className="h-2.5 w-2.5 mr-1 inline" />
                {scene.timestamp}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 flex-1 min-w-0">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Visual</p>
                <p className="text-xs text-foreground leading-snug">{scene.visual}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Voiceover</p>
                <p className="text-xs text-foreground leading-snug">{scene.voiceover}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Text Overlay</p>
                  <p className="text-xs text-muted-foreground leading-snug">{scene.textOverlay}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Action</p>
                  <p className="text-xs text-muted-foreground leading-snug">{scene.action}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaticTab({ brief }: { brief: StaticBrief }) {
  const { toast } = useToast();

  const exportText = () => {
    const lines: string[] = [
      `STATIC AD BRIEF — ${brief.dimensions}`,
      `Hero Headline: ${brief.heroHeadline}`,
      `Subheadline: ${brief.subheadline}`,
      `Visual Direction: ${brief.visualDirection}`,
      `CTA Button: ${brief.ctaButton}`,
      `Color Scheme: ${brief.colorScheme}`,
      `Copy Placement: ${brief.copyPlacement}`,
      "",
      "VARIANTS:",
      ...brief.variants.flatMap(v => [
        `${v.name}:`,
        `  Headline: ${v.headline}`,
        `  Visual: ${v.visual}`,
        "",
      ]),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ description: "Static ad brief copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      {/* Specs */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-mono">{brief.dimensions}</Badge>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5"
            data-testid="export-static"
            onClick={exportText}
          >
            <Download className="h-3 w-3" /> Export as Text
          </Button>
        </div>
      </div>

      {/* Main specs */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <FieldRow label="Hero Headline" value={brief.heroHeadline} testId="copy-static-hero" />
          <FieldRow label="Subheadline" value={brief.subheadline} testId="copy-static-sub" />
          <FieldRow label="Visual Direction" value={brief.visualDirection} testId="copy-static-visual" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="CTA Button" value={brief.ctaButton} testId="copy-static-cta" />
            <FieldRow label="Color Scheme" value={brief.colorScheme} testId="copy-static-color" />
          </div>
          <FieldRow label="Copy Placement" value={brief.copyPlacement} testId="copy-static-placement" />
        </CardContent>
      </Card>

      {/* Placement diagram (text) */}
      <div className="border border-dashed border-border rounded-md p-4 bg-muted/10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Layout Diagram</p>
        <div className="font-mono text-[11px] text-muted-foreground space-y-1 leading-relaxed">
          <p>┌─────────────────────────────────────────┐</p>
          <p>│ <span className="text-[#00C47A]">HEADLINE</span> (top-left)       │ <span className="text-[#00D4FF]">VISUAL</span> (right 60%) │</p>
          <p>│ Subheadline                 │                     │</p>
          <p>│                             │                     │</p>
          <p>│                    <span className="text-[#00C47A]">[CTA btn]</span> │                     │</p>
          <p>└─────────────────────────────────────────┘</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">{brief.copyPlacement}</p>
      </div>

      {/* Variants side-by-side */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">A/B Variants</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {brief.variants.map((variant, i) => (
            <Card key={i} className={`border ${i === 0 ? "border-[#00C47A]/30" : "border-[#00D4FF]/30"}`}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Badge className={`text-[10px] ${i === 0 ? "bg-[#00C47A]/10 text-[#00C47A] border-[#00C47A]/30" : "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/30"}`}>
                    {variant.name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4 space-y-2">
                <FieldRow label="Headline" value={variant.headline} testId={`copy-variant-${i}-headline`} />
                <FieldRow label="Visual" value={variant.visual} testId={`copy-variant-${i}-visual`} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function BriefHistoryPanel({
  onLoad,
}: {
  onLoad: (result: GeneratedBrief, icp: ICP) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);

  const { data: allHistory = [] } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history"],
    queryFn: () => apiRequest("GET", "/api/history").then(r => r.json()),
  });

  const briefHistory = allHistory.filter(
    item => typeof item.angle === "string" && item.angle.startsWith("brief:")
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/history/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ description: "Brief deleted" });
    },
  });

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this brief? This cannot be undone.")) return;
    deleteMutation.mutate(id);
  };

  const getPreview = (item: HistoryItem): string => {
    const r = item.result;
    if (r.carousel?.slides?.[0]?.headline) return r.carousel.slides[0].headline;
    if (r.reel?.hook) return r.reel.hook;
    if (r.static?.heroHeadline) return r.static.heroHeadline;
    return "—";
  };

  const getFormatLabel = (angle: string | null): string => {
    if (!angle) return "brief";
    const parts = angle.split(":");
    return parts[1] || "brief";
  };

  if (briefHistory.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 w-full text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <History className="h-4 w-4 text-[#00C47A]" />
        Brief History
        <span className="text-xs font-normal text-muted-foreground ml-1">({briefHistory.length})</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ICP</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Format</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {briefHistory.map(item => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Badge
                      className={`text-[10px] capitalize ${
                        ICP_META[item.icp as ICP]?.color || "border-border text-muted-foreground"
                      }`}
                    >
                      {item.icp}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {getFormatLabel(item.angle)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px] truncate">
                    {getPreview(item)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1.5 text-[#00C47A] border-[#00C47A]/30 hover:border-[#00C47A]/60 hover:bg-[#00C47A]/5"
                        onClick={() => onLoad(item.result, item.icp as ICP)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BriefGenerator() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [icp, setIcp] = useState<ICP>("seller");
  const [format, setFormat] = useState<Format>("all");
  const [copyInput, setCopyInput] = useState("");
  const [result, setResult] = useState<GeneratedBrief | null>(null);
  const [activeResultTab, setActiveResultTab] = useState("carousel");
  const [loadedIcp, setLoadedIcp] = useState<ICP | null>(null);

  // Fetch history for "Load from last generation" feature
  const { data: allHistory = [] } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history"],
    queryFn: () => apiRequest("GET", "/api/history").then(r => r.json()),
  });

  const mutation = useMutation({
    mutationFn: () => {
      // Try to parse copyInput as JSON, otherwise send as string
      let parsedInput: any;
      try {
        parsedInput = JSON.parse(copyInput.trim());
      } catch {
        parsedInput = copyInput.trim();
      }

      return apiRequest("POST", "/api/generate-brief", {
        icp,
        format,
        copyInput: parsedInput,
      }).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.error) { toast({ variant: "destructive", description: data.error }); return; }
      setResult(data);
      setLoadedIcp(null);
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      // Set active tab to first available
      if (data.carousel) setActiveResultTab("carousel");
      else if (data.reel) setActiveResultTab("reel");
      else if (data.static) setActiveResultTab("static");
      toast({ description: "Creative brief generated" });
    },
    onError: () => toast({ variant: "destructive", description: "Brief generation failed — check Settings" }),
  });

  const handleLoadFromHistory = (histResult: GeneratedBrief, histIcp: ICP) => {
    setResult(histResult);
    setLoadedIcp(histIcp);
    if (histResult.carousel) setActiveResultTab("carousel");
    else if (histResult.reel) setActiveResultTab("reel");
    else if (histResult.static) setActiveResultTab("static");
    toast({ description: "Brief loaded from history" });
  };

  const handleLoadLastCopy = () => {
    const nonBrief = allHistory.find(
      item => !item.angle?.startsWith("brief:")
    );
    if (!nonBrief) {
      toast({ variant: "destructive", description: "No copy generation found in history" });
      return;
    }
    const summary = JSON.stringify(nonBrief.result, null, 2);
    setCopyInput(summary);
    toast({ description: "Copy output loaded from last generation" });
  };

  const hasResult = result && (result.carousel || result.reel || result.static);
  const displayIcp = loadedIcp || icp;
  const availableTabs = [
    { key: "carousel", label: "Carousel", icon: <Layers className="h-3.5 w-3.5" />, data: result?.carousel },
    { key: "reel",     label: "Reel",     icon: <Film className="h-3.5 w-3.5" />,   data: result?.reel },
    { key: "static",   label: "Static",   icon: <Image className="h-3.5 w-3.5" />,  data: result?.static },
  ].filter(t => t.data);

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#00C47A]" /> Brief Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Turn copy output into production-ready creative briefs for Carousel, Reel, and Static ad formats
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel — Controls */}
        <div className="space-y-4">

          {/* Workflow Guide card */}
          <Card className="border-[#00C47A]/20 bg-[#00C47A]/5">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-[10px] font-semibold text-[#00C47A] uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Workflow Guide
              </p>
              <div className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground">Copy Generator → paste here → Brief Generator</p>
                <div className="space-y-1 pl-2 border-l border-[#00C47A]/20">
                  <p><span className="text-[#00C47A] font-medium">Carousel:</span> slide-by-slide layout for Canva</p>
                  <p><span className="text-[#00C47A] font-medium">Reel:</span> visual scene breakdown (director's guide) — use the Copy Generator's 30s script as voiceover in Video Generator</p>
                  <p><span className="text-[#00C47A] font-medium">Static:</span> image specs for AdCreative.ai</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* ICP selector */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["buyer", "seller", "concierge"] as ICP[]).map(t => (
                    <button
                      key={t}
                      data-testid={`icp-${t}`}
                      onClick={() => setIcp(t)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                        icp === t
                          ? "border-[#00C47A] bg-[#00C47A]/10 text-[#00C47A]"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {ICP_META[t].icon}
                      {ICP_META[t].label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{ICP_META[icp].sub}</p>
              </div>

              {/* Format selector */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["all", "carousel", "reel", "static"] as Format[]).map(f => (
                    <button
                      key={f}
                      data-testid={`format-${f}`}
                      onClick={() => setFormat(f)}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                        format === f
                          ? "border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {FORMAT_META[f].icon}
                      {FORMAT_META[f].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copy input textarea — improved */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Paste Copy Output from Copy Generator
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-[#00C47A] hover:text-[#00C47A] hover:bg-[#00C47A]/10 shrink-0"
                    onClick={handleLoadLastCopy}
                  >
                    <RotateCcw className="h-2.5 w-2.5 mr-1" />
                    Load last
                  </Button>
                </div>
                <Textarea
                  data-testid="input-copy"
                  placeholder='Paste JSON from Copy Generator or plain text copy here…'
                  value={copyInput}
                  onChange={e => setCopyInput(e.target.value)}
                  className="resize-none h-40 text-sm font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  JSON or plain text — accepts output from Copy Generator
                </p>
              </div>

              {/* Generate button */}
              <Button
                data-testid="button-generate-brief"
                className="w-full bg-[#00C47A] hover:bg-[#00C47A]/90 text-[hsl(214,35%,8%)] font-semibold"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !copyInput.trim()}
              >
                {mutation.isPending
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating Brief...</>
                  : <><FileText className="h-4 w-4 mr-2" />Generate Brief</>
                }
              </Button>

              {hasResult && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  data-testid="button-regenerate-brief"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="border-dashed border-border/60">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Output Formats</p>
              {[
                { icon: <Layers className="h-3 w-3" />, label: "Carousel — 5-slide sequence" },
                { icon: <Film className="h-3 w-3" />,   label: "Reel — 30s scene timeline" },
                { icon: <Image className="h-3 w-3" />,  label: "Static — Meta feed A/B variants" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                  <span className="text-muted-foreground/50">{icon}</span>
                  {label}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right panel — Results (2/3 width) */}
        <div className="lg:col-span-2" id="brief-results">
          {/* Empty state */}
          {!hasResult && !mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-72 rounded-lg border border-dashed border-border text-center">
              <FileText className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Generate copy first, then paste it here</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5">
                to get production-ready briefs for Carousel, Reel, and Static
              </p>
            </div>
          )}

          {/* Loading state */}
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-72 rounded-lg border border-dashed border-[#00C47A]/30 bg-[#00C47A]/5">
              <RefreshCw className="h-7 w-7 text-[#00C47A] animate-spin mb-3" />
              <p className="text-sm font-medium text-[#00C47A]">
                Building {ICP_META[icp].label} creative briefs...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format === "all" ? "Carousel · Reel · Static" : FORMAT_META[format].label}
              </p>
            </div>
          )}

          {/* Results */}
          {hasResult && !mutation.isPending && (
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge
                  className={`text-xs ${ICP_META[displayIcp]?.color || "border-border text-muted-foreground"}`}
                >
                  {displayIcp}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {format === "all" ? "All formats" : FORMAT_META[format].label}
                </Badge>
                {loadedIcp && (
                  <Badge variant="outline" className="text-xs text-[#00D4FF] border-[#00D4FF]/30">
                    Loaded from history
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
                <TabsList className="mb-4">
                  {availableTabs.map(tab => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="text-xs flex items-center gap-1.5"
                      data-testid={`tab-${tab.key}`}
                    >
                      {tab.icon}
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {result?.carousel && (
                  <TabsContent value="carousel" className="mt-0">
                    <CarouselTab brief={result.carousel} />
                  </TabsContent>
                )}

                {result?.reel && (
                  <TabsContent value="reel" className="mt-0">
                    <ReelTab brief={result.reel} />
                  </TabsContent>
                )}

                {result?.static && (
                  <TabsContent value="static" className="mt-0">
                    <StaticTab brief={result.static} />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* History Panel */}
      <BriefHistoryPanel onLoad={handleLoadFromHistory} />
    </div>
  );
}
