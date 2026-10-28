// lalum-fin-expense-doc: Supabase Edge Function (Deno). Attaches a source document (invoice, receipt or credit note) to one
// expense that already exists, and signs a 60 second link to one already attached, in the private bucket finance-expense-docs
// (migration 20261027100000). A deploy needs the owner's explicit approval. verify_jwt stays on: the caller is a signed in user and
// the same JWT decides what they may see or write, before anything runs with the service role.
// Secrets: none beyond the project's own (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
// ALLOWED_ORIGINS (comma separated, optional) lists the origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, type Access, type Attached, type Ports } from "./handler.ts";

const DEFAULT_ORIGINS = "https://lalumapp.com,https://www.lalumapp.com";
const BUCKET = "finance-expense-docs";
const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };
const asUser = (authorization: string) => createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// The database's refusals (lalum_fin_expense_doc_attach) as the codes the app knows.
const REFUSAL: Array<[string, string]> = [["FORBIDDEN", "forbidden"], ["BAD_SUPERSEDES", "bad_supersedes"], ["ALREADY_SUPERSEDED", "already_superseded"], ["OBJECT_MISSING", "not_stored"]];

const ports = (): Ports => ({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean),
  async access(authorization, expenseId, minLevel): Promise<Access> {
    const u = asUser(authorization);
    const { data: row } = await u.from("lalum_fin_expenses").select("firm_id").eq("id", expenseId).maybeSingle();
    const firm = row?.firm_id;
    if (!firm) return { ok: false };
    const { data: allowed } = await u.rpc("lalum_fin_can", { p_firm: firm, p_min: minLevel });
    return allowed === true ? { ok: true, firmId: String(firm) } : { ok: false };
  },
  async upload(path, bytes, mime) {
    const { error } = await admin().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    return { ok: !error };
  },
  async stored(path) {
    const i = path.lastIndexOf("/");
    const { data } = await admin().storage.from(BUCKET).list(path.slice(0, i), { search: path.slice(i + 1), limit: 1 });
    const f = data?.find((x) => x.name === path.slice(i + 1));
    const size = (f?.metadata as { size?: number } | null | undefined)?.size;
    return typeof size === "number" ? size : null;
  },
  async attach(authorization, a): Promise<Attached> {
    const { data, error } = await asUser(authorization).rpc("lalum_fin_expense_doc_attach", {
      p_expense: a.expenseId, p_path: a.path, p_sha256: a.sha256, p_mime: a.mime, p_size: a.size, p_supersedes: a.supersedes,
    });
    if (error) {
      const hit = REFUSAL.find(([k]) => String(error.message ?? "").includes(k));
      return { ok: false, code: hit ? hit[1] : "record_failed" };
    }
    const r = (data ?? {}) as { id?: string; duplicate?: boolean; same_file_elsewhere?: number };
    return r.id ? { ok: true, id: r.id, duplicate: r.duplicate === true, sameFileElsewhere: Number(r.same_file_elsewhere ?? 0) } : { ok: false, code: "record_failed" };
  },
  async open(authorization, docId) {
    const { data, error } = await asUser(authorization).rpc("lalum_fin_expense_doc_open", { p_doc: docId });
    if (error) {
      if (String(error.message ?? "").includes("FORBIDDEN")) return null;
      throw new Error("open failed");
    }
    const r = (data ?? {}) as { path?: string; mime?: string };
    return r.path ? { path: r.path, mime: r.mime ?? "" } : null;
  },
  async sign(path, downloadName, seconds) {
    const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, seconds, { download: downloadName });
    return error ? null : data?.signedUrl ?? null;
  },
});

Deno.serve(async (req) => {
  let body: unknown = null;
  try { body = req.method === "POST" ? await req.json() : null; } catch { body = null; }
  const res = await handle({ method: req.method, authorization: req.headers.get("authorization"), origin: req.headers.get("origin"), body }, ports());
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
