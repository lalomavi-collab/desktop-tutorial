// lalum-fin-archive-pdf: Supabase Edge Function (Deno). Returns the provider's print link for one history archive document, read only.
// A deploy needs the owner's explicit approval. verify_jwt stays on. Secrets: INVOICE4U_API_KEY (already used by lalum-fin-import) and the
// project's own SUPABASE_URL and SUPABASE_ANON_KEY. FIN_IMPORT_ENV ("prod" default, or "qa") picks the provider host, as in lalum-fin-import.
// ALLOWED_ORIGINS (comma separated, optional) lists the origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, type Allowed, type Attempt, type Fetched, type LinkField, type Ports } from "./handler.ts";

const DEFAULT_ORIGINS = "https://lalumapp.com,https://www.lalumapp.com";
const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };
type Obj = Record<string, unknown>;
const LINKISH = /pdf|link|url|print|file|download|doc/i;
const hostOf = (v: string): string | null => { try { return new URL(v).hostname; } catch { return null; } };
/** Names of string fields that look like a link, up to two levels down, with length and host. Values are never kept. */
function linkFields(o: unknown, prefix = "", depth = 0): LinkField[] {
  if (!o || typeof o !== "object" || depth > 2) return [];
  const out: LinkField[] = [];
  for (const [k, v] of Object.entries(o as Obj)) {
    if (typeof v === "string" && v && LINKISH.test(k)) out.push({ key: prefix + k, length: v.length, host: hostOf(v) });
    else if (v && typeof v === "object") out.push(...linkFields(Array.isArray(v) ? v[0] : v, `${prefix}${k}.`, depth + 1));
  }
  return out;
}

const ports = (): Ports => ({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean),
  async allow(authorization, archiveId): Promise<Allowed> {
    const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const { data: row } = await asUser.from("lalum_fin_archive").select("firm_id, i4u_doc_id, i4u_doc_type, doc_number").eq("id", archiveId).maybeSingle();
    if (!row) return { ok: false };
    const { data: level } = await asUser.rpc("lalum_fin_level", { p_firm: row.firm_id });
    if (typeof level !== "number" || level < 1) return { ok: false };
    return { ok: true, row: { i4uDocId: String(row.i4u_doc_id), docType: Number(row.i4u_doc_type), docNumber: Number(row.doc_number) } };
  },
  async fetchLinks(row): Promise<Fetched> {
    const apiKey = env("INVOICE4U_API_KEY").trim();
    const prod = !(Deno.env.get("FIN_IMPORT_ENV") ?? "prod").toLowerCase().startsWith("qa");
    const base = prod ? "https://api.invoice4u.co.il/Services/ApiService.svc" : "https://apiqa.invoice4u.co.il/Services/ApiService.svc";
    const redact = (s: string) => s.split(apiKey).join("[REDACTED]").slice(0, 200);
    const id = Number(row.i4uDocId);
    // Candidate retrieval operations, tried in order until a link comes back. The names follow the provider's other operations.
    const candidates: Array<[string, Obj]> = [
      ["GetDocument", { doc: { ID: id } }],
      ["GetDocumentByID", { docId: id }],
      ["GetDocumentById", { documentId: id }],
      ["GetDocumentByNumber", { docNumber: row.docNumber, docType: row.docType }],
      ["GetDocumentsByIds", { ids: [id] }],
    ];
    const tried: Attempt[] = [];
    let original: string | null = null, certified: string | null = null;
    for (const [op, payload] of candidates) {
      try {
        const res = await fetch(`${base}/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, token: apiKey }) });
        const text = await res.text();
        let parsed: Obj | null = null;
        try { parsed = JSON.parse(text); } catch { /* not json */ }
        const d = (parsed ? ((parsed.d ?? parsed[`${op}Result`] ?? parsed) as Obj | null) : null) ?? {};
        const r = (Array.isArray(d.Response) ? (d.Response as Obj[])[0] : d.Response) as Obj | undefined;
        const errors = Array.isArray(d.Errors) ? (d.Errors as Array<{ Error?: string }>).map((e) => redact(String(e.Error ?? ""))) : [];
        const o = r && typeof r.PrintOriginalPDFLink === "string" && r.PrintOriginalPDFLink ? r.PrintOriginalPDFLink : null;
        const c = r && typeof r.PrintCertifiedCopyPDFLink === "string" && r.PrintCertifiedCopyPDFLink ? r.PrintCertifiedCopyPDFLink : null;
        const shape = r === undefined ? (parsed ? "no Response in answer" : "answer is not JSON") : Array.isArray(d.Response) ? "Response is a list" : typeof r;
        tried.push({ op, http: res.status, errors, filled: !!(o || c), keys: r && typeof r === "object" ? Object.keys(r) : Object.keys(d), linkFields: linkFields(r ?? d), shape });
        if (o || c) { original = o; certified = c; break; }
      } catch (e) { tried.push({ op, http: null, errors: [redact(String(e))], filled: false }); }
    }
    return { original, certified, tried };
  },
});

Deno.serve(async (req) => {
  let body: unknown = null;
  try { body = req.method === "POST" ? await req.json() : null; } catch { body = null; }
  const res = await handle({ method: req.method, authorization: req.headers.get("authorization"), origin: req.headers.get("origin"), body }, ports());
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
