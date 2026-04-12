import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center">
      <p className="text-4xl font-bold text-muted-foreground/20 mb-4">404</p>
      <p className="text-sm font-semibold text-foreground mb-1">Page not found</p>
      <p className="text-xs text-muted-foreground mb-6">That page doesn't exist in the Marketing Hub</p>
      <Link href="/"><Button variant="outline" size="sm">Back to Dashboard</Button></Link>
    </div>
  );
}
