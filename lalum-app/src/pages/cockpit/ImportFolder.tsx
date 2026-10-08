// Import matters from a local folder. The firm's working folder holds one sub-folder per matter; the browser reads it
// (read-only, the source is never changed or deleted) and sends each file through the normal intake pipeline, so PII is
// masked, conflicts are checked and everything is audited exactly as for a manual upload. One matter per request chain:
// no file from one matter ever travels with another.
import { useState } from "react";
import { Link } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { readFile } from "./Intake";
import { callPipeline, errorText } from "../../lib/cockpit/shared";
import { storeOriginal } from "../../lib/cockpit/storeOriginal";
import { DOC_ORIGIN, DOC_TYPE } from "../../lib/cockpit/docMeta";
import { supabase } from "../../lib/supabase";

const EXT = [".docx", ".pdf", ".txt", ".md", ".html", ".htm"];
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_MATTER = 200;

interface Entry { name: string; file: File }
interface Plan { folder: string; title: string; files: Entry[]; skipped: number; include: boolean }
type Row = { folder: string; state: "wait" | "run" | "done" | "warn" | "err"; text: string };

// Minimal typing for the File System Access API (Chrome, Edge).
interface DirHandle { kind: "directory"; name: string; values(): AsyncIterable<DirHandle | FileHandle> }
interface FileHandle { kind: "file"; name: string; getFile(): Promise<File> }
const hasPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

async function collect(dir: DirHandle, out: Entry[], prefix: string, depth: number): Promise<void> {
  for await (const h of dir.values()) {
    if (h.name.startsWith(".") || h.name.startsWith("~$")) continue; // hidden and Office lock files
    if (h.kind === "file") {
      const f = await h.getFile();
      out.push({ name: prefix + h.name, file: f });
    } else if (depth < 3) {
      await collect(h, out, `${prefix}${h.name}/`, depth + 1);
    }
  }
}

