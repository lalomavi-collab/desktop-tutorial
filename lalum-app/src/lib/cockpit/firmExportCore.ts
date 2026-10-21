// The firm wide handover package, assembled on the client from the database functions of migration 0066.
// The database gives a manifest (a row count and a sha256 per table) and the rows as the exact JSON text those hashes were computed over.
// This module pulls every page, rebuilds each file, and refuses to produce a package whose files do not hash to the manifest.
// It has no browser or Supabase imports, so the same code runs in the check script. The originals in Storage are fetched through the optional
// `originals` port (the lalum-export-originals Edge Function signs them one page at a time); every file is checked against the sha256 and size the
// database recorded. Without the port, or with any original missing or unverified, the package says so in plain words (handover_complete: false).

export interface Section { table: string; rows: number; sha256: string; file: string }
export interface Manifest {
  firmStatus: string;
  generatedAt: string;
  sections: Section[];
  rowsTotal: number;
  excluded: Record<string, string>;
  unclassified: string[];
  complete: boolean;
  chain: { verified: boolean; firstBrokenSeq: number | null; headSeq: number | null; headHash: string | null };
  originals: { count: number; bytes: number; withoutSha256: number };
}
export interface OriginalsPort {
  /** One page of originals with a temporary link each, after the given cursor (null for the first page), or null on failure. */
  list: (after: string | null) => Promise<unknown>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
  digestBytes: (bytes: Uint8Array) => Promise<string>;
}
export interface Ports {
  originals?: OriginalsPort;
  manifest: () => Promise<unknown>;
  page: (table: string, offset: number, limit: number) => Promise<unknown>;
  digest: (text: string) => Promise<string>;
  now: () => Date;
}
export interface PackageFile { path: string; content: string | Uint8Array; binary?: boolean }
export type OriginalFailure = "NO_URL" | "FETCH" | "BAD_ID" | "SIZE" | "SHA256" | "NO_HASH";
export interface OriginalsReport { listed: number; filesInZip: number; verified: number; failed: Array<{ document: string; reason: OriginalFailure }>; listError: string | null }
/** One ZIP of the package. The originals are split into volumes so the browser never holds more than about one volume of them; the LAST volume
 *  also carries the tables, PACKAGE.json and README.txt, because only then is everything known. A firm that fits in one volume gets one ZIP. */
export interface Volume { index: number; files: PackageFile[]; last: boolean }
export interface Built { files: PackageFile[]; manifest: Manifest; handoverComplete: boolean; originals: OriginalsReport | null; volumes: number }
export type ExportErrorCode = "MANIFEST" | "INCOMPLETE" | "PAGE" | "COUNT_CHANGED" | "HASH_MISMATCH" | "VOLUME";
export class ExportError extends Error {
  code: ExportErrorCode;
  detail: string;
  constructor(code: ExportErrorCode, detail: string) { super(`${code}: ${detail}`); this.code = code; this.detail = detail; }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x)) ? Number(x) : null);

/** Reads the manifest the database returned; null when it is not the shape the package depends on. */
export function parseManifest(j: unknown): Manifest | null {
  if (!isObj(j) || !Array.isArray(j.sections) || !isObj(j.audit_chain) || !isObj(j.originals) || !Array.isArray(j.unclassified)) return null;
  const sections: Section[] = [];
  for (const s of j.sections) {
    if (!isObj(s) || typeof s.table !== "string" || typeof s.sha256 !== "string" || typeof s.file !== "string") return null;
    const rows = num(s.rows);
    if (rows === null || rows < 0 || !/^[a-z0-9_]+$/.test(s.table) || !/^[a-f0-9]{64}$/.test(s.sha256)) return null;
    sections.push({ table: s.table, rows, sha256: s.sha256, file: s.file });
  }
  const c = j.audit_chain, o = j.originals;
  const count = num(o.count), bytes = num(o.bytes), without = num(o.without_sha256);
  if (count === null || bytes === null || without === null) return null;
  return {
    firmStatus: typeof j.firm_status === "string" ? j.firm_status : "",
    generatedAt: typeof j.generated_at === "string" ? j.generated_at : "",
    sections,
    rowsTotal: num(j.rows_total) ?? sections.reduce((a, s) => a + s.rows, 0),
    excluded: isObj(j.excluded) ? Object.fromEntries(Object.entries(j.excluded).filter(([, v]) => typeof v === "string") as [string, string][]) : {},
    unclassified: j.unclassified.filter((x): x is string => typeof x === "string"),
    complete: j.complete === true,
    chain: { verified: c.verified === true, firstBrokenSeq: num(c.first_broken_seq), headSeq: num(c.head_seq), headHash: typeof c.head_hash === "string" ? c.head_hash : null },
    originals: { count, bytes, withoutSha256: without },
  };
}

