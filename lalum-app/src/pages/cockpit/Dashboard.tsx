// Cockpit dashboard: greeting, quick actions with illustrations, and charts built from the firm's own data.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { Icon } from "../../components/Icon";
import { Wordmark } from "../../components/Wordmark";
import { AreaChart, Donut, StatusBar } from "../../components/cockpit/CockpitCharts";
import { FolderArt, ImportArt, InboxArt, ShieldArt, TasksArt } from "../../components/cockpit/CockpitIllustrations";
import { CONFLICT, fmt, PRACTICE } from "../../lib/cockpit/shared";
import { delta, loadDashboard, series } from "../../lib/cockpit/dashboard";
import type { DashData } from "../../lib/cockpit/dashboard";
import { dur } from "../../lib/cockpit/work";
import "../../styles/cockpit-dashboard.css";

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 18 ? "צהריים טובים" : "ערב טוב"; };
const initials = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/** Direction is an arrow plus words, never colour alone. */
function Trend({ d }: { d: number | null }) {
  if (d == null) return <span className="db-delta flat"><span aria-hidden="true">■</span> חדש</span>;
  const cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
  return <span className={`db-delta ${cls}`}><span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "■"}</span> <bdi dir="ltr">{d > 0 ? "+" : ""}{d}%</bdi><span className="db-sr"> לעומת התקופה הקודמת</span></span>;
}

/** Tiny trend line from a real series; no axis, the card's number and arrow carry the reading. */
function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values), W = 104, H = 36;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 4 - (v / max) * (H - 8)}`).join(" ");
  return <svg className="db-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label}: ${values.join(", ")}`}><polyline points={pts} fill="none" stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Kpi({ icon, label, value, unit, d, values, note }: { icon: string; label: string; value: number; unit?: string; d?: number | null; values?: number[]; note?: string }) {
  return (
    <div className="ck-card db-kcard">
      <div className="db-khead"><span className="db-kicon"><Icon name={icon} size={18} /></span><span className="db-klabel">{label}</span></div>
      <div className="db-kbody">
        <div>
          <div className="db-kval"><b>{value.toLocaleString("he-IL")}</b>{unit && <small>{unit}</small>}</div>
          {d !== undefined ? <Trend d={d} /> : note ? <span className="db-delta flat">{note}</span> : null}
        </div>
        {values && <Spark values={values} label={label} />}
      </div>
    </div>
  );
}

/** One row of a ranked list: label, count and share, then a bar. */
function RankRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <li className="db-rank">
      <div><span>{label}</span><span><b>{value}</b> <small>({p}%)</small></span></div>
      <span className="db-rbar" aria-hidden="true"><i style={{ width: `${p}%`, background: color }} /></span>
    </li>
  );
}

