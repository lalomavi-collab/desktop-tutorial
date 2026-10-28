// Matter 360: one matter on one screen, from the real tables (matter, fee terms, client, hours, documents).
// Addressed as /workspace/matter-360?matter=<uuid>: the site has no SPA catch-all, so only prerendered
// paths resolve on a direct hit or refresh. Two things are entered here: fee terms (finance level 4) and deadlines
// (the matter team). Documents and review stay in the matter cockpit.
import { useClientNames } from "../../components/cockpit/ClientNames";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { ProceduralDeadlinesTab } from "../../components/matter/ProceduralDeadlinesTab";
import { CONFLICT, MATTER_STATUS, PRACTICE, fmt, money } from "../../lib/cockpit/shared";
import { FEE_FIELDS, FEE_FIELD_LABEL, FEE_MODELS, FEE_MODEL_LABEL, MATTER_STAGES, TIME_STATUS_LABEL, feeFormFrom, hours, isUuid, parseFeeForm, stageIndex, timeSummary } from "../../lib/cockpit/matter360Core";
import type { FeeForm } from "../../lib/cockpit/matter360Core";
import { saveFeeTerms, useFinLevel, useMatter360 } from "../../lib/cockpit/matter360";
import type { FeeRow, Matter360Data } from "../../lib/cockpit/matter360";
import { useTrustSummary } from "../../lib/cockpit/crmTrust";
import { useMatterWip } from "../../lib/cockpit/billingWip";
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

