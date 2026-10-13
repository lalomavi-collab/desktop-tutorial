import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { rpcError, sendReminder, sendReminderError } from "../../../lib/cockpit/financeApi";
import { ACCOUNTING_BASIS, whatsappConsentActive } from "../../../lib/cockpit/finance";
import type { FinCustomer, FinDocument, FinPayment } from "../../../lib/cockpit/finance";
import {
  BUCKETS, BUCKET_LABEL, COOLDOWN_DAYS, DSO_MIN_SAMPLE, TIER_LABEL, agingReport, cooldownState, dsoByCustomer, lastReminderOn,
  fmtDay, reminderBlock, reminderText, tierFor, todayIL,
} from "../../../lib/cockpit/arAging";
import type { DunningEntry } from "../../../lib/cockpit/arAging";

const COLLECTIONS_ERRORS: Record<string, string> = {
  COOLDOWN_ACTIVE: `כבר נרשמה תזכורת ללקוח בשבעת הימים האחרונים. אפשר לרשום תזכורת נוספת רק אחרי ${COOLDOWN_DAYS} ימים.`,
  LOCK_REASON_REQUIRED: "חסימת חיוב דורשת סיבה.", BAD_TIER: "דרגת תזכורת לא תקינה.",
  NOT_LOCKED: "הלקוח אינו חסום.", BAD_DAYS: "מספר הימים לחריג הוא בין 1 ל-30.", OVERRIDE_REASON_REQUIRED: "חריג דורש סיבה.",
};
const errText = (m: string): string => COLLECTIONS_ERRORS[Object.keys(COLLECTIONS_ERRORS).find((k) => m.includes(k)) ?? ""] ?? rpcError(m);
const CHANNELS: Array<[string, string]> = [["EMAIL", 'דוא"ל'], ["WHATSAPP", "WhatsApp"], ["PHONE", "שיחת טלפון"], ["MANUAL", "אחר"]];

