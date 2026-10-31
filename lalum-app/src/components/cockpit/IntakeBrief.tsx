import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DOC_TYPE } from "../../lib/cockpit/docMeta";
import { fmt, PRACTICE } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { briefText, mergeQuestions, questionsFor, readMap, stepsFor, TOPICS } from "../../lib/cockpit/intakeBrief";
import type { Answers, Panel, Step } from "../../lib/cockpit/intakeBrief";
import { loadMatterMap, loadServerAnswers, runMatterMap, saveServerAnswer } from "../../lib/cockpit/matterBrief";
import type { MapResult } from "../../lib/cockpit/matterBrief";
import "../../styles/cockpit-brief.css";

// The intake brief on top of a matter (see lib/cockpit/intakeBrief.ts): one topic per screen, one question at a time, so no
// window is crowded. The local reading runs in the browser on the selected document; the matter map is the deep reading of
// every document (edge function lalum-matter-brief), made only when the lawyer asks for it and cached on the server.
// Answers are closed choices, saved on the matter when the server accepts them and in this browser in any case.
const key = (docId: string) => `ck-brief:${docId}`;
function loadAnswers(docId: string): Answers {
  try { const v = JSON.parse(localStorage.getItem(key(docId)) ?? "{}"); return v && typeof v === "object" ? (v as Answers) : {}; } catch { return {}; }
}
type Sub = "facts" | "risks" | "timeline";
const SEV: Record<string, [string, string]> = { high: ["red", "סיכון גבוה"], medium: ["yellow", "זהירות"], low: ["green", "נמוך"] };
const SIDE: Record<string, string> = { client: "של הלקוח", adverse: "של הצד שכנגד", neutral: "" };