/** preload skips the fetch (previews and tests feed it synthetic data). */
export function DashView({ name, firmName, role, preload }: { name: string; firmName: string; role: string; preload?: DashData }) {
  const [data, setData] = useState<DashData | null>(preload ?? null);
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");
  const [q, setQ] = useState("");
  useEffect(() => { if (!preload) void loadDashboard().then(setData); }, [preload]);

  const view = useMemo(() => {
    if (!data) return null;
    const n = mode === "weekly" ? 12 : 6;
    const matters = series(data.matters.map((m) => m.dispatched_at), mode, n);
    const inq = series(data.inquiries.map((i) => i.received_at), mode, n);
    const done = series(data.tasks.filter((t) => t.status === "DONE" && t.closed_at).map((t) => t.closed_at as string), mode, n);
    const now = Date.now();
    const awaiting = data.inquiries.filter((i) => i.status === "NEW").length;
    const overdue = data.tasks.filter((t) => t.status === "OPEN" && t.due_at && new Date(t.due_at).getTime() < now).length;
    const open = data.tasks.filter((t) => t.status === "OPEN").length;
    const closed = data.tasks.filter((t) => t.status === "DONE").length;
    return { matters, inq, done, awaiting, overdue, open, closed };
  }, [data, mode]);

  const median = useMemo(() => {
    const ms = (data?.score?.people ?? []).map((p) => p.median_minutes).filter((x): x is number => x != null);
    return ms.length ? ms.sort((a, b) => a - b)[Math.floor(ms.length / 2)] : null;
  }, [data]);

  const rows = useMemo(() => (data?.matters ?? []).filter((m) => !q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6), [data, q]);
  const recentInq = (data?.inquiries ?? []).slice().sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, 4);
  const byStatus = (s: string) => (data?.inquiries ?? []).filter((i) => i.status === s).length;

  return (
    <div className="db">
      <div className="db-top">
        <div className="db-search"><Icon name="search" size={18} /><input type="search" placeholder="חיפוש תיק" aria-label="חיפוש תיק" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Link className="db-bubble" to="/workspace/inquiries" aria-label="פניות לקוחות"><Icon name="phone" size={20} />{view && view.awaiting > 0 && <b>{view.awaiting}</b>}</Link>
        <Link className="db-bubble" to="/workspace/tasks" aria-label="משימות"><Icon name="check" size={20} />{view && view.overdue > 0 && <b>{view.overdue}</b>}</Link>
        <div className="db-user"><div><strong>{name}</strong><small>{role}</small></div><div className="db-avatar" aria-hidden="true">{initials(name)}</div></div>
      </div>

      <div className="db-hero">
        <div className="db-greet">
          <div className="db-brand"><Wordmark height={30} className="db-logo" /></div>
          <p className="db-hello"><small>{greeting()}</small><strong>{name}</strong></p>
          {firmName.trim().toLowerCase() !== "lalum" && <p className="db-firm">{firmName}</p>}
        </div>
        <div className="db-actions">
          <Link className="db-act" to="/workspace"><FolderArt size={84} /><span>תיק חדש<small>העלאת מסמך או הדבקת טקסט</small></span></Link>
          <Link className="db-act" to="/workspace/import"><ImportArt size={84} /><span>ייבוא תיקים<small>תיקייה שלמה בבת אחת</small></span></Link>
          <Link className="db-act" to="/workspace/inquiries"><InboxArt size={84} /><span>פניות לקוחות<small>מענה ורישום זמנים</small></span></Link>
          <Link className="db-act" to="/workspace/tasks"><TasksArt size={84} /><span>משימה חדשה<small>אחראי ומועד יעד</small></span></Link>
        </div>
      </div>

      {!data || !view ? <div className="ck-meta">טוען...</div> : (
        <>
          <div className="db-kgrid">
            <Kpi icon="folder" label="תיקים במערכת" value={data.matters.length} d={delta(view.matters.values)} values={view.matters.values} />
            <Kpi icon="phone" label="פניות לקוחות (200 ימים)" value={data.inquiries.length} d={delta(view.inq.values)} values={view.inq.values} />
            <Kpi icon="check" label="משימות שהושלמו" value={view.closed} d={delta(view.done.values)} values={view.done.values} />
            <Kpi icon="file" label="מסמכים בכספת" value={data.docs} note={`${view.open} משימות פתוחות, ${view.overdue} באיחור`} />
          </div>

          <div className="db-grid">
            <div className="ck-card db-card">
              <div className="db-head"><h3>תיקים חדשים</h3>
                <div className="db-toggle" role="group" aria-label="טווח זמן">
                  <button type="button" aria-pressed={mode === "monthly"} onClick={() => setMode("monthly")}>חודשי</button>
                  <button type="button" aria-pressed={mode === "weekly"} onClick={() => setMode("weekly")}>שבועי</button>
                </div>
              </div>
              <AreaChart id="db-matters" values={view.matters.values} labels={view.matters.labels} unit="תיקים חדשים" />
              <div className="db-note">תיקים חדשים לפי {mode === "weekly" ? "שבוע" : "חודש"}</div>
            </div>
            <div className="ck-card db-card db-center">
              <div className="db-head"><h3>פילוח פניות</h3><Link className="ck-link" to="/workspace/inquiries">לכל הפניות</Link></div>
              <Donut centre={data.inquiries.length} sub="פניות" segments={[{ label: "חדשות", value: byStatus("NEW"), color: "#f5c431" }, { label: "נראו", value: byStatus("SEEN"), color: "#9bbb9f" }, { label: "טופלו", value: byStatus("HANDLED"), color: "#537056" }]} />
            </div>
          </div>

          <div className="db-grid b">
            <div className="ck-card db-card">
              <div className="db-head"><h3>משימות לפי מצב</h3><Link className="ck-link" to="/workspace/tasks">לכל המשימות</Link></div>
              <ul className="db-ranks">
                <RankRow label="פתוחות" value={Math.max(0, view.open - view.overdue)} total={data.tasks.length} color="#9bbb9f" />
                <RankRow label="באיחור" value={view.overdue} total={data.tasks.length} color="#b3402f" />
                <RankRow label="הושלמו" value={view.closed} total={data.tasks.length} color="#537056" />
              </ul>
              <div className="db-head" style={{ marginTop: 6 }}><h3>שירות לקוחות</h3>{median != null && <span className="ck-badge green">זמן מענה חציוני {dur(median)}</span>}</div>
              {recentInq.length === 0 ? <div className="db-empty">אין פניות עדיין. פניות שיגיעו לכתובת הקליטה יופיעו כאן.</div> : (
                <ul className="db-list">{recentInq.map((i, k) => (
                  <li key={k}><Link to="/workspace/inquiries"><span className="db-dot" style={{ background: i.status === "NEW" ? "#f5c431" : i.status === "SEEN" ? "#9bbb9f" : "#537056" }} /><em>{i.status === "NEW" ? "פנייה חדשה" : i.status === "SEEN" ? "פנייה שנצפתה" : "פנייה שטופלה"}</em><small dir="ltr">{fmt(i.received_at)}</small></Link></li>
                ))}</ul>
              )}
            </div>
            <div className="ck-card db-card">
              <div className="db-head"><h3>סטטוס תיקים <span className="db-count">{data.matters.length}</span></h3><Link className="ck-link" to="/workspace">לכל התיקים</Link></div>
              {rows.length === 0 ? <div className="db-empty"><ShieldArt size={84} /><div>{q ? "לא נמצא תיק תואם." : "אין תיקים עדיין. פתחו תיק חדש כדי להתחיל."}</div></div> : (
                <div style={{ overflowX: "auto" }}><table className="db-tbl"><thead><tr><th>תיק</th><th>תחום</th><th>ניגוד עניינים</th><th>רמת סיכון</th><th>נקלט</th></tr></thead><tbody>
                  {rows.map((m) => { const [tone, label] = CONFLICT[m.conflict_status] ?? ["yellow", m.conflict_status]; const rt = m.risk_level === "HIGH_RISK" ? "red" : m.risk_level === "CAUTION" ? "yellow" : "green"; return (
                    <tr key={m.matter_id}>
                      <td><Link to={`/workspace?matter=${m.matter_id}`}>{m.title}</Link></td><td>{PRACTICE[m.practice_area]}</td>
                      <td><span className={`ck-badge ${tone}`}>{label}</span></td>
                      <td><StatusBar pct={rt === "red" ? 28 : rt === "yellow" ? 62 : 100} tone={rt} /></td><td dir="ltr" style={{ textAlign: "end" }}>{fmt(m.dispatched_at)}</td>
                    </tr>); })}
                </tbody></table></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  return (
    <CockpitFrame title="לוח בקרה" description="תמונת מצב של התיקים, הפניות והמשימות במשרד." path="/workspace/dashboard">
      {({ member }) => member && <DashView name={member.name} firmName={member.lalum_firms.firm_name} role={({ FIRM_PARTNER: "שותף", ATTORNEY: "עורך דין", ADMIN: "מנהל" } as Record<string, string>)[member.role] ?? member.role} />}
    </CockpitFrame>
  );
}