export function ArAgingTab({ customers, docs, payments, dunning, canOverride, onChange }: {
  customers: FinCustomer[]; docs: FinDocument[]; payments: FinPayment[]; dunning: DunningEntry[]; canOverride: boolean; onChange: () => void;
}) {
  const today = todayIL();
  const report = useMemo(() => agingReport(customers, docs, payments, today), [customers, docs, payments, today]);
  const dso = useMemo(() => dsoByCustomer(customers, docs, payments, today), [customers, docs, payments, today]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
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
  const override = (id: string, cancel: boolean) => {
    if (!supabase) return;
    let days = 0, reason: string | null = null;
    if (!cancel) {
      const d = window.prompt("לכמה ימים לאשר חריג לרישום שעות (1 עד 30)?", "7");
      if (d === null) return;
      days = Number(d);
      reason = window.prompt("סיבת החריג (תישמר ברשומה):", "");
      if (reason === null) return;
    } else if (!window.confirm("לבטל את החריג? רישום שעות חדשות ייחסם שוב.")) return;
    void run(() => supabase!.rpc("lalum_fin_override_collections_lock", { p_customer: id, p_days: days, p_reason: reason }), cancel ? "החריג בוטל." : "החריג אושר.");
  };
  /** Sends on the partner's click. The recipient is chosen by the server from the customer card; the dialog only shows it for confirmation. */
  async function send(row: { customerId: string; name: string; total: number; oldestDaysPastDue: number }, tier: 1 | 2 | 3, channel: "EMAIL" | "WHATSAPP", test: boolean, text: string) {
    if (busy) return;
    const card = byId.get(row.customerId);
    const dest = test ? "הכתובת שלכם (בדיקה)" : channel === "EMAIL" ? card?.email : card?.phone;
    if (!dest) return setMsg({ ok: false, text: sendReminderError({ code: channel === "EMAIL" ? "no_email" : "no_mobile" }) });
    if (!window.confirm(test ? "לשלוח הודעת בדיקה אליכם? היא לא תיספר כתזכורת ללקוח." : `לשלוח ${TIER_LABEL[tier]} ל${row.name} (${dest})? לא ניתן לבטל שליחה.`)) return;
    setBusy(true);
    const r = await sendReminder({ customer_id: row.customerId, tier, channel, test, body: text, name: row.name, amount: row.total, days: Math.max(0, row.oldestDaysPastDue) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: sendReminderError(r) });
    setMsg({ ok: true, text: test ? "הודעת הבדיקה נשלחה אליכם." : `התזכורת נשלחה${r.warning ? ", אך הרישום ביומן לא הושלם. בדקו ביומן" : " ונרשמה ביומן"}.` });
    if (!test) onChange();
  }
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
        הגיול נמדד ממועד התשלום שנקבע במסמך (ללא מועד, ממועד ההפקה). {ACCOUNTING_BASIS === "CASH" ? "בבסיס מזומן החוב הוא חשבון עסקה שהופק ועדיין לא נסגר במסמך מס." : "נספרות חשבוניות מס שהופקו, בניכוי תשלומים, קבלות וזיכויים."}
        כספי נאמנות אינם חלק מהמסך הזה. תזכורת נשלחת רק בלחיצה של שותף, אחרי עיון בנוסח, ואף פעם לא אוטומטית.
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
                {c.locked && !c.overrideUntil && <span className="ck-badge red" title={c.lockReason ?? ""}>חיוב חסום</span>}
                {c.locked && c.overrideUntil && <span className="ck-badge yellow" title={c.lockReason ?? ""}>חריג עד {fmtDay(c.overrideUntil)}</span>}
                {!c.locked && c.shouldLock && <span className="ck-badge yellow">מועמד לחסימה</span>}
                {cd.active && <span className="ck-badge green">בהמתנה, עוד {cd.daysLeft} ימים</span>}
                {tier && !cd.active && <span className="ck-badge yellow">{TIER_LABEL[tier]}</span>}
              </td>
              <td className="fin-actions-cell"><div className="fin-actions">
                <button className="ck-btn sm" disabled={busy} onClick={() => toggleLock(c.customerId, !c.locked)}>{c.locked ? "שחרור חסימה" : "חסימת חיוב"}</button>
                {c.locked && canOverride && <button className="ck-btn sm" disabled={busy} onClick={() => override(c.customerId, !!c.overrideUntil)}>{c.overrideUntil ? "ביטול חריג" : "אישור חריג"}</button>}
                <button className="ck-btn sm" disabled={!tier} onClick={() => setDraftFor(open ? null : c.customerId)}>טיוטת תזכורת</button>
              </div>
              {open && tier && (
                <div className="ck-stack" style={{ marginTop: 8 }}>
                  <textarea className="ck-input" rows={6} value={edited[c.customerId] ?? reminderText(tier, c.name, c.total, Math.max(0, c.oldestDaysPastDue))} onChange={(e) => setEdited({ ...edited, [c.customerId]: e.target.value })} />
                  <div className="ck-meta">אפשר לערוך את הטיוטה. ההודעה נשלחת כפי שהיא מופיעה כאן, ללקוח בכתובת שבכרטיסו. וואטסאפ נשלח כתבנית מאושרת ואינו משתמש בנוסח הזה.</div>
                  <div className="fin-actions">
                    <button className="ck-btn sm primary" disabled={busy || blocked !== null || !byId.get(c.customerId)?.email} onClick={() => void send(c, tier, "EMAIL", false, edited[c.customerId] ?? reminderText(tier, c.name, c.total, Math.max(0, c.oldestDaysPastDue)))}>{blocked === "COOLDOWN" ? "בהמתנה" : "שליחה בדוא\"ל"}</button>
                    <button className="ck-btn sm" disabled={busy || blocked !== null || !byId.get(c.customerId)?.phone || !whatsappConsentActive(byId.get(c.customerId))} title={whatsappConsentActive(byId.get(c.customerId)) ? undefined : "אין הסכמה רשומה ל-WhatsApp. רשמו אותה בכרטיס הלקוח."} onClick={() => void send(c, tier, "WHATSAPP", false, "")}>שליחה ב-WhatsApp</button>
                    <button className="ck-btn sm" disabled={busy} onClick={() => void send(c, tier, "EMAIL", true, edited[c.customerId] ?? reminderText(tier, c.name, c.total, Math.max(0, c.oldestDaysPastDue)))}>בדיקה אליי</button>
                    <button className="ck-btn sm" disabled={busy || blocked !== null} onClick={() => logReminder(c.customerId, tier)}>רישום ידני (נשלח מחוץ למערכת)</button>
                  </div>
                </div>
              )}</td>
            </tr>);
        }) : <tr><td colSpan={9}>אין יתרות פתוחות</td></tr>}
      </tbody></table></div>
    </div>
  );
}
