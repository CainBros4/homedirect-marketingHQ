import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon, Trash2, Home, Users, Briefcase } from "lucide-react";

const ICP_COLOR: Record<string, string> = {
  buyer:     "border-blue-500/40 bg-blue-500/10 text-blue-300",
  seller:    "border-signal/40 bg-signal/10 text-signal",
  concierge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const ICP_ICON: Record<string, React.ReactNode> = {
  buyer:     <Home className="h-3 w-3" />,
  seller:    <Users className="h-3 w-3" />,
  concierge: <Briefcase className="h-3 w-3" />,
};

export default function History() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["/api/history"],
    queryFn: () => apiRequest("GET", "/api/history").then(r => r.json()),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/history/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ description: "Deleted" });
    },
  });

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-muted-foreground" /> Generation History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All previously generated copy sets</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {!isLoading && history.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-border text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No generations yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Run the copy generator to see history here</p>
        </div>
      )}

      <div className="space-y-3">
        {history.map((item: any) => (
          <Card key={item.id} className="border-border bg-card hover:border-border/80 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-[10px] flex items-center gap-1 ${ICP_COLOR[item.icp]}`}>
                      {ICP_ICON[item.icp]}
                      <span className="capitalize">{item.icp}</span>
                    </Badge>
                    {item.angle && (
                      <Badge variant="outline" className="text-[10px] capitalize">{item.angle.replace("_", " ")}</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {item.context && (
                    <p className="text-xs text-muted-foreground mb-2 italic">"{item.context}"</p>
                  )}
                  <div className="space-y-1">
                    {item.result?.headlines?.slice(0, 3).map((h: string, i: number) => (
                      <p key={i} className="text-xs text-foreground/80 truncate">• {h}</p>
                    ))}
                    {(item.result?.headlines?.length || 0) > 3 && (
                      <p className="text-[11px] text-muted-foreground">+{item.result.headlines.length - 3} more headlines</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => del.mutate(item.id)}
                  data-testid={`delete-history-${item.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
