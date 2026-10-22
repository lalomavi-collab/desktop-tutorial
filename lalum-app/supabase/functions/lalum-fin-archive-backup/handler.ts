// Pure request handling for lalum-fin-archive-backup, every outside effect behind a port so scripts/fin-archive-backup-check.mjs can test the shipped code.
// Copies archive PDFs from the provider (link built from the stored CipherText) into the private bucket finance-archive-backup, in small batches.
// The database decides first (caller's own JWT, finance level 3 or more). Existing objects are skipped, so a run can be repeated safely.
// The answer lists document numbers and outcomes only, never a cipher or a link.
const LINK_HOST = /(^|\.)invoice4u\.co\.il$/i;
const PDF_VIEW = "https://newview.invoice4u.co.il/Views/PDF.aspx?cipher=";
export const MAX_BATCH = 25;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Same rule as pdfLinkFromCipher in lalum-fin-archive-pdf/handler.ts (functions deploy flat, so it is repeated here; the check pins both). */
export function pdfLinkFromCipher(cipher: unknown): string | null {
  if (typeof cipher !== "string" || cipher.length < 8 || cipher.length > 2000) return null;
  if (!/^([A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/.test(cipher)) return null;
  try { const u = new URL(PDF_VIEW + cipher); return u.protocol === "https:" && LINK_HOST.test(u.hostname) ? u.toString() : null; } catch { return null; }
}
export const isPdf = (b: Uint8Array): boolean => b.length > 8 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
/** ASCII object path; the row id keeps it unique even when a document number repeats across types. */
export const backupPath = (r: Row): string => `${r.firmId}/${r.docType}-${r.docNumber}-${r.id.slice(0, 8)}.pdf`;

export interface Row { id: string; firmId: string; docType: number; docNumber: number; cipher: string | null }
export type Allowed = { ok: true } | { ok: false };
export type Outcome = "saved" | "skipped" | "no_cipher" | "download_failed" | "not_pdf" | "too_large" | "upload_failed";
export interface Ports {
  allowedOrigins: string[];
  /** The caller's level on the firm that owns the archive, as the signed in user. */
  allow(authorization: string): Promise<Allowed>;
  /** A page of archive rows (as the signed in user) and the total count. */
  listRows(authorization: string, offset: number, limit: number): Promise<{ rows: Row[]; total: number }>;
  exists(path: string): Promise<boolean>;
  download(url: string): Promise<{ status: number; bytes: Uint8Array | null }>;
  upload(path: string, bytes: Uint8Array): Promise<boolean>;
}
export interface Req { method: string; authorization: string | null; origin: string | null; body: unknown }
export interface Res { status: number; body: Record<string, unknown>; headers: Record<string, string> }

export async function backupOne(r: Row, p: Ports): Promise<Outcome> {
  const url = pdfLinkFromCipher(r.cipher);
  if (!url) return "no_cipher";
  const path = backupPath(r);
  if (await p.exists(path)) return "skipped";
  const got = await p.download(url);
  if (got.status !== 200 || !got.bytes) return "download_failed";
  if (got.bytes.length > MAX_PDF_BYTES) return "too_large";
  if (!isPdf(got.bytes)) return "not_pdf";
  return (await p.upload(path, got.bytes)) ? "saved" : "upload_failed";
}

export async function handle(req: Req, p: Ports): Promise<Res> {
  const origin = req.origin && p.allowedOrigins.includes(req.origin) ? req.origin : null;
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "origin" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "authorization, content-type, apikey"; headers["access-control-allow-methods"] = "POST, OPTIONS"; }
  const out = (status: number, body: Record<string, unknown>): Res => ({ status, body, headers });

  if (req.method === "OPTIONS") return out(204, {});
  if (req.method !== "POST") return out(405, { ok: false });
  if (!req.authorization || !/^Bearer\s+\S+/.test(req.authorization)) return out(401, { ok: false });
  const b = (req.body ?? {}) as { offset?: unknown; limit?: unknown };
  const offset = b.offset === undefined ? 0 : b.offset, limit = b.limit === undefined ? 10 : b.limit;
  if (!Number.isInteger(offset) || (offset as number) < 0 || !Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_BATCH) return out(400, { ok: false });

  let allowed: Allowed;
  try { allowed = await p.allow(req.authorization); } catch { return out(500, { ok: false }); }
  if (!allowed.ok) return out(403, { ok: false });

  let page: { rows: Row[]; total: number };
  try { page = await p.listRows(req.authorization, offset as number, limit as number); } catch { return out(500, { ok: false }); }
  const results: Array<{ doc_number: number; doc_type: number; outcome: Outcome }> = [];
  for (const r of page.rows) {
    let outcome: Outcome;
    try { outcome = await backupOne(r, p); } catch { outcome = "download_failed"; }
    results.push({ doc_number: r.docNumber, doc_type: r.docType, outcome });
  }
  const count = (o: Outcome) => results.filter((x) => x.outcome === o).length;
  const next = (offset as number) + page.rows.length;
  return out(200, { ok: true, total: page.total, offset, next: next < page.total ? next : null, saved: count("saved"), skipped: count("skipped"), failed: results.filter((x) => x.outcome !== "saved" && x.outcome !== "skipped").length, results });
}
