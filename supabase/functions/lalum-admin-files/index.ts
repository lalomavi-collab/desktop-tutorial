// lalum-admin-files: firm-only view of every client's uploaded documents.
// Clients upload into their own `${uid}/` folder in the `client-files` bucket
// (guarded by storage RLS). This function runs with the service role so an
// admin can see ALL client folders at once, organised per client, and pull
// signed download links, without widening the storage policies for anyone else.
// Every call is gated: only the firm admin passes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const BUCKET = "client-files";
const ADMIN_EMAIL = "avraham@lalum.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });

  // Identify the caller from their JWT, then confirm they are the firm admin.
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  const admin = createClient(url, serviceKey);
  let isAdmin = (user.email ?? "").toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: prof } = await admin.from("lalum_profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = Boolean(prof?.is_admin);
  }
  if (!isAdmin) return json(403, { code: "forbidden" });

  let body: { action?: string; path?: string };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action ?? "list";

  if (action === "sign") {
    const path = (body.path ?? "").toString();
    if (!path || path.includes("..")) return json(400, { code: "bad_path" });
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return json(404, { code: "not_found" });
    return json(200, { url: data.signedUrl });
  }

  // action "list": enumerate every client folder, its files, and 1-hour signed
  // links so the admin can download or zip them without further round-trips.
  const { data: roots, error: rootErr } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
  if (rootErr) return json(500, { code: "list_failed", detail: rootErr.message });

  const folders = (roots ?? []).filter((e) => e && e.id === null && e.name);
  const clients = [];
  for (const f of folders) {
    const folder = f.name;
    const { data: entries } = await admin.storage.from(BUCKET).list(folder, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    const fileEntries = (entries ?? []).filter((e) => e && e.id !== null);
    if (fileEntries.length === 0) continue;
    const paths = fileEntries.map((e) => `${folder}/${e.name}`);
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

    let email = "";
    let name = "";
    try {
      const { data: u } = await admin.auth.admin.getUserById(folder);
      email = u?.user?.email ?? "";
    } catch { /* folder may not map to a user */ }
    if (email) {
      const { data: prof } = await admin.from("lalum_profiles").select("full_name").eq("id", folder).maybeSingle();
      name = (prof?.full_name as string) ?? "";
    }

    clients.push({
      client_id: folder,
      email,
      name,
      file_count: fileEntries.length,
      files: fileEntries.map((e) => ({
        name: String(e.name).replace(/^\d+-/, ""),
        raw_name: e.name,
        path: `${folder}/${e.name}`,
        size: (e.metadata?.size as number) ?? 0,
        created_at: e.created_at ?? null,
        url: urlByPath.get(`${folder}/${e.name}`) ?? "",
      })),
    });
  }

  clients.sort((a, b) => (b.file_count - a.file_count));
  return json(200, { clients });
});
