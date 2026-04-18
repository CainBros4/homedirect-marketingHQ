import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, FileText, ExternalLink, Eye, EyeOff, Trash2, CheckCircle2, XCircle,
  Globe, Search, Target,
} from "lucide-react";

function j<T = any>(r: Response): Promise<T> { return r.json(); }

export default function Seo() {
  const [tab, setTab] = useState("ideas");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b">
        <Globe className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold">SEO / AEO Content</h1>
          <p className="text-xs text-muted-foreground">AI-generated articles optimized for LLM citations + Google rank. Brand voice pulled live from icp-hub.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="ideas"><Target className="h-4 w-4 mr-1.5" />Ideas</TabsTrigger>
          <TabsTrigger value="articles"><FileText className="h-4 w-4 mr-1.5" />Articles</TabsTrigger>
          <TabsTrigger value="publish"><Globe className="h-4 w-4 mr-1.5" />Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas"><IdeasTab /></TabsContent>
        <TabsContent value="articles"><ArticlesTab /></TabsContent>
        <TabsContent value="publish"><PublishTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Ideas ────────────────────────────────────────────────────────────────

function IdeasTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/seo/ideas"] });
  const [genOpen, setGenOpen] = useState(false);
  const [focus, setFocus] = useState("");
  const [count, setCount] = useState(10);
  const [geoMix, setGeoMix] = useState<"local_heavy" | "balanced" | "national_heavy">("balanced");

  const generate = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/seo/ideas/generate", body).then(j),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/seo/ideas"] });
      setGenOpen(false);
      toast({ title: `Generated ${d.inserted} ideas` });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e?.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/marketing/seo/ideas/${id}`, { status }).then(j),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marketing/seo/ideas"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  const deleteIdea = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/marketing/seo/ideas/${id}`).then(j),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marketing/seo/ideas"] }),
  });

  const generateArticle = useMutation({
    mutationFn: (ideaId: number) => apiRequest("POST", "/api/marketing/seo/articles/generate", { ideaId }).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/seo/ideas"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/seo/articles"] });
      toast({ title: "Article drafted", description: "Check the Articles tab." });
    },
    onError: (e: any) => toast({ title: "Writing failed", description: e?.message, variant: "destructive" }),
  });

  const all = data?.ideas || [];
  const counts = {
    all: all.length,
    proposed: all.filter((i: any) => i.status === "proposed").length,
    approved: all.filter((i: any) => i.status === "approved").length,
    written: all.filter((i: any) => i.status === "written").length,
    rejected: all.filter((i: any) => i.status === "rejected").length,
  };
  const filtered = filter === "all" ? all : all.filter((i: any) => i.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{all.length} ideas in the pipeline</div>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />Generate ideas
          </Button>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Generate article ideas</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Claude reads your icp-hub brand voice + ICPs and generates article ideas that either (a) capture Tampa-local search intent or (b) fill national buyer-intent gaps that LLMs currently mis-serve.
              </p>
              <div>
                <Label>Focus (optional)</Label>
                <Textarea
                  rows={2}
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g., 'post-NAR settlement buyer content' or 'Tampa first-time buyer neighborhoods'"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Count</Label>
                  <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Geographic mix</Label>
                  <Select value={geoMix} onValueChange={(v) => setGeoMix(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local_heavy">Tampa-heavy (70/30)</SelectItem>
                      <SelectItem value="balanced">Balanced (50/50)</SelectItem>
                      <SelectItem value="national_heavy">National-heavy (30/70)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
              <Button disabled={generate.isPending} onClick={() => generate.mutate({ focus: focus || undefined, count, geoMix })}>
                {generate.isPending ? "Generating…" : `Generate ${count}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-1 border-b pb-2">
        {(["all", "proposed", "approved", "written", "rejected"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {k} <span className="ml-1 opacity-70">{(counts as any)[k]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((i: any) => (
          <Card key={i.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-[10px]">{i.tier}</Badge>
                  <Badge variant="outline" className="text-[10px]">{i.icp}</Badge>
                  <Badge variant="outline" className="text-[10px]">{i.searchIntent}</Badge>
                  <Badge variant="outline" className="text-[10px]">{i.estimatedDifficulty}</Badge>
                  <Badge className={`text-[10px] ${
                    i.status === "approved" ? "bg-blue-100 text-blue-800 border-blue-200" :
                    i.status === "written" ? "bg-green-100 text-green-800 border-green-200" :
                    i.status === "rejected" ? "bg-muted text-muted-foreground" :
                    "bg-amber-100 text-amber-800 border-amber-200"
                  }`}>{i.status}</Badge>
                </div>
                <h3 className="font-semibold">{i.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Query: "{i.targetQuery}"</p>
                {i.angle && <p className="text-xs text-muted-foreground mt-1">Angle: {i.angle}</p>}
                {i.rationale && <p className="text-xs italic text-muted-foreground mt-1">Why win: {i.rationale}</p>}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {i.status === "proposed" && (
                  <>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => updateStatus.mutate({ id: i.id, status: "approved" })}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => updateStatus.mutate({ id: i.id, status: "rejected" })}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                    </Button>
                  </>
                )}
                {i.status === "approved" && (
                  <Button size="sm" disabled={generateArticle.isPending} onClick={() => generateArticle.mutate(i.id)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />{generateArticle.isPending ? "Writing…" : "Write article"}
                  </Button>
                )}
                {i.status === "rejected" && (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => deleteIdea.mutate(i.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            {all.length === 0 ? "No ideas yet. Click Generate ideas to start." : `No ideas match "${filter}"`}
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Articles ─────────────────────────────────────────────────────────────

function ArticlesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/seo/articles"] });
  const [previewId, setPreviewId] = useState<number | null>(null);

  const publish = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/seo/articles/${id}/publish`).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/seo/articles"] });
      toast({ title: "Published" });
    },
    onError: (e: any) => toast({ title: "Publish failed", description: e?.message, variant: "destructive" }),
  });
  const unpublish = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/seo/articles/${id}/unpublish`).then(j),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/marketing/seo/articles"] }); toast({ title: "Unpublished" }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/marketing/seo/articles/${id}`).then(j),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marketing/seo/articles"] }),
  });

  const articles = data?.articles || [];

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{articles.length} articles · {articles.filter((a: any) => a.status === "published").length} published</div>
      <div className="space-y-2">
        {articles.map((a: any) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={a.status === "published" ? "default" : "outline"} className="text-[10px]">{a.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{a.wordCount} words</Badge>
                  <Badge variant="outline" className="text-[10px]">{a.readingMinutes} min read</Badge>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">/guides/{a.slug}</code>
                </div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.metaDescription}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Target: "{a.targetQuery}"</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setPreviewId(a.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />Preview
                </Button>
                {a.status === "published" ? (
                  <>
                    <a href={`/guides/${a.slug}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="h-8 w-full">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />Live
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => unpublish.mutate(a.id)}>
                      <EyeOff className="h-3.5 w-3.5 mr-1" />Unpublish
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="h-8" disabled={publish.isPending} onClick={() => publish.mutate(a.id)}>
                    Publish
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => { if (confirm(`Delete "${a.title}"? This cannot be undone.`)) del.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {articles.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No articles yet. Approve an idea in the Ideas tab and click "Write article" to generate one.
          </Card>
        )}
      </div>
      {previewId !== null && <ArticlePreviewDialog id={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

function ArticlePreviewDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useQuery<any>({ queryKey: [`/api/marketing/seo/articles/${id}`] });
  const a = data?.article;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{a?.title || "Loading…"}</DialogTitle>
        </DialogHeader>
        {a && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground italic">{a.metaDescription}</p>
            <div className="border rounded-md p-4 bg-muted/20 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: a.bodyHtml }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Publish ──────────────────────────────────────────────────────────────

function PublishTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/seo/articles"] });
  const published = (data?.articles || []).filter((a: any) => a.status === "published");
  const mhqBase = window.location.origin;
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Public endpoints</h3>
        <p className="text-sm text-muted-foreground">
          These URLs are consumed by <code className="bg-muted px-1 rounded">trykeylime.ai</code> to render articles at <code className="bg-muted px-1 rounded">/guides/:slug</code>. They're also directly crawlable from marketingHQ so Googlebot and LLM crawlers can index content even before the homedirect integration lands.
        </p>
        <ul className="text-sm space-y-1.5 mt-2">
          <li>
            <strong>List published articles:</strong>{" "}
            <a className="font-mono text-xs underline" href="/api/seo/public/articles" target="_blank" rel="noreferrer">
              {mhqBase}/api/seo/public/articles
            </a>
          </li>
          <li>
            <strong>Single article by slug:</strong>{" "}
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{mhqBase}/api/seo/public/articles/:slug</code>
          </li>
          <li>
            <strong>Sitemap XML:</strong>{" "}
            <a className="font-mono text-xs underline" href="/sitemap-seo.xml" target="_blank" rel="noreferrer">
              {mhqBase}/sitemap-seo.xml
            </a>
          </li>
          <li>
            <strong>Direct HTML preview:</strong>{" "}
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{mhqBase}/guides/:slug</code>
          </li>
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Live articles ({published.length})</h3>
        {published.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing published yet. Publish an article from the Articles tab.</p>
        ) : (
          <ul className="space-y-1.5">
            {published.map((a: any) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <a href={`/guides/${a.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
                  <ExternalLink className="h-3 w-3" />
                  /guides/{a.slug}
                </a>
                <span className="text-muted-foreground text-xs truncate">{a.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Search className="h-4 w-4" />trykeylime.ai integration</h3>
        <p className="text-sm text-muted-foreground">
          Articles currently serve from <code className="bg-muted px-1 rounded">marketinghq-production.up.railway.app/guides/:slug</code>. To surface them under <code className="bg-muted px-1 rounded">trykeylime.ai/guides/:slug</code> (better link juice + unified brand), add a route in the homedirect app that proxies to the public API. Instructions below.
        </p>
        <pre className="text-[11px] bg-muted/50 border rounded-md p-3 overflow-x-auto">{`// In homedirect's server/routes.ts:

app.get("/guides/:slug", async (req, res) => {
  const r = await fetch(\`\${MHQ_URL}/api/seo/public/articles/\${req.params.slug}\`);
  if (!r.ok) return res.status(404).send("Not found");
  const { article } = await r.json();
  res.send(renderArticleHtml(article));
});

// In robots.txt add:
Sitemap: https://www.trykeylime.ai/sitemap.xml
Sitemap: \${MHQ_URL}/sitemap-seo.xml

// Then submit both sitemaps in Google Search Console.`}</pre>
      </Card>
    </div>
  );
}
