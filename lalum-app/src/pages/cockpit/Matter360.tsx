// Matter 360: one matter on one screen, from the real tables (matter, fee terms, client, hours, documents).
// Addressed as /workspace/matter-360?matter=<uuid>: the site has no SPA catch-all, so only prerendered
// paths resolve on a direct hit or refresh. Read only; documents and review stay in the matter cockpit.
import { useClientNames } from "../../components/cockpit/ClientNames";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { ProceduralDeadlinesTab } from "../../components/matter/ProceduralDeadlinesTab";
import { CONFLICT, MATTER_STATUS, PRACTICE, fmt, money } from "../../lib/cockpit/shared";
import { FEE_MODEL_LABEL, MATTER_STAGES, TIME_STATUS_LABEL, hours, isUuid, stageIndex, timeSummary } from "../../lib/cockpit/matter360Core";
import { useMatter360 } from "../../lib/cockpit/matter360";
import type { Matter360Data } from "../../lib/cockpit/matter360";
import { useTrustSummary } from "../../lib/cockpit/crmTrust";
import "../../styles/crm.css";

type Tab = "docs" | "billing" | "deadlines";

function Header({ d }: { d: Matter360Data }) {
  const cn = useClientNames();
  const m = d.matter, [tone, conflict] = CONFLICT[m.conflict_status] ?? ["yellow", m.conflict_status], at = stageIndex(m.status);
  return (
    <header className="ck-card" style={{ marginBottom: 14 }}>
      <div className="ck-card-head"><h2 className="ck-title">{cn.name(m)}</h2><span className="ck-badge green">{MATTER_STATUS[m.status] ?? m.status}</span></div>
      <div className="ck-grid2">
        <div><div className="ck-meta">לקוח</div><b>{d.clientName == null ? "לא שויך לקוח" : cn.text(d.clientName)}</b></div>
        <div><div className="ck-meta">תחום</div><b>{PRACTICE[m.practice_area] ?? m.practice_area}</b></div>
        <div><div className="ck-meta">ניגוד עניינים</div><span className={`ck-badge ${tone}`}>{conflict}</span></div>
        <div><div className="ck-meta">נקלט</div><b>{fmt(m.created_at)}</b></div>
      </div>
      <div className="crm-pipe" role="list" aria-label="שלב התיק" style={{ marginTop: 10 }}>
        {MATTER_STAGES.map((s, i) => <span key={s} role="listitem" className={i === at ? "on" : ""} aria-current={i === at ? "step" : undefined}>{MATTER_STATUS[s]}</span>)}
      </div>
    </header>
  );
}

function Docs({ d }: { d: Matter360Data }) {
  return (
    <section className="ck-card" aria-label="מסמכי התיק">
      <div className="ck-card-head"><h3 className="ck-title">מסמכי התיק</h3><Link className="ck-btn" to={`/workspace?matter=${d.matter.id}`}>פתיחה בקוקפיט התיק</Link></div>
      {d.docs.length === 0 ? <div className="ck-empty">אין מסמכים בתיק.</div> : (
        <ul className="crm-list">{d.docs.map((x) => <li key={x.id}><span><bdi>{x.file_name}</bdi></span><span className="ck-meta">{x.doc_type ? `${x.doc_type} · ` : ""}{fmt(x.doc_date ?? x.created_at)}</span></li>)}</ul>
      )}
    </section>
  );
}

