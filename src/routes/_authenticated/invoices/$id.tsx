import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoice, updateInvoice, deleteInvoice, getInvoiceFileUrl, generateInsights } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldCheck, Sparkles, Trash2, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice · InvoiceVision" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getInvoice);
  const updateFn = useServerFn(updateInvoice);
  const deleteFn = useServerFn(deleteInvoice);
  const urlFn = useServerFn(getInvoiceFileUrl);
  const insightsFn = useServerFn(generateInsights);

  const { data, isLoading } = useQuery({ queryKey: ["invoice", id], queryFn: () => getFn({ data: { id } }) });
  const [form, setForm] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => { if (data) setForm(data.invoice); }, [data]);
  useEffect(() => {
    if (data?.invoice?.storage_path) {
      urlFn({ data: { path: data.invoice.storage_path } }).then((r) => setFileUrl(r.url)).catch(() => {});
    }
  }, [data?.invoice?.storage_path]);

  const saveMut = useMutation({
    mutationFn: (patch: any) => updateFn({ data: { id, patch } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice", id] }); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const insightsMut = useMutation({
    mutationFn: () => insightsFn({ data: { invoiceId: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice", id] }); toast.success("Insights refreshed"); },
  });

  const delMut = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); navigate({ to: "/invoices" }); },
  });

  if (isLoading || !data || !form) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div>;
  }

  const inv = data.invoice;
  const flags = (inv.ai_flags ?? {}) as any;

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function save() {
    const patch = {
      invoice_number: form.invoice_number, vendor_name: form.vendor_name, vendor_address: form.vendor_address,
      invoice_date: form.invoice_date, due_date: form.due_date, gst_number: form.gst_number, currency: form.currency,
      subtotal: Number(form.subtotal ?? 0), tax: Number(form.tax ?? 0), discount: Number(form.discount ?? 0),
      total: Number(form.total ?? 0), payment_terms: form.payment_terms, category: form.category, notes: form.notes,
    };
    saveMut.mutate(patch);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />{inv.file_name}
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            {inv.vendor_name ?? "Unknown vendor"}
          </h1>
          <p className="text-muted-foreground">Invoice #{inv.invoice_number ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={inv.status} onValueChange={(v) => saveMut.mutate({ status: v as any })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["draft", "pending", "approved", "paid", "rejected"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => insightsMut.mutate()} disabled={insightsMut.isPending}>
            {insightsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">Re-analyze</span>
          </Button>
          <Button variant="destructive" size="icon" onClick={() => { if (confirm("Delete this invoice?")) delMut.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(flags.is_duplicate || flags.is_suspicious) && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              {flags.is_duplicate && <div><strong>Possible duplicate:</strong> {flags.duplicate_reason}</div>}
              {flags.is_suspicious && <div><strong>Suspicious:</strong> {flags.suspicious_reason}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle><CardDescription>Edit AI-extracted fields</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Invoice number" v={form.invoice_number} onChange={(v) => set("invoice_number", v)} />
              <Field label="Vendor" v={form.vendor_name} onChange={(v) => set("vendor_name", v)} />
              <Field label="Invoice date" v={form.invoice_date} onChange={(v) => set("invoice_date", v)} type="date" />
              <Field label="Due date" v={form.due_date} onChange={(v) => set("due_date", v)} type="date" />
              <Field label="GST / Tax number" v={form.gst_number} onChange={(v) => set("gst_number", v)} />
              <Field label="Currency" v={form.currency} onChange={(v) => set("currency", v)} />
              <Field label="Subtotal" v={form.subtotal} onChange={(v) => set("subtotal", v)} type="number" />
              <Field label="Tax" v={form.tax} onChange={(v) => set("tax", v)} type="number" />
              <Field label="Discount" v={form.discount} onChange={(v) => set("discount", v)} type="number" />
              <Field label="Total" v={form.total} onChange={(v) => set("total", v)} type="number" />
              <Field label="Payment terms" v={form.payment_terms} onChange={(v) => set("payment_terms", v)} />
              <Field label="Category" v={form.category} onChange={(v) => set("category", v)} />
              <div className="md:col-span-2">
                <Label>Vendor address</Label>
                <Textarea value={form.vendor_address ?? ""} onChange={(e) => set("vendor_address", e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={save} disabled={saveMut.isPending}>
                  {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
            <CardContent>
              {data.items.length === 0 ? <p className="text-sm text-muted-foreground">No line items were extracted.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left"><th className="py-2">Description</th><th>Qty</th><th>Unit</th><th className="text-right">Amount</th></tr></thead>
                    <tbody>
                      {data.items.map((it: any) => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="py-2 pr-2">{it.description ?? "—"}</td>
                          <td>{it.quantity ?? "—"}</td>
                          <td>{it.unit_price ?? "—"}</td>
                          <td className="text-right">{Number(it.amount ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /><CardTitle>AI insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</div>
                <p>{inv.ai_summary ?? "No summary yet."}</p>
              </div>
              {flags.payment_recommendation && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Payment recommendation</div>
                  <p>{flags.payment_recommendation}</p>
                </div>
              )}
              {flags.missing_fields?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Missing fields</div>
                  <div className="flex flex-wrap gap-1">
                    {flags.missing_fields.map((f: string) => <Badge key={f} variant="outline">{f}</Badge>)}
                  </div>
                </div>
              )}
              {!flags.is_duplicate && !flags.is_suspicious && (
                <div className="flex items-center gap-2 text-emerald-600"><ShieldCheck className="h-4 w-4" /><span>No risks detected</span></div>
              )}
            </CardContent>
          </Card>

          {fileUrl && (
            <Card>
              <CardHeader><CardTitle>Source file</CardTitle></CardHeader>
              <CardContent>
                {inv.file_mime?.startsWith("image/") ? (
                  <img src={fileUrl} alt="Invoice" className="rounded-md border w-full" />
                ) : (
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary underline text-sm">Open PDF</a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, onChange, type }: { label: string; v: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type ?? "text"} value={v ?? ""} onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)} />
    </div>
  );
}
