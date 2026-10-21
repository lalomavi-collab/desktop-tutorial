// lalum-fin-archive-pdf: Supabase Edge Function (Deno). Returns the provider's print link for one history archive document, read only.
// A deploy needs the owner's explicit approval. verify_jwt stays on. Secrets: INVOICE4U_API_KEY (already used by lalum-fin-import) and the
// project's own SUPABASE_URL and SUPABASE_ANON_KEY. FIN_IMPORT_ENV ("prod" default, or "qa") picks the provider host, as in lalum-fin-import.
// ALLOWED_ORIGINS (comma separated, optional) lists the origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, requestBodies, tokenCandidates, type Allowed, type Attempt, type Fetched, type LinkField, type Ports } from "./handler.ts";

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
    const secrets = [apiKey];
    const redact = (s: string) => secrets.reduce((acc, x) => acc.split(x).join("[REDACTED]"), s).slice(0, 200);
    const tried: Attempt[] = [];
    let original: string | null = null, certified: string | null = null;
    const parseAnswer = (op: string, text: string) => {
      let parsed: Obj | null = null;
      try { parsed = JSON.parse(text); } catch { /* not json */ }
      // WCF sometimes wraps the payload in {"d": "<json string>"}; open it before looking for Response.
      let inner: unknown = parsed ? (parsed.d ?? parsed[`${op}Result`] ?? parsed) : null;
      if (typeof inner === "string") { try { inner = JSON.parse(inner); } catch { /* keep as is */ } }
      return { parsed, inner };
    };
    // Run one list of [operation, JSON body]; stops at the first answer that carries a print link. label tells which token was used, in the diagnostics only.
    async function run(bodies: Array<[string, string]>, label: string): Promise<void> {
      for (const [op, reqBody] of bodies) {
        if (original || certified) return;
        try {
          const res = await fetch(`${base}/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: reqBody });
          const { parsed, inner } = parseAnswer(op, await res.text());
          const d = (inner && typeof inner === "object" ? inner as Obj : null) ?? {};
          const r = (Array.isArray(d.Response) ? (d.Response as Obj[])[0] : d.Response) as Obj | undefined;
          const errors = Array.isArray(d.Errors) ? (d.Errors as Array<{ Error?: string }>).map((e) => redact(String(e.Error ?? ""))) : [];
          const o = r && typeof r.PrintOriginalPDFLink === "string" && r.PrintOriginalPDFLink ? r.PrintOriginalPDFLink : null;
          const c = r && typeof r.PrintCertifiedCopyPDFLink === "string" && r.PrintCertifiedCopyPDFLink ? r.PrintCertifiedCopyPDFLink : null;
          const envelope = parsed && "d" in parsed ? (parsed.d === null ? "d is null" : `d is ${typeof parsed.d}`) : "no d";
          const shape = r === undefined ? (parsed ? `no Response in answer (${envelope})` : "answer is not JSON") : Array.isArray(d.Response) ? "Response is a list" : typeof r;
          tried.push({ op: `${op}${label}`, http: res.status, errors, filled: !!(o || c), keys: r && typeof r === "object" ? Object.keys(r) : Object.keys(d), linkFields: linkFields(r ?? d), shape });
          if (o || c) { original = o; certified = c; }
        } catch (e) { tried.push({ op: `${op}${label}`, http: null, errors: [redact(String(e))], filled: false }); }
      }
    }
    // Candidate retrieval operations, tried in order until a link comes back. The request bodies are built in handler.ts (requestBodies), where a check pins them.
    const bodies = requestBodies(row, apiKey);
    if (!bodies) return { original: null, certified: null, tried: [{ op: "(none)", http: null, errors: ["the archive row has no usable document ID or number; nothing was sent"], filled: false }] };
    await run(bodies, "");
    // GetDocument and GetDocumentByNumber answered {"d":null} for every document with the API key as token, while GetDocuments accepts it. The WSDL also has
    // VerifyLoginApiKey(apiKey), so a session token is tried next. Its answer is read by name only, and the token is used in memory and never returned.
    if (!original && !certified) {
      try {
        const res = await fetch(`${base}/VerifyLoginApiKey`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) });
        const { parsed, inner } = parseAnswer("VerifyLoginApiKey", await res.text());
        const d = (inner && typeof inner === "object" ? inner as Obj : null) ?? {};
        const r = (Array.isArray(d.Response) ? (d.Response as Obj[])[0] : d.Response) as unknown;
        const rObj = r !== null && typeof r === "object" ? r as Obj : null;
        const toks = tokenCandidates(d, apiKey);
        for (const x of toks) secrets.push(x);
        tried.push({ op: "VerifyLoginApiKey", http: res.status, errors: Array.isArray(d.Errors) ? (d.Errors as Array<{ Error?: string }>).map((e) => redact(String(e.Error ?? ""))) : [], filled: false,
          keys: rObj ? Object.keys(rObj) : Object.keys(d), shape: `${rObj ? "Response is an object" : typeof r} (${parsed && "d" in parsed ? (parsed.d === null ? "d is null" : `d is ${typeof parsed.d}`) : "no d"}); ${toks.length} token candidate(s)` });
        for (const [i, x] of toks.entries()) {
          const withSession = requestBodies(row, x);
          if (withSession) await run(withSession, ` (session ${i + 1})`);
        }
      } catch (e) { tried.push({ op: "VerifyLoginApiKey", http: null, errors: [redact(String(e))], filled: false }); }
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
