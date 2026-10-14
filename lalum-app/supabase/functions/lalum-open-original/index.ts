// lalum-open-original: Supabase Edge Function (Deno). Gives a signed in partner or attorney a 60 second link to ONE original in the
// private vault, after the database has checked the right to it and written the audit entry (migration 0047). A deploy
// needs the owner's explicit approval. verify_jwt stays on: the caller is a signed in user and the same JWT is passed on to the database.
// Secrets: none beyond the project's own (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). ALLOWED_ORIGINS (comma separated, optional)
// lists the origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, type Opened, type Ports } from "./handler.ts";

// The same origins lalum-pipeline accepts; ALLOWED_ORIGINS replaces them if set.
const DEFAULT_ORIGINS = "https://lalumapp.com,https://www.lalumapp.com";
const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };

const ports = (): Ports => ({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean),
  async openOriginal(authorization, docId): Promise<Opened> {
    const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const { data, error } = await asUser.rpc("lalum_open_original", { p_doc: docId });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.path) return { ok: false };
    return { ok: true, path: row.path as string, mime: (row.mime as string | null) ?? null, matterCode: String(row.matter_code ?? "") };
  },
  async sign(path, downloadName, seconds) {
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const { data, error } = await admin.storage.from("matter-originals").createSignedUrl(path, seconds, { download: downloadName });
    return error ? null : data?.signedUrl ?? null;
  },
});

Deno.serve(async (req) => {
  let body: unknown = null;
  try { body = req.method === "POST" ? await req.json() : null; } catch { body = null; }
  const res = await handle({ method: req.method, authorization: req.headers.get("authorization"), origin: req.headers.get("origin"), body }, ports());
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
