// Pure request handling for lalum-fin-expense-doc, every outside effect behind a port so
// scripts/fin-expense-doc-check.mjs can test the shipped code with fakes.
//
// Two actions on one expense that already exists: "upload" attaches its source document (level 3, the
// level that can write an expense, migration 0024); "url" signs a 60 second link to one already
// attached (level 1, the level that can read an expense). Both derive the firm from the expense row
// itself, read with the caller's own JWT, so row level security decides who may even name an expense id
// before anything touches the bucket with the service role. The object path is deterministic
// (firm/expense/source.ext), so a later attachment overwrites the one before it on purpose: there is no
// history of earlier attachments, same as the expense row itself.
export const SIGNED_SECONDS = 60;
export const MAX_BYTES = 15 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXT: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "application/pdf": (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  "image/jpeg": (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8,
  "image/png": (b) => b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) => b.length > 11 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  "image/gif": (b) => b.length > 5 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
};

/** Deterministic object path for one expense's source document. null for a mime type outside the allowed set. */
export function expenseDocPath(firmId: string, expenseId: string, mime: string): string | null {
  const ext = EXT[mime];
  return ext ? `${firmId}/${expenseId}/source.${ext}` : null;
}

/** Strict base64 decode: anything malformed, or larger than could ever fit under MAX_BYTES, is rejected up front. */
export function decodeBase64(s: string): Uint8Array | null {
  if (typeof s !== "string" || s.length === 0 || s.length > MAX_BYTES * 2) return null;
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type Access = { ok: true; firmId: string } | { ok: false };
export interface Ports {
  allowedOrigins: string[];
  /** The expense's firm, as the caller's own JWT sees it, and whether the caller's finance level on that firm
   *  is at least minLevel. "ok:false" covers both "no such expense" and "not enough level" on purpose: a
   *  refusal reveals nothing about which. */
  access(authorization: string, expenseId: string, minLevel: number): Promise<Access>;
  /** Uploads with the service role, upsert true: a later attachment replaces the one before it. */
  upload(path: string, bytes: Uint8Array, mime: string): Promise<{ ok: boolean }>;
  /** Size of the object actually in the bucket, read back after the upload. null when it is not there: an
   *  upload call that returned no error proved nothing by itself (the same discipline as the archive backup). */
  stored(path: string): Promise<number | null>;
  /** Records the attachment on the expense row, as the caller's own JWT, so row level security is re-checked on write. */
  recordAttachment(authorization: string, expenseId: string, path: string, mime: string, size: number, sha256: string): Promise<boolean>;
  /** The path and mime already on the expense row, as the caller's own JWT. null means nothing is attached. */
  attached(authorization: string, expenseId: string): Promise<{ path: string; mime: string | null } | null>;
  /** Signs a short link with the service role for exactly this path. null on failure. */
  sign(path: string, downloadName: string, seconds: number): Promise<string | null>;
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

  const b = (req.body ?? {}) as { action?: unknown; expense_id?: unknown; file_base64?: unknown; media_type?: unknown };
  const expenseId = b.expense_id;
  if (typeof expenseId !== "string" || !UUID.test(expenseId)) return out(400, { ok: false, code: "bad_request" });

  if (b.action === "url") {
    let acc: Access;
    try { acc = await p.access(req.authorization, expenseId, 1); } catch { return out(500, { ok: false }); }
    if (!acc.ok) return out(403, { ok: false, code: "forbidden" });
    let att: { path: string; mime: string | null } | null;
    try { att = await p.attached(req.authorization, expenseId); } catch { return out(500, { ok: false }); }
    if (!att) return out(404, { ok: false, code: "no_document" });
    const ext = (att.mime && EXT[att.mime]) || "bin";
    const url = await p.sign(att.path, `expense-${expenseId.replace(/-/g, "").slice(0, 8)}.${ext}`, SIGNED_SECONDS).catch(() => null);
    if (!url) return out(500, { ok: false });
    return out(200, { ok: true, url, expires_in: SIGNED_SECONDS });
  }

  if (b.action === "upload") {
    const mime = b.media_type;
    if (typeof mime !== "string" || !(mime in EXT)) return out(400, { ok: false, code: "bad_type" });
    const bytes = typeof b.file_base64 === "string" ? decodeBase64(b.file_base64) : null;
    if (!bytes || bytes.length === 0) return out(400, { ok: false, code: "bad_request" });
    if (bytes.length > MAX_BYTES) return out(413, { ok: false, code: "too_large" });
    if (!MAGIC[mime](bytes)) return out(400, { ok: false, code: "bad_file" });

    let acc: Access;
    try { acc = await p.access(req.authorization, expenseId, 3); } catch { return out(500, { ok: false }); }
    if (!acc.ok) return out(403, { ok: false, code: "forbidden" });

    const path = expenseDocPath(acc.firmId, expenseId, mime);
    if (!path) return out(400, { ok: false, code: "bad_type" });
    const up = await p.upload(path, bytes, mime).catch(() => ({ ok: false }));
    if (!up.ok) return out(500, { ok: false, code: "upload_failed" });
    const size = await p.stored(path).catch(() => null);
    if (size !== bytes.length) return out(500, { ok: false, code: "not_stored" });
    const sha256 = await sha256Hex(bytes);
    const saved = await p.recordAttachment(req.authorization, expenseId, path, mime, size, sha256).catch(() => false);
    if (!saved) return out(500, { ok: false, code: "record_failed" });
    return out(200, { ok: true, sha256, size });
  }

  return out(400, { ok: false, code: "bad_action" });
}
