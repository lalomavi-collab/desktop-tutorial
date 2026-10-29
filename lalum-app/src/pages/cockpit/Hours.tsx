import { Fragment, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useClientNames } from "../../components/cockpit/ClientNames";
import { money } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { FEE_MODEL_LABEL, TIME_STATUS_LABEL } from "../../lib/cockpit/matter360Core.ts";
import { billableFor, buildHoursDemo, flags, fmtHM, fmtPct, HOURS_DEMO_NOTE, isoDay, monthRange, ratios, totals } from "../../lib/cockpit/hoursIndexCore.ts";
import * as api from "../../lib/cockpit/hoursIndex";
import type { Entry, MatterOption, Session, Timer } from "../../lib/cockpit/hoursIndex";
import { CockpitFrame } from "./CockpitFrame";

const fmtTime = (iso: string): string => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const minutesBetween = (a: string, b: string | null, now: number): number => Math.max(0, Math.floor(((b ? new Date(b).getTime() : now) - new Date(a).getTime()) / 60000));
const toLocalInput = (iso: string): string => { const d = new Date(iso); return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), everyMs); return () => window.clearInterval(i); }, [everyMs]);
  return now;
}

function Note({ m }: { m: { ok: boolean; text: string } | null }) {
  return m ? <div className={m.ok ? "ck-ok" : "ck-err"} aria-live="polite">{m.text}</div> : null;
}

