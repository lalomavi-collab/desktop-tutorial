import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateDeadline, VERIFIED_RULES } from "../../lib/cockpit/deadlines";
import type { Period } from "../../lib/cockpit/deadlines";
import { iso } from "../../lib/cockpit/crm";
import { DEADLINE_KINDS, DEADLINE_KIND_LABEL, DEADLINE_STATUS_LABEL, calcNote, deadlineError, sortDeadlines } from "../../lib/cockpit/matter360Core";
import type { DeadlineRow } from "../../lib/cockpit/matter360Core";
import { addDeadline, loadDeadlines, updateDeadline } from "../../lib/cockpit/matter360";

/**
 * Calculator mechanics with NO built-in law. Period length, recess dates and closed days are typed in by the attorney
 * until a rule is verified against two primary sources and added to VERIFIED_RULES. The screen says so.
 * A saved deadline is a row in lalum_deadlines (it survives a refresh), with the way it was counted in source_note.
 */
export function ProceduralDeadlinesTab({ matterId }: { matterId: string }) {
  const [eventDate, setEventDate] = useState(iso(new Date()));
  const [days, setDays] = useState(30);
  const [countEventDay, setCountEventDay] = useState(false);
  const [roll, setRoll] = useState(true);
  const [rec, setRec] = useState<Period>({ from: "", to: "", label: "" });
  const [frozen, setFrozen] = useState<Period[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("FILING");
  const [dueOverride, setDueOverride] = useState<string | null>(null);
  const [list, setList] = useState<DeadlineRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);

  const result = useMemo(() => calculateDeadline({ eventDate, days, frozen, rollForward: roll, closedWeekdays: roll ? [6] : [], closedDays: [], countEventDay }), [eventDate, days, frozen, roll, countEventDay]);
  const due = dueOverride ?? result.due;
  const show = useCallback((r: { rows: DeadlineRow[]; error: string | null }) => {
    setList(sortDeadlines(r.rows));
    if (r.error) setMsg({ tone: "red", text: r.error });
  }, []);
  const reload = async () => show(await loadDeadlines(matterId));
  useEffect(() => {
    let on = true;
    void loadDeadlines(matterId).then((r) => { if (on) show(r); });
    return () => { on = false; };
  }, [matterId, show]);

  const addRecess = () => { if (rec.from && rec.to && rec.to >= rec.from) { setFrozen((f) => [...f, { ...rec, label: rec.label || "תקופה מוקפאת" }]); setRec({ from: "", to: "", label: "" }); } };
  const save = async () => {
    const t = title.trim() || `מועד מחושב (${days} ימים)`;
    const bad = deadlineError(t, due, kind);
    if (bad) { setMsg({ tone: "red", text: bad }); return; }
    setBusy(true);
    const err = await addDeadline(matterId, { title: t, kind, due_date: due, source_note: calcNote({ eventDate, days, countEventDay, rollForward: roll, frozen, computedDue: result.due, due }) });
    setBusy(false);
    if (err) { setMsg({ tone: "red", text: err }); return; }
    setMsg({ tone: "green", text: `המועד ${due} נשמר בתיק.` });
    setTitle("");
    setDueOverride(null);
    await reload();
  };
  const change = async (id: string, patch: { status?: string; is_client_visible?: boolean }) => {
    setBusy(true);
    const err = await updateDeadline(id, patch);
    setBusy(false);
    setMsg(err ? { tone: "red", text: err } : null);
    await reload();
  };

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

      <div className="crm-banner green" style={{ marginTop: 12 }}>המועד האחרון לפי המחשבון: <b dir="ltr">{result.due}</b></div>
      <ol className="ck-meta">{result.steps.map((s, i) => <li key={i}><span dir="ltr">{s.on}</span>: {s.note}</li>)}</ol>

      <h4 className="ck-title" style={{ marginTop: 16 }}>שמירה כמועד בתיק</h4>
      <div className="ck-grid2">
        <label className="ck-field"><span className="ck-label">כותרת</span><input className="ck-input" maxLength={255} placeholder={`מועד מחושב (${days} ימים)`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="ck-field"><span className="ck-label">תאריך המועד</span><input className="ck-input" type="date" value={due} onChange={(e) => setDueOverride(e.target.value === result.due ? null : e.target.value)} /></label>
        <label className="ck-field"><span className="ck-label">סוג</span>
          <select className="ck-input" value={kind} onChange={(e) => setKind(e.target.value)}>{DEADLINE_KINDS.map((k) => <option key={k} value={k}>{DEADLINE_KIND_LABEL[k]}</option>)}</select>
        </label>
        <div className="ck-field"><span className="ck-label">&nbsp;</span><button type="button" className="ck-btn primary" disabled={busy} onClick={() => void save()}>{busy ? "שומר..." : "שמירה כמועד בתיק"}</button></div>
      </div>
      {dueOverride && <div className="ck-meta">התאריך שונה ידנית מהצעת המחשבון, וכך זה יירשם במועד.</div>}
      {msg && <div className={`crm-banner ${msg.tone}`} role={msg.tone === "red" ? "alert" : "status"} style={{ marginTop: 8 }}>{msg.text}</div>}

      <h4 className="ck-title" style={{ marginTop: 16 }}>מועדי התיק</h4>
      {list === null ? <div className="ck-meta">טוען...</div> : list.length === 0 ? <div className="ck-empty">אין מועדים שמורים בתיק.</div> : (
        <ul className="crm-list">
          {list.map((m) => (
            <li key={m.id}>
              <span><span dir="ltr">{m.due_date}</span> {m.title} <span className="ck-badge">{DEADLINE_KIND_LABEL[m.kind] ?? m.kind}</span>{m.status !== "PENDING" && <span className="ck-badge green"> {DEADLINE_STATUS_LABEL[m.status] ?? m.status}</span>}
                {m.source_note && <div className="ck-meta">{m.source_note}</div>}</span>
              <span className="crm-actions">
                <label><input type="checkbox" checked={m.is_client_visible} disabled={busy || m.kind === "INTERNAL"} onChange={() => void change(m.id, { is_client_visible: !m.is_client_visible })} /> הצג בפורטל הלקוח</label>
                {m.status === "PENDING" && <button type="button" className="ck-btn" disabled={busy} onClick={() => void change(m.id, { status: "DONE" })}>סימון כבוצע</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
