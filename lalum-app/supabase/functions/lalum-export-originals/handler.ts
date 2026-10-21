// Pure request handling for lalum-export-originals, with every outside effect behind a port so scripts/export-originals-check.mjs can
// test the shipped code with fakes. It signs every stored original of ONE firm in one batch, for the firm handover package.
// The order is the point: the database decides first (lalum_firm_export_originals, migration 0066: platform admin with a second factor,
// or a partner of that firm behind MFA with financial permission) and writes ONE audit row for the whole batch BEFORE anything is signed.
// Only paths the database returned are ever signed, so a caller cannot ask for a path of its own choosing. A refusal reveals nothing about why.
export const SIGNED_SECONDS = 900;
export const MAX_ORIGINALS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Original { document: string; matter: string; path: string; sha256: string | null; size: number | null; mime: string | null; file_name: string | null }
export type Listed = { ok: true; items: Original[] } | { ok: false };
export interface Ports {
  allowedOrigins: string[];
  /** Calls lalum_firm_export_originals as the signed in user (their JWT), so the checks apply to them and the audit row names them. */
  list(authorization: string, firm: string): Promise<Listed>;
  /** Signs the given paths with the service role. Returns a map path to url; a path that could not be signed is absent. null when the whole call failed. */
  signMany(paths: string[], seconds: number): Promise<Record<string, string> | null>;
}
export interface Req { method: string; authorization: string | null; origin: string | null; body: unknown }
export interface Res { status: number; body: Record<string, unknown>; headers: Record<string, string> }

export async function handle(req: Req, p: Ports): Promise<Res> {
  const origin = req.origin && p.allowedOrigins.includes(req.origin) ? req.origin : null;
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "origin" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "authorization, content-type, apikey"; headers["access-control-allow-methods"] = "POST, OPTIONS"; }
  const out = (status: number, body: Record<string, unknown>): Res => ({ status, body, headers });

  if (req.method === "OPTIONS") return out(204, {});
  if (req.method !== "POST") return out(405, { ok: false });
  if (!req.authorization || !/^Bearer\s+\S+/.test(req.authorization)) return out(401, { ok: false });
  const firm = (req.body as { firm_id?: unknown } | null)?.firm_id;
  if (typeof firm !== "string" || !UUID.test(firm)) return out(400, { ok: false });

  let listed: Listed;
  try { listed = await p.list(req.authorization, firm); } catch { return out(500, { ok: false }); }
  if (!listed.ok) return out(403, { ok: false });
  if (listed.items.length > MAX_ORIGINALS) return out(413, { ok: false, code: "TOO_MANY", count: listed.items.length });
  if (listed.items.length === 0) return out(200, { ok: true, items: [], expires_in: SIGNED_SECONDS });

  const urls = await p.signMany(listed.items.map((i) => i.path), SIGNED_SECONDS).catch(() => null);
  if (!urls) return out(500, { ok: false });
  // The storage path stays on the server: the package needs the document, its recorded hash and size, and a link.
  const items = listed.items.map((i) => ({ document: i.document, matter: i.matter, sha256: i.sha256, size: i.size, mime: i.mime, file_name: i.file_name, url: urls[i.path] ?? null }));
  return out(200, { ok: true, items, expires_in: SIGNED_SECONDS });
}
