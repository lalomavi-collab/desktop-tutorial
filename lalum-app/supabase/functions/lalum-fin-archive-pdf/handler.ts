// Pure request handling for lalum-fin-archive-pdf, with every outside effect behind a port so scripts/fin-archive-pdf-check.mjs can test the
// shipped code with fakes. It returns the provider's print link for ONE document of the history archive, so a partner can download the PDF.
// The list call of the provider leaves the link fields empty, so the link is fetched per document, read only: nothing here creates, changes
// or cancels anything at the provider. The database decides first (the caller's own JWT: the row must be readable and the finance level at
// least 1); only then is the provider asked. A link is returned only when it is https and on the provider's own domain.
// The answer on failure names the provider operations tried and their status, never a secret, so the first real use also tells us which one works.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LINK_HOST = /(^|\.)invoice4u\.co\.il$/i;

export interface ArchiveRow { i4uDocId: string; docType: number; docNumber: number }
export type Allowed = { ok: true; row: ArchiveRow } | { ok: false };
/** What a provider answer looked like, by NAME only: the keys of the answer object and every string field whose name looks like a link, with its length and host. Never a value. */
export interface LinkField { key: string; length: number; host: string | null }
export interface Attempt { op: string; http: number | null; errors: string[]; filled: boolean; keys?: string[]; linkFields?: LinkField[]; shape?: string }
export interface Fetched { original: string | null; certified: string | null; tried: Attempt[] }
export interface Ports {
  allowedOrigins: string[];
  /** Reads the archive row and the finance level as the signed in user (their JWT). */
  allow(authorization: string, archiveId: string): Promise<Allowed>;
  /** Asks the provider, read only, for the print links of one document. */
  fetchLinks(row: ArchiveRow): Promise<Fetched>;
}
export interface Req { method: string; authorization: string | null; origin: string | null; body: unknown }
export interface Res { status: number; body: Record<string, unknown>; headers: Record<string, string> }

/** A link is usable only when it is https on the provider's domain. */
export function safeLink(v: string | null): string | null {
  if (!v) return null;
  try { const u = new URL(v); return u.protocol === "https:" && LINK_HOST.test(u.hostname) ? u.toString() : null; } catch { return null; }
}

export async function handle(req: Req, p: Ports): Promise<Res> {
  const origin = req.origin && p.allowedOrigins.includes(req.origin) ? req.origin : null;
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "origin" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "authorization, content-type, apikey"; headers["access-control-allow-methods"] = "POST, OPTIONS"; }
  const out = (status: number, body: Record<string, unknown>): Res => ({ status, body, headers });

  if (req.method === "OPTIONS") return out(204, {});
  if (req.method !== "POST") return out(405, { ok: false });
  if (!req.authorization || !/^Bearer\s+\S+/.test(req.authorization)) return out(401, { ok: false });
  const id = (req.body as { archive_id?: unknown } | null)?.archive_id;
  if (typeof id !== "string" || !UUID.test(id)) return out(400, { ok: false });

  let allowed: Allowed;
  try { allowed = await p.allow(req.authorization, id); } catch { return out(500, { ok: false }); }
  if (!allowed.ok) return out(403, { ok: false });

  let got: Fetched;
  try { got = await p.fetchLinks(allowed.row); } catch { return out(502, { ok: false, code: "provider_unreachable" }); }
  const url = safeLink(got.original) ?? safeLink(got.certified);
  if (url) return out(200, { ok: true, url });
  return out(200, { ok: false, code: "no_link", tried: got.tried.map((t) => ({ op: t.op, http: t.http, errors: t.errors.slice(0, 3), filled: t.filled, keys: (t.keys ?? []).slice(0, 40), linkFields: (t.linkFields ?? []).slice(0, 12), shape: t.shape ?? null })) });
}