function Billing({ d, showTrust }: { d: Matter360Data; showTrust: boolean }) {
  const s = timeSummary(d.time), fee = d.fee;
  return (
    <section aria-label="חיוב" className="ck-stack">
      <div className="ck-card">
        <div className="ck-card-head"><h3 className="ck-title">תנאי שכר טרחה</h3>{fee && <span className={`ck-badge ${fee.billing_active ? "green" : "yellow"}`}>{fee.billing_active ? "החיוב פעיל" : "החיוב טרם הופעל"}</span>}</div>
        {!fee ? <div className="ck-empty">לא הוגדרו תנאי שכר טרחה לתיק.</div> : (
          <div className="ck-grid2">
            <div><div className="ck-meta">מודל</div><b>{FEE_MODEL_LABEL[fee.fee_model] ?? fee.fee_model}</b></div>
            {fee.fixed_fee != null && <div><div className="ck-meta">שכר קבוע</div><b>{money(fee.fixed_fee)}</b></div>}
            {fee.fee_cap != null && <div><div className="ck-meta">תקרה</div><b>{money(fee.fee_cap)}</b></div>}
            {fee.retainer_monthly != null && <div><div className="ck-meta">ריטיינר חודשי</div><b>{money(fee.retainer_monthly)}</b></div>}
          </div>
        )}
      </div>
      <div className="ck-card">
        <div className="ck-card-head"><h3 className="ck-title">שעות עבודה</h3><span className="ck-badge green">{hours(s.totalBillable)} שעות לחיוב</span></div>
        <div className="crm-split" style={{ marginBottom: 10 }}>
          <span>אושרו וממתינות לחיוב<b>{hours(s.approvedUnbilled)} ש׳</b></span>
          <span>הוגשו לאישור<b>{hours(s.submitted)} ש׳</b></span>
          <span>טיוטות<b>{hours(s.draft)} ש׳</b></span>
          <span>חויבו<b>{hours(s.billed)} ש׳</b></span>
        </div>
        {d.time.length === 0 ? <div className="ck-empty">אין רישומי שעות בתיק.</div> : (
          <ul className="crm-list">{d.time.slice(0, 30).map((t) => <li key={t.id}><span>{t.narrative || "ללא תיאור"} <span className="ck-meta" dir="ltr">{t.work_date}</span></span><span>{hours(t.billable_minutes)} ש׳ <span className="ck-badge yellow">{TIME_STATUS_LABEL[t.status] ?? t.status}</span></span></li>)}</ul>
        )}
      </div>
      {showTrust && (
        <div className="ck-card"><div className="ck-card-head"><h3 className="ck-title">כספי נאמנות בתיק</h3><span className="ck-badge green">{money(d.trustHeld)}</span></div>
          <div className="ck-meta">התחייבות ללקוח, אינה הכנסה. התנועות מתבצעות במסך הכספים, לשונית נאמנות.</div></div>
      )}
    </section>
  );
}

function MatterView({ id }: { id: string }) {
  const m = useMatter360(id);
  const trust = useTrustSummary();
  const [tab, setTab] = useState<Tab>("docs");
  if (m.state === "loading") return <div className="ck-meta">טוען...</div>;
  if (m.state === "missing") return <div className="ck-card ck-empty">התיק לא נמצא, או שאין לכם הרשאה אליו. <Link to="/workspace">לרשימת התיקים</Link></div>;
  const tabs: Array<[Tab, string]> = [["docs", "מסמכים"], ["billing", "חיוב"], ["deadlines", "מחשבון מועדים"]];
  return (
    <>
      <Header d={m.data} />
      <div className="crm-tabs" role="group" aria-label="לשוניות תיק">
        {tabs.map(([k, label]) => <button key={k} type="button" className="ck-btn" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === "docs" && <Docs d={m.data} />}
      {tab === "billing" && <Billing d={m.data} showTrust={trust.state === "ready"} />}
      {tab === "deadlines" && <ProceduralDeadlinesTab milestones={[]} />}
    </>
  );
}

export function Matter360Page() {
  const [q] = useSearchParams();
  const id = q.get("matter");
  return (
    <CockpitFrame title="תיק 360" description="מרכז הפעילות סביב התיק." path="/workspace/matter-360">
      {() => isUuid(id) ? <MatterView key={id} id={id} /> : <div className="ck-card ck-empty">בחרו תיק מרשימת התיקים כדי לראות אותו כאן. <Link to="/workspace">לרשימת התיקים</Link></div>}
    </CockpitFrame>
  );
}
