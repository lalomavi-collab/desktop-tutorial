import { useMemo, useState } from "react";
import { calculateDeadline, VERIFIED_RULES } from "../../lib/cockpit/deadlines";
import type { Period } from "../../lib/cockpit/deadlines";
import { iso } from "../../lib/cockpit/crm";
import type { Milestone } from "../../lib/cockpit/crmDemo";

/**
 * Calculator mechanics with NO built-in law. Period length, recess dates and closed days are typed in by the attorney
 * until a rule is verified against two primary sources and added to VERIFIED_RULES. The screen says so.
 */
export function ProceduralDeadlinesTab({ milestones }: { milestones: Milestone[] }) {
  const [eventDate, setEventDate] = useState(iso(new Date()));
  const [days, setDays] = useState(30);
  const [countEventDay, setCountEventDay] = useState(false);
  const [roll, setRoll] = useState(true);
  const [rec, setRec] = useState<Period>({ from: "", to: "", label: "" });
  const [frozen, setFrozen] = useState<Period[]>([]);
  const [list, setList] = useState<Milestone[]>(milestones);

  const result = useMemo(() => calculateDeadline({ eventDate, days, frozen, rollForward: roll, closedWeekdays: roll ? [6] : [], closedDays: [], countEventDay }), [eventDate, days, frozen, roll, countEventDay]);
  const addRecess = () => { if (rec.from && rec.to && rec.to >= rec.from) { setFrozen((f) => [...f, { ...rec, label: rec.label || "תקופה מוקפאת" }]); setRec({ from: "", to: "", label: "" }); } };
  const save = () => setList((l) => [...l, { id: `ms-${l.length + 1}`, title: `מועד מחושב (${days} ימים)`, on: result.due, kind: "FILING", clientVisible: false }]);
  const toggle = (id: string) => setList((l) => l.map((x) => (x.id === id ? { ...x, clientVisible: !x.clientVisible } : x)));

  return (
    <section className="ck-card" aria-label="מועדים דיוניים">
      <div className="ck-card-head"><h3 className="ck-title">מחשבון מועדים</h3></div>
      <div className="crm-banner yellow" role="note">
        {VERIFIED_RULES.length === 0
          ? "הכללים המשפטיים (אורך התקופה, פגרות, ימי חג) טרם אומתו מול נוסח התקנות משני מקורות עצמאיים, ולכן אינם מובנים. הזינו אותם ידנית ואמתו לפני הסתמכות."
          : `${VERIFIED_RULES.length} כללים מאומתים זמינים.`}
      </div>
      <div className="ck-grid2">
        <label className="ck-field"><span className="ck-label">תאריך האירוע (מסירה)</span><input className="ck-input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label>
        <label className="ck-field"><span className="ck-label">מספר ימים</span><input className="ck-input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} /></label>
      </div>
      <div className="crm-actions" style={{ margin: "8px 0" }}>
        <label><input type="checkbox" checked={countEventDay} onChange={(e) => setCountEventDay(e.target.checked)} /> יום האירוע נספר</label>
        <label><input type="checkbox" checked={roll} onChange={(e) => setRoll(e.target.checked)} /> דחייה משבת ליום הפתוח הבא</label>
      </div>
      <div className="ck-grid2">
        <label className="ck-field"><span className="ck-label">תקופה מוקפאת: מ-</span><input className="ck-input" type="date" value={rec.from} onChange={(e) => setRec({ ...rec, from: e.target.value })} /></label>
        <label className="ck-field"><span className="ck-label">עד</span><input className="ck-input" type="date" value={rec.to} onChange={(e) => setRec({ ...rec, to: e.target.value })} /></label>
        <label className="ck-field"><span className="ck-label">תיאור</span><input className="ck-input" value={rec.label} onChange={(e) => setRec({ ...rec, label: e.target.value })} /></label>
        <div className="ck-field"><span className="ck-label">&nbsp;</span><button type="button" className="ck-btn" onClick={addRecess}>הוספת תקופה</button></div>
      </div>
      {frozen.length > 0 && <ul className="crm-list">{frozen.map((p, i) => <li key={i}><span>{p.label}: <span dir="ltr">{p.from} עד {p.to}</span></span><button type="button" className="ck-btn" onClick={() => setFrozen((f) => f.filter((_, k) => k !== i))}>הסרה</button></li>)}</ul>}

      <div className="crm-banner green" style={{ marginTop: 12 }}>המועד האחרון: <b dir="ltr">{result.due}</b></div>
      <ol className="ck-meta">{result.steps.map((s, i) => <li key={i}><span dir="ltr">{s.on}</span>: {s.note}</li>)}</ol>
      <button type="button" className="ck-btn primary" onClick={save}>שמירה כמועד בתיק</button>

      <h4 className="ck-title" style={{ marginTop: 16 }}>מועדי התיק</h4>
      <ul className="crm-list">
        {list.map((m) => (
          <li key={m.id}>
            <span><span dir="ltr">{m.on}</span> {m.title}{m.kind === "INTERNAL" && <span className="ck-badge"> פנימי</span>}</span>
            <label><input type="checkbox" checked={m.clientVisible} disabled={m.kind === "INTERNAL"} onChange={() => toggle(m.id)} /> הצג מועד זה בפורטל הלקוח</label>
          </li>
        ))}
      </ul>
    </section>
  );
}
