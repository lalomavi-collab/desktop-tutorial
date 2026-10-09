// lalum-fin-import: READ-ONLY import of history from Invoice4U into the ledger.
//   { action: "customers" }                                  upsert customers, link by Invoice4U id
//   { action: "documents", from: "YYYY-MM-DD", to: "YYYY-MM-DD" }   mirror documents into lalum_fin_archive
//
// Nothing here creates, changes or cancels anything in Invoice4U. Only search and retrieve calls.
//
// Env (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected):
//   INVOICE4U_API_KEY   organization API key (GUID), passed as `token`
//   FIN_IMPORT_ENV      "prod" (default) or "qa". History lives in production, and a read cannot
//                       issue anything, so the default differs from FIN_INVOICE4U_ENV on purpose.
//
// Access: only a firm partner or admin with MFA (lalum_fin_can). Writes use the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

type Obj = Record<string, unknown>;
// Invoice4U document types worth mirroring: invoice, receipt, invoice-receipt, credit, pro forma.
const DOC_TYPES = [1, 2, 3, 4, 5];
const redact = (s: string, key: string) => s.split(key).join("[REDACTED]").slice(0, 800);
// The window is widened by a day on both sides (Israel is UTC+2 or +3) and rows are then filtered by
// their Israel-time issue date, so a boundary document is neither lost nor counted twice.
const wcf = (iso: string, endOfDay = false) =>
  `/Date(${Date.parse(`${iso}T${endOfDay ? "23:59:59" : "00:00:00"}Z`) + (endOfDay ? 86_400_000 : -86_400_000)})/`;
