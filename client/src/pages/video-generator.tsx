import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Clapperboard,
  Download,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoJob = {
  id: number;
  status: string;
  script: string;
  hookText: string | null;
  ctaText: string | null;
  voiceId: string;
  aspectRatio: string;
  icp: string | null;
  outputPath: string | null;
  audioDuration: number | null;
  errorMessage: string | null;
  createdAt: number;
  completedAt: number | null;
};

// ── Voice options ──────────────────────────────────────────────────────────────

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · Warm female" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam · Deep male" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella · Expressive female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh · Casual male" },
];

// ── Pipeline steps ─────────────────────────────────────────────────────────────

function getStepState(status: string, stepStatus: string): "done" | "active" | "pending" {
  const order = ["pending", "generating_audio", "fetching_broll", "composing", "done", "failed"];
  const stepIdx = order.indexOf(stepStatus);
  const currentIdx = order.indexOf(status);
  if (status === "failed") {
    if (currentIdx > stepIdx) return "done";
    return "pending";
  }
  if (currentIdx > stepIdx) return "done";
  if (currentIdx === stepIdx) return "active";
  return "pending";
}

function PipelineStep({
  label,
  state,
  isLast,
}: {
  label: string;
  state: "done" | "active" | "pending";
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
        state === "done"   ? "bg-[hsl(152,100%,39%)]" :
        state === "active" ? "bg-[hsl(192,100%,50%)]/20 border border-[hsl(192,100%,50%)]" :
        "bg-muted/50 border border-border"
      )}>
        {state === "done" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-black" />
        ) : state === "active" ? (
          <Loader2 className="h-3 w-3 text-[hsl(192,100%,50%)] animate-spin" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <span className={cn(
        "text-sm",
        state === "done"   ? "text-foreground" :
        state === "active" ? "text-[hsl(192,100%,50%)] font-medium" :
        "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:          { label: "Pending",          className: "bg-muted text-muted-foreground" },
    generating_audio: { label: "Generating audio", className: "bg-[hsl(192,100%,50%)]/10 text-[hsl(192,100%,50%)]" },
    fetching_broll:   { label: "Fetching b-roll",  className: "bg-[hsl(192,100%,50%)]/10 text-[hsl(192,100%,50%)]" },
    composing:        { label: "Composing",         className: "bg-[hsl(192,100%,50%)]/10 text-[hsl(192,100%,50%)]" },
    done:             { label: "Done",              className: "bg-[hsl(152,100%,39%)]/15 text-[hsl(152,100%,39%)]" },
    failed:           { label: "Failed",            className: "bg-red-500/15 text-red-400" },
  };
  const { label, className } = map[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded", className)}>{label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VideoGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [script, setScript] = useState("");
  const [hookText, setHookText] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [icp, setIcp] = useState<"buyer" | "seller" | "concierge">("seller");

  // Current job being tracked
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: read pipeline script (one-time)
  useEffect(() => {
    apiRequest("GET", "/api/pipeline/get-script")
      .then(r => r.json())
      .then((data: { script: string | null; icp: string | null }) => {
        if (data.script) {
          setScript(data.script);
          if (data.icp && ["buyer", "seller", "concierge"].includes(data.icp)) {
            setIcp(data.icp as "buyer" | "seller" | "concierge");
          }
          toast({ description: "Script pre-filled from Copy Generator" });
        }
      })
      .catch(() => {
        // silently ignore — no pipeline script
      });
  }, []);

  // Settings check
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
  });

  const missingKeys = settings && (!settings.hasElevenlabs || !settings.hasPexels);

  // Active job polling
  const { data: activeJob, refetch: refetchActiveJob } = useQuery<VideoJob>({
    queryKey: ["/api/video/jobs", activeJobId],
    queryFn: () => apiRequest("GET", `/api/video/jobs/${activeJobId}`).then(r => r.json()),
    enabled: !!activeJobId,
    refetchInterval: false, // We handle polling manually
  });

  // Poll every 3 seconds while job is running
  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    if (activeJobId && activeJob && !["done", "failed"].includes(activeJob.status)) {
      pollIntervalRef.current = setInterval(() => {
        refetchActiveJob();
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeJobId, activeJob?.status]);

  // Past jobs list
  const { data: pastJobs = [], refetch: refetchJobs } = useQuery<VideoJob[]>({
    queryKey: ["/api/video/jobs"],
    queryFn: () => apiRequest("GET", "/api/video/jobs").then(r => r.json()),
    refetchInterval: 8000,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/video/generate", {
        script,
        hookText: hookText || undefined,
        ctaText: ctaText || undefined,
        voiceId,
        aspectRatio,
        icp,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start video job");
      }
      return res.json() as Promise<{ jobId: number }>;
    },
    onSuccess: ({ jobId }) => {
      setActiveJobId(jobId);
      queryClient.invalidateQueries({ queryKey: ["/api/video/jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/video/jobs/${id}`);
      if (!res.ok) throw new Error("Failed to delete job");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video/jobs"] });
      if (activeJobId && pastJobs.find(j => j.id === activeJobId)) {
        setActiveJobId(null);
      }
    },
  });

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    deleteMutation.mutate(id);
  };

  const handleRestoreInputs = (job: VideoJob) => {
    setScript(job.script);
    setHookText(job.hookText || "");
    setCtaText(job.ctaText || "");
    setVoiceId(job.voiceId || "21m00Tcm4TlvDq8ikWAM");
    if (job.aspectRatio === "9:16" || job.aspectRatio === "1:1") {
      setAspectRatio(job.aspectRatio);
    }
    if (job.icp && ["buyer", "seller", "concierge"].includes(job.icp)) {
      setIcp(job.icp as "buyer" | "seller" | "concierge");
    }
    toast({ description: "Inputs restored from past job" });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isGenerating = generateMutation.isPending ||
    (!!activeJob && !["done", "failed"].includes(activeJob?.status ?? ""));

  function formatDuration(secs: number | null | undefined): string {
    if (!secs) return "—";
    return `${Math.round(secs)}s`;
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Clapperboard className="h-5 w-5 text-[hsl(192,100%,50%)]" />
          <h1 className="text-xl font-bold text-foreground">Video Generator</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-8">
          Script → voiceover → b-roll → composed .mp4. No avatars. No actors. Ready in ~60 seconds.
        </p>
      </div>

      {/* Env warning */}
      {missingKeys && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">API keys required</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Add <code className="bg-amber-900/40 px-1 rounded">ELEVENLABS_API_KEY</code> and{" "}
              <code className="bg-amber-900/40 px-1 rounded">PEXELS_API_KEY</code> to your environment variables.
            </p>
          </div>
        </div>
      )}

      {/* Past Videos — shown above the fold when jobs exist and no active job */}
      {pastJobs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            Past Videos
            <Badge variant="outline" className="text-[10px] font-normal">{pastJobs.length}</Badge>
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ICP</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hook</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Format</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pastJobs.map(job => (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      {job.icp ? (
                        <span className="capitalize text-xs font-medium px-2 py-0.5 rounded bg-[hsl(152,100%,39%)]/10 text-[hsl(152,100%,39%)]">
                          {job.icp}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">
                      {job.hookText || <span className="italic opacity-50">No hook</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{job.aspectRatio}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDuration(job.audioDuration)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Restore Inputs button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1.5 text-[hsl(192,100%,50%)] border-[hsl(192,100%,50%)]/30 hover:border-[hsl(192,100%,50%)]/60 hover:bg-[hsl(192,100%,50%)]/5"
                          onClick={() => handleRestoreInputs(job)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                        {job.status === "done" && (
                          <a href={`/api/video/jobs/${job.id}/download`} download="homedirectai-reel.mp4">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                              <Download className="h-3 w-3 mr-1" />
                              .mp4
                            </Button>
                          </a>
                        )}
                        {!["done", "failed"].includes(job.status) && (
                          <button
                            onClick={() => setActiveJobId(job.id)}
                            className="text-xs text-[hsl(192,100%,50%)] hover:underline"
                          >
                            <Play className="h-3 w-3 inline mr-1" />
                            Track
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-red-400"
                          onClick={() => handleDelete(job.id)}
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
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Controls */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Script */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Script
              </label>
              <Textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Paste your 30s or 60s script from Copy Generator here (voiceover text)..."
                className="min-h-[120px] text-sm resize-none bg-background border-border"
              />
            </div>

            {/* Hook Text */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Hook Text <span className="font-normal normal-case">(0–4s overlay)</span>
              </label>
              <Input
                value={hookText}
                onChange={e => setHookText(e.target.value)}
                placeholder='e.g. "Save $19,000 on your home sale"'
                className="text-sm bg-background border-border"
              />
            </div>

            {/* CTA Text */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                CTA Text <span className="font-normal normal-case">(last 5s overlay)</span>
              </label>
              <Input
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                placeholder='e.g. "Try KeyLime AI — 1% at closing"'
                className="text-sm bg-background border-border"
              />
            </div>

            {/* Voice */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Voice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceId(v.id)}
                    className={cn(
                      "text-left px-3 py-2 rounded-md border text-sm transition-colors",
                      voiceId === v.id
                        ? "border-[hsl(152,100%,39%)] bg-[hsl(152,100%,39%)]/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Format
              </label>
              <div className="flex gap-2">
                {([["9:16", "9:16 Reels"], ["1:1", "1:1 Feed"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAspectRatio(val)}
                    className={cn(
                      "flex-1 py-2 rounded-md border text-sm font-medium transition-colors",
                      aspectRatio === val
                        ? "border-[hsl(192,100%,50%)] bg-[hsl(192,100%,50%)]/10 text-[hsl(192,100%,50%)]"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ICP */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                ICP <span className="font-normal normal-case">(auto b-roll terms)</span>
              </label>
              <div className="flex gap-2">
                {(["buyer", "seller", "concierge"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setIcp(v)}
                    className={cn(
                      "flex-1 capitalize py-2 rounded-md border text-sm font-medium transition-colors",
                      icp === v
                        ? "border-[hsl(152,100%,39%)] bg-[hsl(152,100%,39%)]/10 text-[hsl(152,100%,39%)]"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              className="w-full bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,34%)] text-black font-semibold"
              disabled={isGenerating || !script.trim() || !!missingKeys}
              onClick={() => generateMutation.mutate()}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><Clapperboard className="h-4 w-4 mr-2" /> Generate Video</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT: Output */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <h2 className="text-sm font-semibold text-foreground">Output</h2>
          </CardHeader>
          <CardContent>
            {/* Empty state */}
            {!activeJob && !activeJobId && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="p-4 rounded-full bg-muted/30 mb-4">
                  <Clapperboard className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Your video will appear here.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Takes 30–60 seconds.</p>
              </div>
            )}

            {/* Generating state */}
            {activeJob && !["done", "failed"].includes(activeJob.status) && (
              <div className="space-y-4 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Pipeline</p>
                <PipelineStep
                  label="Generating voiceover (ElevenLabs)"
                  state={getStepState(activeJob.status, "generating_audio")}
                />
                <PipelineStep
                  label="Fetching b-roll (Pexels)"
                  state={getStepState(activeJob.status, "fetching_broll")}
                />
                <PipelineStep
                  label="Composing video (FFmpeg)"
                  state={getStepState(activeJob.status, "composing")}
                  isLast
                />
                <div className="mt-6 text-xs text-muted-foreground">
                  Job #{activeJob.id} · {activeJob.aspectRatio} · {activeJob.icp || "—"}
                </div>
              </div>
            )}

            {/* Done state */}
            {activeJob?.status === "done" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[hsl(152,100%,39%)]/30 bg-[hsl(152,100%,39%)]/10">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(152,100%,39%)] shrink-0" />
                  <p className="text-sm font-medium text-[hsl(152,100%,39%)]">Video ready!</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{activeJob.aspectRatio}</Badge>
                  <Badge variant="secondary">{formatDuration(activeJob.audioDuration)}</Badge>
                  {activeJob.icp && <Badge variant="secondary" className="capitalize">{activeJob.icp}</Badge>}
                </div>

                <a
                  href={`/api/video/jobs/${activeJob.id}/download`}
                  download="homedirectai-reel.mp4"
                  className="block"
                >
                  <Button className="w-full bg-[hsl(152,100%,39%)] hover:bg-[hsl(152,100%,34%)] text-black font-semibold">
                    <Download className="h-4 w-4 mr-2" />
                    Download .mp4
                  </Button>
                </a>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveJobId(null)}
                >
                  Generate Another
                </Button>
              </div>
            )}

            {/* Failed state */}
            {activeJob?.status === "failed" && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Generation failed</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{activeJob.errorMessage || "Unknown error"}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setActiveJobId(null);
                    generateMutation.mutate();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