/** The attendance clock: one button, the open session, and the last sessions of the month. */
function ClockCard({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const now = useNow();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(0);
  useEffect(() => {
    let on = true;
    (async () => { const s = await api.loadSessions(`${monthRange(new Date()).from}T00:00:00`, userId); if (on) setSessions(s); })();
    return () => { on = false; };
  }, [userId, v]);
  const open = sessions.find((s) => !s.clock_out) ?? null;
  const month = sessions.reduce((a, s) => a + (s.clock_out ? minutesBetween(s.clock_in, s.clock_out, now) : 0), 0);
  async function punch() {
    setBusy(true);
    const err = await (open ? api.clockOut() : api.clockIn());
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: open ? "נרשמה יציאה." : "נרשמה כניסה." });
    setV((x) => x + 1);
    if (!err) onChanged();
  }
  return (
    <div className="ck-card">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="ck-title">שעון נוכחות</div>
          <div className="ck-meta">{open ? <>בעבודה מאז {fmtTime(open.clock_in)} · {fmtHM(minutesBetween(open.clock_in, null, now))} שעות</> : "לא מחותם כרגע."} · החודש: {fmtHM(month)} שעות נוכחות</div>
        </div>
        <button className={`ck-btn${open ? "" : " primary"}`} disabled={busy} onClick={() => void punch()}>{open ? "החתמת יציאה" : "החתמת כניסה"}</button>
      </div>
      <Note m={msg} />
      {sessions.length > 0 && (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>כניסה</th><th>יציאה</th><th>משך</th><th>הערה</th></tr></thead><tbody>
          {sessions.slice(0, 6).map((s) => <tr key={s.id}><td>{fmtTime(s.clock_in)}</td><td>{s.clock_out ? fmtTime(s.clock_out) : "פתוחה"}</td><td>{fmtHM(minutesBetween(s.clock_in, s.clock_out, now))}</td><td>{s.adjust_reason ? `תוקן על ידי שותף: ${s.adjust_reason}` : ""}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}

/** Time on matters: the running timer, a manual entry, and the person's own recent entries. */
function MyWork({ firmId, userId, onChanged }: { firmId: string; userId: string; onChanged: () => void }) {
  const { name } = useClientNames();
  const now = useNow(15000);
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matter, setMatter] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [mins, setMins] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    let on = true;
    (async () => { const [t, e] = await Promise.all([api.loadTimer(userId), api.loadEntries(userId)]); if (on) { setTimer(t); setEntries(e); } })();
    return () => { on = false; };
  }, [userId, v]);
  useEffect(() => {
    let on = true;
    (async () => { const m = await api.loadMatters(); if (on) { setMatters(m); setMatter((cur) => cur || m[0]?.matter_id || ""); } })();
    return () => { on = false; };
  }, []);
  const label = (id: string) => { const m = matters.find((x) => x.matter_id === id); return m ? name(m) : "תיק"; };
  const done = (err: string | null, ok: string) => { setMsg(err ? { ok: false, text: err } : { ok: true, text: ok }); setV((x) => x + 1); if (!err) onChanged(); };
  const worked = Math.floor(Number(mins));
  return (
    <>
      <div className="ck-label">זמן על תיקים</div>
      <div className="ck-card">
        {timer ? (
          <div className="ck-stack">
            <div className="ck-row" style={{ justifyContent: "space-between" }}>
              <div><div className="ck-title">טיימר רץ: {label(timer.matter_id)}</div><div className="ck-meta">{fmtHM(minutesBetween(timer.started_at, null, now))} שעות מאז {fmtTime(timer.started_at)}</div></div>
              <button className="ck-btn primary" onClick={() => void api.timerStop(text || timer.narrative).then((e) => { setText(""); done(e, "הטיימר נעצר ונשמרה טיוטה."); })}>עצירה ושמירה כטיוטה</button>
            </div>
            <input className="field" aria-label="תיאור העבודה" placeholder="מה נעשה (אפשר להשלים גם אחר כך)" defaultValue={timer.narrative} onChange={(e) => setText(e.target.value)} />
          </div>
        ) : (
          <div className="ck-row">
            <select className="field" aria-label="תיק" value={matter} onChange={(e) => setMatter(e.target.value)} style={{ maxWidth: 260 }}>{matters.map((m) => <option key={m.matter_id} value={m.matter_id}>{name(m)}</option>)}</select>
            <input className="field" aria-label="תיאור העבודה" placeholder="תיאור העבודה" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <button className="ck-btn primary" disabled={!matter} onClick={() => void api.timerStart(matter, text).then((e) => { setText(""); done(e, "הטיימר התחיל."); })}>התחלת טיימר</button>
          </div>
        )}
        <div className="ck-meta">השעון מודד נוכחות בפירמה. הזמן שמחויב נמדד כאן, לפי תיק. שעה בלי תיק נשארת פער ולא נזקפת לאף לקוח.</div>
      </div>
      <div className="ck-card">
        <div className="ck-title">רישום ידני</div>
        <div className="ck-row">
          <select className="field" aria-label="תיק" value={matter} onChange={(e) => setMatter(e.target.value)} style={{ maxWidth: 220 }}>{matters.map((m) => <option key={m.matter_id} value={m.matter_id}>{name(m)}</option>)}</select>
          <input className="field" type="date" aria-label="תאריך" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />
          <input className="field" type="number" min={1} max={1440} inputMode="numeric" aria-label="דקות עבודה" placeholder="דקות" value={mins} onChange={(e) => setMins(e.target.value)} style={{ maxWidth: 110 }} />
          <input className="field" aria-label="תיאור העבודה" placeholder="תיאור העבודה" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <button className="ck-btn" disabled={!matter || !(worked >= 1 && worked <= 1440)} onClick={() => void api.addEntry({ firmId, matterId: matter, workDate: date, worked, billable: billableFor(worked), narrative: text }).then((e) => { if (!e) { setMins(""); setText(""); } done(e, `נשמרה טיוטה: ${worked} דקות, ${billableFor(worked)} לחיוב.`); })}>שמירה כטיוטה</button>
        </div>
        <div className="ck-meta">החיוב נעשה ביחידות של 6 דקות, לא מעל זמן העבודה בפועל.</div>
        <Note m={msg} />
      </div>
      {entries.length > 0 && (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>תיק</th><th>עבודה</th><th>לחיוב</th><th>תיאור</th><th>סטטוס</th><th /></tr></thead><tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.work_date}</td><td>{label(e.matter_id)}</td><td>{fmtHM(e.worked_minutes)}</td><td>{fmtHM(e.billable_minutes)}</td>
              <td>{e.status === "draft" ? <input className="field" aria-label="תיאור העבודה" defaultValue={e.narrative} onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))} /> : e.narrative}</td>
              <td>{TIME_STATUS_LABEL[e.status] ?? e.status}</td>
              <td>{e.status === "draft" && <button className="ck-btn" onClick={() => void api.submitEntry(e.id, drafts[e.id] ?? e.narrative).then((er) => done(er, "הרישום הוגש לאישור."))}>הגשה</button>}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </>
  );
}

