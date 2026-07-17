import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markNotificationRead } from "@/lib/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · InvoiceVision" }] }),
  component: Notifications,
});

function Notifications() {
  const qc = useQueryClient();
  const fn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const { data, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => fn() });
  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Activity and alerts on your invoices.</p>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : !data?.rows.length ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />No notifications yet.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <ul className="divide-y">
            {data.rows.map((n) => (
              <li key={n.id} className={`p-4 flex items-start gap-3 ${!n.read ? "bg-primary/5" : ""}`}>
                <div className={`h-2 w-2 mt-2 rounded-full ${n.read ? "bg-muted" : "bg-primary"}`} />
                <div className="flex-1">
                  {n.invoice_id ? (
                    <Link to="/invoices/$id" params={{ id: n.invoice_id }} className="hover:underline">{n.message}</Link>
                  ) : <span>{n.message}</span>}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => mark.mutate(n.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}