/** The ZIP name carries the date and a short id, never the firm or a client name: it sits in downloads lists and on screens. */
export const zipName = (firmId: string, now: Date): string => `firm-export-${firmId.replace(/[^a-f0-9]/gi, "").slice(0, 8) || "firm"}-${now.toISOString().slice(0, 10)}.zip`;

const PAGE = 500;

async function pullTable(ports: Ports, s: Section, pageSize: number): Promise<string> {
  const rows: string[] = [];
  let offset = 0;
  const maxPages = Math.ceil(s.rows / pageSize) + 2;
  for (let i = 0; i < maxPages && rows.length < s.rows; i++) {
    const p = await ports.page(s.table, offset, pageSize);
    if (!isObj(p) || !Array.isArray(p.rows) || !p.rows.every((r) => typeof r === "string")) throw new ExportError("PAGE", s.table);
    if (num(p.total) !== s.rows) throw new ExportError("COUNT_CHANGED", s.table);
    if (p.rows.length === 0) throw new ExportError("COUNT_CHANGED", s.table);
    rows.push(...(p.rows as string[]));
    offset += p.rows.length;
  }
  if (rows.length !== s.rows) throw new ExportError("COUNT_CHANGED", s.table);
  return rows.join("\n");
}

export function readmeText(m: Manifest, handoverComplete: boolean, now: Date, o: OriginalsReport | null = null, volumes = 1): string {
  const L: string[] = [];
  L.push("חבילת מסירה של נתוני המשרד", "");
  if (volumes > 1) L.push(`החבילה מחולקת ל-${volumes} קבצי ZIP, כדי שאפשר יהיה לפתוח כל אחד בנפרד. קובץ ה-ZIP האחרון (part-${String(volumes).padStart(2, "0")}) מכיל את הטבלאות, את PACKAGE.json ואת הקובץ הזה, וכל קובץ ZIP מכיל VOLUME-NN.json עם החתימות של הקבצים שבו. יש לשמור את כל הקבצים יחד: חבילה שחסר בה קובץ ZIP אינה שלמה.`, "");
  L.push(`נוצרה ב: ${now.toLocaleDateString("he-IL")}`, `סטטוס המשרד בעת הייצוא: ${m.firmStatus}`, "");
  L.push("מה כלול", `כל טבלה של המשרד בקובץ נפרד בתיקיית data, בפורמט JSON Lines: שורה אחת לכל רשומה. סך הכול ${m.sections.length} קבצים ו-${m.rowsTotal} רשומות.`, "");
  L.push("איך מאמתים", "לכל קובץ רשומים ב-PACKAGE.json מספר הרשומות וחתימת SHA-256. החתימה היא של תוכן הקובץ בקידוד UTF-8, בלי שורה ריקה בסוף. קובץ שחתימתו שונה אינו הקובץ שנמסר.", "");
  L.push("יומן הביקורת");
  L.push(m.chain.verified
    ? `שרשרת הגיבובים של יומן הביקורת נבדקה בעת הייצוא ונמצאה תקינה. ראש השרשרת: רצף ${m.chain.headSeq ?? "אין"}, גיבוב ${m.chain.headHash ?? "אין"}.`
    : `שרשרת הגיבובים של יומן הביקורת נבדקה בעת הייצוא ונמצאה שבורה החל מרצף ${m.chain.firstBrokenSeq ?? "לא ידוע"}. זהו ממצא שיש לבדוק לפני כל הסתמכות על היומן.`, "");
  L.push("מה לא כלול ולמה");
  for (const [t, why] of Object.entries(m.excluded).sort(([a], [b]) => a.localeCompare(b))) L.push(`${t}: ${why}`);
  L.push("");
  L.push("המסמכים המקוריים");
  if (m.originals.count === 0) L.push("לא נמצאו מסמכים מקוריים שמורים.", "");
  else if (!o) L.push(`המשרד מחזיק ${m.originals.count} מסמכים מקוריים (${Math.round(m.originals.bytes / 1024 / 1024)} MB) בארכיון הקבצים של הפלטפורמה. הם אינם כלולים בארכיון הזה.`, "עד שהמקוריים נמסרו, החבילה אינה שלמה למסירה.", "");
  else {
    L.push(`המשרד מחזיק ${m.originals.count} מסמכים מקוריים (${Math.round(m.originals.bytes / 1024 / 1024)} MB). בתיקיית originals נכללו ${o.filesInZip}, ומהם אומתו ${o.verified} מול חתימת ה-SHA-256 והגודל שנרשמו. הקובץ originals/index.jsonl ממפה כל קובץ למסמך, לתיק, לשם המקורי ולחתימה.`);
    if (o.listed !== m.originals.count) L.push(`רשימת המקוריים שהתקבלה (${o.listed}) שונה ממספרם בכרטיס (${m.originals.count}). יש לייצא שוב.`);
    if (o.listError === "TOO_LARGE") L.push("נפח המקוריים גדול מדי לייצוא מהדפדפן, ולכן הם אינם כלולים. יש לבקש מסירה של המקוריים בנפרד.");
    else if (o.listError === "COUNT_CHANGED") L.push("מספר המקוריים השתנה בזמן הייצוא. יש לייצא שוב.");
    else if (o.listError) L.push("קבלת רשימת המקוריים נכשלה או נקטעה, ולכן ייתכן שהם אינם כלולים במלואם.");
    if (o.failed.length > 0) {
      const by: Record<string, number> = {};
      for (const f of o.failed) by[f.reason] = (by[f.reason] ?? 0) + 1;
      L.push(`${o.failed.length} מסמכים לא כלולים או לא אומתו: ${Object.entries(by).sort(([a], [b]) => a.localeCompare(b)).map(([r, n]) => `${r} ${n}`).join(", ")}. הפירוט ב-PACKAGE.json.`);
    }
    L.push(handoverComplete ? "כל המקוריים כלולים ואומתו." : "עד שכל המקוריים כלולים ואומתו, החבילה אינה שלמה למסירה.", "");
  }
  L.push("שמות ופרטים מזהים", "המסמכים השמורים בטבלאות מחליפים שמות באסימונים כמו [CLIENT_NAME_1]. את השמות האמיתיים אפשר לקרוא רק במסמכים המקוריים. שמות הקבצים המקוריים נמצאים ב-originals/index.jsonl ולא בשמות הקבצים בארכיון.", "");
  L.push("העתק זה אינו חוות דעת משפטית ואינו מחליף את תיק המשרד.");
  return L.join("\n");
}

