// Work areas for the attorney and the partner: client inquiries (with reply log and response time), tasks, scorecard.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { fmt } from "../../lib/cockpit/shared";
import {
  CHANNEL, VIA, closeTask, createTask, dur, firmPeople, fmtExact, myInquiryAddress, handleInquiry, listInquiries, listTasks, logReply, matterOptions, openRaw, scorecard,
} from "../../lib/cockpit/work";
import type { Inquiry, Person, Reply, Scorecard, Task } from "../../lib/cockpit/work";
import { CheckArt, InboxArt } from "../../components/cockpit/CockpitIllustrations";
import { InquiryInsights, ScoreInsights, TaskInsights } from "../../components/cockpit/CockpitInsights";

const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

function InquiriesView() {
  const [data, setData] = useState<{ inquiries: Inquiry[]; replies: Reply[]; titles: Map<string, string> } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [raw, setRaw] = useState<{ id: string; text: string } | null>(null);
  const [via, setVia] = useState("PHONE");
  const [addr, setAddr] = useState<string | null>(null);
  const [target, setTarget] = useState(240);
  useEffect(() => { void scorecard(30).then((x) => { if (x) setTarget(x.target_minutes); }); }, []);
  useEffect(() => { void myInquiryAddress().then(setAddr); }, []);
  const load = useCallback(async () => { setData(await listInquiries()); setPeople(await firmPeople()); }, []);
  useEffect(() => { void load(); }, [load]);
  const name = (id: string) => people.find((p) => p.user_id === id)?.display_name ?? "חבר צוות";

  if (!data) return <div className="ck-meta">טוען...</div>;
  const first = new Map<string, Reply>();
  for (const r of data.replies) if (!first.has(r.inquiry_id)) first.set(r.inquiry_id, r);
  const rows = data.inquiries.filter((i) => filter === "all" || i.status !== "HANDLED");

  async function reply(i: Inquiry) { const e = await logReply(i.id, via); setMsg({ ok: !e, text: e ?? "המענה נרשם עם שעה מדויקת." }); if (!e) await load(); }
  async function done(i: Inquiry) { const e = await handleInquiry(i.id); setMsg({ ok: !e, text: e ?? "הפנייה סומנה כמטופלת." }); if (!e) await load(); }
  async function show(i: Inquiry) { const t = await openRaw(i.id); setRaw(t == null ? null : { id: i.id, text: t }); if (t == null) setMsg({ ok: false, text: "לא ניתן לפתוח." }); }

  return (
    <div className="ck-stack">
      <div className="ck-warn">כאן נרשם שהלקוח קיבל מענה ומתי. תוכן המענה אינו נשמר במערכת. זמן המענה הראשון נמדד משעת קבלת הפנייה עד לרישום הראשון, והוא מזין את מדד התגובה. הפתיחה של הטקסט המקורי נרשמת ביומן הביקורת.</div>
      {addr && <div className="ck-card ck-stack"><div className="ck-title">כתובת הקליטה של המשרד</div><div className="ck-meta">מייל שנשלח לכתובת הזו (או שהלקוח מעביר אליה) נקלט כפנייה: <b dir="ltr">{addr}</b>. קבצים מצורפים אינם נשמרים עד שתופעל סריקת וירוסים. אל תפרסמו את הכתובת ברבים.</div></div>}
      <InquiryInsights inquiries={data.inquiries} replies={data.replies} targetMinutes={target} />
      <div className="ck-row">
        <select className="ck-select" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")}><option value="open">פניות פתוחות</option><option value="all">כל הפניות</option></select>
        <label className="ck-row ck-meta">ערוץ המענה שיירשם:
          <select className="ck-select" style={{ width: "auto" }} value={via} onChange={(e) => setVia(e.target.value)}>{Object.entries(VIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} role="status">{msg.text}</div>}
      {rows.length === 0 ? <div className="ck-card ck-empty"><InboxArt size={104} /><div className="ck-meta">אין פניות להצגה. פניות של לקוחות יופיעו כאן כשיתחברו ערוצי הקליטה.</div></div> : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>התקבלה</th><th>ערוץ</th><th>תיק</th><th>תקציר (מוסתר)</th><th>מענה ראשון</th><th>פעולות</th></tr></thead><tbody>
          {rows.map((i) => {
            const f = first.get(i.id);
            return (
              <tr key={i.id}>
                <td>{fmtExact(i.received_at)}</td><td>{CHANNEL[i.channel] ?? i.channel}</td>
                <td>{i.matter_id ? <Link to={`/workspace/${i.matter_id}`}>{data.titles.get(i.matter_id) ?? "תיק"}</Link> : <span className="ck-badge yellow">לא שויכה</span>}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 320 }} dir="auto">{i.body_masked.slice(0, 160)}{i.attachment_count ? ` (${i.attachment_count} קבצים)` : ""}</td>
                <td>{f ? <span className="ck-badge green">{dur(mins(i.received_at, f.replied_at))} על ידי {name(f.replied_by)}<br />{fmtExact(f.replied_at)}</span> : <span className="ck-badge red">ממתין למענה</span>}</td>
                <td><div className="ck-row">
                  <button className="ck-btn" onClick={() => void reply(i)}>רישום מענה</button>
                  <button className="ck-btn" onClick={() => void show(i)}>טקסט מקורי</button>
                  {i.status !== "HANDLED" && <button className="ck-btn" onClick={() => void done(i)}>טופל</button>}
                </div></td>
              </tr>);
          })}
        </tbody></table></div>)}
      {raw && <aside className="ck-drawer" aria-label="טקסט מקורי"><div className="ck-title">הטקסט המקורי של הפנייה</div><div className="ck-card" style={{ whiteSpace: "pre-wrap" }} dir="auto">{raw.text}</div><div className="ck-row"><button className="ck-btn" onClick={() => setRaw(null)}>סגירה</button></div></aside>}
    </div>
  );
}

