// Cockpit dashboard: greeting, quick actions with illustrations, and charts built from the firm's own data.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { Icon } from "../../components/Icon";
import { AreaChart, Donut, PillBars, StatusBar } from "../../components/cockpit/CockpitCharts";
import { FolderArt, ImportArt, InboxArt, ShieldArt, TasksArt } from "../../components/cockpit/CockpitIllustrations";
import { CONFLICT, fmt, PRACTICE } from "../../lib/cockpit/shared";
import { delta, loadDashboard, series } from "../../lib/cockpit/dashboard";
import type { DashData } from "../../lib/cockpit/dashboard";
import { dur } from "../../lib/cockpit/work";
import "../../styles/cockpit-dashboard.css";

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 18 ? "צהריים טובים" : "ערב טוב"; };
const initials = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

function Trend({ d }: { d: number | null }) {
  if (d == null) return <i className="flat">חדש</i>;
  return <i className={d > 0 ? "up" : d < 0 ? "down" : "flat"}>{d > 0 ? "+" : ""}{d}%</i>;
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
        <div className="db-greet"><small>{greeting()}</small><h2>{name}</h2><p>{firmName}</p></div>
        <div className="db-actions">
          <Link className="db-act" to="/workspace"><FolderArt size={84} /><span>תיק חדש<small>העלאת מסמך או הדבקת טקסט</small></span></Link>
          <Link className="db-act" to="/workspace/import"><ImportArt size={84} /><span>ייבוא תיקים<small>תיקייה שלמה בבת אחת</small></span></Link>
          <Link className="db-act" to="/workspace/inquiries"><InboxArt size={84} /><span>פניות לקוחות<small>מענה ורישום זמנים</small></span></Link>
          <Link className="db-act" to="/workspace/tasks"><TasksArt size={84} /><span>משימה חדשה<small>אחראי ומועד יעד</small></span></Link>
        </div>
      </div>

      {!data || !view ? <div className="ck-meta">טוען...</div> : (
        <>
          <div className="db-grid">
            <div className="ck-card db-card">
              <div className="db-head"><h3>סקירה כללית</h3>
                <div className="db-toggle" role="group" aria-label="טווח זמן">
                  <button type="button" aria-pressed={mode === "monthly"} onClick={() => setMode("monthly")}>חודשי</button>
                  <button type="button" aria-pressed={mode === "weekly"} onClick={() => setMode("weekly")}>שבועי</button>
                </div>
              </div>
              <div className="db-overview">
                <div className="db-kpis">
                  <div className="db-kpi"><Trend d={delta(view.matters.values)} /><b>{data.matters.length}</b><small>תיקים במערכת</small></div>
                  <div className="db-kpi"><Trend d={delta(view.inq.values)} /><b>{data.inquiries.length}</b><small>פניות (200 ימים)</small></div>
                  <div className="db-kpi"><Trend d={delta(view.done.values)} /><b>{data.docs}</b><small>מסמכים בכספת</small></div>
                </div>
                <div>
                  <AreaChart id="db-matters" values={view.matters.values} labels={view.matters.labels} unit="תיקים חדשים" />
                  <div className="db-note">תיקים חדשים לפי {mode === "weekly" ? "שבוע" : "חודש"}</div>
                </div>
              </div>
            </div>
            <div className="ck-card db-card">
              <div className="db-head"><h3>פניות</h3><Link className="ck-link" to="/workspace/inquiries">לכל הפניות</Link></div>
              <PillBars items={[{ label: "חדשות", value: byStatus("NEW"), color: "#f5c431" }, { label: "נראו", value: byStatus("SEEN"), color: "#8ed46a" }, { label: "טופלו", value: byStatus("HANDLED"), color: "#4ea53a" }]} />
            </div>
          </div>

          <div className="db-grid b">
            <div className="ck-card db-card">
              <div className="db-head"><h3>שירות לקוחות</h3>{median != null && <span className="ck-badge green">זמן מענה חציוני {dur(median)}</span>}</div>
              {recentInq.length === 0 ? <div className="db-empty">אין פניות עדיין. פניות שיגיעו לכתובת הקליטה יופיעו כאן.</div> : (
                <ul className="db-list">{recentInq.map((i, k) => (
                  <li key={k}><Link to="/workspace/inquiries"><span className="db-dot" style={{ background: i.status === "NEW" ? "#f5c431" : i.status === "SEEN" ? "#8ed46a" : "#3d8d2e" }} /><em>{i.status === "NEW" ? "פנייה חדשה" : i.status === "SEEN" ? "פנייה שנצפתה" : "פנייה שטופלה"}</em><small dir="ltr">{fmt(i.received_at)}</small></Link></li>
                ))}</ul>
              )}
              <div className="db-head" style={{ marginTop: 6 }}><h3>משימות</h3><Link className="ck-link" to="/workspace/tasks">לכל המשימות</Link></div>
              <Donut centre={view.open} sub="פתוחות" segments={[{ label: "פתוחות", value: Math.max(0, view.open - view.overdue), color: "#8ed46a" }, { label: "באיחור", value: view.overdue, color: "#cf4b3a" }, { label: "הושלמו", value: view.closed, color: "#3d8d2e" }]} />
            </div>
            <div className="ck-card db-card">
              <div className="db-head"><h3>סטטוס תיקים</h3><Link className="ck-link" to="/workspace">לכל התיקים</Link></div>
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
