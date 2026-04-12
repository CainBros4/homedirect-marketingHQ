import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import Seo from "@/pages/seo";
import Meta from "@/pages/meta";
import Ppc from "@/pages/ppc";
import Settings from "@/pages/settings";
// Legacy pages — no longer in sidebar but routes remain accessible for in-progress work
import CopyGenerator from "@/pages/copy-generator";
import BriefGenerator from "@/pages/brief-generator";
import CompetitorMonitor from "@/pages/competitor-monitor";
import FeedbackLoop from "@/pages/feedback-loop";
import History from "@/pages/history";
import PerformanceBoard from "@/pages/performance-board";
import AssetLibrary from "@/pages/asset-library";
import VideoGenerator from "@/pages/video-generator";
import NotFound from "@/pages/not-found";

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/seo" component={Seo} />
          <Route path="/meta" component={Meta} />
          <Route path="/ppc" component={Ppc} />
          <Route path="/settings" component={Settings} />
          {/* Legacy routes (kept accessible for existing generation history / deep links) */}
          <Route path="/copy-generator" component={CopyGenerator} />
          <Route path="/brief-generator" component={BriefGenerator} />
          <Route path="/competitor-monitor" component={CompetitorMonitor} />
          <Route path="/feedback-loop" component={FeedbackLoop} />
          <Route path="/history" component={History} />
          <Route path="/performance-board" component={PerformanceBoard} />
          <Route path="/asset-library" component={AssetLibrary} />
          <Route path="/video-generator" component={VideoGenerator} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppShell />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
