import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Zap } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/login", { email: email.trim(), password });
      await refresh();
      toast({ title: "Signed in" });
      setLocation("/marketing");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Key Lime Marketing HQ</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email <span className="text-xs text-muted-foreground">(optional if using standalone password)</span></Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="paul.audet.cain@gmail.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Admin-only access. If you're using a shared database (production), sign in with your homedirect admin credentials. Otherwise, enter the standalone password set in <code className="bg-muted px-1 rounded">MARKETING_ADMIN_PASSWORD</code>.
        </p>
      </Card>
    </div>
  );
}
