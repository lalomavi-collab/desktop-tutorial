// Import matters from a local folder. The firm's working folder holds one sub-folder per matter; the browser reads it
// (read-only, the source is never changed or deleted) and sends each file through the normal intake pipeline, so PII is
// masked, conflicts are checked and everything is audited exactly as for a manual upload. One matter per request chain:
// no file from one matter ever travels with another.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { readFile } from "./Intake";
import { callPipeline, errorText, PRACTICE } from "../../lib/cockpit/shared";
import { storeOriginal } from "../../lib/cockpit/storeOriginal";
import { DOC_ORIGIN, DOC_TYPE } from "../../lib/cockpit/docMeta";
import { findExisting, sha256File } from "../../lib/cockpit/dedupe";
import { supabase } from "../../lib/supabase";

const EXT = [".docx", ".pdf", ".txt", ".md", ".html", ".htm"];
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_MATTER = 200;

interface Entry { name: string; file: File; hash: string }
// files = new, unique files to import. existing = already in the vault (matched by SHA-256). dupes = repeats inside the folder.
interface Plan { folder: string; title: string; files: Entry[]; skipped: number; existing: number; dupes: number; targetMatter: string | null; targetTitle: string | null; include: boolean; flag: string | null; practice: string; sample: string[] }
// Folders that are usually a sorting place, not a matter: left unchecked until the partner decides.
const SORTING = /(דואר|נכנס|יוצא|inbox|outbox|סריק|scan|הורד|download|\btmp\b|\btemp\b|טיוטות|ארכיון|archive|שונות|misc|new folder|תיקייה חדשה)/i;
type Row = { folder: string; state: "wait" | "run" | "done" | "warn" | "err"; text: string };

// Minimal typing for the File System Access API (Chrome, Edge).
interface DirHandle { kind: "directory"; name: string; values(): AsyncIterable<DirHandle | FileHandle> }
interface FileHandle { kind: "file"; name: string; getFile(): Promise<File> }
const hasPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