/** The ZIPs of the originals are cut at about this many bytes, so the browser holds at most one volume of originals at a time (a single larger file gets a volume of its own). */
export const VOLUME_BYTES = 256 * 1024 * 1024;
/** Above this many bytes of originals the export leaves them out and says so: that many volumes is not a download anyone should be asked to babysit. */
export const MAX_ORIGINALS_BYTES = 20 * 1024 * 1024 * 1024;
const DOC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_EXT: Record<string, string> = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "text/plain": "txt", "text/markdown": "md", "text/html": "html" };
interface OriginalItem { document: string; matter: string; sha256: string | null; size: number | null; mime: string | null; fileName: string | null; url: string | null }

interface OriginalsPage { items: OriginalItem[]; nextAfter: string | null; total: number | null }

/** Reads one page answer of lalum-export-originals; null when it is not the shape the package depends on. */
export function parseOriginals(j: unknown): OriginalsPage | null {
  if (!isObj(j) || j.ok !== true || !Array.isArray(j.items)) return null;
  if (j.next_after !== null && j.next_after !== undefined && (typeof j.next_after !== "string" || !DOC_ID.test(j.next_after))) return null;
  const out: OriginalItem[] = [];
  for (const x of j.items) {
    if (!isObj(x) || typeof x.document !== "string" || typeof x.matter !== "string") return null;
    out.push({ document: x.document, matter: x.matter, sha256: typeof x.sha256 === "string" ? x.sha256 : null, size: num(x.size), mime: typeof x.mime === "string" ? x.mime : null, fileName: typeof x.file_name === "string" ? x.file_name : null, url: typeof x.url === "string" ? x.url : null });
  }
  return { items: out, nextAfter: typeof j.next_after === "string" ? j.next_after : null, total: num(j.total) };
}