function TasksView() {
  const [d, setD] = useState<{ tasks: Task[]; titles: Map<string, string>; people: Person[] } | null>(null);
  const [matters, setMatters] = useState<Array<{ id: string; title: string }>>([]);
  const [f, setF] = useState({ matter: "", title: "", due: "", who: "" });
  const [show, setShow] = useState<"OPEN" | "DONE">("OPEN");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => { setD(await listTasks()); }, []);
  useEffect(() => { void load(); void matterOptions().then(setMatters); }, [load]);
  if (!d) return <div className="ck-meta">טוען...</div>;
  const name = (id: string) => d.people.find((p) => p.user_id === id)?.display_name ?? "חבר צוות";
  const now = Date.now();
  const rows = d.tasks.filter((t) => (show === "OPEN" ? t.status === "OPEN" : t.status !== "OPEN"));

  async function add() {
    const e = await createTask(f.matter, f.title, f.due ? new Date(f.due).toISOString() : null, f.who || null);
    setMsg({ ok: !e, text: e ?? "המשימה נוצרה." });
    if (!e) { setF({ ...f, title: "", due: "" }); await load(); }
  }
  async function close(t: Task, s: "DONE" | "CANCELLED") { const e = await closeTask(t.id, s); setMsg({ ok: !e, text: e ?? (s === "DONE" ? "המשימה הושלמה." : "המשימה בוטלה.") }); if (!e) await load(); }

  return (
    <div className="ck-stack">
      <div className="ck-warn">משימה היא פעולה פתוחה בתיק עם אחראי ומועד יעד. משימה שהושלמה לפני המועד נספרת לטובת האחראי במדד, ומשימה פתוחה שעבר מועדה נספרת כאיחור. אל תכתבו בכותרת פרטים מזהים של הלקוח.</div>
      <div className="ck-card ck-stack">
        <div className="ck-title">משימה חדשה</div>
        <div className="ck-grid2">
          <label className="ck-field">תיק<select className="ck-select" value={f.matter} onChange={(e) => setF({ ...f, matter: e.target.value })}><option value="">בחרו תיק</option>{matters.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
          <label className="ck-field">אחראי<select className="ck-select" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}><option value="">אני</option>{d.people.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
          <label className="ck-field">מה צריך לעשות<input className="ck-input" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="ck-field">מועד יעד<input className="ck-input" type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        </div>
        <div className="ck-row"><button className="ck-btn primary" disabled={!f.matter || f.title.trim().length < 3} onClick={() => void add()}>יצירת משימה</button></div>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} role="status">{msg.text}</div>}
      <TaskInsights tasks={d.tasks} />
      <div className="ck-row"><select className="ck-select" style={{ width: "auto" }} value={show} onChange={(e) => setShow(e.target.value as "OPEN" | "DONE")}><option value="OPEN">משימות פתוחות</option><option value="DONE">סגורות</option></select></div>
      {rows.length === 0 ? <div className="ck-card ck-empty"><CheckArt size={104} /><div className="ck-meta">{show === "OPEN" ? "אין משימות פתוחות." : "אין משימות סגורות."}</div></div> : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>משימה</th><th>תיק</th><th>אחראי</th><th>מועד יעד</th><th>מצב</th><th>פעולות</th></tr></thead><tbody>
          {rows.map((t) => {
            const late = t.status === "OPEN" && t.due_at && new Date(t.due_at).getTime() < now;
            return (
              <tr key={t.id}>
                <td style={{ whiteSpace: "normal", maxWidth: 300 }}>{t.title}</td>
                <td><Link to={`/workspace/${t.matter_id}`}>{d.titles.get(t.matter_id) ?? "תיק"}</Link></td>
                <td>{name(t.assignee)}</td><td>{t.due_at ? fmt(t.due_at) : "ללא מועד"}</td>
                <td>{t.status === "DONE" ? <span className="ck-badge green">הושלמה {fmt(t.closed_at)}</span> : t.status === "CANCELLED" ? <span className="ck-badge yellow">בוטלה</span> : late ? <span className="ck-badge red">באיחור</span> : <span className="ck-badge yellow">פתוחה</span>}</td>
                <td>{t.status === "OPEN" && <div className="ck-row"><button className="ck-btn" onClick={() => void close(t, "DONE")}>הושלמה</button><button className="ck-btn" onClick={() => void close(t, "CANCELLED")}>ביטול</button></div>}</td>
              </tr>);
          })}
        </tbody></table></div>)}
    </div>
  );
}

