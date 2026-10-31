import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DOC_TYPE } from "../../lib/cockpit/docMeta";
import { PRACTICE } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { briefText, questionsFor, readMap, stepsFor, TOPICS } from "../../lib/cockpit/intakeBrief";
import type { Answers, Panel, Step } from "../../lib/cockpit/intakeBrief";
import "../../styles/cockpit-brief.css";

// The intake brief on top of a matter (see lib/cockpit/intakeBrief.ts): one topic per screen, one question at a time, so no
// window is crowded. Answers are closed choices kept in this browser only (keyed by document); nothing is sent or saved
// on the server in this first stage.
const key = (docId: string) => `ck-brief:${docId}`;
function loadAnswers(docId: string): Answers {
  try { const v = JSON.parse(localStorage.getItem(key(docId)) ?? "{}"); return v && typeof v === "object" ? (v as Answers) : {}; } catch { return {}; }
}

export function IntakeBrief({ matterId, doc, practiceArea, conflictStatus, onPanel, onClose }: { matterId: string; doc: MatterDoc; practiceArea: string; conflictStatus: string; onPanel: (p: Panel) => void; onClose: () => void }) {
  const input = useMemo(() => ({ text: doc.editor_content, practiceArea, docOrigin: doc.doc_origin, conflictStatus, findings: doc.analysis.findings ?? [] }), [doc, practiceArea, conflictStatus]);
  const map = useMemo(() => readMap(input), [input]);
  const qs = useMemo(() => questionsFor(input, map), [input, map]);
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(doc.id));
  const [step, setStep] = useState(0);
  const [qi, setQi] = useState(() => { const first = qs.findIndex((q) => !loadAnswers(doc.id)[q.id]); return first < 0 ? 0 : first; });
  const [note, setNote] = useState("");
  useEffect(() => { try { localStorage.setItem(key(doc.id), JSON.stringify(answers)); } catch { /* storage blocked: the brief still works for this visit */ } }, [doc.id, answers]);
  const steps = useMemo(() => stepsFor(input, map, answers, matterId), [input, map, answers, matterId]);
  const answered = qs.filter((q) => answers[q.id]).length;
  const q = qs[qi];

  function pick(id: string) {
    setAnswers((a) => ({ ...a, [q.id]: id }));
    if (qi < qs.length - 1) setQi(qi + 1);
  }
  async function act(s: Step) {
    if (s.action.kind === "panel") { onPanel(s.action.panel); return; }
    if (s.action.kind !== "copy") return;
    const text = briefText({ area: PRACTICE[practiceArea] ?? practiceArea, type: doc.doc_type ? DOC_TYPE[doc.doc_type] ?? null : null, file: doc.file_name }, map, qs, answers);
    try { await navigator.clipboard.writeText(text); setNote("הסיכום הועתק. אפשר להדביק אותו במייל או בהערה."); } catch { setNote("ההעתקה נחסמה בדפדפן. נסו שוב מחלון פעיל."); }
  }

  const rows: Array<[string, string]> = [
    ["המסמך", doc.file_name],
    ["מה זה", [doc.doc_type ? DOC_TYPE[doc.doc_type] : null, map.kind].filter(Boolean).join(", ") || "לא זוהה"],
    ["תחום", PRACTICE[practiceArea] ?? practiceArea],
    ["צדדים", map.parties ? `${map.parties} שמות, מוסתרים` : "לא זוהו שמות בטקסט"],
    ["מועדים", [...map.deadlines, ...map.dates].join(", ") || "לא נמצאו בטקסט"],
    ["סכומים", map.amounts.join(", ") || "לא נמצאו בטקסט"],
    ["ממצאי פלייבוק", `${map.red.length} בסיכון גבוה, ${map.yellow} לזהירות`],
  ];
  const tabs: Array<[number, string]> = [[0, "מה הבנו"], [1, `מה חסר לנו (${answered}/${qs.length})`], [2, "מה עושים עכשיו"]];

  return (
    <section className="ck-card ck-brief" aria-label="תדריך קליטה">
      <div className="ck-brief-head">
        <div><div className="ck-title">תדריך קליטה</div><div className="ck-meta">שלושה צעדים קצרים, כדי לדעת בדיוק מה לנתח בתיק.</div></div>
        <button type="button" className="ck-btn sm" onClick={onClose}>סגירה</button>
      </div>
      <div className="ck-brief-steps" role="tablist" aria-label="שלבי התדריך">
        {tabs.map(([n, label]) => (
          <button key={n} type="button" role="tab" aria-selected={step === n} className={`ck-brief-step${step === n ? " on" : ""}`} onClick={() => setStep(n)}>
            <span className="ck-brief-num" aria-hidden="true">{n + 1}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="ck-brief-body" role="tabpanel" aria-label="מה הבנו">
          <dl className="ck-brief-map">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {map.red.length > 0 && <div className="ck-meta">בסיכון גבוה: {map.red.slice(0, 3).join(", ")}</div>}
          <div className="ck-row"><button type="button" className="ck-btn primary" onClick={() => setStep(1)}>המשך לשאלות</button></div>
        </div>
      )}

      {step === 1 && q && (
        <div className="ck-brief-body" role="tabpanel" aria-label="מה חסר לנו">
          <div className="ck-meta" aria-live="polite">שאלה {qi + 1} מתוך {qs.length}</div>
          <div className="ck-brief-q">{q.ask}</div>
          {q.context && <div className="ck-brief-ctx">{q.context}</div>}
          <div className="ck-brief-why"><b>למה שואלים:</b> {q.why}</div>
          <div className="ck-brief-opts" role="group" aria-label={q.ask}>
            {q.options.map((o) => <button key={o.id} type="button" className="ck-brief-opt" aria-pressed={answers[q.id] === o.id} onClick={() => pick(o.id)}>{o.label}</button>)}
          </div>
          <div className="ck-row">
            <button type="button" className="ck-btn sm" disabled={qi === 0} onClick={() => setQi(qi - 1)}>לשאלה הקודמת</button>
            {qi < qs.length - 1 ? <button type="button" className="ck-btn sm" onClick={() => setQi(qi + 1)}>דילוג</button> : <button type="button" className="ck-btn primary sm" onClick={() => setStep(2)}>לצעדים המומלצים</button>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ck-brief-body" role="tabpanel" aria-label="מה עושים עכשיו">
          <div className="ck-brief-topics">
            {TOPICS.map(([t, label]) => {
              const items = steps.filter((s) => s.topic === t);
              return items.length > 0 && (
                <div key={t} className="ck-brief-topic">
                  <div className="ck-label">{label}</div>
                  <ul role="list">
                    {items.map((s) => (
                      <li key={s.id}>
                        <span><b>{s.title}</b><small>{s.when}</small></span>
                        {s.action.kind === "go" ? <Link className="ck-btn sm" to={s.action.to}>פתיחה</Link> : <button type="button" className="ck-btn sm" onClick={() => void act(s)}>{s.action.kind === "copy" ? "העתקה" : "פתיחה"}</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {note && <div className="ck-meta" role="status">{note}</div>}
        </div>
      )}

      <div className="ck-meta ck-brief-foot">הניתוח רץ בדפדפן על הטקסט המוסתר וממצאי הפלייבוק. התשובות נשמרות בדפדפן הזה בלבד, ושום דבר לא נשלח החוצה.</div>
    </section>
  );
}
