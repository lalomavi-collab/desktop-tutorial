// Filing one routed message into its matter, through the existing secure path. No Deno APIs: the real ports are wired in index.ts
// and the test wires fakes. The path, in this order, with a retry that never creates a second document:
//   1. the readable text goes through the existing server to server route of lalum-pipeline (/api/v1/intake/webhook, firm intake
//      token): PII shield, conflict check, audit, a masked working copy in the matter. The pipeline refuses a document that is not
//      masked (a database check), so no readable working text can be stored without it;
//   2. the document id is recorded on the intake row at once, so a retry resumes instead of creating another document;
//   3. the raw message source (RFC 822, which carries the attachments) is written once to the private vault as text/plain, a type the
//      bucket already accepts, under firm/matter/document/original.txt, and attached with its SHA-256 by a service only function.
// A message is never deleted or changed in the mailbox, and nothing readable is logged.
import type { Reason } from "./route.ts";

export type FileOutcome = "FILED" | "CONFLICT_HOLD" | "FAILED" | "RETRY";
export interface PipelineResult { status: number; body: { ok?: boolean; code?: string; matter_id?: string | null; document_id?: string | null } | null }
export interface Pending { messageKey: string; graphId: string; matterId: string; receivedAt: string; documentId: string | null }
export interface FileDeps {
  firmId: string;
  maxBytes: number;
  getText(graphId: string): Promise<{ subject: string; text: string } | null>;
  getMime(graphId: string): Promise<Uint8Array | null>;
  callPipeline(input: { text: string; fileName: string; matterId: string }): Promise<PipelineResult>;
  /** Writes text/plain once, never overwrites. "exists" means an earlier attempt already wrote it. */
  upload(path: string, bytes: Uint8Array): Promise<"ok" | "exists" | "error">;
  setDocument(messageKey: string, documentId: string): Promise<boolean>;
  attachOriginal(messageKey: string, path: string, sha256: string, size: number): Promise<boolean>;
  setState(messageKey: string, state: "CONFLICT_HOLD" | "FAILED", reason: Reason | "TOO_LARGE" | "PII_BLOCKED" | null): Promise<void>;
  log(event: string, data: Record<string, string | number>): void;
}

const hex = (n: string) => n.slice(0, 8);
const day = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

export async function fileOne(d: FileDeps, p: Pending): Promise<FileOutcome> {
  const bytes = await d.getMime(p.graphId);
  if (!bytes) return "RETRY";
  if (bytes.byteLength === 0 || bytes.byteLength > d.maxBytes) { await d.setState(p.messageKey, "FAILED", "TOO_LARGE"); d.log("file", { outcome: "too_large", bytes: bytes.byteLength }); return "FAILED"; }
  const sha = await sha256Bytes(bytes);

  let docId = p.documentId;
  if (!docId) {
    const t = await d.getText(p.graphId);
    if (!t) return "RETRY";
    const text = `${t.subject}\n\n${t.text}`.trim() || "[הודעה ללא גוף טקסט]";
    const r = await d.callPipeline({ text, fileName: `mail-${day(p.receivedAt)}-${hex(p.messageKey)}.eml`, matterId: p.matterId });
    if (r.body?.code === "CONFLICT_HALT") { await d.setState(p.messageKey, "CONFLICT_HOLD", null); d.log("file", { outcome: "conflict_hold" }); return "CONFLICT_HOLD"; }
    if (r.body?.code === "PII_LEAK_BLOCKED") { await d.setState(p.messageKey, "FAILED", "PII_BLOCKED"); d.log("file", { outcome: "pii_blocked" }); return "FAILED"; }
    if (r.status === 429 || r.status >= 500) { d.log("file", { outcome: "retry", status: r.status }); return "RETRY"; }
    if (r.status !== 200 || !r.body?.ok || !r.body.document_id || r.body.matter_id !== p.matterId) {
      // A 4xx, or an answer that names a different matter: stop, a person looks. Never retry blindly.
      await d.setState(p.messageKey, "FAILED", null); d.log("file", { outcome: "rejected", status: r.status }); return "FAILED";
    }
    docId = r.body.document_id;
    if (!(await d.setDocument(p.messageKey, docId))) {
      // The document exists but is not linked: a retry would create a second one, so stop and say so.
      d.log("file", { outcome: "orphan_document" }); await d.setState(p.messageKey, "FAILED", null).catch(() => undefined); return "FAILED";
    }
  }

  const path = `${d.firmId}/${p.matterId}/${docId}/original.txt`;
  if ((await d.upload(path, bytes)) === "error") return "RETRY";
  if (!(await d.attachOriginal(p.messageKey, path, sha, bytes.byteLength))) return "RETRY";
  d.log("file", { outcome: "filed", bytes: bytes.byteLength });
  return "FILED";
}

async function sha256Bytes(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
