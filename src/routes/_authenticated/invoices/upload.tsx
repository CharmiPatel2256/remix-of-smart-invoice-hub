import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createUploadUrl, extractInvoice, generateInsights } from "@/lib/invoices.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/upload")({
  head: () => ({ meta: [{ title: "Upload invoice · InvoiceVision" }] }),
  component: UploadPage,
});

type Stage = "idle" | "uploading" | "extracting" | "insights" | "done";

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);

  const createUrl = useServerFn(createUploadUrl);
  const extract = useServerFn(extractInvoice);
  const insights = useServerFn(generateInsights);

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) setFile(f);
  }

  async function process() {
    if (!file) return;
    try {
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!allowed.includes(file.type)) throw new Error("Only PDF, PNG or JPG files are supported");
      if (file.size > 15 * 1024 * 1024) throw new Error("Max file size is 15 MB");

      setStage("uploading");
      const { path, token } = await createUrl({ data: { fileName: file.name, mime: file.type } });
      const { error: upErr } = await supabase.storage.from("invoices").uploadToSignedUrl(path, token, file);
      if (upErr) throw upErr;

      setStage("extracting");
      const { invoiceId } = await extract({ data: { path, mime: file.type, fileName: file.name } });

      setStage("insights");
      await insights({ data: { invoiceId } });

      setStage("done");
      toast.success("Invoice processed");
      setTimeout(() => navigate({ to: "/invoices/$id", params: { id: invoiceId } }), 400);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to process invoice");
      setStage("idle");
    }
  }

  const busy = stage !== "idle" && stage !== "done";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Upload invoice</h1>
        <p className="text-muted-foreground">PDF, PNG or JPG. AI will auto-extract the details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New invoice</CardTitle>
          <CardDescription>Drop a file below or browse your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{file ? file.name : "Click to browse or drag a file"}</p>
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG up to 15 MB</p>
            <input type="file" accept="application/pdf,image/png,image/jpeg" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
          </label>

          {file && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {file.type}</div>
              </div>
              {!busy && <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>}
            </div>
          )}

          <Button className="w-full" onClick={process} disabled={!file || busy} size="lg">
            {stage === "idle" && "Process invoice"}
            {stage === "uploading" && (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>)}
            {stage === "extracting" && (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting with AI…</>)}
            {stage === "insights" && (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating insights…</>)}
            {stage === "done" && (<><CheckCircle2 className="h-4 w-4 mr-2" />Done</>)}
          </Button>

          {busy && (
            <div className="text-xs text-muted-foreground text-center">
              This can take 10–30 seconds depending on document size.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
