import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Image as ImageIcon, CheckCircle2, XCircle, Trash2, RefreshCw,
  Target, Send, AlertTriangle,
} from "lucide-react";

function j<T = any>(r: Response): Promise<T> { return r.json(); }

export default function Meta() {
  const [tab, setTab] = useState("generate");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b">
        <Target className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Meta Ads (Facebook + Instagram)</h1>
          <p className="text-xs text-muted-foreground">AI-generated ads with human review. Housing Special Ad Category enforced — no demographic targeting.</p>
        </div>
      </div>

      <ConnectionBanner />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="generate"><Sparkles className="h-4 w-4 mr-1.5" />Generate</TabsTrigger>
          <TabsTrigger value="review"><ImageIcon className="h-4 w-4 mr-1.5" />Review queue</TabsTrigger>
          <TabsTrigger value="approved"><CheckCircle2 className="h-4 w-4 mr-1.5" />Approved</TabsTrigger>
          <TabsTrigger value="launched"><Send className="h-4 w-4 mr-1.5" />Launched</TabsTrigger>
        </TabsList>

        <TabsContent value="generate"><GenerateTab /></TabsContent>
        <TabsContent value="review"><CreativeList status="draft" /></TabsContent>
        <TabsContent value="approved"><CreativeList status="approved" /></TabsContent>
        <TabsContent value="launched"><CreativeList status="launched" /></TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionBanner() {
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/meta/status"] });
  if (!data) return null;

  const pill = (ok: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
      ok ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {pill(data.claude, "Claude (copy)")}
        {pill(data.openai, "DALL-E 3 (images)")}
        {pill(data.metaConnected, data.metaConnected ? `Meta connected (${data.metaAccountId || "?"})` : "Meta not connected — launch blocked")}
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-blue-100 text-blue-800 border-blue-200">
          Daily cap ${(data.dailyBudgetCapCents / 100).toFixed(0)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted text-muted-foreground">
          Housing SAC enforced
        </span>
      </div>
      {!data.metaConnected && (
        <p className="mt-3 text-xs text-muted-foreground">
          You can generate and review creatives now. Launching requires finishing Business Manager + Ad Account setup, then pasting <code className="bg-muted px-1 rounded">META_ACCESS_TOKEN</code>, <code className="bg-muted px-1 rounded">META_AD_ACCOUNT_ID</code>, and <code className="bg-muted px-1 rounded">META_PAGE_ID</code> into Railway.
        </p>
      )}
      {!data.openai && (
        <p className="mt-2 text-xs text-muted-foreground">
          Add <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code> to Railway for DALL-E 3. Copy-only generation works without it (toggle "with image" off).
        </p>
      )}
    </Card>
  );
}

// ─── Generate ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    icp: "buyer" as "buyer" | "seller" | "general",
    brief: "",
    audienceNote: "",
    objective: "OUTCOME_TRAFFIC" as "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_AWARENESS",
    landingUrl: "https://www.trykeylime.ai",
    aspectRatio: "1:1" as "1:1" | "4:5" | "9:16",
    withImage: true,
  });

  const generate = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/meta/creatives/generate", body).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/meta/creatives?status=draft"] });
      toast({ title: "Creative drafted", description: "Check the Review queue." });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>ICP</Label>
          <Select value={form.icp} onValueChange={(v) => setForm({ ...form, icp: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Buyer — browse Tampa homes</SelectItem>
              <SelectItem value="seller">Seller — list without 6% commission</SelectItem>
              <SelectItem value="general">General — brand awareness</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Objective</Label>
          <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTCOME_TRAFFIC">Traffic — drive clicks to trykeylime.ai</SelectItem>
              <SelectItem value="OUTCOME_LEADS">Leads — form fills on Meta</SelectItem>
              <SelectItem value="OUTCOME_ENGAGEMENT">Engagement — post reach + reactions</SelectItem>
              <SelectItem value="OUTCOME_AWARENESS">Awareness — broad reach</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Brief</Label>
        <Textarea
          rows={3}
          value={form.brief}
          onChange={(e) => setForm({ ...form, brief: e.target.value })}
          placeholder="What should this ad accomplish? e.g., 'Convince Tampa homeowners whose listing recently expired that Key Lime is the 1%-fee alternative. Drive them to the savings calculator on trykeylime.ai.'"
        />
      </div>
      <div>
        <Label>Audience note <span className="text-xs text-muted-foreground">(internal only — no demographic targeting, Housing SAC)</span></Label>
        <Input
          value={form.audienceNote}
          onChange={(e) => setForm({ ...form, audienceNote: e.target.value })}
          placeholder="e.g., 'Tampa Bay 15-mile radius, interest: real estate news'"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Landing URL</Label>
          <Input value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} />
        </div>
        <div>
          <Label>Aspect ratio</Label>
          <Select value={form.aspectRatio} onValueChange={(v) => setForm({ ...form, aspectRatio: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1 — Feed (1024×1024)</SelectItem>
              <SelectItem value="4:5">4:5 — Mobile feed portrait</SelectItem>
              <SelectItem value="9:16">9:16 — Stories / Reels</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.withImage}
              onChange={(e) => setForm({ ...form, withImage: e.target.checked })}
              className="h-4 w-4"
            />
            Generate image (~$0.04-0.08)
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          disabled={!form.brief.trim() || generate.isPending}
          onClick={() => generate.mutate(form)}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          {generate.isPending ? "Generating…" : "Generate creative"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Copy variants (Claude, ~2s) and image (DALL-E 3, ~10s) are drafted. They land in the Review queue. Human review required before launch.
      </p>
    </Card>
  );
}

// ─── Creative list (shared across review / approved / launched tabs) ─────

function CreativeList({ status }: { status: "draft" | "approved" | "launched" }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const queryKey = `/api/marketing/meta/creatives?status=${status}`;
  const { data } = useQuery<any>({ queryKey: [queryKey] });

  const approve = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/meta/creatives/${id}/approve`).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/meta/creatives?status=draft"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/meta/creatives?status=approved"] });
      toast({ title: "Approved" });
    },
    onError: (e: any) => toast({ title: "Approve failed", description: e?.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/meta/creatives/${id}/reject`).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/meta/creatives?status=draft"] });
      toast({ title: "Rejected" });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/marketing/meta/creatives/${id}`).then(j),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const regenImage = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/meta/creatives/${id}/regenerate-image`, {}).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "New image generated" });
    },
    onError: (e: any) => toast({ title: "Regen failed", description: e?.message, variant: "destructive" }),
  });

  const launch = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/meta/creatives/${id}/launch`).then(j),
    onSuccess: (d: any) => toast({ title: d?.message || "Launch requested" }),
    onError: (e: any) => toast({ title: "Launch blocked", description: e?.message, variant: "destructive" }),
  });

  const creatives = data?.creatives || [];
  if (creatives.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        {status === "draft" ? "No drafts. Go to Generate to create one." :
         status === "approved" ? "No approved creatives yet. Approve one from the Review queue." :
         "No launched ads yet. Meta connection required before launch."}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {creatives.map((c: any) => (
        <Card key={c.id} className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr]">
            <div className="bg-muted/30 aspect-square sm:h-full relative">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.headline} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-4 text-center">
                  <ImageIcon className="h-6 w-6 mb-1.5" />
                  No image
                </div>
              )}
            </div>
            <div className="p-4 space-y-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{c.icp}</Badge>
                <Badge variant="outline" className="text-[10px]">{c.objective.replace("OUTCOME_", "").toLowerCase()}</Badge>
                <Badge variant="outline" className="text-[10px]">{c.aspectRatio}</Badge>
                <Badge variant={c.status === "approved" ? "default" : "outline"} className="text-[10px]">{c.status}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Primary text</p>
                <p className="text-sm">{c.primaryText}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Headline · Description</p>
                <p className="text-sm font-semibold">{c.headline}</p>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>CTA: <code className="bg-muted px-1 rounded">{c.ctaButton}</code></span>
                <span>·</span>
                <a href={c.landingUrl} target="_blank" rel="noreferrer" className="underline truncate">{c.landingUrl}</a>
              </div>
              {c.rationale && (
                <p className="text-[11px] italic text-muted-foreground">Why: {c.rationale}</p>
              )}
              {c.generationCostCents > 0 && (
                <p className="text-[10px] text-muted-foreground">Cost so far: ${(c.generationCostCents / 100).toFixed(3)}</p>
              )}
              <div className="flex gap-1.5 pt-1 flex-wrap">
                {status === "draft" && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approve.mutate(c.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reject.mutate(c.id)}>
                      <XCircle className="h-3 w-3 mr-1" />Reject
                    </Button>
                  </>
                )}
                {status === "approved" && (
                  <Button size="sm" className="h-7 text-xs" disabled={launch.isPending} onClick={() => launch.mutate(c.id)}>
                    <Send className="h-3 w-3 mr-1" />Launch to Meta
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={regenImage.isPending} onClick={() => regenImage.mutate(c.id)}>
                  <RefreshCw className="h-3 w-3 mr-1" />Re-roll image
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { if (confirm("Delete this creative?")) del.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