export function IntakeBrief({ matterId, doc, docs, practiceArea, conflictStatus, onPanel, onClose }: { matterId: string; doc: MatterDoc; docs: Array<{ id: string; file_name: string }>; practiceArea: string; conflictStatus: string; onPanel: (p: Panel) => void; onClose: () => void }) {
  const input = useMemo(() => ({ text: doc.editor_content, practiceArea, docOrigin: doc.doc_origin, conflictStatus, findings: doc.analysis.findings ?? [] }), [doc, practiceArea, conflictStatus]);
  const map = useMemo(() => readMap(input), [input]);
  const [mm, setMm] = useState<MapResult | null>(null);
  const [mmBusy, setMmBusy] = useState(false);
  const [mmErr, setMmErr] = useState("");
  const [sub, setSub] = useState<Sub>("facts");
  const qs = useMemo(() => mergeQuestions(questionsFor(input, map), mm?.map.questions ?? []), [input, map, mm]);
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(doc.id));
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [qi, setQi] = useState(() => { const first = qs.findIndex((q) => !loadAnswers(doc.id)[q.id]); return first < 0 ? 0 : first; });
  const [note, setNote] = useState("");
  useEffect(() => { try { localStorage.setItem(key(doc.id), JSON.stringify(answers)); } catch { /* storage blocked: the brief still works for this visit */ } }, [doc.id, answers]);
  useEffect(() => {
    let live = true;
    void loadServerAnswers(matterId).then((a) => { if (!live) return; setServerOk(a !== null); if (a) setAnswers((x) => ({ ...x, ...a })); });
    void loadMatterMap(matterId).then((r) => { if (live && r) setMm(r); });
    return () => { live = false; };
  }, [matterId]);
  const steps = useMemo(() => stepsFor(input, map, answers, matterId, mm?.map.gaps.length ?? 0), [input, map, answers, matterId, mm]);
  const answered = qs.filter((q) => answers[q.id]).length;
  const q = qs[Math.min(qi, qs.length - 1)];
  const stale = !!mm && (mm.docIds.length !== docs.length || docs.some((d) => !mm.docIds.includes(d.id)));
  const docLabel = (n: number) => docs.find((d) => d.id === mm?.docIds[n - 1])?.file_name ?? (n ? `מסמך ${n}` : "");

  function pick(id: string) {
    setAnswers((a) => ({ ...a, [q.id]: id }));
    void saveServerAnswer(matterId, q.id, id).then(setServerOk);
    if (qi < qs.length - 1) setQi(qi + 1);
  }
  async function runMap(refresh: boolean) {
    setMmBusy(true); setMmErr("");
    const r = await runMatterMap(matterId, refresh);
    setMmBusy(false);
    if (r.ok) setMm(r.result); else setMmErr(r.error);
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
  const tabs: Array<[number, string]> = [[0, "מה הבנו"], [1, "מפת התיק"], [2, `מה חסר לנו (${answered}/${qs.length})`], [3, "מה עושים עכשיו"]];
  const subs: Array<[Sub, string, number]> = mm ? [["facts", "עובדות וטענות", mm.map.facts.length], ["risks", "סיכונים ופערים", mm.map.risks.length + mm.map.gaps.length], ["timeline", "ציר זמן", mm.map.timeline.length]] : [];
  const Quote = ({ n, text, ok }: { n: number; text: string; ok: boolean }) => (
    <div className="ck-brief-src">
      {text && <q className="ck-brief-quote">{text}</q>}
      <span className="ck-meta">{docLabel(n)}{!ok && <span className="ck-badge yellow">הציטוט לא אומת מול המסמך</span>}</span>
    </div>
  );

  return (
    <section className="ck-card ck-brief" aria-label="תדריך קליטה">
      <div className="ck-brief-head">
        <div><div className="ck-title">תדריך קליטה</div><div className="ck-meta">צעדים קצרים, נושא אחד בכל מסך, כדי לדעת בדיוק מה לנתח בתיק.</div></div>
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
          <div className="ck-row"><button type="button" className="ck-btn primary" onClick={() => setStep(1)}>המשך למפת התיק</button></div>
        </div>
      )}

      {step === 1 && (
        <div className="ck-brief-body" role="tabpanel" aria-label="מפת התיק">
          {!mm ? (
            <>
              <div className="ck-meta">ניתוח עומק של כל מסמכי התיק ({docs.length}): עובדות וטענות, סיכונים ופערים, וציר זמן. כל פריט נשען על ציטוט מהמסמך, והמערכת בודקת שהציטוט באמת מופיע בו. הטקסט המוסתר עובר דרך שער ההסתרה. הניתוח לוקח כדקה.</div>
              <div className="ck-row"><button type="button" className="ck-btn primary" disabled={mmBusy} onClick={() => void runMap(false)}>{mmBusy ? "מנתח את התיק..." : "ניתוח עומק של התיק"}</button><button type="button" className="ck-btn" onClick={() => setStep(2)}>דילוג לשאלות</button></div>
            </>
          ) : (
            <>
              {mm.map.summary && <p className="ck-brief-summary">{mm.map.summary}</p>}
              {stale && <div className="ck-warn">נוספו מסמכים לתיק מאז הניתוח. <button type="button" className="ck-link" disabled={mmBusy} onClick={() => void runMap(true)}>{mmBusy ? "מנתח..." : "ניתוח מחדש"}</button></div>}
              <div className="fin-seg" role="group" aria-label="נושא במפת התיק">
                {subs.map(([k, label, n]) => <button key={k} type="button" aria-pressed={sub === k} onClick={() => setSub(k)}>{label} ({n})</button>)}
              </div>
              {sub === "facts" && (mm.map.facts.length ? <ul className="ck-brief-list" role="list">{mm.map.facts.map((f, i) => (
                <li key={i}><span className="ck-meta">{f.kind === "claim" ? `טענה ${SIDE[f.side] ?? ""}` : "עובדה"}</span><span>{f.text}</span><Quote n={f.doc} text={f.quote} ok={f.quote_ok} /></li>
              ))}</ul> : <div className="ck-meta">לא זוהו עובדות או טענות.</div>)}
              {sub === "risks" && (
                <>
                  {mm.map.risks.length > 0 && <ul className="ck-brief-list" role="list">{mm.map.risks.map((r, i) => (
                    <li key={i}><span className={`ck-badge ${(SEV[r.severity] ?? SEV.medium)[0]} dot`}>{(SEV[r.severity] ?? SEV.medium)[1]}</span><span>{r.text}</span><Quote n={r.doc} text={r.quote} ok={r.quote_ok} /></li>
                  ))}</ul>}
                  {mm.map.gaps.length > 0 && <><div className="ck-label">מה חסר בתיק</div><ul className="ck-brief-list" role="list">{mm.map.gaps.map((g, i) => (
                    <li key={i}><span>{g.text}</span><span className="ck-meta"><b>למה זה חשוב:</b> {g.why}</span></li>
                  ))}</ul></>}
                  {!mm.map.risks.length && !mm.map.gaps.length && <div className="ck-meta">לא זוהו סיכונים או פערים.</div>}
                </>
              )}
              {sub === "timeline" && (mm.map.timeline.length ? <ol className="ck-brief-list ck-brief-tl">{mm.map.timeline.map((t, i) => (
                <li key={i}><b>{t.date}</b><span>{t.event}</span><Quote n={t.doc} text={t.quote} ok={t.quote_ok} /></li>
              ))}</ol> : <div className="ck-meta">לא נמצאו אירועים עם תאריך.</div>)}
              <div className="ck-meta">נותח {fmt(mm.createdAt)}{mm.map.truncated ? ". מסמכים ארוכים קוצרו לניתוח" : ""}. <button type="button" className="ck-link" disabled={mmBusy} onClick={() => void runMap(true)}>{mmBusy ? "מנתח..." : "ניתוח מחדש"}</button></div>
              <div className="ck-row"><button type="button" className="ck-btn primary" onClick={() => setStep(2)}>המשך לשאלות</button></div>
            </>
          )}
          {mmErr && <div className="ck-err" role="status">{mmErr}</div>}
        </div>
      )}

      {step === 2 && q && (
        <div className="ck-brief-body" role="tabpanel" aria-label="מה חסר לנו">
          <div className="ck-meta" aria-live="polite">שאלה {qs.indexOf(q) + 1} מתוך {qs.length}{q.id.startsWith("ai_") && <span className="ck-chip">מהניתוח העמוק</span>}</div>
          <div className="ck-brief-q">{q.ask}</div>
          {q.context && <div className="ck-brief-ctx">{q.context}</div>}
          <div className="ck-brief-why"><b>למה שואלים:</b> {q.why}</div>
          <div className="ck-brief-opts" role="group" aria-label={q.ask}>
            {q.options.map((o) => <button key={o.id} type="button" className="ck-brief-opt" aria-pressed={answers[q.id] === o.id} onClick={() => pick(o.id)}>{o.label}</button>)}
          </div>
          <div className="ck-row">
            <button type="button" className="ck-btn sm" disabled={qi === 0} onClick={() => setQi(qi - 1)}>לשאלה הקודמת</button>
            {qi < qs.length - 1 ? <button type="button" className="ck-btn sm" onClick={() => setQi(qi + 1)}>דילוג</button> : <button type="button" className="ck-btn primary sm" onClick={() => setStep(3)}>לצעדים המומלצים</button>}
          </div>
        </div>
      )}

      {step === 3 && (
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

      <div className="ck-meta ck-brief-foot">{serverOk ? "התשובות נשמרות בתיק ומשותפות לצוות." : "התשובות נשמרות בדפדפן הזה."} הניתוח המקומי רץ בדפדפן על הטקסט המוסתר. ניתוח העומק עובר דרך שער ההסתרה ונשמר בתיק.</div>
    </section>
  );
}
