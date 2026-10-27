// Pure request handling for lalum-fin-expense-doc, every outside effect behind a port so
// scripts/fin-expense-doc-check.mjs can test the shipped code with fakes.
//
// Two actions. "upload" attaches a source document to an expense that already exists (level 3, the level
// that can write an expense, migration 0024); "url" signs a 60 second link to one document (level 1, the
// level that can read an expense, a bookkeeper included). The database decides both, with the caller's own
// JWT: the firm comes from the expense row as row level security lets the caller see it, and the record is
// written by lalum_fin_expense_doc_attach, which checks the level again, checks that the object is really
// in the bucket, and audits. The link is signed only for a path that lalum_fin_expense_doc_open returned,
// which audits the view; a path the caller names is never signed.
//
// Nothing is ever overwritten. The object path is the content's own sha256 (firm/expense/<sha256>.<ext>)
// and the upload runs with upsert off, so the same file twice lands on the same object and a different
// file can never replace an earlier one. A replacement names the document it supersedes; the earlier row
// and its object stay (migration 20261027100000).
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

/** Content addressed object path for one expense's source document. null for a mime type outside the allowed set. */
export function expenseDocPath(firmId: string, expenseId: string, sha256: string, mime: string): string | null {
  const ext = EXT[mime];
  return ext && /^[0-9a-f]{64}$/.test(sha256) ? `${firmId}/${expenseId}/${sha256}.${ext}` : null;
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
export interface Attachment { expenseId: string; path: string; sha256: string; mime: string; size: number; supersedes: string | null }
export type Attached = { ok: true; id: string; duplicate: boolean; sameFileElsewhere: number } | { ok: false; code: string };
export interface Ports {
  allowedOrigins: string[];
  /** The expense's firm, as the caller's own JWT sees it, and whether the caller's finance level on that firm
   *  is at least minLevel. "ok:false" covers both "no such expense" and "not enough level" on purpose: a
   *  refusal reveals nothing about which. */
  access(authorization: string, expenseId: string, minLevel: number): Promise<Access>;
  /** Uploads with the service role, upsert off. ok:false also when the object is already there. */
  upload(path: string, bytes: Uint8Array, mime: string): Promise<{ ok: boolean }>;
  /** Size of the object actually in the bucket. null when it is not there: an upload call that returned no
   *  error proved nothing by itself (the same discipline as the archive backup). */
  stored(path: string): Promise<number | null>;
  /** lalum_fin_expense_doc_attach as the caller's own JWT. code is the database's refusal, mapped. */
  attach(authorization: string, a: Attachment): Promise<Attached>;
  /** lalum_fin_expense_doc_open as the caller's own JWT: the path of a document the caller may read, audited. null when refused. */
  open(authorization: string, docId: string): Promise<{ path: string; mime: string } | null>;
  /** Signs a short link with the service role for exactly this path. null on failure. */
  sign(path: string, downloadName: string, seconds: number): Promise<string | null>;
}
export interface Req { method: string; authorization: string | null; origin: string | null; body: unknown }
export interface Res { status: number; body: Record<string, unknown>; headers: Record<string, string> }

const ATTACH_STATUS: Record<string, number> = { forbidden: 403, bad_supersedes: 409, already_superseded: 409, not_stored: 500, record_failed: 500 };

export async function handle(req: Req, p: Ports): Promise<Res> {
  const origin = req.origin && p.allowedOrigins.includes(req.origin) ? req.origin : null;
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "origin" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "authorization, content-type, apikey"; headers["access-control-allow-methods"] = "POST, OPTIONS"; }
  const out = (status: number, body: Record<string, unknown>): Res => ({ status, body, headers });

  if (req.method === "OPTIONS") return out(204, {});
  if (req.method !== "POST") return out(405, { ok: false });
  if (!req.authorization || !/^Bearer\s+\S+/.test(req.authorization)) return out(401, { ok: false });

  const b = (req.body ?? {}) as { action?: unknown; expense_id?: unknown; doc_id?: unknown; supersedes?: unknown; file_base64?: unknown; media_type?: unknown };

  if (b.action === "url") {
    const docId = b.doc_id;
    if (typeof docId !== "string" || !UUID.test(docId)) return out(400, { ok: false, code: "bad_request" });
    let doc: { path: string; mime: string } | null;
    try { doc = await p.open(req.authorization, docId); } catch { return out(500, { ok: false }); }
    if (!doc) return out(403, { ok: false, code: "forbidden" });
    const ext = EXT[doc.mime] ?? "bin";
    const url = await p.sign(doc.path, `expense-doc-${docId.replace(/-/g, "").slice(0, 8)}.${ext}`, SIGNED_SECONDS).catch(() => null);
    if (!url) return out(500, { ok: false });
    return out(200, { ok: true, url, expires_in: SIGNED_SECONDS });
  }

  if (b.action === "upload") {
    const expenseId = b.expense_id;
    if (typeof expenseId !== "string" || !UUID.test(expenseId)) return out(400, { ok: false, code: "bad_request" });
    const supersedes = b.supersedes ?? null;
    if (supersedes !== null && (typeof supersedes !== "string" || !UUID.test(supersedes))) return out(400, { ok: false, code: "bad_request" });
    const mime = b.media_type;
    if (typeof mime !== "string" || !(mime in EXT)) return out(400, { ok: false, code: "bad_type" });
    const bytes = typeof b.file_base64 === "string" ? decodeBase64(b.file_base64) : null;
    if (!bytes || bytes.length === 0) return out(400, { ok: false, code: "bad_request" });
    if (bytes.length > MAX_BYTES) return out(413, { ok: false, code: "too_large" });
    if (!MAGIC[mime](bytes)) return out(400, { ok: false, code: "bad_file" });

    let acc: Access;
    try { acc = await p.access(req.authorization, expenseId, 3); } catch { return out(500, { ok: false }); }
    if (!acc.ok) return out(403, { ok: false, code: "forbidden" });

    const sha256 = await sha256Hex(bytes);
    const path = expenseDocPath(acc.firmId, expenseId, sha256, mime);
    if (!path) return out(400, { ok: false, code: "bad_type" });
    // upsert is off, so a refusal can mean the very same bytes are already there (a retry, or the same file
    // uploaded twice). The path is the content's hash, so an object of the same size at it is this file.
    const up = await p.upload(path, bytes, mime).catch(() => ({ ok: false }));
    const size = await p.stored(path).catch(() => null);
    if (size !== bytes.length) return out(500, { ok: false, code: up.ok ? "not_stored" : "upload_failed" });

    let rec: Attached;
    try { rec = await p.attach(req.authorization, { expenseId, path, sha256, mime, size, supersedes: supersedes as string | null }); }
    catch { return out(500, { ok: false, code: "record_failed" }); }
    if (!rec.ok) return out(ATTACH_STATUS[rec.code] ?? 500, { ok: false, code: rec.code in ATTACH_STATUS ? rec.code : "record_failed" });
    return out(200, { ok: true, id: rec.id, sha256, size, duplicate: rec.duplicate, same_file_elsewhere: rec.sameFileElsewhere });
  }

  return out(400, { ok: false, code: "bad_action" });
}
