// lalum-fin-archive-backup: Supabase Edge Function (Deno). Copies history archive PDFs into the private bucket finance-archive-backup, in batches.
// A deploy needs the owner's explicit approval. verify_jwt stays on. Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (all injected).
// ALLOWED_ORIGINS (comma separated, optional): origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, type Allowed, type Ports, type Row } from "./handler.ts";

const DEFAULT_ORIGINS = "https://lalumapp.com,https://www.lalumapp.com";
const BUCKET = "finance-archive-backup";
const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };
const asUser = (authorization: string) => createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const ports = (): Ports => ({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean),
  async allow(authorization): Promise<Allowed> {
    const u = asUser(authorization);
    const { data: firms } = await u.from("lalum_fin_archive").select("firm_id").limit(1);
    const firm = firms?.[0]?.firm_id;
    if (!firm) return { ok: false };
    const { data: level } = await u.rpc("lalum_fin_level", { p_firm: firm });
    return typeof level === "number" && level >= 3 ? { ok: true } : { ok: false };
  },
  async listRows(authorization, offset, limit) {
    const { data, count, error } = await asUser(authorization).from("lalum_fin_archive")
      .select("id, firm_id, i4u_doc_type, doc_number, cipher:raw->>CipherText", { count: "exact" }).order("doc_number").order("id").range(offset, offset + limit - 1);
    if (error) throw new Error("list failed");
    const rows: Row[] = (data ?? []).map((r) => ({ id: String(r.id), firmId: String(r.firm_id), docType: Number(r.i4u_doc_type), docNumber: Number(r.doc_number), cipher: typeof r.cipher === "string" ? r.cipher : null }));
    return { rows, total: count ?? rows.length };
  },
  async exists(path) {
    const i = path.lastIndexOf("/");
    const { data } = await admin().storage.from(BUCKET).list(path.slice(0, i), { search: path.slice(i + 1), limit: 1 });
    return !!data?.some((f) => f.name === path.slice(i + 1));
  },
  async download(url) {
    const res = await fetch(url, { redirect: "follow" });
    return { status: res.status, bytes: res.status === 200 ? new Uint8Array(await res.arrayBuffer()) : null };
  },
  async upload(path, bytes) {
    const { error } = await admin().storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
    return !error;
  },
});

Deno.serve(async (req) => {
  let body: unknown = null;
  try { body = req.method === "POST" ? await req.json() : null; } catch { body = null; }
  const res = await handle({ method: req.method, authorization: req.headers.get("authorization"), origin: req.headers.get("origin"), body }, ports());
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