function ScoreView() {
  const [days, setDays] = useState(30);
  const [sc, setSc] = useState<Scorecard | null | undefined>(undefined);
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => { setSc(undefined); void scorecard(days).then(setSc); void firmPeople().then(setPeople); }, [days]);
  const name = useMemo(() => (id: string) => people.find((p) => p.user_id === id)?.display_name ?? "חבר צוות", [people]);
  if (sc === undefined) return <div className="ck-meta">טוען...</div>;
  if (sc === null) return <div className="ck-err">לא ניתן לטעון את המדדים.</div>;
  return (
    <div className="ck-stack">
      <div className="ck-warn">מדד פנימי לניהול ולשיפור השירות, אינו חוות דעת על איכות העבודה המשפטית. עורך דין רואה את המספרים שלו בלבד; שותף רואה את כל הצוות. הנוסחה גלויה כאן, והיא נשענת רק על רישומים שבוצעו במערכת: אם מענה לא נרשם, הוא לא נספר.</div>
      <ScoreInsights sc={sc} nameOf={name} />
      <div className="ck-row"><label className="ck-row ck-meta">תקופה:
        <select className="ck-select" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 ימים</option><option value={30}>30 ימים</option><option value={90}>90 ימים</option></select></label></div>
      <div className="ck-grid2">
        <div className="ck-card"><div className="ck-title">{sc.firm.inquiries}</div><div className="ck-meta">פניות בתקופה</div></div>
        <div className="ck-card"><div className="ck-title">{sc.firm.unanswered}</div><div className="ck-meta">פניות ללא מענה{sc.firm.unanswered_over_target ? `, מתוכן ${sc.firm.unanswered_over_target} מעבר ליעד` : ""}</div></div>
        <div className="ck-card"><div className="ck-title">{sc.firm.tasks_open}</div><div className="ck-meta">משימות פתוחות במשרד</div></div>
        <div className="ck-card"><div className="ck-title">{sc.firm.tasks_overdue}</div><div className="ck-meta">משימות באיחור</div></div>
      </div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th>מענים שנרשמו</th><th>בתוך היעד</th><th>זמן מענה חציוני</th><th>משימות פתוחות</th><th>באיחור</th><th>הושלמו בזמן</th><th>ציון</th></tr></thead><tbody>
        {sc.people.map((p) => (
          <tr key={p.user_id}>
            <td>{name(p.user_id)}</td><td>{p.replies}</td><td>{p.replies ? `${p.replies_in_target} (${Math.round((100 * p.replies_in_target) / p.replies)}%)` : ""}</td><td>{dur(p.median_minutes)}</td>
            <td>{p.tasks_open}</td><td>{p.tasks_overdue || ""}</td><td>{p.tasks_judged ? `${p.tasks_on_time} מתוך ${p.tasks_judged}` : ""}</td>
            <td>{p.score == null ? <span className="ck-meta">אין נתונים</span> : <span className={`ck-badge ${p.score >= 80 ? "green" : p.score >= 60 ? "yellow" : "red"}`}>{p.score}</span>}</td>
          </tr>))}
      </tbody></table></div>
      <div className="ck-card ck-stack">
        <div className="ck-title">איך הציון מחושב</div>
        <div className="ck-meta">מענה בתוך היעד: מענה ראשון שנרשם תוך {dur(sc.target_minutes)} משעת קבלת הפנייה (זמן קלנדרי, כולל לילות וסופי שבוע). נקודות מענה = אחוז הפניות שנענו בתוך היעד, מבין הפניות שהאדם ענה להן ראשון.</div>
        <div className="ck-meta">נקודות משימות = אחוז המשימות עם מועד יעד שהושלמו עד המועד, מבין משימות שהושלמו או שפתוחות ועבר מועדן.</div>
        <div className="ck-meta">ציון = 60% נקודות מענה + 40% נקודות משימות. רכיב ללא נתונים מושמט והשאר מקבל משקל מלא. פנייה שלא נענתה כלל אינה נזקפת לאדם מסוים אלא מוצגת במשרד כולו.</div>
      </div>
    </div>
  );
}

const wrap = (title: string, description: string, path: string, el: ReactNode) => (
  <CockpitFrame title={title} description={description} path={path}>{({ member }) => member && el}</CockpitFrame>
);
export const InquiriesPage = () => wrap("פניות לקוחות", "פניות של לקוחות שהגיעו לתיקים.", "/workspace/inquiries", <InquiriesView />);
export const TasksPage = () => wrap("משימות", "משימות פתוחות בתיקים.", "/workspace/tasks", <TasksView />);
export const ScorecardPage = () => wrap("מדדי שירות", "זמני מענה ועמידה במשימות.", "/workspace/scorecard", <ScoreView />);
