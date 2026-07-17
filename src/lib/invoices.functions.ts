import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const uuid = z.string().uuid();

function getAi() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

// ---------- Upload: return a signed upload URL ----------
const uploadInput = z.object({
  fileName: z.string().min(1).max(255),
  mime: z.string().min(1).max(100),
});

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => uploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(data.mime)) throw new Error("Unsupported file type");
    const clean = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${Date.now()}_${clean}`;
    const { data: signed, error } = await context.supabase.storage
      .from("invoices")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ---------- Signed read URL ----------
export const getInvoiceFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("invoices")
      .createSignedUrl(data.path, 60 * 30);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ---------- AI extraction ----------
const lineItemSchema = z.object({
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable(),
});
const extractionSchema = z.object({
  invoice_number: z.string().nullable(),
  vendor_name: z.string().nullable(),
  vendor_address: z.string().nullable(),
  invoice_date: z.string().nullable(),
  due_date: z.string().nullable(),
  gst_number: z.string().nullable(),
  currency: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  discount: z.number().nullable(),
  total: z.number().nullable(),
  payment_terms: z.string().nullable(),
  category: z.string().nullable(),
  line_items: z.array(lineItemSchema),
});
type Extraction = z.infer<typeof extractionSchema>;

function emptyExtraction(): Extraction {
  return {
    invoice_number: null, vendor_name: null, vendor_address: null,
    invoice_date: null, due_date: null, gst_number: null, currency: null,
    subtotal: null, tax: null, discount: null, total: null,
    payment_terms: null, category: null, line_items: [],
  };
}

export const extractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string(), mime: z.string(), fileName: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("invoices").createSignedUrl(data.path, 60 * 10);
    if (sErr) throw sErr;

    // Fetch and base64-encode
    const fileRes = await fetch(signed.signedUrl);
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);

    const isPdf = data.mime === "application/pdf";
    const contentBlock = isPdf
      ? { type: "file" as const, file: { filename: data.fileName, file_data: `data:${data.mime};base64,${b64}` } }
      : { type: "image_url" as const, image_url: { url: `data:${data.mime};base64,${b64}` } };

    const ai = getAi();
    let extraction: Extraction = emptyExtraction();
    try {
      const { output } = await generateText({
        model: ai("google/gemini-3-flash-preview"),
        output: Output.object({ schema: extractionSchema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract structured invoice data from this document. Use ISO dates (YYYY-MM-DD). Return null for missing fields. Include every line item.",
              },
              contentBlock as any,
            ] as any,
          },
        ],
      });
      extraction = output;
    } catch (e) {
      if (!NoObjectGeneratedError.isInstance(e)) console.error("extract error", e);
    }

    // Insert invoice + items
    const { data: invRow, error: iErr } = await context.supabase
      .from("invoices")
      .insert({
        user_id: context.userId,
        invoice_number: extraction.invoice_number,
        vendor_name: extraction.vendor_name,
        vendor_address: extraction.vendor_address,
        invoice_date: extraction.invoice_date,
        due_date: extraction.due_date,
        gst_number: extraction.gst_number,
        currency: extraction.currency ?? "USD",
        subtotal: extraction.subtotal ?? 0,
        tax: extraction.tax ?? 0,
        discount: extraction.discount ?? 0,
        total: extraction.total ?? 0,
        payment_terms: extraction.payment_terms,
        category: extraction.category,
        status: "draft",
        storage_path: data.path,
        file_name: data.fileName,
        file_mime: data.mime,
        extracted_json: extraction as any,
      })
      .select()
      .single();
    if (iErr) throw iErr;

    if (extraction.line_items.length) {
      const items = extraction.line_items.map((it, idx) => ({
        invoice_id: invRow.id,
        description: it.description,
        quantity: it.quantity ?? 1,
        unit_price: it.unit_price ?? 0,
        amount: it.amount ?? 0,
        position: idx,
      }));
      await context.supabase.from("invoice_items").insert(items);
    }

    await context.supabase.from("notifications").insert({
      user_id: context.userId,
      type: "invoice_uploaded",
      message: `Invoice ${extraction.invoice_number ?? "(no number)"} from ${extraction.vendor_name ?? "unknown vendor"} uploaded`,
      invoice_id: invRow.id,
    });

    return { invoiceId: invRow.id };
  });

// ---------- AI insights ----------
const insightsSchema = z.object({
  summary: z.string(),
  payment_recommendation: z.string(),
  missing_fields: z.array(z.string()),
  is_duplicate: z.boolean(),
  duplicate_reason: z.string().nullable(),
  is_suspicious: z.boolean(),
  suspicious_reason: z.string().nullable(),
});

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ invoiceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("invoices").select("*").eq("id", data.invoiceId).single();
    if (error) throw error;

    // Duplicate lookup
    const { data: dupes } = await context.supabase
      .from("invoices")
      .select("id, invoice_number, total, vendor_name, created_at")
      .eq("user_id", context.userId)
      .neq("id", inv.id)
      .eq("invoice_number", inv.invoice_number ?? "___none___")
      .eq("vendor_name", inv.vendor_name ?? "___none___");

    const ai = getAi();
    const prompt = `You are an accounts payable analyst. Analyze this invoice and return a concise summary and risk assessment.
