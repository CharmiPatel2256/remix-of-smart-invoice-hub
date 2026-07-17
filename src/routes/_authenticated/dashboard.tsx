import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardStats } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from "recharts";
import { FileText, Clock, CheckCircle2, DollarSign, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Ledgerly" }] }),
  component: Dashboard,
});

const PIE_COLORS = ["hsl(var(--muted-foreground))", "hsl(45 90% 55%)", "hsl(200 85% 50%)", "hsl(160 70% 40%)", "hsl(0 75% 55%)"];

function formatCurrency(n: number, ccy = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n); }
  catch { return `$${n.toFixed(0)}`; }
}

function Dashboard() {
  const fn = useServerFn(dashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  const { totals, monthlySeries, topVendors, statusPie, recent, dueSoon } = data;
  const stats = [
    { label: "Total invoices", value: totals.count, icon: FileText, tint: "text-primary" },
    { label: "Pending review", value: totals.pending, icon: Clock, tint: "text-amber-500" },
    { label: "Approved / Paid", value: totals.approved + totals.paid, icon: CheckCircle2, tint: "text-emerald-500" },
    { label: "Total spend", value: formatCurrency(totals.totalSpend), icon: DollarSign, tint: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your invoice processing pipeline.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </div>
              <s.icon className={`h-5 w-5 ${s.tint}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly spend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(180 70% 35%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(180 70% 35%)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="hsl(180 70% 35%)" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status breakdown</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top vendors</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVendors} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={12} width={110} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(180 70% 35%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Due soon</CardTitle>
            {dueSoon.length > 0 && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{dueSoon.length}</Badge>}
          </CardHeader>
          <CardContent>
            {dueSoon.length === 0 ? <p className="text-sm text-muted-foreground">Nothing urgent this week.</p> : (
              <ul className="divide-y">
                {dueSoon.map((r) => (
                  <li key={r.id} className="py-2 flex justify-between text-sm">
                    <Link to="/invoices/$id" params={{ id: r.id }} className="hover:underline">
                      <span className="font-medium">{r.vendor_name ?? "Unknown"}</span>
                      <span className="text-muted-foreground"> · {r.invoice_number ?? "—"}</span>
                    </Link>
                    <span>{r.due_date} · {formatCurrency(Number(r.total ?? 0), r.currency ?? "USD")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No invoices yet. <Link to="/invoices/upload" className="underline">Upload one</Link>.
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id} className="py-3 flex justify-between items-center">
                  <Link to="/invoices/$id" params={{ id: r.id }} className="hover:underline">
                    <div className="font-medium">{r.vendor_name ?? "Unknown vendor"}</div>
                    <div className="text-xs text-muted-foreground">{r.invoice_number ?? "—"} · {r.invoice_date ?? "no date"}</div>
                  </Link>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(Number(r.total ?? 0), r.currency ?? "USD")}</div>
                    <Badge variant="outline" className="text-xs">{r.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
