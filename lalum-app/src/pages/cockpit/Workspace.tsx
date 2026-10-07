import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { CONFLICT, fmt, MATTER_STATUS, PRACTICE, RESPONSE, ROLE } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";
import { IntakeForm } from "./Intake";
import { MatterCockpit } from "./MatterCockpit";

interface Row { matter_id: string; title: string; practice_area: string; matter_status: string; conflict_status: string; risk_level: string | null; partner_response: string; dispatched_at: string; sla_breached: boolean }

function MatterList({ firmName, userName, role }: { firmName: string; userName: string; role: string }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_v_admin_matters").select("*").order("dispatched_at", { ascending: false }).limit(100);
      if (live) setRows((data as Row[] | null) ?? []);
    })();
    return () => { live = false; };
  }, []);
  const risk = (r: string | null) => (r === "HIGH_RISK" ? <span className="ck-badge red">🔴 סיכון גבוה</span> : r === "CAUTION" ? <span className="ck-badge yellow">🟡 זהירות</span> : <span className="ck-badge green">🟢 תקין</span>);
  return (
    <div className="ck-stack">
      <div className="ck-card"><div className="ck-row" style={{ justifyContent: "space-between" }}><div><div className="ck-title">{firmName}</div><div className="ck-meta">{userName} · {ROLE[role] ?? role}</div></div><span className="ck-pii">🔒 PII Masked &amp; Secured</span></div></div>
      <div className="ck-label">מה עושים עכשיו?</div>
      <div className="ck-grid2">
        <div className="ck-card"><div className="ck-title">פתיחת תיק חדש</div><div className="ck-meta">מעלים מסמך או מדביקים טקסט. המערכת מסתירה פרטים מזהים, בודקת ניגוד עניינים ומסמנת סיכונים.</div><button className="ck-btn primary" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>תיק חדש</button></div>
        <div className="ck-card"><div className="ck-title">מדריך קצר</div><div className="ck-meta">מה קורה לכל מסמך, איך עובד אישור השותף, ומה נמחק ומתי.</div><Link className="ck-btn" to="/workspace/guide">לפתיחת המדריך</Link></div>
        <div className="ck-card"><div className="ck-title">מסך הניהול</div><div className="ck-meta">כל התיקים, חריגות SLA ויומן ניגוד עניינים.</div><Link className="ck-btn" to="/admin/matters">לניהול</Link></div>
        <div className="ck-card"><div className="ck-title">חיוב והגדרות</div><div className="ck-meta">מסלול, מושבים, חשבוניות וטלפון להתראות.</div><Link className="ck-btn" to="/settings/billing">להגדרות</Link></div>
        <div className="ck-card"><div className="ck-title">אבטחת חשבון</div><div className="ck-meta">הפעלת אימות דו-שלבי: קוד מהטלפון בנוסף לסיסמה.</div><Link className="ck-btn" to="/settings/security">להפעלה</Link></div>
      </div>
      <div className="ck-meta">חומרי התיק נשמרים לפי חוק לשכת עורכי הדין (7 שנים מסיום הטיפול, 25 למסמכי מקרקעין). מחיקה אחרי 30 יום אפשרית רק בתיק שבו הלקוח הסכים בכתב.</div>
      {adding && <div className="ck-card"><IntakeForm onDone={(m) => nav(`/workspace?matter=${m}`)} /></div>}
      <div className="ck-label">תיקים</div>
      {rows == null ? <div className="ck-meta">טוען...</div> : rows.length === 0 ? <div className="ck-card"><div className="ck-meta">אין תיקים עדיין. פתחו תיק חדש כדי להתחיל.</div></div> : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיק</th><th>תחום</th><th>סטטוס</th><th>ניגוד עניינים</th><th>סיכון</th><th>תגובת שותף</th><th>נקלט</th></tr></thead><tbody>
          {rows.map((x) => { const [t, l] = CONFLICT[x.conflict_status] ?? ["yellow", x.conflict_status]; return (
            <tr key={x.matter_id} className={x.sla_breached ? "breach" : ""}>
              <td><Link to={`/workspace?matter=${x.matter_id}`} style={{ textDecoration: "underline" }}>{x.title}</Link></td>
              <td>{PRACTICE[x.practice_area]}</td><td>{MATTER_STATUS[x.matter_status]}</td><td><span className={`ck-badge ${t}`}>{l}</span></td><td>{risk(x.risk_level)}</td><td>{RESPONSE[x.partner_response]}</td><td>{fmt(x.dispatched_at)}</td>
            </tr>); })}
        </tbody></table></div>
      )}
    </div>
  );
}

export function Workspace() {
  // A matter is addressed as /workspace?matter=<uuid>: the site has no SPA catch-all, so only
  // prerendered paths resolve on a direct hit or refresh. /workspace/<uuid> still works in-app.
  const [q] = useSearchParams();
  const fromQuery = q.get("matter");
  const param = useParams().matterId;
  const matterId = param ?? (fromQuery && /^[0-9a-f-]{36}$/i.test(fromQuery) ? fromQuery : undefined);
  return (
    <CockpitFrame title="קוקפיט תיקים" description="קוקפיט התיקים של LALUM: כספת, עורך חכם ואולפן סוכני תחום עם אישור אנושי לפני ייצוא." path="/workspace">
      {({ member }) => member && (matterId
        ? <MatterCockpit key={matterId} matterId={matterId} member={member} />
        : <MatterList firmName={member.lalum_firms.firm_name} userName={member.name} role={member.role} />)}
    </CockpitFrame>
  );
}
