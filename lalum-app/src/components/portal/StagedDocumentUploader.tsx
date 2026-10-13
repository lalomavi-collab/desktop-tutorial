import { useRef, useState } from "react";
import { iso } from "../../lib/cockpit/crm";
import type { StagedDoc } from "../../lib/cockpit/crmDemo";

const BADGE: Record<StagedDoc["status"], [string, string]> = {
  PENDING_REVIEW: ["yellow", "ממתין לבדיקת עו״ד"],
  APPROVED: ["green", "אושר ותויק בתיק"],
  REVISION: ["red", "נדרש תיקון או העלאה חוזרת"],
};
const MAX_MB = 25;

/** Drag and drop plus a keyboard-reachable button. In demo mode the file never leaves the browser. */
export function StagedDocumentUploader({ docs, onChange }: { docs: StagedDoc[]; onChange: (d: StagedDoc[]) => void }) {
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) => {
    if (!files) return;
    const next: StagedDoc[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_MB * 1048576) { setErr(`הקובץ ${f.name} גדול מ-${MAX_MB}MB.`); continue; }
      next.push({ id: `up-${Date.now()}-${next.length}`, name: f.name, uploadedOn: iso(new Date()), status: "PENDING_REVIEW" });
    }
    if (next.length) { setErr(""); onChange([...next, ...docs]); }
  };
  return (
    <section aria-label="העלאת מסמכים" className="ck-stack">
      <h3 className="ck-title">מסמכים</h3>
      <div className={`crm-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <p>גררו קבצים לכאן</p>
        <button type="button" className="ck-btn primary" onClick={() => input.current?.click()}>בחירת קבצים</button>
        <input ref={input} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      {err && <div className="ck-err" role="alert">{err}</div>}
      <ul className="crm-list">
        {docs.map((d) => { const [tone, label] = BADGE[d.status]; return (
          <li key={d.id}><span>{d.name}</span><span><span className={`ck-badge ${tone}`}>{label}</span>{d.status === "REVISION" && d.note && <div className="ck-meta">הערת עו״ד: {d.note}</div>}</span></li>
        ); })}
      </ul>
    </section>
  );
}
