// lalum-export-originals: Supabase Edge Function (Deno). Gives a partner of a firm (or the platform admin) 15 minute links to one page of the stored
// originals of that firm, for the firm handover package, after the database has checked the right to it and written ONE audit
// entry for the page (migration 0068). A deploy needs the owner's explicit approval. verify_jwt stays on: the caller is a signed in user
// and the same JWT is passed on to the database. Secrets: none beyond the project's own (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY). ALLOWED_ORIGINS (comma separated, optional) lists the origins that may call it from a browser (default: the production site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle, type Listed, type Ports } from "./handler.ts";

const DEFAULT_ORIGINS = "https://lalumapp.com,https://www.lalumapp.com";
const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };

const ports = (): Ports => ({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean),
  async list(authorization, firm, after, limit): Promise<Listed> {
    const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const { data, error } = await asUser.rpc("lalum_firm_export_originals_page", { p_firm: firm, p_after: after, p_limit: limit });
    const d = data as { originals?: unknown; next_after?: unknown; total?: unknown } | null;
    const items = d?.originals;
    if (error || !Array.isArray(items)) return { ok: false };
    return {
      ok: true,
      nextAfter: typeof d?.next_after === "string" ? d.next_after : null,
      total: typeof d?.total === "number" ? d.total : null,
      items: items.map((x: Record<string, unknown>) => ({
        document: String(x.document), matter: String(x.matter), path: String(x.path),
        sha256: typeof x.sha256 === "string" ? x.sha256 : null, size: typeof x.size === "number" ? x.size : null,
        mime: typeof x.mime === "string" ? x.mime : null, file_name: typeof x.file_name === "string" ? x.file_name : null,
      })),
    };
  },
  async signMany(paths, seconds) {
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const { data, error } = await admin.storage.from("matter-originals").createSignedUrls(paths, seconds);
    if (error || !data) return null;
    const map: Record<string, string> = {};
    for (const row of data) if (row.path && row.signedUrl && !row.error) map[row.path] = row.signedUrl;
    return map;
  },
});

Deno.serve(async (req) => {
  let body: unknown = null;
  try { body = req.method === "POST" ? await req.json() : null; } catch { body = null; }
  const res = await handle({ method: req.method, authorization: req.headers.get("authorization"), origin: req.headers.get("origin"), body }, ports());
  return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
