import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { rpcError } from "../../../lib/cockpit/financeApi";
import type { FinCustomer, FinDocument, FinPayment } from "../../../lib/cockpit/finance";
import {
  BUCKETS, BUCKET_LABEL, COOLDOWN_DAYS, DSO_MIN_SAMPLE, TIER_LABEL, agingReport, cooldownState, dsoByCustomer, lastReminderOn,
  reminderBlock, reminderText, tierFor, todayIL,
} from "../../../lib/cockpit/arAging";
import type { DunningEntry } from "../../../lib/cockpit/arAging";

const COLLECTIONS_ERRORS: Record<string, string> = {
  COOLDOWN_ACTIVE: `כבר נרשמה תזכורת ללקוח בשבעת הימים האחרונים. אפשר לרשום תזכורת נוספת רק אחרי ${COOLDOWN_DAYS} ימים.`,
  LOCK_REASON_REQUIRED: "חסימת חיוב דורשת סיבה.", BAD_TIER: "דרגת תזכורת לא תקינה.",
};
const errText = (m: string): string => COLLECTIONS_ERRORS[Object.keys(COLLECTIONS_ERRORS).find((k) => m.includes(k)) ?? ""] ?? rpcError(m);
const CHANNELS: Array<[string, string]> = [["EMAIL", 'דוא"ל'], ["WHATSAPP", "WhatsApp"], ["PHONE", "שיחת טלפון"], ["MANUAL", "אחר"]];

