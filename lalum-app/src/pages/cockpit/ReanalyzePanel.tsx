import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { callPipeline, errorText, PRACTICE } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { eligibleDocs, reanalyzeDocs, type Analysis } from "../../lib/cockpit/reanalyze";

/** Partner only. Runs the matter's documents again under a chosen practice area and stores the results (migration 0046).
    The risk summary of the matter follows by itself (migration 0042). Nothing here changes document text. */
export function ReanalyzePanel({ matterId, practiceArea, docs, onDone }: { matterId: string; practiceArea: string; docs: MatterDoc[]; onDone: () => void }) {
  const [area, setArea] = useState(practiceArea);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const todo = eligibleDocs(docs);
  const left = docs.length - todo.length;

  async function run() {
    if (!supabase || busy) return;
    if (!window.confirm(`לנתח מחדש ${todo.length} מסמכים לפי התחום "${PRACTICE[area] ?? area}"?\nהניתוח הקודם של המסמכים האלה יוחלף, וסיכום הסיכון של התיק יתעדכן. הטקסט לא משתנה, והפעולה נרשמת ביומן.`)) return;
    setMsg(""); setBusy(`0/${todo.length}`);
    const res = await reanalyzeDocs(
      todo, area,
      async (text, a) => { const r = await callPipeline("/api/v1/documents/analyze", { text, practice_area: a }); return r.ok && r.risk ? { ok: true, analysis: { findings: r.findings ?? [], risk: r.risk } as Analysis } : { ok: false, error: errorText(r) }; },
      async (id, analysis, a) => { const { error } = await supabase!.rpc("lalum_document_set_analysis", { p_doc: id, p_analysis: analysis, p_area: a }); return error ? { ok: false, error: "השמירה נכשלה: אין הרשאה או שנדרש אימות דו שלבי." } : { ok: true }; },
      (n, t) => setBusy(`${n}/${t}`),
    );
    let areaErr = "";
    if (res.failed.length === 0 && area !== practiceArea) {
      const { error } = await supabase.rpc("lalum_matter_set_practice", { p_matter: matterId, p_area: area });
      if (error) areaErr = " תחום התיק עצמו לא עודכן.";
    }
    setBusy(null);
    setMsg(res.failed.length === 0
      ? `נותחו מחדש ${res.done.length} מסמכים לפי "${PRACTICE[area] ?? area}".${areaErr}`
      : `נותחו ${res.done.length}. לא נותחו ${res.failed.length} (מסמכים מספר ${res.failed.slice(0, 10).map((f) => docs.findIndex((d) => d.id === f.id) + 1).join(", ")} ברשימת המסמכים): ${[...new Set(res.failed.map((f) => f.error))].slice(0, 3).join("; ")}. תחום התיק לא שונה.`);
    onDone();
  }

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>ניתוח מחדש של כל המסמכים לפי תחום</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">הכללים נבחרים לפי התחום. מסמכים מסוג חוזה, כתב בי דין או ללא סוג נבדקים ({todo.length}); חוות דעת, התכתבות, ראיות ומקורות סמכות נשארים כפי שהם ({left}).</div>
        <label className="ck-field">תחום הניתוח
          <select className="ck-select" value={area} disabled={busy !== null} onChange={(e) => setArea(e.target.value)}>
            {Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="ck-row">
          <button className="ck-btn primary" disabled={busy !== null || todo.length === 0} onClick={() => void run()}>הרצה מחדש</button>
          {busy && <span className="ck-meta" role="status">מנתח {busy}...</span>}
        </div>
        {msg && <div className="ck-meta" role="status">{msg}</div>}
      </div>
    </details>
  );
}