Invoice data:
${JSON.stringify({
  invoice_number: inv.invoice_number, vendor_name: inv.vendor_name, vendor_address: inv.vendor_address,
  invoice_date: inv.invoice_date, due_date: inv.due_date, gst_number: inv.gst_number,
  currency: inv.currency, subtotal: inv.subtotal, tax: inv.tax, discount: inv.discount, total: inv.total,
  payment_terms: inv.payment_terms,
}, null, 2)}
Potential duplicates in this user's history: ${JSON.stringify(dupes ?? [])}.
List missing critical fields (invoice_number, vendor_name, invoice_date, total are required).
Flag suspicious if totals don't reconcile (subtotal + tax - discount != total within 1 unit) or if the vendor/GST looks malformed.
Keep summary under 60 words. payment_recommendation should mention due date urgency.`;

    let insights = {
      summary: "AI summary unavailable.",
      payment_recommendation: "Review manually.",
      missing_fields: [] as string[],
      is_duplicate: (dupes?.length ?? 0) > 0,
      duplicate_reason: (dupes?.length ?? 0) > 0 ? "Matching vendor and invoice number found." : null,
      is_suspicious: false,
      suspicious_reason: null as string | null,
    };
    try {
      const { output } = await generateText({
        model: ai("google/gemini-3-flash-preview"),
        output: Output.object({ schema: insightsSchema }),
        prompt,
      });
      insights = output;
    } catch (e) {
      if (!NoObjectGeneratedError.isInstance(e)) console.error("insights error", e);
    }

    await context.supabase.from("invoices").update({
      ai_summary: insights.summary,
      ai_flags: insights as any,
    }).eq("id", inv.id);

    return insights;
  });

// ---------- CRUD ----------
const invoiceUpdate = z.object({
  id: uuid,
  patch: z.object({
    invoice_number: z.string().nullable().optional(),
    vendor_name: z.string().nullable().optional(),
    vendor_address: z.string().nullable().optional(),
    invoice_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    gst_number: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    subtotal: z.number().nullable().optional(),
    tax: z.number().nullable().optional(),
    discount: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
    payment_terms: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.enum(["draft", "pending", "approved", "rejected", "paid"]).optional(),
  }),
});

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => invoiceUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoices").update(data.patch).eq("id", data.id);
    if (error) throw error;
    if (data.patch.status) {
      await context.supabase.from("notifications").insert({
        user_id: context.userId, type: `invoice_${data.patch.status}`,
        message: `Invoice status changed to ${data.patch.status}`, invoice_id: data.id,
      });
    }
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from("invoices").select("storage_path").eq("id", data.id).single();
    if (inv?.storage_path) await context.supabase.storage.from("invoices").remove([inv.storage_path]);
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase.from("invoices").select("*").eq("id", data.id).single();
    if (error) throw error;
    const { data: items } = await context.supabase
      .from("invoice_items").select("*").eq("invoice_id", data.id).order("position");
    return { invoice: inv, items: items ?? [] };
  });

const listInput = z.object({
  search: z.string().optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "paid"]).optional(),
  vendor: z.string().optional(),
  category: z.string().optional(),
  month: z.string().optional(), // YYYY-MM
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("invoices").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.vendor) q = q.ilike("vendor_name", `%${data.vendor}%`);
    if (data.category) q = q.eq("category", data.category);
    if (data.minAmount !== undefined) q = q.gte("total", data.minAmount);
    if (data.maxAmount !== undefined) q = q.lte("total", data.maxAmount);
    if (data.month) {
      const [y, m] = data.month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endD = new Date(y, m, 1);
      const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-01`;
      q = q.gte("invoice_date", start).lt("invoice_date", end);
    }
    if (data.search) {
      q = q.or(
        `invoice_number.ilike.%${data.search}%,vendor_name.ilike.%${data.search}%,gst_number.ilike.%${data.search}%`,
      );
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0 };
  });