/** Last sessions of the firm for the partner: corrections need a reason and are audited. */
function SessionsPanel({ firmId, from, onChanged }: { firmId: string; from: string; onChanged: () => void }) {
  const now = useNow(60000);
  const [rows, setRows] = useState<Session[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; user: string; from: string; to: string; reason: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    let on = true;
    (async () => { const r = await api.loadSessions(`${from}T00:00:00`); if (on) setRows(r); })();
    return () => { on = false; };
  }, [from, v]);
  useEffect(() => {
    let on = true;
    (async () => { const m = await api.loadMembers(firmId); if (on) setMembers(m); })();
    return () => { on = false; };
  }, [firmId]);
  const who = (id: string) => members.find((m) => m.user_id === id)?.name ?? "";
  async function save() {
    if (!edit) return;
    const a = new Date(edit.from), b = new Date(edit.to);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) { setMsg({ ok: false, text: "יש למלא שעת כניסה ושעת יציאה." }); return; }
    const err = edit.id ? await api.correctSession(edit.id, a.toISOString(), b.toISOString(), edit.reason) : await api.addSession(edit.user, a.toISOString(), b.toISOString(), edit.reason);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "נשמר ונרשם ביומן הביקורת." });
    if (!err) { setEdit(null); setV((x) => x + 1); onChanged(); }
  }
  return (
    <>
      <div className="ck-label">החתמות ותיקונים</div>
      <div className="ck-card">
        <div className="ck-meta">תיקון או הוספה של החתמה דורשים סיבה, ונרשמים ביומן הביקורת עם הערך הקודם. החתמה פתוחה מעל 24 שעות חוסמת את העובד עד לתיקון.</div>
        <div className="ck-row"><button className="ck-btn" onClick={() => setEdit({ id: null, user: members[0]?.user_id ?? "", from: "", to: "", reason: "" })}>הוספת החתמה שנשכחה</button></div>
        {edit && (
          <div className="ck-row" role="group" aria-label={edit.id ? "תיקון החתמה" : "הוספת החתמה"}>
            {!edit.id && <select className="field" aria-label="עובד" value={edit.user} onChange={(e) => setEdit({ ...edit, user: e.target.value })} style={{ maxWidth: 200 }}>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select>}
            <input className="field" type="datetime-local" aria-label="כניסה" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} style={{ maxWidth: 220 }} />
            <input className="field" type="datetime-local" aria-label="יציאה" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} style={{ maxWidth: 220 }} />
            <input className="field" aria-label="סיבה" placeholder="סיבה (לפחות 10 תווים)" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => setEdit(null)}>ביטול</button>
          </div>
        )}
        <Note m={msg} />
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>עובד</th><th>כניסה</th><th>יציאה</th><th>משך</th><th>הערה</th><th /></tr></thead><tbody>
          {rows.length ? rows.map((s) => {
            const long = !s.clock_out && minutesBetween(s.clock_in, null, now) > 16 * 60;
            return (
              <tr key={s.id}><td>{who(s.user_id)}</td><td>{fmtTime(s.clock_in)}</td><td>{s.clock_out ? fmtTime(s.clock_out) : <span className={`ck-badge ${long ? "red" : "yellow"}`}>פתוחה{long ? " מעל 16 שעות" : ""}</span>}</td>
                <td>{fmtHM(minutesBetween(s.clock_in, s.clock_out, now))}</td><td>{s.adjust_reason ?? ""}</td>
                <td><button className="ck-btn" onClick={() => setEdit({ id: s.id, user: s.user_id, from: toLocalInput(s.clock_in), to: s.clock_out ? toLocalInput(s.clock_out) : "", reason: "" })}>תיקון</button></td></tr>
            );
          }) : <tr><td colSpan={6}>אין החתמות בתקופה.</td></tr>}
        </tbody></table></div>
      </div>
    </>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return <div className="ck-card"><div className="ck-meta">{title}</div><div className="fin-kpi" style={{ fontSize: 24 }}>{value}</div>{sub && <div className="ck-meta">{sub}</div>}</div>;
}

