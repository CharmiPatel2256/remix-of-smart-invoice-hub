
# Smart Invoice Processing System

Built on Lovable's stack (TanStack Start + Lovable Cloud + Lovable AI Gateway) rather than Next.js/Azure, since Lovable can't provision Azure. The feature set is equivalent — auth, cloud storage, database, OCR-style extraction via a vision LLM, AI insights, dashboards, workflow.

## Stack mapping

| Spec (Azure) | Built with |
|---|---|
| Next.js 15 + TS + Tailwind + shadcn | TanStack Start + TS + Tailwind + shadcn (already in project) |
| Azure AD B2C / JWT | Lovable Cloud auth (email/password + Google) |
| Azure SQL | Lovable Cloud Postgres |
| Azure Blob Storage | Lovable Cloud Storage (`invoices` bucket, private) |
| Azure Document Intelligence | Gemini vision model via Lovable AI Gateway (structured JSON extraction) |
| Azure OpenAI (summary/risk) | Gemini via Lovable AI Gateway |
| Recharts | Recharts |
| Azure App Service | Lovable hosting (Publish) |

Users will see "Lovable AI" / "AI-powered", not provider names.

## Data model (Postgres, RLS on)

- `profiles` (id → auth.users, name, email, created_at)
- `user_roles` (id, user_id, role: admin | manager | user) — separate table, `has_role()` SECURITY DEFINER
- `invoices` — id, user_id, invoice_number, vendor_name, vendor_address, invoice_date, due_date, gst_number, currency, subtotal, tax, discount, total, payment_terms, status (draft|pending|approved|rejected|paid), category, storage_path, extracted_json (jsonb), ai_summary, ai_flags (jsonb: duplicate/suspicious/missing), created_at, updated_at
- `invoice_items` — id, invoice_id, description, quantity, unit_price, amount
- `notifications` — id, user_id, type, message, invoice_id, read, created_at

RLS: users read/write their own invoices; managers/admins read all and change status. Grants for `authenticated` + `service_role` per rules.

Storage bucket `invoices` (private) with RLS: owner-only read/write via signed URLs.

## Server functions (`src/lib/*.functions.ts`)

- `uploadInvoice` — signed upload URL for storage
- `extractInvoice` — signed-read URL → Lovable AI (Gemini) with image/PDF input + strict JSON schema (all extraction fields + line items) → insert `invoices` + `invoice_items` in `draft` status
- `generateInsights` — AI summary, payment recommendation, missing-field detection, duplicate check (query same vendor + invoice_number + total), suspicious flags
- `updateInvoice`, `setInvoiceStatus` (role-gated), `listInvoices` (search/filter/pagination), `getInvoice`, `deleteInvoice`
- `dashboardStats`, `analytics` (monthly, vendor, category, paid vs pending, tax)
- `exportInvoices` (CSV/Excel via `xlsx`; PDF via `pdf-lib`)
- `createNotification` + triggers on upload/approve/paid; due-date approaching computed on read

## Routes (`src/routes/`)

Public:
- `/` — landing page (hero, features, CTA)
- `/auth` — sign in / sign up / forgot password (email + Google)
- `/reset-password`

Protected under `_authenticated/`:
- `/dashboard` — widgets (total, pending, approved, paid, spend, monthly, tax) + recent invoices + Recharts
- `/invoices` — list with search + filters (month, vendor, status, amount, category)
- `/invoices/upload` — drag-drop PDF/PNG/JPG, uploads → extracts → redirects to detail
- `/invoices/$id` — extracted fields editable, line items table, AI insights panel, approval actions (role-gated), export buttons
- `/analytics` — full charts page
- `/notifications`
- `/profile`, `/settings`

## AI extraction contract

Gemini `google/gemini-3-flash-preview` with `image_url`/`file` block + Zod strict schema (nullable optional fields) covering: invoice_number, vendor_name/address, invoice_date, due_date, gst_number, currency, subtotal, tax, discount, total, payment_terms, line_items[]. `NoObjectGeneratedError` handled with a fallback empty extraction so the user can edit manually.

Insights call returns: summary (string), payment_recommendation, missing_fields[], is_duplicate (bool + reason), is_suspicious (bool + reason).

## UI / design

- shadcn components, Tailwind v4 tokens (already set up), light/dark
- Custom modern palette (not default indigo), one distinctive direction — deep teal primary + warm neutral surface, Geist/Inter typography loaded via `<link>` in `__root.tsx`
- Sidebar layout for authenticated app; marketing-style landing page

## Security

- RLS on every table; `has_role()` for role checks; role changes admin-only
- Private storage + signed URLs only
- Zod validation on every server fn input; file type/size limits on upload (20MB, pdf/png/jpg/jpeg)
- No service-role usage for normal reads; admin client only inside handlers when needed

## Notifications

Toast on client events; `notifications` rows written server-side on upload, status change, payment. Due-date approaching surfaced as computed banner on dashboard.

## Out of scope / simplifications vs original spec

- No Azure App Service / Key Vault / Monitor — Lovable owns hosting, secrets, and logs equivalently
- No Azure AD B2C SSO — email/password + Google (Lovable-supported providers). SAML/Apple can be added later
- No separate Azure Functions — server functions are equivalent
- AI Vision handled by the single multimodal Gemini call; no separate OCR service

## Build order (single pass)

1. Enable Lovable Cloud
2. Migrations: tables, RLS, grants, roles, storage bucket + policies
3. Design tokens + fonts + shell layout
4. Auth pages + `_authenticated/route.tsx` gate
5. Landing page (replace placeholder index)
6. Upload + extract server fns + upload page
7. Invoice list + detail (edit, approve, insights)
8. Dashboard + analytics + charts
9. Export (CSV/XLSX/PDF) + notifications
10. Head metadata per route; verify build

I'll implement everything in one build once approved.
