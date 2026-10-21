// Pure request handling for lalum-export-originals, with every outside effect behind a port so scripts/export-originals-check.mjs can
// test the shipped code with fakes. It signs one PAGE of the stored originals of ONE firm, for the firm handover package; the client asks
// for the next page with the cursor it was given (version 2, migration 0068: keyset paging by document id, no ceiling on the firm's total).
// The order is the point: the database decides first (lalum_firm_export_originals_page: platform admin with a second factor, or a partner
// of that firm behind MFA with financial permission) and writes ONE audit row for the page BEFORE anything is signed.
// Only paths the database returned are ever signed, so a caller cannot ask for a path of its own choosing. A refusal reveals nothing about why.
export const SIGNED_SECONDS = 900;
export const DEFAULT_PAGE = 100;
export const MAX_PAGE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Original { document: string; matter: string; path: string; sha256: string | null; size: number | null; mime: string | null; file_name: string | null }
export type Listed = { ok: true; items: Original[]; nextAfter: string | null; total: number | null } | { ok: false };
export interface Ports {
  allowedOrigins: string[];
  /** Calls lalum_firm_export_originals_page as the signed in user (their JWT), so the checks apply to them and the audit row names them. */
  list(authorization: string, firm: string, after: string | null, limit: number): Promise<Listed>;
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
  const b = req.body as { firm_id?: unknown; after?: unknown; limit?: unknown } | null;
  const firm = b?.firm_id;
  if (typeof firm !== "string" || !UUID.test(firm)) return out(400, { ok: false });
  const after = b?.after ?? null;
  if (after !== null && (typeof after !== "string" || !UUID.test(after))) return out(400, { ok: false });
  const lim = b?.limit ?? DEFAULT_PAGE;
  if (typeof lim !== "number" || !Number.isInteger(lim) || lim < 1) return out(400, { ok: false });
  const limit = Math.min(lim, MAX_PAGE);

  let listed: Listed;
  try { listed = await p.list(req.authorization, firm, after, limit); } catch { return out(500, { ok: false }); }
  if (!listed.ok) return out(403, { ok: false });
  // the database never returns more than it was asked for; a reply that does is not signed
  if (listed.items.length > limit) return out(500, { ok: false });
  if (listed.items.length === 0) return out(200, { ok: true, items: [], next_after: listed.nextAfter, total: listed.total, expires_in: SIGNED_SECONDS });

  const urls = await p.signMany(listed.items.map((i) => i.path), SIGNED_SECONDS).catch(() => null);
  if (!urls) return out(500, { ok: false });
  // The storage path stays on the server: the package needs the document, its recorded hash and size, and a link.
  const items = listed.items.map((i) => ({ document: i.document, matter: i.matter, sha256: i.sha256, size: i.size, mime: i.mime, file_name: i.file_name, url: urls[i.path] ?? null }));
  return out(200, { ok: true, items, next_after: listed.nextAfter, total: listed.total, expires_in: SIGNED_SECONDS });
}