/** Presence against logged against billable, per person and per matter. */
function PartnerReport({ firmId, demo, refresh }: { firmId: string; demo: boolean; refresh: number }) {
  const { name } = useClientNames();
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [tick, setTick] = useState(0);
  const res = api.useHoursIndex(range.from, range.to, tick + refresh, !demo);
  const [open, setOpen] = useState<string | null>(null);
  const data = demo ? buildHoursDemo(new Date()) : res.state === "ready" ? res.data : null;
  const tot = data ? totals(data.people) : null;
  const rt = tot ? ratios(tot) : null;
  return (
    <>
      <div className="ck-label">מדד שעות העבודה</div>
      <div className="ck-card">
        <div className="ck-row">
          <button className="ck-btn" onClick={() => setRange(monthRange(new Date()))}>החודש</button>
          <button className="ck-btn" onClick={() => setRange(monthRange(new Date(), -1))}>חודש קודם</button>
          <label className="ck-meta">מ-<input className="field" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} style={{ maxWidth: 160 }} /></label>
          <label className="ck-meta">עד <input className="field" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} style={{ maxWidth: 160 }} /></label>
          <button className="ck-btn" onClick={() => setTick((t) => t + 1)} aria-label="רענון">רענון</button>
        </div>
        <div className="ck-meta">נוכחות היא החתמות כניסה ויציאה שנסגרו. רשום על תיקים הוא זמן העבודה ברישומים, בכל סטטוס. לחיוב הוא זמן מוגש, מאושר או שחויב. נוכחות אינה מחולקת בין תיקים: מה שלא נרשם על תיק מופיע כפער. כל צפייה בדוח נרשמת ביומן הביקורת.</div>
      </div>
      {demo && <div className="ck-warn" role="note">{HOURS_DEMO_NOTE}</div>}
      {!demo && res.state === "loading" && <div className="ck-meta">טוען...</div>}
      {!demo && res.state === "unavailable" && <div className="ck-card ck-empty">הדוח עדיין לא הופעל במסד הנתונים (מיגרציה 0058).</div>}
      {!demo && res.state === "denied" && <div className="ck-card ck-empty">אין הרשאה לדוח, או שנדרש אימות דו שלבי.</div>}
      {data && tot && rt && (
        <>
          <div className="ck-grid2">
            <Kpi title="נוכחות" value={fmtHM(tot.attendance)} sub={`פער שלא נרשם על תיק: ${fmtHM(rt.unallocated)}`} />
            <Kpi title="רשום על תיקים" value={fmtHM(tot.logged)} sub={`ניצול הנוכחות: ${fmtPct(rt.utilization)}`} />
            <Kpi title="לחיוב" value={fmtHM(tot.billable)} sub={`מתוך הרשום: ${fmtPct(rt.billableShare)} · מתוך הנוכחות: ${fmtPct(rt.billableOfAttendance)}`} />
            <Kpi title="שווי לחיוב לפי תעריפים" value={money(tot.value)} sub={tot.entriesWithoutRate ? `${tot.entriesWithoutRate} רישומים בלי תעריף אינם כלולים` : "תיקים בשעה, בתקרה ומשולבים בלבד"} />
          </div>
          {(tot.daysOver > 0 || tot.daysNoAttendance > 0 || tot.openSessions > 0) && (
            <div className="ck-warn">לבדיקה: {tot.openSessions} החתמות פתוחות, {tot.daysOver} ימים שבהם נרשם יותר זמן מהנוכחות, {tot.daysNoAttendance} ימי רישום בלי החתמת נוכחות. אלה סימנים לבדיקה, לא מסקנה על האדם.</div>
          )}
          <div className="ck-label">לפי עורך דין</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th>נוכחות</th><th>רשום על תיקים</th><th>לחיוב</th><th>פער</th><th>ניצול</th><th>שיעור חיוב</th><th>שווי</th><th>לבדיקה</th></tr></thead><tbody>
            {data.people.map((p) => { const r = ratios(p); const f = flags(p); return (
              <tr key={p.name}><td>{p.name}</td><td>{fmtHM(p.attendance)}</td><td>{fmtHM(p.logged)}</td><td>{fmtHM(p.billable)}</td><td>{fmtHM(r.unallocated)}</td><td>{fmtPct(r.utilization)}</td><td>{fmtPct(r.billableShare)}</td><td>{money(p.value)}</td>
                <td>{f.length ? f.map((x) => <span key={x} className="ck-badge yellow" style={{ marginInlineEnd: 4 }}>{x}</span>) : ""}</td></tr>); })}
          </tbody></table></div>
          <div className="ck-label">לפי תיק</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיק</th><th>שיטת חיוב</th><th>אנשים</th><th>רשום</th><th>לחיוב</th><th>חויב</th><th>נמחק</th><th>שווי</th></tr></thead><tbody>
            {data.matters.length ? data.matters.map((m) => (
              <Fragment key={m.matterId}>
                <tr onClick={() => setOpen(open === m.matterId ? null : m.matterId)} style={{ cursor: "pointer" }} aria-expanded={open === m.matterId}>
                  <td>{name({ matter_code: m.matterCode, title: m.title })}</td><td>{m.feeModel ? FEE_MODEL_LABEL[m.feeModel] ?? m.feeModel : "ללא הסכם"}</td><td>{m.people}</td>
                  <td>{fmtHM(m.logged)}</td><td>{fmtHM(m.billable)}</td><td>{fmtHM(m.billed)}</td><td>{fmtHM(m.writtenOff)}</td><td>{m.feeModel && ["hourly", "capped", "hybrid"].includes(m.feeModel) ? money(m.value) : "לא מתומחר לפי שעה"}</td>
                </tr>
                {open === m.matterId && data.split.filter((s) => s.matterId === m.matterId).map((s) => (
                  <tr key={m.matterId + s.name} className="ck-meta"><td>↳ {s.name}</td><td /><td /><td>{fmtHM(s.logged)}</td><td>{fmtHM(s.billable)}</td><td colSpan={3} />
                  </tr>))}
              </Fragment>
            )) : <tr><td colSpan={8}>אין רישומי זמן בתקופה.</td></tr>}
          </tbody></table></div>
        </>
      )}
      {!demo && <SessionsPanel firmId={firmId} from={range.from} onChanged={() => setTick((t) => t + 1)} />}
    </>
  );
}

