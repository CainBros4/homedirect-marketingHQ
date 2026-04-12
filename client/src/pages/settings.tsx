import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, CheckCircle2, XCircle, Terminal, Eye, EyeOff } from "lucide-react";

const PROVIDERS = [
  { value: "together",  label: "Together AI",  envVar: "TOGETHER_API_KEY",  defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", docsUrl: "https://api.together.xyz/settings/api-keys" },
  { value: "openai",    label: "OpenAI",        envVar: "OPENAI_API_KEY",    defaultModel: "gpt-4o-mini",                                   docsUrl: "https://platform.openai.com/api-keys" },
  { value: "deepseek",  label: "DeepSeek",      envVar: "DEEPSEEK_API_KEY",  defaultModel: "deepseek-chat",                                 docsUrl: "https://platform.deepseek.com/api_keys" },
  { value: "fireworks", label: "Fireworks AI",  envVar: "FIREWORKS_API_KEY", defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct", docsUrl: "https://fireworks.ai/account/api-keys" },
];

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [provider, setProvider] = useState("together");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [pexelsKey, setPexelsKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: current } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
  });

  useEffect(() => {
    if (current) {
      setProvider(current.provider || "together");
      setModel(current.model || "");
    }
  }, [current]);

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", {
      provider,
      model: model || undefined,
      apiKey: apiKey || undefined,
      elevenlabsKey: elevenlabsKey || undefined,
      pexelsKey: pexelsKey || undefined,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ description: "Settings saved" });
    },
  });

  const selectedProvider = PROVIDERS.find(p => p.value === provider) || PROVIDERS[0];
  const envStatus: Record<string, boolean> = current?.envStatus || {};

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your AI provider and model for the copy generator</p>
      </div>

      {/* Env var status */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Environment Variables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            API keys are read from environment variables — never stored in the database.
            Set these in your <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.env</code> file locally,
            or in Railway's environment variable store for production.
          </p>
          {PROVIDERS.map(p => {
            const detected = envStatus[p.envVar];
            return (
              <div key={p.envVar} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                {detected
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-signal shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                }
                <code className={`text-xs flex-1 font-mono ${detected ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {p.envVar}
                </code>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${detected ? "text-signal" : "text-muted-foreground/40"}`}>
                  {detected ? "Detected" : "Not set"}
                </span>
                {!detected && (
                  <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground underline">
                    Get key →
                  </a>
                )}
              </div>
            );
          })}

          {/* .env example */}
          <div className="mt-3 rounded-md bg-muted/40 border border-border p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">marketing-hub/.env</p>
            <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre">{
`TOGETHER_API_KEY=your-key-here
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=your-key-here
FIREWORKS_API_KEY=your-key-here`
            }</pre>
          </div>
        </CardContent>
      </Card>

      {/* Provider + model selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Active Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key input — used when no env var is set */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              API Key {current?.hasKey ? <span className="font-normal text-signal">(key saved — leave blank to keep)</span> : ""}
            </label>
            <div className="relative">
              <Input
                data-testid="input-api-key"
                type={showKey ? "text" : "password"}
                placeholder={current?.hasKey ? "••••••••••••••••" : `Paste your ${selectedProvider.label} key here`}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm h-9"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Stored securely in the database. For Railway deployments, use environment variables instead (they take priority).
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Provider</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger data-testid="select-provider" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      {envStatus[p.envVar]
                        ? <span className="h-1.5 w-1.5 rounded-full bg-signal shrink-0" />
                        : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                      }
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!envStatus[selectedProvider.envVar] && (
              <p className="text-xs text-amber-400 mt-1.5">
                {selectedProvider.envVar} is not set — add it to your environment before generating copy.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Model override <span className="font-normal">(optional)</span>
            </label>
            <Input
              data-testid="input-model"
              placeholder={selectedProvider.defaultModel}
              value={model}
              onChange={e => setModel(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank to use the default model for the selected provider.</p>
          </div>

          {/* ElevenLabs Key */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              ElevenLabs API Key
              {current?.hasElevenlabs && <span className="font-normal text-signal ml-2">(key saved)</span>}
            </label>
            <Input
              data-testid="input-elevenlabs-key"
              type="password"
              placeholder={current?.hasElevenlabs ? "••••••••••••••••" : "Paste ElevenLabs key — elevenlabs.io/app/settings/api-keys"}
              value={elevenlabsKey}
              onChange={e => setElevenlabsKey(e.target.value)}
              className="font-mono text-sm h-9"
            />
          </div>

          {/* Pexels Key */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Pexels API Key
              {current?.hasPexels && <span className="font-normal text-signal ml-2">(key saved)</span>}
            </label>
            <Input
              data-testid="input-pexels-key"
              type="password"
              placeholder={current?.hasPexels ? "••••••••••••••••" : "Paste Pexels key — pexels.com/api"}
              value={pexelsKey}
              onChange={e => setPexelsKey(e.target.value)}
              className="font-mono text-sm h-9"
            />
          </div>

          <Button
            data-testid="button-save-settings"
            className="bg-signal hover:bg-signal/90 text-[hsl(214,35%,8%)] font-semibold w-full"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
