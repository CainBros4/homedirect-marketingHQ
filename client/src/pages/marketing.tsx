import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Shield, Mail, Users, List, FileText, Send, Zap, Search,
  Plus, Sparkles, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Filter, Trash2,
} from "lucide-react";

// ───────────────────────── helpers ─────────────────────────
function j<T = any>(r: Response): Promise<T> {
  return r.json();
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

interface ParsedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBulkContacts(text: string): ParsedContact[] {
  const out: ParsedContact[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Split on commas, tabs, or 2+ spaces — lets users paste CSV or whitespace-delimited
    const parts = line.split(/\s*,\s*|\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    const emailPart = parts.find((p) => EMAIL_RX.test(p));
    if (!emailPart) continue;
    const email = emailPart.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const nonEmail = parts.filter((p) => p !== emailPart);
    const [firstName, lastName, city, state, zip] = nonEmail;
    out.push({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
    });
  }
  return out;
}

function StatusPill({ kind, label }: { kind: "ok" | "warn" | "err"; label: string }) {
  const cls = kind === "ok"
    ? "bg-green-100 text-green-800 border-green-200"
    : kind === "warn"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";
  const Icon = kind === "ok" ? CheckCircle2 : kind === "warn" ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// ───────────────────────── page ─────────────────────────
export default function MarketingHQ() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("overview");

  if (user && user.role !== "admin") {
    return (
      <div className="py-24 text-center">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Admin access required</h2>
        <Button className="mt-4" onClick={() => setLocation("/")}>Go home</Button>
      </div>
    );
  }
  if (!user) {
    return <div className="py-24 text-center"><p className="text-sm text-muted-foreground">Please sign in as an admin.</p></div>;
  }

  return (
    <div className="min-h-screen" data-testid="page-marketing">
      <div className="border-b py-3 px-4">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Marketing HQ</h1>
            <p className="text-xs text-muted-foreground">AI-powered email campaigns, drips, and MLS outreach</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="overview"><TrendingUp className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="contacts"><Users className="mr-1.5 h-4 w-4" />Contacts</TabsTrigger>
            <TabsTrigger value="lists"><List className="mr-1.5 h-4 w-4" />Lists</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="mr-1.5 h-4 w-4" />Templates</TabsTrigger>
            <TabsTrigger value="campaigns"><Send className="mr-1.5 h-4 w-4" />Campaigns</TabsTrigger>
            <TabsTrigger value="drips"><Mail className="mr-1.5 h-4 w-4" />Drips</TabsTrigger>
            <TabsTrigger value="mls"><Search className="mr-1.5 h-4 w-4" />MLS Search</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="contacts"><ContactsTab /></TabsContent>
          <TabsContent value="lists"><ListsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
          <TabsContent value="drips"><DripsTab /></TabsContent>
          <TabsContent value="mls"><MlsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ───────────────────────── Overview ─────────────────────────
function OverviewTab() {
  const { data: status } = useQuery<any>({ queryKey: ["/api/marketing/status"] });
  const { data: summary } = useQuery<any>({ queryKey: ["/api/marketing/analytics/summary"] });

  const pill = (ok: boolean, label: string) => <StatusPill kind={ok ? "ok" : "warn"} label={`${label}: ${ok ? "ready" : "not configured"}`} />;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Infrastructure status</h3>
        <div className="flex flex-wrap gap-2">
          {status && pill(status.resend, "Resend")}
          {status && pill(status.claude, "Claude API")}
          {status && pill(status.skipTrace, "Skip trace")}
          {status && pill(status.mlsProviderConfigured, `MLS (${status.mlsProvider})`)}
        </div>
        {status && !status.resend && (
          <p className="mt-3 text-xs text-muted-foreground">Add <code className="bg-muted px-1 rounded">RESEND_API_KEY</code> to your environment to enable sending.</p>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Contacts" value={summary?.contacts ?? 0} />
        <StatCard label="Lists" value={summary?.lists ?? 0} />
        <StatCard label="Campaigns" value={summary?.campaigns ?? 0} />
        <StatCard label="Drip sequences" value={summary?.drips ?? 0} />
      </div>

      {summary?.events && Object.keys(summary.events).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Email events (all time)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.events).map(([k, v]: any) => (
              <div key={k} className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-xs text-muted-foreground capitalize">{k}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

// ───────────────────────── Contacts ─────────────────────────
function ContactsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/contacts"] });
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSource, setBulkSource] = useState("manual");
  const [bulkPreview, setBulkPreview] = useState<ParsedContact[]>([]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", city: "", state: "", zip: "", source: "manual" });
  const [filter, setFilter] = useState<"all" | "active" | "opted_out" | "bounced">("all");

  const optOut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/contacts/${id}/opt-out`).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/contacts"] });
      toast({ title: "Contact opted out", description: "They won't receive further emails." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const optIn = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/contacts/${id}/opt-in`).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/contacts"] });
      toast({ title: "Contact re-subscribed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/contacts", body).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/analytics/summary"] });
      setOpen(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", city: "", state: "", zip: "", source: "manual" });
      toast({ title: "Contact added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const bulk = useMutation({
    mutationFn: (contacts: any[]) => apiRequest("POST", "/api/marketing/contacts/bulk", { contacts }).then(j),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/analytics/summary"] });
      setBulkOpen(false);
      setBulkText("");
      setBulkPreview([]);
      toast({ title: "Bulk import complete", description: `${res.inserted} added, ${res.skipped} already existed, ${res.errors} errors` });
    },
    onError: (e: any) => toast({ title: "Bulk import failed", description: e.message, variant: "destructive" }),
  });

  const onBulkTextChange = (t: string) => {
    setBulkText(t);
    setBulkPreview(parseBulkContacts(t));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.contacts?.length ?? 0} contacts</div>
        <div className="flex gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1.5 h-4 w-4" />Bulk add</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Bulk add contacts</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Paste one contact per line. Supported formats:</p>
                  <ul className="list-disc ml-5 space-y-0.5">
                    <li><code className="bg-muted px-1 rounded">email@example.com</code></li>
                    <li><code className="bg-muted px-1 rounded">email@example.com,First,Last</code></li>
                    <li><code className="bg-muted px-1 rounded">email@example.com,First,Last,City,State,ZIP</code></li>
                    <li>Or just whitespace-separated — we auto-detect the email</li>
                  </ul>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={bulkSource} onValueChange={setBulkSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="import">Bulk Import</SelectItem>
                      <SelectItem value="mls_cancelled">MLS Cancelled</SelectItem>
                      <SelectItem value="mls_withdrawn">MLS Withdrawn</SelectItem>
                      <SelectItem value="mls_expired">MLS Expired</SelectItem>
                      <SelectItem value="fsbo">FSBO</SelectItem>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contacts</Label>
                  <Textarea rows={10} value={bulkText} onChange={(e) => onBulkTextChange(e.target.value)}
                    placeholder={"alice@company.com,Alice,Smith\nbob@company.com,Bob,Jones\ncharlie@company.com"}
                    className="font-mono text-xs" />
                </div>
                <div className="text-xs">
                  <span className={`font-semibold ${bulkPreview.length > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                    {bulkPreview.length} valid contact{bulkPreview.length === 1 ? "" : "s"} detected
                  </span>
                  {bulkPreview.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-auto border rounded p-2 bg-muted/30 space-y-0.5">
                      {bulkPreview.slice(0, 20).map((c, i) => (
                        <div key={i} className="text-[11px] font-mono">
                          {c.email}{c.firstName ? ` — ${c.firstName} ${c.lastName || ""}`.trim() : ""}{c.city ? ` (${c.city}${c.state ? `, ${c.state}` : ""})` : ""}
                        </div>
                      ))}
                      {bulkPreview.length > 20 && <div className="text-[11px] text-muted-foreground">…and {bulkPreview.length - 20} more</div>}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button disabled={bulkPreview.length === 0 || bulk.isPending}
                  onClick={() => bulk.mutate(bulkPreview.map((c) => ({ ...c, source: bulkSource })))}>
                  {bulk.isPending ? "Importing…" : `Import ${bulkPreview.length}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add contact</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Email *</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label>Last name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div><Label>ZIP</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="mls_cancelled">MLS Cancelled</SelectItem>
                    <SelectItem value="mls_withdrawn">MLS Withdrawn</SelectItem>
                    <SelectItem value="mls_expired">MLS Expired</SelectItem>
                    <SelectItem value="fsbo">FSBO</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                    <SelectItem value="import">Bulk Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate(form)} disabled={!form.email || create.isPending}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {(() => {
        const all = data?.contacts || [];
        const counts = {
          all: all.length,
          active: all.filter((c: any) => !c.optedOut && !c.bouncedAt).length,
          opted_out: all.filter((c: any) => c.optedOut).length,
          bounced: all.filter((c: any) => c.bouncedAt && !c.optedOut).length,
        };
        const filtered = all.filter((c: any) => {
          if (filter === "all") return true;
          if (filter === "active") return !c.optedOut && !c.bouncedAt;
          if (filter === "opted_out") return c.optedOut;
          if (filter === "bounced") return c.bouncedAt && !c.optedOut;
          return true;
        });
        const tabBtn = (key: typeof filter, label: string, count: number) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {label} <span className="ml-1 opacity-70">{count}</span>
          </button>
        );
        return (
          <>
            <div className="flex items-center gap-1 border-b pb-2">
              {tabBtn("all", "All", counts.all)}
              {tabBtn("active", "Active", counts.active)}
              {tabBtn("opted_out", "Opted out", counts.opted_out)}
              {tabBtn("bounced", "Bounced", counts.bounced)}
            </div>
            <Card>
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Email</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Added</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{c.email}</td>
                      <td className="p-3">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="p-3">{c.city || "—"}</td>
                      <td className="p-3"><Badge variant="outline">{c.source}</Badge></td>
                      <td className="p-3">
                        {c.optedOut ? (
                          <div className="flex flex-col gap-0.5">
                            <StatusPill kind="err" label="opted out" />
                            {c.optedOutAt && <span className="text-[10px] text-muted-foreground">{formatDate(c.optedOutAt)}</span>}
                          </div>
                        ) : c.bouncedAt ? (
                          <StatusPill kind="err" label="bounced" />
                        ) : c.verifiedEmail ? (
                          <StatusPill kind="ok" label="verified" />
                        ) : (
                          <StatusPill kind="warn" label="unverified" />
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                      <td className="p-3 text-right">
                        {c.optedOut ? (
                          <Button size="sm" variant="ghost" disabled={optIn.isPending} onClick={() => optIn.mutate(c.id)}>
                            Re-subscribe
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={optOut.isPending} onClick={() => {
                            if (confirm(`Opt out ${c.email}? They will not receive any further emails.`)) optOut.mutate(c.id);
                          }}>
                            Opt out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {all.length === 0 ? "No contacts yet. Add your first one above, or import from MLS search." : `No contacts match the "${filter.replace("_", " ")}" filter.`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </>
        );
      })()}
    </div>
  );
}

// ───────────────────────── Lists ─────────────────────────
function ListsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/lists"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedList, setSelectedList] = useState<any | null>(null);

  const create = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/lists", body).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/lists"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/analytics/summary"] });
      setOpen(false);
      setForm({ name: "", description: "" });
      toast({ title: "List created" });
    },
    onError: (e: any) => toast({ title: "Create failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.lists?.length ?? 0} lists</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New list</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New list</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tampa Bay Cancelled Sellers" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this list is for" /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.name}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data?.lists || []).map((l: any) => (
          <Card key={l.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedList(l)}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{l.name}</h3>
                {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
              </div>
              <Badge>{l.contactCount}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Created {formatDate(l.createdAt)} · click to manage</p>
          </Card>
        ))}
        {(data?.lists || []).length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground">No lists yet. Create one to start grouping contacts.</Card>
        )}
      </div>

      {selectedList && <ListDetailDialog list={selectedList} onClose={() => setSelectedList(null)} />}
    </div>
  );
}

function ListDetailDialog({ list, onClose }: { list: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: members } = useQuery<any>({ queryKey: [`/api/marketing/lists/${list.id}/members`] });
  const { data: allContacts } = useQuery<any>({ queryKey: ["/api/marketing/contacts"] });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");

  const memberIds = new Set<number>((members?.contacts || []).map((c: any) => c.id));

  const add = useMutation({
    mutationFn: (contactIds: number[]) =>
      apiRequest("POST", `/api/marketing/lists/${list.id}/members`, { contactIds }).then(j),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: [`/api/marketing/lists/${list.id}/members`] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/lists"] });
      setPickerOpen(false);
      setSelectedIds(new Set());
      toast({ title: "Added to list", description: `${r.added} contact${r.added === 1 ? "" : "s"} added` });
    },
    onError: (e: any) => toast({ title: "Failed to add contacts", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const candidates = (allContacts?.contacts || []).filter((c: any) => {
    if (memberIds.has(c.id)) return false;
    if (!searchText) return true;
    const needle = searchText.toLowerCase();
    return (
      c.email.toLowerCase().includes(needle) ||
      (c.firstName || "").toLowerCase().includes(needle) ||
      (c.lastName || "").toLowerCase().includes(needle) ||
      (c.city || "").toLowerCase().includes(needle)
    );
  });

  const toggleId = (id: number) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === candidates.length && candidates.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(candidates.map((c: any) => c.id)));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{list.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{members?.contacts?.length ?? 0}</span> member{(members?.contacts?.length ?? 0) === 1 ? "" : "s"}
            </div>
            <Button size="sm" onClick={() => { setPickerOpen(true); setSelectedIds(new Set()); }}>
              <Plus className="mr-1.5 h-4 w-4" />Add contacts
            </Button>
          </div>
          <Card className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2.5">Email</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">City</th>
                  <th className="p-2.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {(members?.contacts || []).map((c: any) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2.5 font-mono text-xs">{c.email}</td>
                    <td className="p-2.5">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="p-2.5">{c.city || "—"}</td>
                    <td className="p-2.5"><Badge variant="outline" className="text-xs">{c.source}</Badge></td>
                  </tr>
                ))}
                {(members?.contacts || []).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">No members yet. Click "Add contacts" to build this list.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </DialogContent>

      {pickerOpen && (
        <Dialog open onOpenChange={(v) => { if (!v) setPickerOpen(false); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add contacts to {list.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Filter by email, name, city…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{candidates.length} eligible · {selectedIds.size} selected</span>
                <button className="hover:underline" onClick={toggleAll}>
                  {selectedIds.size === candidates.length && candidates.length > 0 ? "Clear all" : "Select all"}
                </button>
              </div>
              <Card className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="w-10 p-2.5"></th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c: any) => (
                      <tr key={c.id} className="border-b cursor-pointer hover:bg-muted/40" onClick={() => toggleId(c.id)}>
                        <td className="p-2.5"><Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleId(c.id)} /></td>
                        <td className="p-2.5 font-mono text-xs">{c.email}</td>
                        <td className="p-2.5">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-2.5"><Badge variant="outline" className="text-xs">{c.source}</Badge></td>
                      </tr>
                    ))}
                    {candidates.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">
                        {searchText ? "No contacts match your filter." : "No more contacts to add — all are already on this list."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
              <Button disabled={selectedIds.size === 0 || add.isPending} onClick={() => add.mutate(Array.from(selectedIds))}>
                {add.isPending ? "Adding…" : `Add ${selectedIds.size}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

// ───────────────────────── Templates ─────────────────────────
function TemplatesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/templates"] });
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ saveAs: "", audience: "", brief: "", tone: "direct, warm, consultative" });
  const [preview, setPreview] = useState<any>(null);

  const generate = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/templates/generate", body).then(j),
    onSuccess: (data: any) => {
      setPreview(data.template);
      qc.invalidateQueries({ queryKey: ["/api/marketing/templates"] });
      toast({ title: "Template generated", description: data.saved ? "Saved to library." : "Preview only." });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.templates?.length ?? 0} templates</div>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild><Button size="sm"><Sparkles className="mr-1.5 h-4 w-4" />Generate with AI</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Generate email with Claude</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Save as (optional — leave blank for preview only)</Label><Input value={gen.saveAs} onChange={(e) => setGen({ ...gen, saveAs: e.target.value })} placeholder="Tampa Cancelled Intro" /></div>
              <div><Label>Audience</Label><Input value={gen.audience} onChange={(e) => setGen({ ...gen, audience: e.target.value })} placeholder="Tampa Bay homeowner whose MLS listing was recently cancelled" /></div>
              <div><Label>Brief (what this email should accomplish)</Label><Textarea rows={4} value={gen.brief} onChange={(e) => setGen({ ...gen, brief: e.target.value })} placeholder="Introduce Key Lime as a cash-offer + list-without-agent option. No hard sell. Offer a free home value check." /></div>
              <div><Label>Tone</Label><Input value={gen.tone} onChange={(e) => setGen({ ...gen, tone: e.target.value })} /></div>
              {preview && (
                <div className="rounded border bg-muted/30 p-3 text-xs space-y-2">
                  <div><span className="font-semibold">Subject:</span> {preview.subject}</div>
                  <div><span className="font-semibold">Preheader:</span> {preview.preheader}</div>
                  <div className="border-t pt-2" dangerouslySetInnerHTML={{ __html: preview.htmlBody }} />
                  <div className="text-muted-foreground italic mt-2">Why this will work: {preview.rationale}</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setGenOpen(false); setPreview(null); }}>Close</Button>
              <Button onClick={() => generate.mutate(gen)} disabled={!gen.brief || !gen.audience || generate.isPending}>
                {generate.isPending ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data?.templates || []).map((t: any) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 truncate">Subject: {t.subject}</p>
              </div>
              {t.aiGenerated ? <Badge variant="outline" className="shrink-0"><Sparkles className="h-3 w-3 mr-1" />AI</Badge> : null}
            </div>
            {t.preheader && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.preheader}</p>}
          </Card>
        ))}
        {(data?.templates || []).length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground">No templates yet. Generate your first with AI above.</Card>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Campaigns ─────────────────────────
function CampaignsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/campaigns"] });
  const { data: listsData } = useQuery<any>({ queryKey: ["/api/marketing/lists"] });
  const { data: templatesData } = useQuery<any>({ queryKey: ["/api/marketing/templates"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", listId: "", templateId: "" });
  const [testCampaignId, setTestCampaignId] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendConfirmId, setSendConfirmId] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/campaigns", { ...body, listId: Number(body.listId), templateId: Number(body.templateId) }).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setOpen(false);
      setForm({ name: "", listId: "", templateId: "" });
      toast({ title: "Campaign created" });
    },
    onError: (e: any) => toast({ title: "Create failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const send = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/campaigns/${id}/send`).then(j),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      toast({ title: "Campaign sent", description: `${d.stats.sent} sent, ${d.stats.failed} failed` });
    },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const testSend = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      apiRequest("POST", `/api/marketing/campaigns/${id}/test-send`, { email }).then(j),
    onSuccess: (d: any) => {
      if (d.sent) {
        toast({ title: "Test sent", description: d.stubbed ? "Stub mode (no RESEND_API_KEY) — check server logs." : `Delivered to your inbox. Resend id: ${d.resendId?.slice(0, 8)}…` });
      } else {
        toast({ title: "Test not sent", description: d.error || "Unknown error", variant: "destructive" });
      }
      setTestCampaignId(null);
      setTestEmail("");
    },
    onError: (e: any) => toast({ title: "Test failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.campaigns?.length ?? 0} campaigns</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="April 2026 — Tampa Cancelled Intro" /></div>
              <div>
                <Label>List</Label>
                <Select value={form.listId} onValueChange={(v) => setForm({ ...form, listId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select list" /></SelectTrigger>
                  <SelectContent>
                    {(listsData?.lists || []).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.contactCount})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {(templatesData?.templates || []).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.name || !form.listId || !form.templateId}>Create draft</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left"><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Stats</th><th className="p-3">Created</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(data?.campaigns || []).map((c: any) => {
              const stats = (() => { try { return JSON.parse(c.stats || "{}"); } catch { return {}; } })();
              return (
                <tr key={c.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="p-3"><Badge variant={c.status === "sent" ? "default" : "outline"}>{c.status}</Badge></td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {stats.sent != null ? `${stats.sent} sent, ${stats.failed || 0} failed` : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setTestCampaignId(c.id); setTestEmail(""); }}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />Send test
                      </Button>
                      {c.status === "draft" && (
                        <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => setSendConfirmId(c.id)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" />Send to list
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(data?.campaigns || []).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={testCampaignId !== null} onOpenChange={(v) => { if (!v) setTestCampaignId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send test email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sends a single rendered preview to the address below. The email is prefixed with <code className="bg-muted px-1 rounded">[TEST]</code> in the subject, stats aren't affected, and no contact row is created.
            </p>
            <div>
              <Label>Send to</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@trykeylime.ai"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestCampaignId(null)}>Cancel</Button>
            <Button
              disabled={!testEmail || testSend.isPending}
              onClick={() => testCampaignId && testSend.mutate({ id: testCampaignId, email: testEmail })}
            >
              {testSend.isPending ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sendConfirmId !== null && (
        <SendConfirmDialog
          campaignId={sendConfirmId}
          campaignName={(data?.campaigns || []).find((c: any) => c.id === sendConfirmId)?.name || ""}
          onClose={() => setSendConfirmId(null)}
          onConfirm={() => { send.mutate(sendConfirmId); setSendConfirmId(null); }}
          sending={send.isPending}
        />
      )}
    </div>
  );
}

function SendConfirmDialog({
  campaignId,
  campaignName,
  onClose,
  onConfirm,
  sending,
}: {
  campaignId: number;
  campaignName: string;
  onClose: () => void;
  onConfirm: () => void;
  sending: boolean;
}) {
  const { data: preview, isLoading } = useQuery<any>({
    queryKey: [`/api/marketing/campaigns/${campaignId}/preview`],
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send "{campaignName}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Calculating recipient breakdown…</p>
          ) : preview ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">Will send to</span>
                  <span className="text-2xl font-semibold">{preview.sendable}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  out of {preview.totalOnList} contact{preview.totalOnList === 1 ? "" : "s"} on this list
                </div>
              </div>
              {preview.totalSuppressed > 0 && (
                <div className="rounded-lg border p-3 space-y-1.5 text-xs">
                  <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Suppressed — will NOT receive</div>
                  {preview.suppressedOptedOut > 0 && (
                    <div className="flex justify-between">
                      <span>Opted out</span>
                      <span className="font-mono">{preview.suppressedOptedOut}</span>
                    </div>
                  )}
                  {preview.suppressedBounced > 0 && (
                    <div className="flex justify-between">
                      <span>Previously bounced</span>
                      <span className="font-mono">{preview.suppressedBounced}</span>
                    </div>
                  )}
                </div>
              )}
              {preview.sendable === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  Nobody on this list is eligible to receive. Add contacts first, or re-subscribe opted-out members.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This will run now and cannot be stopped partway through.
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">Couldn't load preview.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isLoading || !preview?.sendable || sending}
            onClick={onConfirm}
          >
            {sending ? "Sending…" : `Send to ${preview?.sendable ?? 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Drips ─────────────────────────
function DripsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<any>({ queryKey: ["/api/marketing/drips"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    audience: "",
    stepCount: 5,
    cadenceDays: "0, 2, 5, 9, 14",
    tone: "direct, warm, consultative",
    activate: false,
  });

  const generate = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/drips/generate", body).then(j),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketing/drips"] });
      qc.invalidateQueries({ queryKey: ["/api/marketing/templates"] });
      setOpen(false);
      toast({ title: "Drip sequence generated", description: "Check the drips list and templates." });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const activate = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/marketing/drips/${id}/activate`).then(j),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/marketing/drips"] }); toast({ title: "Drip activated" }); },
    onError: (e: any) => toast({ title: "Activate failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const tick = useMutation({
    mutationFn: () => apiRequest("POST", "/api/marketing/drips/tick").then(j),
    onSuccess: (d: any) => toast({ title: "Tick complete", description: `${d.sent} sent, ${d.errors} errors, ${d.skipped} skipped` }),
    onError: (e: any) => toast({ title: "Tick failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.sequences?.length ?? 0} drip sequences</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => tick.mutate()}>Run tick now</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Sparkles className="mr-1.5 h-4 w-4" />Generate drip</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Generate AI drip sequence</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tampa Cancelled Sellers — 5-email" /></div>
                <div><Label>Audience</Label><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Tampa Bay homeowner whose MLS listing was recently cancelled or withdrawn (contract ended with listing agent)" /></div>
                <div><Label>Goal</Label><Textarea rows={3} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Move cancelled-listing sellers to book a free home-value consultation with Key Lime. Position Key Lime as the no-commission alternative to re-listing with another agent." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Step count</Label><Input type="number" min={1} max={10} value={form.stepCount} onChange={(e) => setForm({ ...form, stepCount: Number(e.target.value) })} /></div>
                  <div><Label>Cadence (days, comma-sep)</Label><Input value={form.cadenceDays} onChange={(e) => setForm({ ...form, cadenceDays: e.target.value })} /></div>
                </div>
                <div><Label>Tone</Label><Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Checkbox id="activate" checked={form.activate} onCheckedChange={(v) => setForm({ ...form, activate: !!v })} /><Label htmlFor="activate">Activate immediately (otherwise created as draft)</Label></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.name || !form.goal || !form.audience || generate.isPending}
                        onClick={() => generate.mutate({ ...form, cadenceDays: form.cadenceDays.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)) })}>
                  {generate.isPending ? "Generating…" : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {(data?.sequences || []).map((s: any) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                <div className="mt-2 flex gap-2 items-center">
                  <Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge>
                  <span className="text-xs text-muted-foreground">{s.steps?.length || 0} steps · {s.enrollmentCount} enrolled</span>
                </div>
              </div>
              {s.status !== "active" && (
                <Button size="sm" variant="outline" onClick={() => activate.mutate(s.id)}>Activate</Button>
              )}
            </div>
            {s.steps?.length > 0 && (
              <div className="mt-3 border-t pt-3 space-y-1">
                {s.steps.map((step: any) => (
                  <div key={step.id} className="text-xs flex gap-2 text-muted-foreground">
                    <span className="font-mono">Step {step.stepOrder}</span>
                    <span>·</span>
                    <span>T+{step.delayHours}h</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        {(data?.sequences || []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">No drips yet. Generate your first with AI above — cadence defaults work for most real-estate outreach.</Card>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── MLS Search ─────────────────────────
function MlsTab() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    statuses: ["cancelled", "withdrawn", "expired"] as string[],
    city: "Tampa",
    priceMin: "",
    priceMax: "",
    bedsMin: "",
    domMin: "",
    limit: 50,
  });
  const [results, setResults] = useState<any[]>([]);
  const [provider, setProvider] = useState<string>("");

  const search = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/marketing/mls/search", body).then(j),
    onSuccess: (d: any) => { setResults(d.listings || []); setProvider(d.provider); },
    onError: (e: any) => toast({ title: "Search failed", description: e.message, variant: "destructive" }),
  });

  const imp = useMutation({
    mutationFn: (listings: any[]) => apiRequest("POST", "/api/marketing/mls/import", { listings }).then(j),
    onSuccess: (d: any) => toast({ title: "Imported", description: `${d.inserted} new, ${d.updated} already existed` }),
    onError: (e: any) => toast({ title: "Import failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const toggleStatus = (s: string) => {
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s],
    }));
  };

  const runSearch = () => {
    const body: any = { ...filters };
    ["priceMin", "priceMax", "bedsMin", "domMin"].forEach((k) => {
      if (body[k] === "") delete body[k];
      else body[k] = Number(body[k]);
    });
    search.mutate(body);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Filter className="h-4 w-4" />Filters</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Listing status (multi)</Label>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {["active", "cancelled", "withdrawn", "expired", "fsbo", "pending"].map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={filters.statuses.includes(s)} onCheckedChange={() => toggleStatus(s)} />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div><Label className="text-xs">City</Label><Input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} /></div>
            <div><Label className="text-xs">Min price</Label><Input type="number" value={filters.priceMin} onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })} /></div>
            <div><Label className="text-xs">Max price</Label><Input type="number" value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })} /></div>
            <div><Label className="text-xs">Beds min</Label><Input type="number" value={filters.bedsMin} onChange={(e) => setFilters({ ...filters, bedsMin: e.target.value })} /></div>
            <div><Label className="text-xs">DOM min</Label><Input type="number" value={filters.domMin} onChange={(e) => setFilters({ ...filters, domMin: e.target.value })} /></div>
            <div><Label className="text-xs">Limit</Label><Input type="number" value={filters.limit} onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })} /></div>
          </div>
          <Button size="sm" onClick={runSearch} disabled={search.isPending}>
            <Search className="mr-1.5 h-4 w-4" />{search.isPending ? "Searching…" : "Search"}
          </Button>
        </div>
      </Card>

      {provider && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{results.length}</span> results from <Badge variant="outline">{provider}</Badge>
            </div>
            {results.length > 0 && (
              <Button size="sm" onClick={() => imp.mutate(results)} disabled={imp.isPending}>
                Import all into mls_listings
              </Button>
            )}
          </div>
          {results.length === 0 && provider === "bridge" && (
            <p className="mt-3 text-xs text-muted-foreground">
              No results. This is expected until <code className="bg-muted px-1 rounded">BRIDGE_API_TOKEN</code> is configured and your dataset has Tampa Bay data. Once Stellar MLS is live, switch <code className="bg-muted px-1 rounded">MLS_PROVIDER=stellar</code>.
            </p>
          )}
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left"><th className="p-3">Address</th><th className="p-3">City</th><th className="p-3">Status</th><th className="p-3">Price</th><th className="p-3">DOM</th></tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map((l: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-3">{l.address || "—"}</td>
                  <td className="p-3">{l.city || "—"}</td>
                  <td className="p-3"><Badge variant="outline">{l.status}</Badge></td>
                  <td className="p-3">{l.price ? `$${Number(l.price).toLocaleString()}` : "—"}</td>
                  <td className="p-3">{l.daysOnMarket ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