function HoursBody({ member }: { member: Membership }) {
  const { user } = useAuth();
  const partner = ["FIRM_PARTNER", "ADMIN"].includes(member.role);
  // The preview is for partners only, is never stored, and hides the real punch and timer so nobody clocks in by accident during a demo.
  const [demo, setDemo] = useState(() => partner && new URLSearchParams(window.location.search).get("demo") === "1");
  // A punch or an entry saved above reloads the report below, so its totals never lag behind the person's own work.
  const [changed, setChanged] = useState(0);
  const onChanged = () => setChanged((c) => c + 1);
  if (!user) return null;
  return (
    <div className="ck-stack">
      {partner && (
        <div className="ck-row">
          <button className={`ck-btn${demo ? " primary" : ""}`} aria-pressed={demo} onClick={() => setDemo((d) => !d)}>{demo ? "יציאה מתצוגת הדגמה" : "תצוגת הדגמה (נתונים בדויים)"}</button>
        </div>
      )}
      {!demo && <ClockCard userId={user.id} onChanged={onChanged} />}
      {!demo && <MyWork firmId={member.firm_id} userId={user.id} onChanged={onChanged} />}
      {partner && <PartnerReport firmId={member.firm_id} demo={demo} refresh={changed} />}
    </div>
  );
}

export function Hours() {
  return (
    <CockpitFrame title="שעות עבודה" description="החתמת נוכחות, טיימר לפי תיק ורישום זמן. לשותפים: מדד שמציג נוכחות מול שעות רשומות מול שעות לחיוב, לכל עורך דין ולכל תיק." path="/workspace/hours">
      {({ member }) => (member ? <HoursBody member={member} /> : null)}
    </CockpitFrame>
  );
}