/** The extension comes from the original file name when it is plain, else from the mime type: the archive name itself is the document id, never a client name. */
const extOf = (i: OriginalItem): string => {
  const e = i.fileName?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase();
  return e ?? (i.mime && MIME_EXT[i.mime]) ?? "bin";
};

const CONCURRENCY = 4;

interface VolumeSink { cap: number; flush: (files: PackageFile[], index: number) => Promise<void> }
interface Pulled { rest: PackageFile[]; restRows: Array<Record<string, unknown>>; sealed: number; index: Array<Record<string, unknown>>; report: OriginalsReport }

const volumeName = (n: number) => `VOLUME-${String(n).padStart(2, "0")}.json`;
const volumeManifest = (n: number, rows: Array<Record<string, unknown>>): PackageFile => ({
  path: volumeName(n),
  content: JSON.stringify({ volume: n, files: rows.map((r) => ({ path: r.file, size: r.size, sha256: r.sha256, verified: r.verified, reason: r.reason })) }, null, 2),
});

async function pullOriginals(port: OriginalsPort, expected: number, onProgress: ((done: number, total: number) => void) | undefined, vol: VolumeSink): Promise<Pulled> {
  const failed: OriginalsReport["failed"] = [];
  const index: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let current: PackageFile[] = [];
  let currentRows: Array<Record<string, unknown>> = [];
  let currentBytes = 0, sealed = 0, filesInZip = 0;
  let pending: Promise<void> = Promise.resolve();
  let verified = 0, done = 0, listError: string | null = null;
  // Cutting a volume hands it to the sink and frees it; the next fetch waits for the sink, so memory stays near one volume.
  function seal(): void {
    const no = ++sealed;
    for (const r of currentRows) r.volume = no;
    const files = [...current].sort((a, b) => a.path.localeCompare(b.path));
    files.push(volumeManifest(no, currentRows));
    current = []; currentRows = []; currentBytes = 0;
    pending = pending.then(() => vol.flush(files, no));
  }
  async function one(i: OriginalItem): Promise<void> {
    const row: Record<string, unknown> = { document: i.document, matter: i.matter, original_name: i.fileName, mime: i.mime, size: i.size, sha256: i.sha256 };
    if (!DOC_ID.test(i.document)) { failed.push({ document: i.document, reason: "BAD_ID" }); return; }
    if (!i.url) { failed.push({ document: i.document, reason: "NO_URL" }); index.push({ ...row, file: null, volume: null, verified: false, reason: "NO_URL" }); return; }
    await pending;
    let bytes: Uint8Array | null = null;
    for (let attempt = 0; attempt < 2 && !bytes; attempt++) { try { bytes = await port.fetchBytes(i.url); } catch { bytes = null; } }
    if (!bytes) { failed.push({ document: i.document, reason: "FETCH" }); index.push({ ...row, file: null, volume: null, verified: false, reason: "FETCH" }); return; }
    const path = `originals/${i.document}.${extOf(i)}`;
    let reason: OriginalFailure | null = null;
    if (i.size !== null && bytes.length !== i.size) reason = "SIZE";
    else if (i.sha256 === null) reason = "NO_HASH";
    else if ((await port.digestBytes(bytes)) !== i.sha256) reason = "SHA256";
    const full = { ...row, file: path, volume: null as number | null, verified: reason === null, reason };
    current.push({ path, content: bytes, binary: true });
    currentRows.push(full); index.push(full);
    currentBytes += bytes.length; filesInZip += 1;
    if (reason) failed.push({ document: i.document, reason }); else verified += 1;
    if (currentBytes >= vol.cap) seal();
  }
  // A page is downloaded as soon as it is signed: the links last 15 minutes, so signing everything first would let the early ones expire.
  // Every page is bounded: it must hold something new, the cursor must move, and the walk is capped by the count the manifest announced.
  let after: string | null = null;
  const maxPages = expected + 2;
  try {
    for (let page = 0; page < maxPages; page++) {
      let got: OriginalsPage | null;
      try { got = parseOriginals(await port.list(after)); } catch { got = null; }
      if (!got) { listError = "LIST"; break; }
      const fresh = got.items.filter((i) => !seen.has(i.document));
      for (const i of got.items) seen.add(i.document);
      if (got.total !== null && got.total !== expected) { listError = "COUNT_CHANGED"; }
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < fresh.length) { const i = fresh[next++]; await one(i); done += 1; onProgress?.(done, expected); }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker));
      if (got.nextAfter === null) break;
      if (got.items.length === 0 || got.nextAfter === after || fresh.length === 0) { listError = "LIST"; break; }
      after = got.nextAfter;
      if (page === maxPages - 1) listError = "LIST";
    }
    await pending;
  } catch (e) {
    if (e instanceof ExportError) throw e;
    throw new ExportError("VOLUME", String(sealed));
  }
  failed.sort((a, b) => a.document.localeCompare(b.document));
  index.sort((a, b) => String(a.document).localeCompare(String(b.document)));
  const rest = [...current].sort((a, b) => a.path.localeCompare(b.path));
  return { rest, restRows: currentRows, sealed, index, report: { listed: seen.size, filesInZip, verified, failed, listError } };
}