const fromWcf = (v: unknown): string | null => {
  const m = typeof v === "string" ? /\/Date\((-?\d+)/.exec(v) : null;
  return m ? new Date(Number(m[1])).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) : null;
};
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("INVOICE4U_API_KEY")?.trim();
  const prod = !(Deno.env.get("FIN_IMPORT_ENV") ?? "prod").toLowerCase().startsWith("qa");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) return json(500, { code: "not_configured" });
  if (!apiKey) return json(500, { code: "invoice4u_not_configured" });
  const base = prod ? "https://api.invoice4u.co.il/Services/ApiService.svc" : "https://apiqa.invoice4u.co.il/Services/ApiService.svc";

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const { data: firmId } = await asUser.rpc("lalum_my_firm_id");
  const { data: allowed } = firmId ? await asUser.rpc("lalum_fin_can", { p_firm: firmId }) : { data: false };
  if (!firmId || allowed !== true) return json(403, { code: "forbidden" });

  let body: { action?: string; from?: string; to?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const admin = createClient(url, serviceKey);

  // The envelope differs between endpoints: `d`, or `<Operation>Result`, or bare.
  async function call(op: string, payload: Obj): Promise<{ d: Obj; errors: Array<{ ID?: number; Error?: string }> }> {
    const res = await fetch(`${base}/${op}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, token: apiKey }),
    });
    const text = await res.text();
    let parsed: Obj;
    try { parsed = JSON.parse(text); } catch { throw new Error(`${op} HTTP ${res.status} non-JSON`); }
    const d = ((parsed.d ?? parsed[`${op}Result`] ?? parsed) as Obj | null) ?? {};
    return { d, errors: Array.isArray(d.Errors) ? (d.Errors as Array<{ ID?: number; Error?: string }>) : [] };
  }
  async function logRun(row: Obj) {
    await admin.from("lalum_fin_import_runs").insert({ firm_id: firmId, run_by: user!.id, ...row });
  }

  try {
    if (body.action === "customers") {
      const { d, errors } = await call("GetCustomersByOrgId", {});
      const list = Array.isArray(d.Response) ? (d.Response as Obj[]) : [];
      if (errors.length) {
        await logRun({ kind: "CUSTOMERS", error: redact(JSON.stringify(errors), apiKey) });
        return json(502, { code: "invoice4u_rejected", errors: errors.map((e) => e.Error) });
      }
      const { data: existing } = await admin.from("lalum_fin_customers").select("id, tax_id, i4u_customer_id").eq("firm_id", firmId);
      const byI4u = new Set((existing ?? []).filter((c) => c.i4u_customer_id).map((c) => Number(c.i4u_customer_id)));
      const byTax = new Map((existing ?? []).filter((c) => c.tax_id && !c.i4u_customer_id).map((c) => [String(c.tax_id), c.id as string]));
      let inserted = 0, linked = 0, skipped = 0;
      const toInsert: Obj[] = [];
      for (const c of list) {
        const id = Number(c.ID);
        if (!(id > 0)) { skipped++; continue; }
        if (byI4u.has(id)) { skipped++; continue; }
        const uid = String(c.UniqueID ?? "").replace(/\D/g, "");
        const tax = /^\d{5,9}$/.test(uid) ? uid : null;
        const linkTo = tax ? byTax.get(tax) : undefined;
        if (linkTo) {
          await admin.from("lalum_fin_customers").update({ i4u_customer_id: id }).eq("id", linkTo);
          byTax.delete(tax!); linked++; continue;
        }
        const email = String(c.Email ?? "").trim();
        toInsert.push({
          firm_id: firmId, name: String(c.Name ?? "").trim().slice(0, 200) || `לקוח ${id}`, tax_id: tax,
          email: /^[^@\s]+@[^@\s]+$/.test(email) ? email : null, phone: String(c.Phone ?? c.Cell ?? "").trim() || null,
          address: String(c.Address ?? "").trim() || null, city: String(c.City ?? "").trim() || null,
          i4u_customer_id: id, archived: c.Active === false, created_by: user.id,
        });
      }
      for (let i = 0; i < toInsert.length; i += 200) {
        const { error } = await admin.from("lalum_fin_customers").insert(toInsert.slice(i, i + 200));
        if (error) {
          await logRun({ kind: "CUSTOMERS", fetched: list.length, inserted, error: error.message.slice(0, 300) });
          return json(500, { code: "db_error" });
        }
        inserted += Math.min(200, toInsert.length - i);
      }
      await logRun({ kind: "CUSTOMERS", fetched: list.length, inserted, updated: linked, skipped });
      return json(200, { ok: true, fetched: list.length, inserted, linked, skipped });
    }

    if (body.action === "documents") {
      const from = String(body.from ?? ""), to = String(body.to ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return json(400, { code: "bad_range" });
      let fetched = 0, inserted = 0, updated = 0, skipped = 0;
      const perType: Record<string, number> = {};
      for (const t of DOC_TYPES) {
        const { d, errors } = await call("GetDocuments", {
          dr: { DocumentType: t, From: wcf(from), To: wcf(to, true), ItemsIncluded: true, PaymentsIncluded: true },
        });
        if (errors.length) {
          await logRun({ kind: "DOCUMENTS", date_from: from, date_to: to, fetched, inserted, updated, skipped, error: redact(`type ${t} ${JSON.stringify(errors)}`, apiKey) });
          return json(502, { code: "invoice4u_rejected", doc_type: t, errors: errors.map((e) => e.Error) });
        }
        const docs = Array.isArray(d.Response) ? (d.Response as Obj[]) : [];
        const rows: Obj[] = [];
        for (const x of docs) {
          const issue = fromWcf(x.IssueDate);
          if (!x.ID || typeof x.DocumentNumber !== "number" || !issue) { skipped++; continue; }
          if (issue < from || issue > to) continue;
          rows.push({
            firm_id: firmId, source: "INVOICE4U", i4u_doc_id: String(x.ID), i4u_doc_type: t, doc_number: x.DocumentNumber, issue_date: issue,
            i4u_client_id: Number(x.ClientID) > 0 ? Number(x.ClientID) : null, subject: x.Subject ? String(x.Subject).slice(0, 300) : null,
            currency: String(x.Currency ?? "ILS"), subtotal: num(x.TotalWithoutTax), vat_amount: num(x.TotalTaxAmount), total: num(x.Total),
            allocation_number: x.AllocationNumber ? String(x.AllocationNumber) : null, status_id: typeof x.StatusID === "number" ? x.StatusID : null,
            paid: typeof x.Paid === "number" ? x.Paid : null, balance: typeof x.Balance === "number" ? x.Balance : null,
            raw: x, imported_by: user.id, refreshed_at: new Date().toISOString(),
          });
        }
        fetched += rows.length;
        perType[String(t)] = rows.length;
        if (!rows.length) continue;
        const ids = rows.map((r) => r.i4u_doc_id as string);
        const { data: had } = await admin.from("lalum_fin_archive").select("i4u_doc_id").eq("firm_id", firmId).in("i4u_doc_id", ids);
        const hadSet = new Set((had ?? []).map((r) => r.i4u_doc_id as string));
        const { error } = await admin.from("lalum_fin_archive").upsert(rows, { onConflict: "firm_id,source,i4u_doc_id" });
        if (error) {
          await logRun({ kind: "DOCUMENTS", date_from: from, date_to: to, fetched, inserted, updated, skipped, error: error.message.slice(0, 300) });
          // ARCHIVE_IMMUTABLE here means Invoice4U now reports different amounts for a number we already hold.
          return json(500, { code: error.message.includes("ARCHIVE_IMMUTABLE") ? "archive_conflict" : "db_error", doc_type: t });
        }
        updated += rows.filter((r) => hadSet.has(r.i4u_doc_id as string)).length;
        inserted += rows.filter((r) => !hadSet.has(r.i4u_doc_id as string)).length;
      }
      await logRun({ kind: "DOCUMENTS", date_from: from, date_to: to, fetched, inserted, updated, skipped });
      return json(200, { ok: true, fetched, inserted, updated, skipped, per_type: perType });
    }

    return json(400, { code: "bad_action" });
  } catch (e) {
    console.log("FIN_IMPORT_ERR " + redact(String(e), apiKey));
    await logRun({ kind: body.action === "customers" ? "CUSTOMERS" : "DOCUMENTS", error: redact(String(e), apiKey).slice(0, 300) });
    return json(502, { code: "fetch_failed" });
  }
});
