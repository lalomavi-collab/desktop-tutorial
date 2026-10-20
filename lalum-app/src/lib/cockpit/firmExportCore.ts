// The firm wide handover package, assembled on the client from the database functions of migration 0066.
// The database gives a manifest (a row count and a sha256 per table) and the rows as the exact JSON text those hashes were computed over.
// This module pulls every page, rebuilds each file, and refuses to produce a package whose files do not hash to the manifest.
// It has no browser or Supabase imports, so the same code runs in the check script. The originals in Storage are NOT fetched here:
// they need a batch signer that does not exist yet, and the package says so in plain words (handover_complete: false).

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
export interface Ports {
  manifest: () => Promise<unknown>;
  page: (table: string, offset: number, limit: number) => Promise<unknown>;
  digest: (text: string) => Promise<string>;
  now: () => Date;
}
export interface PackageFile { path: string; content: string }
export interface Built { files: PackageFile[]; manifest: Manifest; handoverComplete: boolean }
export type ExportErrorCode = "MANIFEST" | "INCOMPLETE" | "PAGE" | "COUNT_CHANGED" | "HASH_MISMATCH";
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

export function readmeText(m: Manifest, handoverComplete: boolean, now: Date): string {
  const L: string[] = [];
  L.push("חבילת מסירה של נתוני המשרד", "");
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
  else L.push(`המשרד מחזיק ${m.originals.count} מסמכים מקוריים (${Math.round(m.originals.bytes / 1024 / 1024)} MB) בארכיון הקבצים של הפלטפורמה. הם אינם כלולים בארכיון הזה.`, handoverComplete ? "" : "עד שהמקוריים נמסרו, החבילה אינה שלמה למסירה.", "");
  L.push("שמות ופרטים מזהים", "המסמכים השמורים בטבלאות מחליפים שמות באסימונים כמו [CLIENT_NAME_1]. את השמות האמיתיים אפשר לקרוא רק במסמכים המקוריים.", "");
  L.push("העתק זה אינו חוות דעת משפטית ואינו מחליף את תיק המשרד.");
  return L.join("\n");
}

/** Pulls every table, checks every file against the manifest, and returns the files of the package. Throws ExportError and produces nothing otherwise. */
export async function buildPackage(ports: Ports, opts: { pageSize?: number; onProgress?: (done: number, total: number, table: string) => void } = {}): Promise<Built> {
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
  const now = ports.now();
  const handoverComplete = m.originals.count === 0;
  const pkg = {
    generated_at: m.generatedAt, packaged_at: now.toISOString(), firm_status: m.firmStatus,
    format: "JSON Lines, one JSON object per line, rows ordered by their JSON text, joined by a newline, no trailing newline",
    files: m.sections.map((s) => ({ path: `data/${s.table}.jsonl`, rows: s.rows, sha256: s.sha256, verified: true })),
    audit_chain: { verified: m.chain.verified, first_broken_seq: m.chain.firstBrokenSeq, head_seq: m.chain.headSeq, head_hash: m.chain.headHash },
    excluded: m.excluded,
    originals: { count: m.originals.count, bytes: m.originals.bytes, without_sha256: m.originals.withoutSha256, included: false },
    handover_complete: handoverComplete,
  };
  files.push({ path: "PACKAGE.json", content: JSON.stringify(pkg, null, 2) });
  files.push({ path: "README.txt", content: readmeText(m, handoverComplete, now) });
  return { files, manifest: m, handoverComplete };
}

/** A Hebrew message for the screen. The detail names a table, never a row. */
export function exportErrorText(e: unknown): string {
  if (!(e instanceof ExportError)) return "הייצוא נכשל.";
  switch (e.code) {
    case "INCOMPLETE": return "החבילה אינה שלמה: יש טבלה שטרם סווגה לייצוא. לא נוצר קובץ. יש לפנות לתמיכה.";
    case "COUNT_CHANGED": return "הנתונים השתנו בזמן הייצוא. לא נוצר קובץ. כדאי לנסות שוב.";
    case "HASH_MISMATCH": return "אימות חתימה נכשל באחד הקבצים. לא נוצר קובץ.";
    case "PAGE": return "קריאת נתונים נכשלה. לא נוצר קובץ.";
    default: return "הייצוא נכשל.";
  }
}