/** Fee terms: shown and edited from finance level 4, which is also what RLS on lalum_matter_fees requires. */
function FeeTerms({ d }: { d: Matter360Data }) {
  const level = useFinLevel(d.matter.firm_id);
  const [fee, setFee] = useState<FeeRow | null>(d.fee);
  const [form, setForm] = useState<FeeForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canEdit = level != null && level >= 4;
  const save = async () => {
    if (!form) return;
    const p = parseFeeForm(form);
    if (!p.ok) { setErr(p.error); return; }
    setBusy(true);
    const e = await saveFeeTerms(d.matter.id, d.matter.firm_id, p.terms);
    setBusy(false);
    if (e) { setErr(e); return; }
    setFee({ billing_active: fee?.billing_active ?? false, fin_customer_id: fee?.fin_customer_id ?? null, ...p.terms });
    setForm(null);
    setErr(null);
  };
  return (
    <div className="ck-card">
      <div className="ck-card-head"><h3 className="ck-title">תנאי שכר טרחה</h3>
        {fee && <span className={`ck-badge ${fee.billing_active ? "green" : "yellow"}`}>{fee.billing_active ? "החיוב פעיל" : "החיוב טרם הופעל"}</span>}
        {canEdit && !form && <button type="button" className="ck-btn" onClick={() => { setForm(feeFormFrom(fee)); setErr(null); }}>{fee ? "עריכה" : "הגדרת תנאים"}</button>}
      </div>
      {form ? (
        <>
          <div className="ck-grid2">
            <label className="ck-field"><span className="ck-label">מודל</span>
              <select className="ck-input" value={form.fee_model} onChange={(e) => setForm({ ...form, fee_model: e.target.value })}>{FEE_MODELS.map((k) => <option key={k} value={k}>{FEE_MODEL_LABEL[k]}</option>)}</select>
            </label>
            {FEE_FIELDS[form.fee_model].map((k) => (
              <label key={k} className="ck-field"><span className="ck-label">{FEE_FIELD_LABEL[k]} (₪, לפני מע"מ)</span><input className="ck-input" inputMode="decimal" dir="ltr" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
            ))}
            {FEE_FIELDS[form.fee_model].includes("fee_cap") && (
              <label className="ck-field"><span className="ck-label">התרעה באחוז מהתקרה</span><input className="ck-input" inputMode="numeric" dir="ltr" value={form.cap_alert_pct} onChange={(e) => setForm({ ...form, cap_alert_pct: e.target.value })} /></label>
            )}
          </div>
          <div className="ck-meta">השמירה אינה מפעילה חיוב. הפעלת החיוב דורשת הסכם שכר טרחה חתום, והיא נעשית במסך הכספים.</div>
          <div className="crm-actions" style={{ marginTop: 8 }}>
            <button type="button" className="ck-btn primary" disabled={busy} onClick={() => void save()}>{busy ? "שומר..." : "שמירה"}</button>
            <button type="button" className="ck-btn" disabled={busy} onClick={() => { setForm(null); setErr(null); }}>ביטול</button>
          </div>
        </>
      ) : !fee ? (
        <div className="ck-empty">{level != null && level < 4 ? "תנאי שכר הטרחה מוצגים ונערכים רק עם הרשאת כספים מלאה." : "לא הוגדרו תנאי שכר טרחה לתיק."}</div>
      ) : (
        <div className="ck-grid2">
          <div><div className="ck-meta">מודל</div><b>{FEE_MODEL_LABEL[fee.fee_model] ?? fee.fee_model}</b></div>
          {fee.fixed_fee != null && <div><div className="ck-meta">שכר קבוע</div><b>{money(fee.fixed_fee)}</b></div>}
          {fee.fee_cap != null && <div><div className="ck-meta">תקרה</div><b>{money(fee.fee_cap)}</b></div>}
          {fee.retainer_monthly != null && <div><div className="ck-meta">ריטיינר חודשי</div><b>{money(fee.retainer_monthly)}</b></div>}
        </div>
      )}
      {err && <div className="crm-banner red" role="alert" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function Billing({ d, showTrust }: { d: Matter360Data; showTrust: boolean }) {
  const s = timeSummary(d.time);
  const wip = useMatterWip(d.matter.id, true);
  return (
    <section aria-label="חיוב" className="ck-stack">
      <FeeTerms d={d} />
      <div className="ck-card">
        <div className="ck-card-head"><h3 className="ck-title">שווי שעות לחיוב</h3>{wip.state === "ready" && <span className="ck-badge green">{money(wip.data.billableValue)}</span>}</div>
        {wip.state === "loading" && <div className="ck-meta">טוען...</div>}
        {wip.state === "denied" && <div className="ck-meta">הסכומים מוצגים רק לבעלי הרשאת כספים.</div>}
        {wip.state === "unavailable" && <div className="ck-meta">תמחור השעות אינו זמין עדיין: פונקציית החיוב (מיגרציה 0021) טרם הופעלה במסד הנתונים. השעות עצמן מוצגות למטה.</div>}
        {wip.state === "ready" && (
          <>
            <div className="ck-meta">שעות שאושרו ועדיין לא חויבו, לפי כרטיסי התעריפים של הפירמה (קודם כרטיס התיק, אחר כך כרטיס הפירמה, לפי תפקיד).</div>
            {wip.data.entriesWithoutRate > 0 && <div className="crm-banner red" role="alert">{wip.data.entriesWithoutRate} רישומים ללא תעריף אינם נכללים בסכום. הגדירו כרטיס תעריפים לתפקיד.</div>}
            {wip.data.awaitingApproval > 0 && <div className="crm-banner yellow" role="note">{wip.data.awaitingApproval} רישומים ממתינים לאישור ואינם נכללים בסכום.</div>}
            {wip.data.entries.length > 0 && (
              <ul className="crm-list">{wip.data.entries.map((e) => <li key={e.id}><span>{e.narrative || "ללא תיאור"} <span className="ck-meta" dir="ltr">{e.workDate}</span>{e.timekeeper ? <span className="ck-meta"> · {e.timekeeper}</span> : null}</span><span>{hours(e.minutes)} ש׳ {e.rate != null ? `× ${money(e.rate)}` : <span className="ck-badge red">ללא תעריף</span>} {e.amount != null && <b>{money(e.amount)}</b>} <span className="ck-badge yellow">{TIME_STATUS_LABEL[e.status] ?? e.status}{e.reserved ? ", שמור לחשבון" : ""}</span></span></li>)}</ul>
            )}
            {wip.data.disbursementsTotal > 0 && <div className="ck-meta">הוצאות להשבה שטרם חויבו: <b>{money(wip.data.disbursementsTotal)}</b></div>}
          </>
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
  const tabs: Array<[Tab, string]> = [["docs", "מסמכים"], ["billing", "חיוב"], ["deadlines", "מועדים"]];
  return (
    <>
      <Header d={m.data} />
      <div className="crm-tabs" role="group" aria-label="לשוניות תיק">
        {tabs.map(([k, label]) => <button key={k} type="button" className="ck-btn" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === "docs" && <Docs d={m.data} />}
      {tab === "billing" && <Billing d={m.data} showTrust={trust.state === "ready"} />}
      {tab === "deadlines" && <ProceduralDeadlinesTab matterId={m.data.matter.id} />}
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
