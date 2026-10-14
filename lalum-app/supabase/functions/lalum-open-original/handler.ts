// Pure request handling for lalum-open-original, with every outside effect behind a port so scripts/open-original-check.mjs can
// test the shipped code with fakes. The order is the point: the database decides (lalum_open_original, migration 0047: role, MFA,
// firm, matter access, live document) and writes the audit entry BEFORE anything is signed. A refusal reveals nothing about why.
export const SIGNED_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
};

export type Opened = { ok: true; path: string; mime: string | null; matterCode: string } | { ok: false };
export interface Ports {
  allowedOrigins: string[];
  /** Calls lalum_open_original as the signed in user (their JWT), so row level security and the checks apply to them. */
  openOriginal(authorization: string, docId: string): Promise<Opened>;
  /** Signs a short link with the service role for exactly this path. null on failure. */
  sign(path: string, downloadName: string, seconds: number): Promise<string | null>;
}
export interface Req { method: string; authorization: string | null; origin: string | null; body: unknown }
export interface Res { status: number; body: Record<string, unknown>; headers: Record<string, string> }

/** The download name carries the matter code and a short document id: never the original file name, which can identify the client. */
export function downloadName(matterCode: string, docId: string, mime: string | null): string {
  const code = matterCode.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "matter";
  const ext = (mime && EXT[mime]) || "bin";
  return `${code}-${docId.replace(/-/g, "").slice(0, 8)}.${ext}`;
}

export async function handle(req: Req, p: Ports): Promise<Res> {
  const origin = req.origin && p.allowedOrigins.includes(req.origin) ? req.origin : null;
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "origin" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "authorization, content-type, apikey"; headers["access-control-allow-methods"] = "POST, OPTIONS"; }
  const out = (status: number, body: Record<string, unknown>): Res => ({ status, body, headers });

  if (req.method === "OPTIONS") return out(204, {});
  if (req.method !== "POST") return out(405, { ok: false });
  if (!req.authorization || !/^Bearer\s+\S+/.test(req.authorization)) return out(401, { ok: false });
  const id = (req.body as { document_id?: unknown } | null)?.document_id;
  if (typeof id !== "string" || !UUID.test(id)) return out(400, { ok: false });

  let opened: Opened;
  try { opened = await p.openOriginal(req.authorization, id); } catch { return out(500, { ok: false }); }
  if (!opened.ok) return out(403, { ok: false });
  const url = await p.sign(opened.path, downloadName(opened.matterCode, id, opened.mime), SIGNED_SECONDS).catch(() => null);
  if (!url) return out(500, { ok: false });
  return out(200, { ok: true, url, expires_in: SIGNED_SECONDS });
}
