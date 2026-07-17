import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices } from "@/lib/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Upload, Download } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [{ title: "Invoices · InvoiceVision" }] }),
  component: InvoicesList,
});

function fmt(n: number, ccy = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

function statusColor(s: string) {
  return {
    draft: "secondary", pending: "outline", approved: "default",
    paid: "default", rejected: "destructive",
  }[s] as any ?? "outline";
}

function InvoicesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const fn = useServerFn(listInvoices);
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search, status],
    queryFn: () => fn({ data: { search: search || undefined, status: status === "all" ? undefined : status as any, limit: 100, offset: 0 } }),
  });

  function exportCsv() {
    if (!data?.rows.length) return;
    const rows = data.rows.map((r) => ({
      invoice_number: r.invoice_number, vendor: r.vendor_name, invoice_date: r.invoice_date,
      due_date: r.due_date, status: r.status, subtotal: r.subtotal, tax: r.tax, total: r.total, currency: r.currency,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Search, filter and manage every invoice.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!data?.rows.length}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
          <Button asChild><Link to="/invoices/upload"><Upload className="h-4 w-4 mr-2" />Upload</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor, number, GST..." className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.rows.length ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No invoices match your filters.</p>
              <Button asChild><Link to="/invoices/upload">Upload your first invoice</Link></Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer">
                    <TableCell><Link to="/invoices/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.invoice_number ?? "—"}</Link></TableCell>
                    <TableCell>{r.vendor_name ?? "—"}</TableCell>
                    <TableCell>{r.invoice_date ?? "—"}</TableCell>
                    <TableCell>{r.due_date ?? "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(r.total ?? 0), r.currency ?? "USD")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
