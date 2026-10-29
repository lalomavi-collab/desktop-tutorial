import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { callPipeline, errorText, PRACTICE } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { DOC_TYPE } from "../../lib/cockpit/docMeta";
import { buildPlan, countByType, isAssessed, reanalyzePlan, UNTYPED, type Analysis } from "../../lib/cockpit/reanalyze";

/** Partner or firm admin (both pass lalum_mgr_ok on the server). Runs documents again under a practice area chosen per document type or per document, and stores the
    results (migration 0046). A choice on a document wins over the choice for its type; "ללא שינוי" leaves a document as it is.
    Only contracts, court filings and untyped documents feed the risk summary of the matter (migration 0042); the others
    are analysed and stored but do not change it. Nothing here changes document text or the matter's own practice area. */
export function ReanalyzePanel({ matterId, practiceArea, docs, onDone }: { matterId: string; practiceArea: string; docs: MatterDoc[]; onDone: () => void }) {
  const [typeAreas, setTypeAreas] = useState<Record<string, string>>({});
  const [docAreas, setDocAreas] = useState<Record<string, string>>({});
  const [setMatterArea, setSetMatterArea] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const types = useMemo(() => countByType(docs), [docs]);
  const plan = useMemo(() => buildPlan(docs, typeAreas, docAreas), [docs, typeAreas, docAreas]);
  const perArea = useMemo(() => { const m = new Map<string, number>(); for (const p of plan) m.set(p.area, (m.get(p.area) ?? 0) + 1); return [...m.entries()]; }, [plan]);
  const label = (t: string) => (t === UNTYPED ? "ללא סוג" : DOC_TYPE[t] ?? t);
  const AreaSelect = ({ value, onChange, label: l }: { value: string; onChange: (v: string) => void; label: string }) => (
    <select className="ck-select" style={{ width: "auto" }} aria-label={l} value={value} disabled={busy !== null} onChange={(e) => onChange(e.target.value)}>
      <option value="">ללא שינוי</option>
      {Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );

  async function run() {
    if (!supabase || busy || plan.length === 0) return;
    const summary = perArea.map(([a, n]) => `${n} לפי "${PRACTICE[a] ?? a}"`).join(", ");
    if (!window.confirm(`לנתח מחדש ${plan.length} מסמכים: ${summary}?\nהניתוח הקודם של המסמכים האלה יוחלף, וסיכום הסיכון של התיק יתעדכן. הטקסט לא משתנה, והפעולה נרשמת ביומן.`)) return;
    setMsg(""); setBusy(`0/${plan.length}`);
    const res = await reanalyzePlan(
      plan,
      async (text, a) => { const r = await callPipeline("/api/v1/documents/analyze", { text, practice_area: a }); return r.ok && r.risk ? { ok: true, analysis: { practice_area: a, findings: r.findings ?? [], risk: r.risk } as Analysis } : { ok: false, error: errorText(r) }; },
      async (id, analysis, a) => { const { error } = await supabase!.rpc("lalum_document_set_analysis", { p_doc: id, p_analysis: analysis, p_area: a }); return error ? { ok: false, error: "השמירה נכשלה: אין הרשאה או שנדרש אימות דו שלבי." } : { ok: true }; },
      (n, t) => setBusy(`${n}/${t}`),
    );
    let areaErr = "";
    if (res.failed.length === 0 && setMatterArea && setMatterArea !== practiceArea) {
      const { error } = await supabase.rpc("lalum_matter_set_practice", { p_matter: matterId, p_area: setMatterArea });
      if (error) areaErr = " תחום התיק עצמו לא עודכן.";
    }
    setBusy(null);
    setMsg(res.failed.length === 0
      ? `נותחו מחדש ${res.done.length} מסמכים.${areaErr}`
      : `נותחו ${res.done.length}. לא נותחו ${res.failed.length} (מסמכים מספר ${res.failed.slice(0, 10).map((f) => docs.findIndex((d) => d.id === f.id) + 1).join(", ")} ברשימת המסמכים): ${[...new Set(res.failed.map((f) => f.error))].slice(0, 3).join("; ")}. תחום התיק לא שונה.`);
    onDone();
  }

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>ניתוח מחדש לפי תחום, לפי סוג מסמך או לפי מסמך</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">בחרו תחום לכל סוג מסמך, ואם צריך תחום אחר למסמך מסוים, בחרו אותו ברשימה למטה (בחירה על מסמך גוברת). מה שנשאר "ללא שינוי" לא נוגע. רק חוזים, כתבי בי דין ומסמכים בלי סוג משפיעים על סיכום הסיכון של התיק.</div>
        <div className="ck-label">לפי סוג מסמך</div>
        {types.map(([t, n]) => (
          <div key={t || "none"} className="ck-row">
            <span className="ck-chip">{label(t)} ({n}){isAssessed(t || null) ? "" : " · לא נספר בסיכון התיק"}</span>
            <AreaSelect label={`תחום ל${label(t)}`} value={typeAreas[t] ?? ""} onChange={(v) => setTypeAreas((s) => ({ ...s, [t]: v }))} />
          </div>))}
        <details>
          <summary className="ck-meta">לפי מסמך ({docs.length})</summary>
          <div className="ck-stack" style={{ marginTop: 8 }}>
            {docs.map((d, i) => (
              <div key={d.id} className="ck-row" style={{ flexWrap: "nowrap" }}>
                <span className="ck-meta" style={{ minWidth: 0, flex: 1 }}>מסמך {i + 1} · {label(d.doc_type ?? UNTYPED)} · נותח לפי: {d.analysis.practice_area ? PRACTICE[d.analysis.practice_area] ?? d.analysis.practice_area : "לא ידוע"}</span>
                <AreaSelect label={`תחום למסמך ${i + 1}`} value={docAreas[d.id] ?? ""} onChange={(v) => setDocAreas((s) => ({ ...s, [d.id]: v }))} />
              </div>))}
          </div>
        </details>
        <label className="ck-field">תחום התיק עצמו (לא חובה)
          <select className="ck-select" style={{ width: "auto" }} value={setMatterArea} disabled={busy !== null} onChange={(e) => setSetMatterArea(e.target.value)}>
            <option value="">ללא שינוי ({PRACTICE[practiceArea] ?? practiceArea})</option>
            {Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="ck-row">
          <button className="ck-btn primary" disabled={busy !== null || plan.length === 0} onClick={() => void run()}>הרצה מחדש ({plan.length} מסמכים)</button>
          {busy && <span className="ck-meta" role="status">מנתח {busy}...</span>}
        </div>
        {msg && <div className="ck-meta" role="status">{msg}</div>}
      </div>
    </details>
  );
}