// ---------- Dashboard + analytics ----------
export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoices")
      .select("id, status, total, tax, invoice_date, vendor_name, due_date, category, created_at, currency, invoice_number");
    if (error) throw error;
    const list = rows ?? [];
    const sum = (arr: typeof list, k: "total" | "tax") =>
      arr.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    const totals = {
      count: list.length,
      pending: list.filter((r) => r.status === "pending").length,
      approved: list.filter((r) => r.status === "approved").length,
      paid: list.filter((r) => r.status === "paid").length,
      draft: list.filter((r) => r.status === "draft").length,
      totalSpend: sum(list, "total"),
      totalTax: sum(list, "tax"),
    };

    // Monthly
    const monthly = new Map<string, number>();
    for (const r of list) {
      const d = r.invoice_date ? new Date(r.invoice_date) : new Date(r.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(k, (monthly.get(k) ?? 0) + Number(r.total ?? 0));
    }
    const monthlySeries = Array.from(monthly.entries()).sort().map(([month, total]) => ({ month, total }));

    // Vendor top
    const vendors = new Map<string, number>();
    for (const r of list) {
      const v = r.vendor_name ?? "Unknown";
      vendors.set(v, (vendors.get(v) ?? 0) + Number(r.total ?? 0));
    }
    const topVendors = Array.from(vendors.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);

    // Category
    const cats = new Map<string, number>();
    for (const r of list) {
      const c = r.category ?? "Uncategorized";
      cats.set(c, (cats.get(c) ?? 0) + Number(r.total ?? 0));
    }
    const categories = Array.from(cats.entries()).map(([name, total]) => ({ name, total }));

    // Status pie
    const statusPie = ["draft", "pending", "approved", "paid", "rejected"].map((s) => ({
      name: s,
      value: list.filter((r) => r.status === s).length,
    }));

    // Recent + upcoming
    const recent = list.slice().sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 6);
    const today = new Date();
    const soon = list.filter((r) => {
      if (!r.due_date || r.status === "paid") return false;
      const d = new Date(r.due_date);
      const diff = (d.getTime() - today.getTime()) / 86400000;
      return diff <= 7 && diff >= -1;
    }).slice(0, 5);

    return { totals, monthlySeries, topVendors, categories, statusPie, recent, dueSoon: soon };
  });

// ---------- Notifications ----------
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    return { rows: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("notifications").update({ read: true }).eq("id", data.id);
    return { ok: true };
  });

// ---------- Profile ----------
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles").select("*").eq("id", context.userId).single();
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return { profile: data, roles: (roles ?? []).map((r) => r.role) };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().max(100).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({ name: data.name }).eq("id", context.userId);
    return { ok: true };
  });