function Importer({ firmId }: { firmId: string }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [docType, setDocType] = useState("");
  const [docOrigin, setDocOrigin] = useState("");

  async function pick() {
    setNote(""); setRows([]);
    try {
      const root = await (window as unknown as { showDirectoryPicker(o: { mode: "read" }): Promise<DirHandle> }).showDirectoryPicker({ mode: "read" });
      const found: Plan[] = [];
      for await (const h of root.values()) {
        if (h.kind !== "directory" || h.name.startsWith(".")) continue;
        const all: Entry[] = [];
        await collect(h, all, "", 0);
        const ok = all.filter((e) => EXT.some((x) => e.name.toLowerCase().endsWith(x)) && e.file.size > 0 && e.file.size <= MAX_BYTES).slice(0, MAX_FILES_PER_MATTER);
        if (ok.length) found.push({ folder: h.name, title: h.name, files: ok, skipped: all.length - ok.length, include: true });
      }
      found.sort((a, b) => a.folder.localeCompare(b.folder, "he"));
      setPlans(found);
      if (!found.length) setNote("לא נמצאו תתי-תיקיות עם מסמכים נתמכים (Word, PDF, טקסט, HTML).");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("לא ניתן לקרוא את התיקייה.");
    }
  }

  const set = (folder: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.folder === folder ? { ...r, ...patch } : r)));

  async function run() {
    if (!plans) return;
    const chosen = plans.filter((p) => p.include);
    setBusy(true);
    setRows(chosen.map((p) => ({ folder: p.folder, state: "wait", text: "ממתין" })));
    for (const p of chosen) {
      set(p.folder, { state: "run", text: "מעבד..." });
      let matterId: string | undefined;
      let okFiles = 0; let failed = 0; let halted = false; let noOriginal = 0;
      for (const [i, e] of p.files.entries()) {
        set(p.folder, { text: `קובץ ${i + 1} מתוך ${p.files.length}` });
        let text: string;
        try { text = (await readFile(e.file)).trim(); } catch { failed++; continue; }
        if (!text) { failed++; continue; }
        const r = await callPipeline("/api/v1/documents/upload", { text, file_name: e.name, title: matterId ? undefined : p.title.trim() || undefined, matter_id: matterId, parties: [] });
        if (!r.ok || !r.matter_id) {
          if (r.code === "CONFLICT_HALT") { halted = true; set(p.folder, { state: "warn", text: errorText(r) }); break; }
          failed++; continue;
        }
        matterId = r.matter_id; okFiles++;
        if (r.document_id && supabase) await supabase.rpc("lalum_set_document_meta", { p_doc: r.document_id, p_type: docType, p_origin: docOrigin, p_date: null });
        if (r.document_id && !(await storeOriginal(firmId, r.matter_id, r.document_id, e.file))) noOriginal++;
      }
      if (!halted) set(p.folder, { state: failed || noOriginal ? (okFiles ? "warn" : "err") : "done", text: `${okFiles} קבצים נקלטו${failed ? `, ${failed} נכשלו` : ""}${noOriginal ? `, למקור לא נשמר: ${noOriginal}` : ""}` });
    }
    setBusy(false);
  }

  return (
    <div className="ck-stack">
      <div className="ck-warn">הקריאה היא לקריאה בלבד: הקבצים בתיקייה לא משתנים ולא נמחקים. כל קובץ עובר הסתרת מידע מזהה ובדיקת ניגוד עניינים, והטקסט המוסתר הוא זה שמשמש לעבודה ולבינה מלאכותית. הקובץ המקורי נשמר בכספת התיק, פרטית ובלתי ניתנת לדריסה, עם חתימת SHA-256 ביומן. אל תמחקו את התיקייה המקורית לפני שוידאתם שהכול נקלט. תיקים סגורים חייבים להישמר לפי חוק לשכת עורכי הדין.</div>
      {!hasPicker && <div className="ck-err">הדפדפן אינו תומך בבחירת תיקייה. השתמשו ב-Chrome או Edge במחשב.</div>}
      <div className="ck-row"><button className="ck-btn primary" disabled={!hasPicker || busy} onClick={() => void pick()}>בחירת תיקייה</button>
        <span className="ck-meta">בחרו את התיקייה שמכילה תיקייה לכל תיק. תופיע רשימה לבדיקה לפני הייבוא.</span></div>
      {note && <div className="ck-meta" role="status">{note}</div>}
      {plans && plans.length > 0 && rows.length === 0 && (
        <>
          <div className="ck-label">נמצאו {plans.length} תיקים. סמנו מה לייבא ותקנו כותרות שמכילות פרטים מזהים.</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>ייבוא</th><th>כותרת התיק</th><th>תיקייה</th><th>קבצים</th><th>דולגו</th></tr></thead><tbody>
            {plans.map((p) => (
              <tr key={p.folder}>
                <td><input type="checkbox" aria-label={`ייבוא ${p.folder}`} checked={p.include} onChange={(e) => setPlans((ps) => ps?.map((x) => (x.folder === p.folder ? { ...x, include: e.target.checked } : x)) ?? ps)} /></td>
                <td style={{ minWidth: 240 }}><input className="ck-input" value={p.title} onChange={(e) => setPlans((ps) => ps?.map((x) => (x.folder === p.folder ? { ...x, title: e.target.value } : x)) ?? ps)} /></td>
                <td>{p.folder}</td><td>{p.files.length}</td><td>{p.skipped || ""}</td>
              </tr>))}
          </tbody></table></div>
          <div className="ck-label">שתי שאלות לפני הייבוא, כדי שכל מסמך יסווג ולא יישאר לא מסודר</div>
          <div className="ck-grid2">
            <label className="ck-field">מה סוג רוב המסמכים בתיקיות שנבחרו?
              <select className="ck-select" value={docType} onChange={(e) => setDocType(e.target.value)}><option value="">בחרו סוג</option>{Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">ממי הגיעו בדרך כלל?
              <select className="ck-select" value={docOrigin} onChange={(e) => setDocOrigin(e.target.value)}><option value="">בחרו מקור</option>{Object.entries(DOC_ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="ck-meta">הסיווג חל על כל קובץ בייבוא הזה, וניתן לתקן אותו לכל מסמך בנפרד בתוך התיק. כל תיקייה הופכת לתיק אחד במשרד, וכל קובץ נשמר בתוכו.</div>
          <div className="ck-row"><button className="ck-btn primary" disabled={busy || !docType || !docOrigin || !plans.some((p) => p.include)} onClick={() => void run()}>ייבוא {plans.filter((p) => p.include).length} תיקים</button></div>
        </>
      )}
      {rows.length > 0 && (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיקייה</th><th>מצב</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.folder}><td>{r.folder}</td><td><span className={`ck-badge ${r.state === "done" ? "green" : r.state === "err" ? "red" : "yellow"}`}>{r.text}</span></td></tr>)}
        </tbody></table></div>
      )}
      {!busy && rows.length > 0 && <div className="ck-row"><Link className="ck-btn primary" to="/workspace">לרשימת התיקים</Link></div>}
    </div>
  );
}

export function ImportFolderPage() {
  return (
    <CockpitFrame title="ייבוא תיקים מתיקייה" description="יצירת תיקים מתיקיית העבודה של המשרד." path="/workspace/import">
      {({ member }) => member && <Importer firmId={member.firm_id} />}
    </CockpitFrame>
  );
}