async function collect(dir: DirHandle, out: Array<{ name: string; file: File }>, prefix: string, depth: number): Promise<void> {
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
  const [progress, setProgress] = useState("");
  const [root, setRoot] = useState<DirHandle | null>(null);
  const [level, setLevel] = useState<1 | 2>(1);

  async function pick() {
    setNote(""); setRows([]);
    try {
      const r = await (window as unknown as { showDirectoryPicker(o: { mode: "read" }): Promise<DirHandle> }).showDirectoryPicker({ mode: "read" });
      setRoot(r);
      await scan(r, level);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("לא ניתן לקרוא את התיקייה.");
    }
  }

  // level 1: every direct sub folder is a matter. level 2: folders are clients and their sub folders are the matters.
  async function scan(rootDir: DirHandle, lvl: 1 | 2) {
    setNote(""); setRows([]); setPlans(null);
    try {
      const raw: Array<{ folder: string; files: Array<{ name: string; file: File }>; skipped: number }> = [];
      let loose = 0;
      const addMatter = async (dir: DirHandle, label: string) => {
        const all: Array<{ name: string; file: File }> = [];
        await collect(dir, all, "", 0);
        const ok = all.filter((e) => EXT.some((x) => e.name.toLowerCase().endsWith(x)) && e.file.size > 0 && e.file.size <= MAX_BYTES).slice(0, MAX_FILES_PER_MATTER);
        if (ok.length) raw.push({ folder: label, files: ok, skipped: all.length - ok.length });
      };
      for await (const h of rootDir.values()) {
        if (h.name.startsWith(".")) continue;
        if (h.kind === "file") { loose++; continue; }
        if (lvl === 1) { await addMatter(h, h.name); continue; }
        for await (const g of h.values()) {
          if (g.name.startsWith(".")) continue;
          if (g.kind === "file") loose++; else await addMatter(g, `${h.name} / ${g.name}`);
        }
      }
      // Fingerprint every file, then ask the vault which of them it already holds.
      const hashed: Array<{ folder: string; skipped: number; files: Entry[] }> = [];
      let n = 0; const total = raw.reduce((a, r) => a + r.files.length, 0);
      for (const r of raw) {
        const files: Entry[] = [];
        for (const e of r.files) { setProgress(`בודק כפילויות: ${++n} מתוך ${total}`); files.push({ name: e.name, file: e.file, hash: await sha256File(e.file) }); }
        hashed.push({ folder: r.folder, skipped: r.skipped, files });
      }
      setProgress("");
      const known = await findExisting(hashed.flatMap((h) => h.files.map((f) => f.hash)));
      const found: Plan[] = hashed.map((h) => {
        // Unique files of the folder (repeats inside it are dropped).
        const seen = new Set<string>(); const unique: Entry[] = []; let dupes = 0;
        for (const f of h.files) { if (seen.has(f.hash)) { dupes++; continue; } seen.add(f.hash); unique.push(f); }
        // The folder joins an existing matter only if at least half of its files are already in that one matter.
        // A file that also sits in another matter (a shared template, say) never links two matters, and is imported normally.
        const overlap = new Map<string, number>();
        for (const f of unique) for (const m of known.get(f.hash) ?? []) overlap.set(m, (overlap.get(m) ?? 0) + 1);
        const best = [...overlap.entries()].sort((x, y) => y[1] - x[1])[0];
        const target = best && best[1] * 2 >= unique.length ? best[0] : null;
        const fresh = unique.filter((f) => !target || !(known.get(f.hash) ?? []).includes(target));
        const flag = SORTING.test(h.folder) ? "נראית כתיקיית מיון ולא כתיק" : null;
        return { folder: h.folder, title: h.folder, files: fresh, skipped: h.skipped, existing: unique.length - fresh.length, dupes, targetMatter: target, targetTitle: null, include: fresh.length > 0 && !flag, flag, practice: "", sample: fresh.slice(0, 3).map((f) => f.name) };
      });
      const ids = [...new Set(found.map((p) => p.targetMatter).filter((x): x is string => !!x))];
      if (ids.length && supabase) {
        const { data } = await supabase.from("lalum_cockpit_matters").select("id, title").in("id", ids);
        const t = new Map(((data as Array<{ id: string; title: string }> | null) ?? []).map((m) => [m.id, m.title]));
        for (const p of found) if (p.targetMatter) p.targetTitle = t.get(p.targetMatter) ?? "תיק קיים";
      }
      found.sort((a, b) => a.folder.localeCompare(b.folder, "he"));
      setPlans(found);
      const msgs: string[] = [];
      if (!found.length) msgs.push("לא נמצאו תיקיות עם מסמכים נתמכים (Word, PDF, טקסט, HTML) ברמה שנבחרה.");
      if (loose) msgs.push(`${loose} קבצים עומדים מחוץ לתיקיות התיקים ולכן לא ייובאו (קובץ שאינו בתיקיית תיק אינו משויך לתיק).`);
      setNote(msgs.join(" "));
    } catch {
      setNote("לא ניתן לקרוא את התיקייה.");
    }
  }

  const set = (folder: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.folder === folder ? { ...r, ...patch } : r)));

  const stopRef = useRef(false);
  const failedRef = useRef<Record<string, string[]>>({});
  const [conc, setConc] = useState(3);
  const [stats, setStats] = useState<{ done: number; total: number; started: number } | null>(null);
  const [stopping, setStopping] = useState(false);

  // Warn before the tab is closed while an import runs, and keep the screen awake (a sleeping laptop stops the import).
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    let lock: { release(): Promise<void> } | null = null;
    void (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    return () => { window.removeEventListener("beforeunload", warn); void lock?.release(); };
  }, [busy]);

  const retryable = (c?: string) => !!c && /RATE|429|BUSY|OVERLOAD/i.test(c);

  // One matter: its files go in order (the first creates the matter, the rest join it). Matters run side by side, never mixed.
  async function importPlan(p: Plan) {
    set(p.folder, { state: "run", text: "מעבד..." });
    let matterId: string | undefined = p.targetMatter ?? undefined;
    let okFiles = 0; let failed = 0; let halted = false; let noOriginal = 0;
    const failedNames: string[] = [];
    for (const [i, e] of p.files.entries()) {
      if (stopRef.current) { failedNames.push(...p.files.slice(i).map((f) => f.name)); break; }
      set(p.folder, { text: `קובץ ${i + 1} מתוך ${p.files.length}` });
      let text = "";
      try { text = (await readFile(e.file)).trim(); } catch { text = ""; }
      if (!text) { failed++; failedNames.push(e.name); setStats((s) => s && { ...s, done: s.done + 1 }); continue; }
      let r = await callPipeline("/api/v1/documents/upload", { text, file_name: e.name, title: matterId ? undefined : p.title.trim() || undefined, matter_id: matterId, practice_area: matterId ? undefined : p.practice || undefined, parties: [] });
      // Only an explicit rate limit is retried: after a network failure the server may already have stored the file, and a blind retry could create a second matter.
      for (let t = 0; t < 3 && !r.ok && retryable(r.code); t++) {
        await new Promise((res) => setTimeout(res, 2000 * (t + 1)));
        r = await callPipeline("/api/v1/documents/upload", { text, file_name: e.name, title: matterId ? undefined : p.title.trim() || undefined, matter_id: matterId, practice_area: matterId ? undefined : p.practice || undefined, parties: [] });
      }
      setStats((s) => s && { ...s, done: s.done + 1 });
      if (!r.ok || !r.matter_id) {
        if (r.code === "CONFLICT_HALT") { halted = true; failedNames.push(...p.files.slice(i).map((f) => f.name)); set(p.folder, { state: "warn", text: errorText(r) }); break; }
        failed++; failedNames.push(e.name); continue;
      }
      matterId = r.matter_id; okFiles++;
      if (r.document_id && supabase) await supabase.rpc("lalum_set_document_meta", { p_doc: r.document_id, p_type: docType, p_origin: docOrigin, p_date: null });
      if (r.document_id && !(await storeOriginal(firmId, r.matter_id, r.document_id, e.file, e.hash))) { noOriginal++; failedNames.push(`${e.name} (המקור לא נשמר)`); }
    }
    failedRef.current[p.folder] = failedNames;
    if (!halted) set(p.folder, { state: failed || noOriginal || stopRef.current ? (okFiles ? "warn" : "err") : "done", text: `${okFiles} קבצים נקלטו${failed ? `, ${failed} נכשלו` : ""}${noOriginal ? `, למקור לא נשמר: ${noOriginal}` : ""}${stopRef.current && failedNames.length > failed + noOriginal ? ", נעצר" : ""}` });
  }

  async function run() {
    if (!plans) return;
    const chosen = plans.filter((p) => p.include);
    stopRef.current = false; setStopping(false); failedRef.current = {};
    setBusy(true);
    setStats({ done: 0, total: chosen.reduce((a, p) => a + p.files.length, 0), started: Date.now() });
    setRows(chosen.map((p) => ({ folder: p.folder, state: "wait", text: "ממתין" })));
    let next = 0;
    const worker = async () => { while (!stopRef.current) { const i = next++; if (i >= chosen.length) break; await importPlan(chosen[i]); } };
    await Promise.all(Array.from({ length: Math.min(conc, chosen.length) }, worker));
    setBusy(false);
  }

  function stop() { stopRef.current = true; setStopping(true); }

  function downloadReport() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["תיקייה", "מצב", "קבצים שלא נקלטו"].map(esc).join(",")];
    for (const r of rows) lines.push([r.folder, r.text, (failedRef.current[r.folder] ?? []).join(" | ")].map(esc).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `import-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="ck-stack">
      <div className="ck-warn">הקריאה היא לקריאה בלבד: הקבצים בתיקייה לא משתנים ולא נמחקים. כל קובץ עובר הסתרת מידע מזהה ובדיקת ניגוד עניינים, והטקסט המוסתר הוא זה שמשמש לעבודה ולבינה מלאכותית. הקובץ המקורי נשמר בכספת התיק, פרטית ובלתי ניתנת לדריסה, עם חתימת SHA-256 ביומן. אל תמחקו את התיקייה המקורית לפני שוידאתם שהכול נקלט. תיקים סגורים חייבים להישמר לפי חוק לשכת עורכי הדין.</div>
      {!hasPicker && <div className="ck-err">הדפדפן אינו תומך בבחירת תיקייה. השתמשו ב-Chrome או Edge במחשב.</div>}
      <div className="ck-row"><button className="ck-btn primary" disabled={!hasPicker || busy} onClick={() => void pick()}>בחירת תיקייה</button>
        <label className="ck-row ck-meta">מה נחשב תיק:
          <select className="ck-select" style={{ width: "auto" }} value={level} disabled={busy} onChange={(e) => { const v = Number(e.target.value) as 1 | 2; setLevel(v); if (root) void scan(root, v); }}>
            <option value={1}>כל תיקייה ישירה היא תיק</option>
            <option value={2}>תיקיית לקוח ובתוכה תיקייה לכל תיק</option>
          </select></label>
        <span className="ck-meta">כל תיק נקלט בנפרד ולא מתערב באחר. תופיע רשימה לבדיקה לפני הייבוא.</span></div>
      {note && <div className="ck-meta" role="status">{note}</div>}
      {progress && <div className="ck-meta" role="status">{progress}</div>}
      {plans && plans.length > 0 && rows.length === 0 && (
        <>
          <div className="ck-label">נמצאו {plans.length} תיקיות. קבצים שכבר קיימים בכספת (לפי חתימת תוכן) ולא ייקלטו שוב, וקבצים כפולים בתוך התיקייה ידולגו. תיקייה שלפחות חצי מקבציה כבר בתיק קיים תתווסף לאותו תיק. תקנו כותרות שמכילות פרטים מזהים.</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>ייבוא</th><th>כותרת התיק</th><th>תחום</th><th>תיקייה</th><th>קבצים חדשים</th><th>כבר קיימים</th><th>כפולים בתיקייה</th><th>דולגו (סוג לא נתמך)</th></tr></thead><tbody>
            {plans.map((p) => (
              <tr key={p.folder}>
                <td><input type="checkbox" aria-label={`ייבוא ${p.folder}`} checked={p.include} disabled={p.files.length === 0} onChange={(e) => setPlans((ps) => ps?.map((x) => (x.folder === p.folder ? { ...x, include: e.target.checked } : x)) ?? ps)} /></td>
                <td style={{ minWidth: 240 }}>
                  {p.targetMatter
                    ? <span className="ck-badge yellow">{p.files.length ? `יתווסף לתיק קיים: ${p.targetTitle}` : `כבר קיים בתיק: ${p.targetTitle}`}</span>
                    : <input className="ck-input" value={p.title} onChange={(e) => setPlans((ps) => ps?.map((x) => (x.folder === p.folder ? { ...x, title: e.target.value } : x)) ?? ps)} />}
                </td>
                <td>{p.targetMatter ? "" : (
                  <select className="ck-select" aria-label={`תחום ${p.folder}`} value={p.practice} onChange={(e) => setPlans((ps) => ps?.map((x) => (x.folder === p.folder ? { ...x, practice: e.target.value } : x)) ?? ps)}>
                    <option value="">זיהוי אוטומטי</option>
                    {Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>)}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 260 }}>{p.folder}{p.flag && <div><span className="ck-badge yellow">{p.flag}</span></div>}<div className="ck-meta" dir="auto">{p.sample.join(" , ")}</div></td><td>{p.files.length}</td><td>{p.existing || ""}</td><td>{p.dupes || ""}</td><td>{p.skipped || ""}</td>
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
          <div className="ck-row"><button className="ck-btn primary" disabled={busy || !docType || !docOrigin || !plans.some((p) => p.include)} onClick={() => void run()}>ייבוא {plans.filter((p) => p.include).length} תיקים ({plans.filter((p) => p.include).reduce((a, p) => a + p.files.length, 0)} קבצים)</button>
            <label className="ck-row ck-meta">מהירות:
              <select className="ck-select" style={{ width: "auto" }} value={conc} onChange={(e) => setConc(Number(e.target.value))}>
                <option value={1}>רגילה (תיק אחד בכל פעם)</option><option value={3}>מהירה (שלושה תיקים במקביל)</option><option value={5}>מהירה מאוד (חמישה)</option>
              </select></label></div>
          {plans.filter((p) => p.include).length > 20 && <div className="ck-meta">ייבוא גדול: השאירו את הלשונית פתוחה והמחשב ער. אפשר לעצור בכל רגע ולהמשיך אחר כך באותה תיקייה: קבצים שכבר נקלטו לא ייקלטו שוב.</div>}
        </>
      )}
      {stats && rows.length > 0 && (() => {
        const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 100;
        const secs = (Date.now() - stats.started) / 1000;
        const eta = stats.done > 0 && busy ? Math.max(0, Math.round((secs / stats.done) * (stats.total - stats.done) / 60)) : 0;
        return (
          <div className="ck-stack" role="status">
            <div className="ck-meta">{stats.done} מתוך {stats.total} קבצים ({pct}%){busy && eta > 0 ? `, נותרו בערך ${eta} דקות` : ""}</div>
            <div className="ck-bar"><div style={{ width: `${pct}%` }} /></div>
            {busy && <div className="ck-row"><button className="ck-btn danger" disabled={stopping} onClick={stop}>{stopping ? "עוצר אחרי הקובץ הנוכחי..." : "עצירה"}</button></div>}
          </div>);
      })()}
      {rows.length > 0 && (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיקייה</th><th>מצב</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.folder}><td>{r.folder}</td><td><span className={`ck-badge ${r.state === "done" ? "green" : r.state === "err" ? "red" : "yellow"}`}>{r.text}</span></td></tr>)}
        </tbody></table></div>
      )}
      {!busy && rows.length > 0 && <div className="ck-row"><Link className="ck-btn primary" to="/workspace">לרשימת התיקים</Link><button className="ck-btn" onClick={downloadReport}>הורדת דוח</button></div>}
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
