import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles, Rocket, BarChart2 } from "lucide-react";

export interface TacticSection {
  plan: React.ReactNode;
  create: React.ReactNode;
  deploy: React.ReactNode;
  monitor: React.ReactNode;
}

interface TacticWorkspaceProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  sections: TacticSection;
  headerRight?: React.ReactNode;
}

export default function TacticWorkspace({
  title,
  subtitle,
  icon,
  accentColor,
  sections,
  headerRight,
}: TacticWorkspaceProps) {
  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className={accentColor}>{icon}</span>
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {headerRight}
      </div>

      <Tabs defaultValue="plan">
        <TabsList className="grid grid-cols-4 mb-6 w-full max-w-2xl">
          <TabsTrigger value="plan" className="text-xs gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Plan
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Create
          </TabsTrigger>
          <TabsTrigger value="deploy" className="text-xs gap-1.5">
            <Rocket className="h-3.5 w-3.5" /> Deploy
          </TabsTrigger>
          <TabsTrigger value="monitor" className="text-xs gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-0">{sections.plan}</TabsContent>
        <TabsContent value="create" className="mt-0">{sections.create}</TabsContent>
        <TabsContent value="deploy" className="mt-0">{sections.deploy}</TabsContent>
        <TabsContent value="monitor" className="mt-0">{sections.monitor}</TabsContent>
      </Tabs>
    </div>
  );
}

export function Placeholder({
  title,
  description,
  status = "planned",
}: {
  title: string;
  description: string;
  status?: "planned" | "building" | "needs-key";
}) {
  const statusConfig = {
    planned: { label: "Planned", color: "text-muted-foreground bg-muted/40 border-border" },
    building: { label: "Building", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    "needs-key": { label: "Needs API Key", color: "text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/30" },
  };
  const cfg = statusConfig[status];
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-8">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge className={`text-[10px] ${cfg.color}`} variant="outline">
          {cfg.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
