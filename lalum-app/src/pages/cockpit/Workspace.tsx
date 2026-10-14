import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { CONFLICT, fmt, MATTER_STATUS, PRACTICE, RESPONSE, ROLE } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";
import { trashMatter } from "../../lib/cockpit/bin";
import { runBulk, setAll, toggle } from "../../lib/cockpit/bulk";
import { useClientNames } from "../../components/cockpit/ClientNames";
import { CardArt, EmptyArt, HeroArt } from "../../components/cockpit/CockpitArt";
import { MatterInsights } from "../../components/cockpit/CockpitInsights";
import { IntakeForm } from "./Intake";
import { MatterCockpit } from "./MatterCockpit";

interface Row { matter_id: string; matter_code: string | null; title: string; practice_area: string; matter_status: string; conflict_status: string; risk_level: string | null; partner_response: string; dispatched_at: string; sla_breached: boolean }

function MatterList({ firmId, firmName, userName, role, platformAdmin }: { firmId: string; firmName: string; userName: string; role: string; platformAdmin: boolean }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [trashing, setTrashing] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [trashMsg, setTrashMsg] = useState("");
  const { name } = useClientNames();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const isPartner = platformAdmin && role === "FIRM_PARTNER"; // trash and permanent deletion are for the platform admin only
  async function moveToBin() {
    if (!trashing) return;
    const r = await trashMatter(trashing.matter_id, reason);
    if (!r.ok) { setTrashMsg(r.error ?? "הפעולה נכשלה."); return; }
    setRows((rs) => rs?.filter((x) => x.matter_id !== trashing.matter_id) ?? rs);
    setTrashing(null); setReason(""); setTrashMsg("");
  }
  async function bulkToBin() {
    const ids = [...sel];
    setBusy(`0/${ids.length}`); setTrashMsg("");
    const res = await runBulk(ids, (id) => trashMatter(id, reason), (n, t) => setBusy(`${n}/${t}`));
    setBusy(null);
    const gone = new Set(res.done);
    setRows((rs) => rs?.filter((x) => !gone.has(x.matter_id)) ?? rs);
    setSel(new Set(res.failed.map((f) => f.id)));
    if (res.failed.length === 0) { setBulkOpen(false); setReason(""); return; }
    const names = new Map(rows?.map((x) => [x.matter_id, name(x)]));
    setTrashMsg(`הועברו ${res.done.length}. לא הועברו ${res.failed.length}: ` + res.failed.map((f) => `${names.get(f.id) ?? f.id} (${f.error})`).join("; "));
  }
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_v_admin_matters").select("*").order("dispatched_at", { ascending: false }).limit(100);
      if (live) setRows((data as Row[] | null) ?? []);
    })();
    return () => { live = false; };
  }, []);
  const risk = (r: string | null) => (r === "HIGH_RISK" ? <span className="ck-badge red">🔴 סיכון גבוה</span> : r === "CAUTION" ? <span className="ck-badge yellow">🟡 זהירות</span> : r === "NOT_ASSESSED" ? <span className="ck-badge">לא נבדק</span> : <span className="ck-badge green">🟢 תקין</span>);
  return (
    <div className="ck-stack">
      <div className="ck-card ck-hero"><div className="ck-hero-art"><HeroArt /></div><div className="ck-row" style={{ justifyContent: "space-between", flex: 1 }}><div><div className="ck-hero-title">{firmName}</div><div className="ck-meta">{userName} · {ROLE[role] ?? role}</div></div><span className="ck-pii">🔒 PII Masked &amp; Secured</span></div></div>
      <div className="ck-label">מה עושים עכשיו?</div>
      <div className="ck-grid2">
        <div className="ck-card"><div className="ck-card-head"><CardArt name="intake" /><div className="ck-title">פתיחת תיק חדש</div></div><div className="ck-meta">מעלים מסמך או מדביקים טקסט. המערכת מסתירה פרטים מזהים, בודקת ניגוד עניינים ומסמנת סיכונים.</div><div className="ck-row"><button className="ck-btn primary" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>תיק חדש</button><Link className="ck-btn" to="/workspace/import">ייבוא מתיקייה</Link></div></div>
        <div className="ck-card"><div className="ck-card-head"><CardArt name="guide" /><div className="ck-title">מדריך קצר</div></div><div className="ck-meta">מה קורה לכל מסמך, איך עובד אישור השותף, ומה נמחק ומתי.</div><Link className="ck-btn" to="/workspace/guide">לפתיחת המדריך</Link></div>
        <div className="ck-card"><div className="ck-card-head"><CardArt name="admin" /><div className="ck-title">מסך הניהול</div></div><div className="ck-meta">כל התיקים, חריגות SLA ויומן ניגוד עניינים.</div><Link className="ck-btn" to="/admin/matters">לניהול</Link></div>
        <div className="ck-card"><div className="ck-card-head"><CardArt name="billing" /><div className="ck-title">חיוב והגדרות</div></div><div className="ck-meta">מסלול, מושבים, חשבוניות וטלפון להתראות.</div><Link className="ck-btn" to="/settings/billing">להגדרות</Link></div>
        <div className="ck-card"><div className="ck-card-head"><CardArt name="security" /><div className="ck-title">אבטחת חשבון</div></div><div className="ck-meta">הפעלת אימות דו-שלבי: קוד מהטלפון בנוסף לסיסמה.</div><Link className="ck-btn" to="/settings/security">להפעלה</Link></div>
      </div>
      <div className="ck-meta">חומרי התיק נשמרים לפי חוק לשכת עורכי הדין (7 שנים מסיום הטיפול, 25 למסמכי מקרקעין). מחיקה אחרי 30 יום אפשרית רק בתיק שבו הלקוח הסכים בכתב.</div>
      {adding && <div className="ck-card"><IntakeForm firmId={firmId} matters={rows?.map((x) => ({ id: x.matter_id, label: name(x) }))} onDone={(m) => nav(`/workspace?matter=${m}`)} /></div>}
      {rows && <MatterInsights rows={rows} />}
      <div className="ck-label">תיקים</div>
      {isPartner && sel.size > 0 && (
        <div className="ck-card ck-row" role="toolbar" aria-label="פעולות על התיקים המסומנים">
          <span className="ck-title">{sel.size} תיקים מסומנים</span>
          <button className="ck-btn danger" onClick={() => { setBulkOpen(true); setReason(""); setTrashMsg(""); }}>העברת המסומנים לסל</button>
          <button className="ck-btn" onClick={() => setSel(new Set())}>ניקוי סימון</button>
        </div>)}
      {rows == null ? <div className="ck-meta">טוען...</div> : rows.length === 0 ? <div className="ck-card ck-empty"><EmptyArt /><div className="ck-meta">אין תיקים עדיין. פתחו תיק חדש כדי להתחיל.</div></div> : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr>{isPartner && <th><input type="checkbox" aria-label="סימון כל התיקים" checked={sel.size > 0 && sel.size === rows.length} onChange={(e) => setSel(setAll(rows.map((x) => x.matter_id), e.target.checked))} /></th>}<th>תיק</th><th>תחום</th><th>סטטוס</th><th>ניגוד עניינים</th><th>סיכון</th><th>תגובת שותף</th><th>נקלט</th>{isPartner && <th>סל</th>}</tr></thead><tbody>
          {rows.map((x) => { const [t, l] = CONFLICT[x.conflict_status] ?? ["yellow", x.conflict_status]; return (
            <tr key={x.matter_id} className={x.sla_breached ? "breach" : ""}>
              {isPartner && <td><input type="checkbox" aria-label={`סימון ${name(x)}`} checked={sel.has(x.matter_id)} onChange={() => setSel((s0) => toggle(s0, x.matter_id))} /></td>}
              <td><Link to={`/workspace?matter=${x.matter_id}`} style={{ textDecoration: "underline" }}>{name(x)}</Link></td>
              <td>{PRACTICE[x.practice_area]}</td><td>{MATTER_STATUS[x.matter_status]}</td><td><span className={`ck-badge ${t}`}>{l}</span></td><td>{risk(x.risk_level)}</td><td>{RESPONSE[x.partner_response]}</td><td>{fmt(x.dispatched_at)}</td>
              {isPartner && <td><button className="ck-btn" aria-label={`העברת ${name(x)} לסל המיחזור`} onClick={() => { setTrashing(x); setReason(""); setTrashMsg(""); }}>התיק לסל</button></td>}
            </tr>); })}
        </tbody></table></div>
      )}
      {bulkOpen && (
        <aside className="ck-drawer" aria-label="העברת תיקים מסומנים לסל המיחזור">
          <div className="ck-title">העברת {sel.size} תיקים לסל המיחזור</div>
          <div className="ck-card" style={{ whiteSpace: "normal" }}>{rows?.filter((x) => sel.has(x.matter_id)).map((x) => name(x)).join(" · ")}</div>
          <div className="ck-meta">התיקים יוסתרו מכל המסכים וניתן יהיה לשחזר כל אחד מסל המיחזור. כל תיק נרשם ביומן בנפרד עם אותה סיבה. מחיקה סופית נעשית משם בלבד.</div>
          <label className="ck-field">סיבה (נרשמת בכל תיק)
            <input className="ck-input" value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
          </label>
          {trashMsg && <div className="ck-err" role="status">{trashMsg}</div>}
          {busy && <div className="ck-meta" role="status">מעביר {busy}...</div>}
          <div className="ck-row"><button className="ck-btn danger" disabled={busy !== null || sel.size === 0 || reason.trim().length < 3} onClick={() => void bulkToBin()}>העברה לסל</button><button className="ck-btn" disabled={busy !== null} onClick={() => setBulkOpen(false)}>סגירה</button></div>
        </aside>
      )}
      {trashing && (
        <aside className="ck-drawer" aria-label="העברה לסל המיחזור">
          <div className="ck-title">העברת התיק לסל המיחזור</div>
          <div className="ck-card" style={{ whiteSpace: "normal" }}>{name(trashing)}</div>
          <div className="ck-meta">התיק יוסתר מכל המסכים וניתן יהיה לשחזר אותו מסל המיחזור. מחיקה סופית נעשית משם בלבד.</div>
          <label className="ck-field">סיבה (נרשמת בתיק)
            <input className="ck-input" value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
          </label>
          {trashMsg && <div className="ck-err" role="status">{trashMsg}</div>}
          <div className="ck-row"><button className="ck-btn danger" disabled={reason.trim().length < 3} onClick={() => void moveToBin()}>העברה לסל</button><button className="ck-btn" onClick={() => setTrashing(null)}>ביטול</button></div>
        </aside>
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
      {({ member, platformAdmin }) => member && (matterId
        ? <MatterCockpit key={matterId} matterId={matterId} member={member} platformAdmin={platformAdmin} />
        : <MatterList platformAdmin={platformAdmin} firmId={member.firm_id} firmName={member.lalum_firms.firm_name} userName={member.name} role={member.role} />)}
    </CockpitFrame>
  );
}
