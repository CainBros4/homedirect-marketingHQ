import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, Copy, Home, Users, Briefcase } from "lucide-react";

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

const ICP_META: Record<ICP, { label: string; sub: string; icon: React.ReactNode }> = {
  buyer:     { label: "Buyer",     sub: "Save ~$9,818 on a $430K home",      icon: <Home className="h-4 w-4" /> },
  seller:    { label: "Seller",    sub: "Keep ~$19,000 more at closing",      icon: <Users className="h-4 w-4" /> },
  concierge: { label: "Concierge", sub: "$20/showing, your schedule",         icon: <Briefcase className="h-4 w-4" /> },
};

const ANGLES: Record<Angle, string> = {
  all:          "All angles (full set)",
  pain:         "Pain — open with the problem",
  savings:      "Savings — lead with the number",
  curiosity:    "Curiosity — open a loop",
  social_proof: "Social Proof — data & credibility",
  urgency:      "Urgency — market timing",
};

/**
 * Channel formats — each tactic page tells the generator which assets matter.
 * "search" = short headlines + descriptions (Google Ads / PPC)
 * "social" = hooks + captions + body (Meta)
 * "content" = longform body + hooks (SEO)
 */
export type ChannelFormat = "search" | "social" | "content";

const CHANNEL_FOCUS: Record<ChannelFormat, { label: string; fields: (keyof GeneratedCopy)[] }> = {
  search: {
    label: "Search ad assets",
    fields: ["headlines", "bodyVariants", "ctaVariants", "objectionHandlers"],
  },
  social: {
    label: "Social/feed assets",
    fields: ["headlines", "hooks", "socialCaptions", "bodyVariants"],
  },
  content: {
    label: "Content assets",
    fields: ["headlines", "hooks", "bodyVariants", "emailSubject", "emailPreview"],
  },
};

function CopyCard({ label, content }: { label: string; content: string }) {
  const { toast } = useToast();
  return (
    <div className="relative group rounded-md border border-border bg-muted/20 p-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap pr-8">{content}</p>
      <button
        onClick={() => { navigator.clipboard.writeText(content); toast({ description: `${label} copied` }); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

interface EmbeddedCopyGeneratorProps {
  defaultIcp?: ICP;
  channelFormat: ChannelFormat;
  channelLabel: string;
}

export default function EmbeddedCopyGenerator({
  defaultIcp = "buyer",
  channelFormat,
  channelLabel,
}: EmbeddedCopyGeneratorProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [icp, setIcp] = useState<ICP>(defaultIcp);
  const [angle, setAngle] = useState<Angle>("all");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GeneratedCopy | null>(null);

  const focus = CHANNEL_FOCUS[channelFormat];

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/generate-copy", {
        icp,
        angle: angle === "all" ? undefined : angle,
        context: context.trim() || `For ${channelLabel}. Prioritize ${focus.label}.`,
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls */}
      <div>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Configure</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Target Audience</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["buyer", "seller", "concierge"] as ICP[]).map(t => (
                  <button
                    key={t}
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

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Hook Angle</label>
              <Select value={angle} onValueChange={v => setAngle(v as Angle)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ANGLES).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Extra Context <span className="font-normal">(optional)</span></label>
              <Textarea
                placeholder={`Extra direction for ${channelLabel}...`}
                value={context}
                onChange={e => setContext(e.target.value)}
                className="resize-none h-20 text-sm"
              />
            </div>

            <Button
              className="w-full bg-signal hover:bg-signal/90 text-[hsl(214,35%,8%)] font-semibold"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                : <><Sparkles className="h-4 w-4 mr-2" />Generate for {channelLabel}</>
              }
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results filtered to the channel's relevant fields */}
      <div className="lg:col-span-2">
        {!result && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Configure and generate {channelLabel} copy</p>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-signal/30 bg-signal/5">
            <RefreshCw className="h-7 w-7 text-signal animate-spin mb-3" />
            <p className="text-sm font-medium text-signal">Writing {ICP_META[icp].label} copy for {channelLabel}...</p>
          </div>
        )}

        {result && !mutation.isPending && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge className="text-xs border-signal/40 bg-signal/10 text-signal">{ICP_META[icp].label}</Badge>
              <Badge variant="outline" className="text-xs">{channelLabel}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {focus.fields.includes("headlines") && result.headlines && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">HEADLINES ({result.headlines.length})</p>
                <div className="space-y-2">
                  {result.headlines.map((h, i) => (
                    <CopyCard key={i} label={`headline-${i}`} content={`${i + 1}. ${h}`} />
                  ))}
                </div>
              </div>
            )}

            {focus.fields.includes("hooks") && result.hooks && (
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
            )}

            {focus.fields.includes("bodyVariants") && result.bodyVariants && (
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
            )}

            {focus.fields.includes("ctaVariants") && result.ctaVariants && (
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
              </div>
            )}

            {focus.fields.includes("socialCaptions") && result.socialCaptions && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">SOCIAL CAPTIONS</p>
                <div className="space-y-2">
                  {result.socialCaptions.map((cap, i) => {
                    const labels = ["IG / FB — Story", "IG / FB — Question", "TikTok", "LinkedIn", "UGC Style"];
                    return (
                      <div key={i}>
                        <Badge variant="outline" className="text-[10px] mb-1">{labels[i] || `Caption ${i + 1}`}</Badge>
                        <CopyCard label={labels[i]} content={cap} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {focus.fields.includes("emailSubject") && result.emailSubject && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">EMAIL SUBJECT</p>
                <CopyCard label="subject" content={result.emailSubject} />
              </div>
            )}

            {focus.fields.includes("emailPreview") && result.emailPreview && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">PREVIEW TEXT</p>
                <CopyCard label="preview" content={result.emailPreview} />
              </div>
            )}

            {focus.fields.includes("objectionHandlers") && result.objectionHandlers && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">OBJECTION HANDLERS</p>
                <div className="space-y-2">
                  {result.objectionHandlers.map((o, i) => (
                    <CopyCard key={i} label={`obj-${i}`} content={o} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
