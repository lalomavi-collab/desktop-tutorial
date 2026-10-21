// The original files for the per matter client export (ArchiveExport). Each original is opened through the same door as the cockpit's own
// "open original" (lalum-open-original: role, second factor, firm, matter access, ONE chain row per file, a 60 second link), fetched at once,
// and checked against the size and sha256 the database recorded. No browser or Supabase imports, so the check script runs this very code.
// Nothing is silent: a file that cannot be opened, fetched or verified is listed with a reason, and the export says the set is incomplete.

export interface DocOriginal { id: string; fileName: string; size: number | null; sha256: string | null; mime: string | null }
export type OpenAnswer = { ok: true; url: string } | { ok: false };
export interface OriginalsPort {
  open: (documentId: string) => Promise<OpenAnswer>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
  digestBytes: (bytes: Uint8Array) => Promise<string>;
}
export type OriginalFailure = "OPEN" | "FETCH" | "SIZE" | "SHA256" | "NO_HASH";
export interface OriginalRow { document: string; file: string | null; size: number | null; sha256: string | null; verified: boolean; reason: OriginalFailure | null }
export interface OriginalsResult {
  files: Array<{ path: string; content: Uint8Array }>;
  rows: OriginalRow[];
  /** documents that have a stored original / documents that have none */
  requested: number;
  without: number;
  verified: number;
  skipped: "TOO_LARGE" | null;
  complete: boolean;
}

/** A matter file for a client request is a handful of documents; above these the browser would hold too much, so the originals are left out and the export says so. */
export const MAX_FILES = 150;
export const MAX_BYTES = 300 * 1024 * 1024;
const CONCURRENCY = 2;
const MIME_EXT: Record<string, string> = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "text/plain": "txt", "text/markdown": "md", "text/html": "html" };

/** The extension from the stored file name when it is plain, else from the mime type. The rest of the name is chosen by the caller. */
export const extFor = (d: DocOriginal): string => d.fileName.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? (d.mime && MIME_EXT[d.mime]) ?? "bin";

/** `nameOf(index, doc)` gives the archive path without the extension, so the original sits next to the text versions of the same document. */
export async function pullMatterOriginals(docs: DocOriginal[], port: OriginalsPort, nameOf: (index: number, d: DocOriginal) => string, onProgress?: (done: number, total: number) => void): Promise<OriginalsResult> {
  const withOriginal = docs.map((d, index) => ({ d, index })).filter((x) => x.d.size !== null);
  const without = docs.length - withOriginal.length;
  const total = withOriginal.reduce((a, x) => a + (x.d.size ?? 0), 0);
  if (withOriginal.length > MAX_FILES || total > MAX_BYTES) {
    return { files: [], rows: [], requested: withOriginal.length, without, verified: 0, skipped: "TOO_LARGE", complete: false };
  }
  const files: OriginalsResult["files"] = [];
  const rows: OriginalRow[] = [];
  let verified = 0, done = 0, next = 0;
  async function one(x: { d: DocOriginal; index: number }): Promise<void> {
    const { d } = x;
    const base: OriginalRow = { document: d.id, file: null, size: d.size, sha256: d.sha256, verified: false, reason: null };
    let opened: OpenAnswer;
    try { opened = await port.open(d.id); } catch { opened = { ok: false }; }
    if (!opened.ok) { rows.push({ ...base, reason: "OPEN" }); return; }
    let bytes: Uint8Array | null = null;
    for (let attempt = 0; attempt < 2 && !bytes; attempt++) { try { bytes = await port.fetchBytes(opened.url); } catch { bytes = null; } }
    // a second attempt reuses the same link (it lasts 60 seconds); opening again would write a second chain row for one file
    if (!bytes) { rows.push({ ...base, reason: "FETCH" }); return; }
    const path = `${nameOf(x.index, d)}.${extFor(d)}`;
    let reason: OriginalFailure | null = null;
    if (d.size !== null && bytes.length !== d.size) reason = "SIZE";
    else if (d.sha256 === null) reason = "NO_HASH";
    else if ((await port.digestBytes(bytes)) !== d.sha256) reason = "SHA256";
    files.push({ path, content: bytes });
    if (!reason) verified += 1;
    rows.push({ ...base, file: path, verified: reason === null, reason });
  }
  async function worker(): Promise<void> {
    while (next < withOriginal.length) { const x = withOriginal[next++]; await one(x); done += 1; onProgress?.(done, withOriginal.length); }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, withOriginal.length) }, worker));
  rows.sort((a, b) => a.document.localeCompare(b.document));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, rows, requested: withOriginal.length, without, verified, skipped: null, complete: verified === withOriginal.length };
}

/** The README sentences about the originals, in one place so the screen and the file cannot disagree. */
export function originalsReadme(r: OriginalsResult | null): string[] {
  if (!r) return ["מה לא כלול: קובץ המקור כפי שהועלה (PDF, DOCX וכדומה), גם כשהוא שמור בכספת של הפלטפורמה. המשרד מוסר אותו בנפרד."];
  if (r.skipped === "TOO_LARGE") return ["מה לא כלול: קבצי המקור, כי מספרם או נפחם גדולים מדי לייצוא אחד. המשרד מוסר אותם בנפרד."];
  const L: string[] = [];
  if (r.requested === 0) L.push("קבצי מקור: לא נמצאו קבצי מקור שמורים למסמכי התיק.");
  else {
    L.push(`קבצי מקור: בתיקיית originals ${r.files.length} מתוך ${r.requested} קבצי המקור השמורים, ומהם אומתו ${r.verified} מול חתימת ה-SHA-256 והגודל שנרשמו בעת הקליטה. החתימות ב-manifest.json.`);
    const bad = r.rows.filter((x) => !x.verified);
    if (bad.length > 0) {
      const by: Record<string, number> = {};
      for (const b of bad) by[b.reason ?? "?"] = (by[b.reason ?? "?"] ?? 0) + 1;
      L.push(`${bad.length} קבצים לא נכללו או לא אומתו: ${Object.entries(by).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(", ")}. המשרד מוסר אותם בנפרד.`);
    }
  }
  if (r.without > 0) L.push(`${r.without} מסמכים נקלטו בלי קובץ מקור שמור.`);
  return L;
}