/** Pulls every table, checks every file against the manifest, and returns the files of the package. Throws ExportError and produces nothing otherwise. */
export async function buildPackage(ports: Ports, opts: { pageSize?: number; volumeBytes?: number; emit?: (v: Volume) => Promise<void>; onProgress?: (done: number, total: number, table: string) => void; onOriginals?: (done: number, total: number) => void } = {}): Promise<Built> {
  const m = parseManifest(await ports.manifest());
  if (!m) throw new ExportError("MANIFEST", "shape");
  if (!m.complete || m.unclassified.length > 0) throw new ExportError("INCOMPLETE", m.unclassified.join(","));
  const pageSize = Math.min(Math.max(opts.pageSize ?? PAGE, 1), PAGE);
  const files: PackageFile[] = [];
  let done = 0;
  for (const s of m.sections) {
    opts.onProgress?.(done, m.sections.length, s.table);
    const content = s.rows === 0 ? "" : await pullTable(ports, s, pageSize);
    if ((await ports.digest(content)) !== s.sha256) throw new ExportError("HASH_MISMATCH", s.table);
    files.push({ path: `data/${s.table}.jsonl`, content });
    done += 1;
  }
  opts.onProgress?.(done, m.sections.length, "");
  let orig: OriginalsReport | null = null;
  // With an emit callback the earlier volumes leave memory as soon as they are cut; without one (the check scripts) they are kept and joined.
  const held: PackageFile[] = [];
  let tail: PackageFile[] = [];
  let tailRows: Array<Record<string, unknown>> = [];
  let sealed = 0;
  let indexRows: Array<Record<string, unknown>> = [];
  if (ports.originals && m.originals.count > 0 && m.originals.bytes > MAX_ORIGINALS_BYTES) {
    orig = { listed: 0, filesInZip: 0, verified: 0, failed: [], listError: "TOO_LARGE" };
  } else if (ports.originals && m.originals.count > 0) {
    const sink: VolumeSink = {
      cap: Math.max(opts.volumeBytes ?? VOLUME_BYTES, 1),
      flush: async (vf, n) => { if (opts.emit) await opts.emit({ index: n, files: vf, last: false }); else held.push(...vf); },
    };
    const got = await pullOriginals(ports.originals, m.originals.count, opts.onOriginals, sink);
    tail = got.rest; tailRows = got.restRows; sealed = got.sealed; indexRows = got.index;
    orig = got.report;
  }
  const volumes = sealed + 1;
  for (const r of tailRows) r.volume = volumes;
  if (volumes > 1) tail.push(volumeManifest(volumes, tailRows));
  if (indexRows.length > 0) tail.push({ path: "originals/index.jsonl", content: indexRows.map((r) => JSON.stringify(r)).join("\n") });
  const now = ports.now();
  const handoverComplete = m.originals.count === 0 || (orig !== null && orig.listError === null && orig.listed === m.originals.count && orig.filesInZip === m.originals.count && orig.failed.length === 0);
  const pkg = {
    generated_at: m.generatedAt, packaged_at: now.toISOString(), firm_status: m.firmStatus,
    format: "JSON Lines, one JSON object per line, rows ordered by their JSON text, joined by a newline, no trailing newline",
    files: m.sections.map((s) => ({ path: `data/${s.table}.jsonl`, rows: s.rows, sha256: s.sha256, verified: true })),
    volumes,
    audit_chain: { verified: m.chain.verified, first_broken_seq: m.chain.firstBrokenSeq, head_seq: m.chain.headSeq, head_hash: m.chain.headHash },
    excluded: m.excluded,
    originals: { count: m.originals.count, bytes: m.originals.bytes, without_sha256: m.originals.withoutSha256, included: m.originals.count === 0 || handoverComplete, files_in_zip: orig?.filesInZip ?? 0, verified: orig?.verified ?? 0, failed: orig?.failed ?? [], list_error: orig?.listError ?? null },
    handover_complete: handoverComplete,
  };
  files.push({ path: "PACKAGE.json", content: JSON.stringify(pkg, null, 2) });
  files.push({ path: "README.txt", content: readmeText(m, handoverComplete, now, orig, volumes) });
  const lastFiles = [...tail, ...files];
  if (opts.emit) {
    try { await opts.emit({ index: volumes, files: lastFiles, last: true }); } catch { throw new ExportError("VOLUME", String(volumes)); }
    return { files: [], manifest: m, handoverComplete, originals: orig, volumes };
  }
  return { files: [...held, ...lastFiles], manifest: m, handoverComplete, originals: orig, volumes };
}

/** A Hebrew message for the screen. The detail names a table, never a row. */
export function exportErrorText(e: unknown): string {
  if (!(e instanceof ExportError)) return "הייצוא נכשל.";
  switch (e.code) {
    case "INCOMPLETE": return "החבילה אינה שלמה: יש טבלה שטרם סווגה לייצוא. לא נוצר קובץ. יש לפנות לתמיכה.";
    case "COUNT_CHANGED": return "הנתונים השתנו בזמן הייצוא. לא נוצר קובץ. כדאי לנסות שוב.";
    case "HASH_MISMATCH": return "אימות חתימה נכשל באחד הקבצים. לא נוצר קובץ.";
    case "PAGE": return "קריאת נתונים נכשלה. לא נוצר קובץ.";
    case "VOLUME": return "יצירת אחד מקובצי ה-ZIP נכשלה. חלק מהקבצים ייתכן שכבר ירדו והחבילה אינה שלמה. יש לייצא שוב ולהשליך את הקבצים החלקיים.";
    default: return "הייצוא נכשל.";
  }
}
