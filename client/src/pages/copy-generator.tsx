import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, RefreshCw, Copy, Home, Users, Briefcase, Video, Info } from "lucide-react";

type ICP = "buyer" | "seller" | "concierge";
type Angle = "all" | "pain" | "savings" | "curiosity" | "social_proof" | "urgency";

interface GeneratedCopy {
  headlines: string[];
  hooks: { angle: string; hook: string }[];
  bodyVariants: string[];
  videoScript30: string;
  videoScript60: string;
  socialCaptions: string[];
  emailSubject: string;
  emailPreview: string;
  ctaVariants: string[];
  objectionHandlers: string[];
}

const ICP_META: Record<ICP, { label: string; sub: string; icon: React.ReactNode; color: string }> = {
  buyer:     { label: "Buyer",     sub: "Save ~$9,818 on a $430K home",      icon: <Home className="h-4 w-4" />,      color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  seller:    { label: "Seller",    sub: "Keep ~$19,000 more at closing",       icon: <Users className="h-4 w-4" />,     color: "border-signal/40 bg-signal/10 text-signal" },
  concierge: { label: "Concierge", sub: "$20/showing, your schedule",          icon: <Briefcase className="h-4 w-4" />, color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
};

const ANGLES: Record<Angle, string> = {
  all:          "All angles (full set)",
  pain:         "Pain — open with the problem",
  savings:      "Savings — lead with the number",
  curiosity:    "Curiosity — open a loop",
  social_proof: "Social Proof — data & credibility",
  urgency:      "Urgency — market timing",
};

function CopyCard({ label, content, mono = false }: { label: string; content: string; mono?: boolean }) {
  const { toast } = useToast();
  return (
    <div className="relative group rounded-md border border-border bg-muted/20 p-3">
      <p className={`text-sm leading-relaxed whitespace-pre-wrap pr-8 ${mono ? "font-mono text-xs text-muted-foreground" : ""}`}>{content}</p>
      <button
        onClick={() => { navigator.clipboard.writeText(content); toast({ description: `${label} copied` }); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
        data-testid={`copy-btn-${label}`}
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function CopyList({ items, numbered = false }: { items: string[]; numbered?: boolean }) {
  const { toast } = useToast();
  return (
    <div className="space-y-2">
      {items.map((item, i) => <CopyCard key={i} label={`item-${i}`} content={numbered ? `${i + 1}. ${item}` : item} />)}
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => { navigator.clipboard.writeText(items.join("\n\n")); toast({ description: "All copied" }); }}>
        <Copy className="h-3 w-3 mr-1" /> Copy all
      </Button>
    </div>
  );
}

function VideoScriptBlock({
  label,
  script,
  icp,
}: {
  label: string;
  script: string;
  icp: ICP;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleUseAsVideoScript = async () => {
    try {
      await apiRequest("POST", "/api/pipeline/set-script", { script, icp });
      toast({ description: "Script saved — opening Video Generator" });
      navigate("/video-generator");
    } catch {
      toast({ variant: "destructive", description: "Failed to save script" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <Button
          size="sm"
          className="h-7 px-3 text-xs bg-[#00D4FF]/15 hover:bg-[#00D4FF]/25 text-[#00D4FF] border border-[#00D4FF]/30 hover:border-[#00D4FF]/50"
          onClick={handleUseAsVideoScript}
        >
          <Video className="h-3 w-3 mr-1.5" />
          → Use as Video Script
        </Button>
      </div>
      <CopyCard label={label} content={script} mono />
    </div>
  );
}

export default function CopyGenerator() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [icp, setIcp] = useState<ICP>("seller");
  const [angle, setAngle] = useState<Angle>("all");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GeneratedCopy | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/generate-copy", {
        icp,
        angle: angle === "all" ? undefined : angle,
        context: context.trim() || undefined,
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast({ variant: "destructive", description: data.error }); return; }
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ description: "Copy generated" });
    },
    onError: () => toast({ variant: "destructive", description: "Generation failed — check Settings" }),
  });

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-signal" /> Copy Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">ICP-targeted copy powered by your brand docs and audience research</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Configure</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* ICP */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Target Audience</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["buyer", "seller", "concierge"] as ICP[]).map(t => (
                    <button
                      key={t}
                      data-testid={`icp-${t}`}
                      onClick={() => setIcp(t)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                        icp === t ? "border-signal bg-signal/10 text-signal" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {ICP_META[t].icon}
                      {ICP_META[t].label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{ICP_META[icp].sub}</p>
              </div>

              {/* Angle */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Hook Angle</label>
                <Select value={angle} onValueChange={v => setAngle(v as Angle)}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-angle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANGLES).map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Context */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Extra Context <span className="font-normal">(optional)</span></label>
                <Textarea
                  data-testid="input-context"
                  placeholder='e.g. "Focus on NYC relocators" or "Emphasize Tampa inventory glut"'
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  className="resize-none h-20 text-sm"
                />
              </div>

              <Button
                data-testid="button-generate"
                className="w-full bg-signal hover:bg-signal/90 text-[hsl(214,35%,8%)] font-semibold"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                  : <><Sparkles className="h-4 w-4 mr-2" />Generate Copy</>
                }
              </Button>

              {result && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed border-border/60">
            <CardContent className="pt-4 pb-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Powered by</p>
              {["icp-buyer.md", "icp-seller.md", "icp-concierge.md", "icp-brand-psychology.md"].map(f => (
                <p key={f} className="text-[11px] font-mono text-muted-foreground/60">{f}</p>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2" id="results">
          {!result && !mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select an ICP, pick an angle, hit Generate</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Takes ~15–25 seconds</p>
            </div>
          )}

          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-signal/30 bg-signal/5">
              <RefreshCw className="h-7 w-7 text-signal animate-spin mb-3" />
              <p className="text-sm font-medium text-signal">Writing {ICP_META[icp].label} copy...</p>
              <p className="text-xs text-muted-foreground mt-1">Headlines · Hooks · Scripts · Captions</p>
            </div>
          )}

          {result && !mutation.isPending && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className={`text-xs ${ICP_META[icp].color}`}>{ICP_META[icp].label}</Badge>
                {angle !== "all" && <Badge variant="outline" className="text-xs capitalize">{angle.replace("_", " ")}</Badge>}
                <span className="text-xs text-muted-foreground ml-auto">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              <Tabs defaultValue="ads">
                <TabsList className="grid grid-cols-4 mb-4 w-full">
                  <TabsTrigger value="ads" className="text-xs">Ads</TabsTrigger>
                  <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
                  <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
                  <TabsTrigger value="email" className="text-xs">Email + CTA</TabsTrigger>
                </TabsList>

                <TabsContent value="ads" className="space-y-5 mt-0">
                  <div><p className="text-xs font-semibold text-muted-foreground mb-2">HEADLINES ({result.headlines.length})</p><CopyList items={result.headlines} numbered /></div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">HOOKS BY ANGLE</p>
                    <div className="space-y-2">
                      {result.hooks.map((h, i) => (
                        <div key={i}>
                          <Badge variant="outline" className="text-[10px] mb-1 capitalize">{h.angle.replace("_", " ")}</Badge>
                          <CopyCard label={h.angle} content={h.hook} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">BODY COPY</p>
                    <div className="space-y-2">
                      {result.bodyVariants.map((v, i) => (
                        <div key={i}>
                          <p className="text-[10px] text-muted-foreground mb-1">Variant {["A","B","C"][i]}</p>
                          <CopyCard label={`body-${i}`} content={v} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div><p className="text-xs font-semibold text-muted-foreground mb-2">OBJECTION HANDLERS</p><CopyList items={result.objectionHandlers} /></div>
                </TabsContent>

                <TabsContent value="video" className="space-y-5 mt-0">
                  {/* Workflow info box */}
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-[#00D4FF]/20 bg-[#00D4FF]/5">
                    <Info className="h-3.5 w-3.5 text-[#00D4FF] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#00D4FF]/80 leading-relaxed">
                      The 30s and 60s scripts are your <strong className="text-[#00D4FF]">voiceover</strong> — they go directly into the Video Generator.
                      The Brief Generator produces your <strong className="text-[#00D4FF]">visual direction guide</strong> (scene layout, b-roll cues) to use alongside the video.
                    </p>
                  </div>

                  <VideoScriptBlock label="30-SECOND UGC SCRIPT" script={result.videoScript30} icp={icp} />
                  <VideoScriptBlock label="60-SECOND UGC SCRIPT" script={result.videoScript60} icp={icp} />
                </TabsContent>

                <TabsContent value="social" className="space-y-3 mt-0">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">SOCIAL CAPTIONS</p>
                  {result.socialCaptions.map((cap, i) => {
                    const labels = ["IG / FB — Story", "IG / FB — Question", "TikTok", "LinkedIn", "UGC Style"];
                    return (
                      <div key={i}>
                        <Badge variant="outline" className="text-[10px] mb-1">{labels[i] || `Caption ${i + 1}`}</Badge>
                        <CopyCard label={labels[i]} content={cap} />
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="email" className="space-y-5 mt-0">
                  <div><p className="text-xs font-semibold text-muted-foreground mb-2">EMAIL SUBJECT</p><CopyCard label="subject" content={result.emailSubject} /></div>
                  <div><p className="text-xs font-semibold text-muted-foreground mb-2">PREVIEW TEXT</p><CopyCard label="preview" content={result.emailPreview} /></div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">CTA VARIANTS</p>
                    <div className="flex flex-wrap gap-2">
                      {result.ctaVariants.map((cta, i) => (
                        <button
                          key={i}
                          onClick={() => { navigator.clipboard.writeText(cta); toast({ description: `"${cta}" copied` }); }}
                          className="px-4 py-2 rounded-md text-sm font-semibold bg-signal text-[hsl(214,35%,8%)] hover:bg-signal/80 transition-colors"
                        >
                          {cta}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Click any button to copy</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