export function ArAgingTab({ customers, docs, payments, dunning, onChange }: {
  customers: FinCustomer[]; docs: FinDocument[]; payments: FinPayment[]; dunning: DunningEntry[]; onChange: () => void;
}) {
  const today = todayIL();
  const report = useMemo(() => agingReport(customers, docs, payments, today), [customers, docs, payments, today]);
  const dso = useMemo(() => dsoByCustomer(customers, docs, payments, today), [customers, docs, payments, today]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [channel, setChannel] = useState("EMAIL");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errText(error.message) });
    setMsg({ ok: true, text: ok }); onChange();
  }
  const toggleLock = (id: string, lock: boolean) => {
    if (!supabase) return;
    let reason: string | null = null;
    if (lock) {
      reason = window.prompt("סיבת החסימה (תישמר ברשומה):", "יתרה פתוחה מעל 60 יום");
      if (reason === null) return;
    } else if (!window.confirm("לשחרר את חסימת החיוב ללקוח?")) return;
    void run(() => supabase!.rpc("lalum_fin_set_collections_lock", { p_customer: id, p_locked: lock, p_reason: reason }), lock ? "החיוב ללקוח נחסם." : "החסימה שוחררה.");
  };
  const logReminder = (id: string, tier: number) => {
    if (!supabase) return;
    void run(() => supabase!.rpc("lalum_fin_log_reminder", { p_customer: id, p_tier: tier, p_channel: channel, p_note: null }), "התזכורת נרשמה.");
  };
  const refreshDso = () => {
    if (!supabase) return;
    void run(async () => {
      const now = new Date().toISOString();
      for (const c of customers) {
        const d = dso.get(c.id);
        if (!d || d.sample === 0) continue;
        const r = await supabase!.from("lalum_fin_customers").update({ historical_dso_days: d.days, dso_sample_size: d.sample, dso_computed_at: now }).eq("id", c.id);
        if (r.error) return r;
      }
      return { error: null };
    }, "ימי הגבייה ההיסטוריים עודכנו.");
  };

  return (
    <div className="ck-stack">
      <div className="ck-meta">
        הגיול נמדד ממועד התשלום שנקבע בחשבונית (ללא מועד, ממועד ההפקה). נספרות חשבוניות מס שהופקו בלבד, בניכוי תשלומים, קבלות וזיכויים.
        כספי נאמנות אינם חלק מהמסך הזה. תזכורות נרשמות כאן אך אינן נשלחות אוטומטית.
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-grid2">
        {BUCKETS.map((b) => (
          <div key={b} className="ck-card fin-stat">
            <div className="ck-meta">{BUCKET_LABEL[b]}</div>
            <div className="fin-figure">{money(report.totals[b])}</div>
          </div>
        ))}
      </div>
      <div className="ck-card fin-stat">
        <div className="ck-meta">סך יתרות פתוחות</div>
        <div className="fin-figure">{money(report.total)}</div>
        <div className="fin-note">מתוכן עדיין לפני מועד התשלום: <bdi>{money(report.notYetDue)}</bdi>.</div>
      </div>
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>ערוץ לרישום תזכורת
          <select className="ck-select" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ maxWidth: 160 }}>{CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <button className="ck-btn" disabled={busy} onClick={refreshDso}>עדכון ימי גבייה היסטוריים (DSO)</button>
      </div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr>
        <th>לקוח</th>{BUCKETS.map((b) => <th key={b} className="fin-num">{BUCKET_LABEL[b]}</th>)}<th className="fin-num">סה"כ</th><th>DSO</th><th>סטטוס</th><th></th>
      </tr></thead><tbody>
        {report.customers.length ? report.customers.map((c) => {
          const last = lastReminderOn(dunning, c.customerId);
          const cd = cooldownState(last, today);
          const tier = tierFor(c.oldestDaysPastDue);
          const blocked = reminderBlock(c.oldestDaysPastDue, last, today);
          const d = dso.get(c.customerId);
          const open = draftFor === c.customerId;
          return (
            <tr key={c.customerId}>
              <td className="fin-text"><span className="fin-name">{c.name}</span><span className="fin-sub">הישן ביותר: {Math.max(0, c.oldestDaysPastDue)} ימים אחרי המועד</span></td>
              {BUCKETS.map((b) => <td key={b} className="fin-num">{c.buckets[b] ? money(c.buckets[b]) : ""}</td>)}
              <td className="fin-num"><b>{money(c.total)}</b></td>
              <td className="fin-num">{d && d.sample >= DSO_MIN_SAMPLE ? `${d.days} ימים (${d.sample})` : d && d.sample > 0 ? `${d.days} ימים, מדגם קטן (${d.sample})` : "אין נתונים"}</td>
              <td>
                {c.locked && <span className="ck-badge red" title={c.lockReason ?? ""}>חיוב חסום</span>}
                {!c.locked && c.shouldLock && <span className="ck-badge yellow">מועמד לחסימה</span>}
                {cd.active && <span className="ck-badge green">בהמתנה, עוד {cd.daysLeft} ימים</span>}
                {tier && !cd.active && <span className="ck-badge yellow">{TIER_LABEL[tier]}</span>}
              </td>
              <td className="fin-actions-cell"><div className="fin-actions">
                <button className="ck-btn sm" disabled={busy} onClick={() => toggleLock(c.customerId, !c.locked)}>{c.locked ? "שחרור חסימה" : "חסימת חיוב"}</button>
                <button className="ck-btn sm" disabled={!tier} onClick={() => setDraftFor(open ? null : c.customerId)}>טיוטת תזכורת</button>
              </div>
              {open && tier && (
                <div className="ck-stack" style={{ marginTop: 8 }}>
                  <textarea className="ck-input" rows={5} readOnly value={reminderText(tier, c.name, c.total, Math.max(0, c.oldestDaysPastDue))} onFocus={(e) => e.currentTarget.select()} />
                  <div className="ck-meta">הטיוטה לעיון ולהעתקה. השליחה בפועל נעשית מחוץ למערכת.</div>
                  <button className="ck-btn sm primary" disabled={busy || blocked !== null} onClick={() => logReminder(c.customerId, tier)}>{blocked === "COOLDOWN" ? "בהמתנה" : "רישום שהתזכורת נשלחה"}</button>
                </div>
              )}</td>
            </tr>);
        }) : <tr><td colSpan={9}>אין יתרות פתוחות</td></tr>}
      </tbody></table></div>
    </div>
  );
}
