import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import type { FinCustomer, FinDocument, FinPayment } from "../../../lib/cockpit/finance";
import { fmtDay, todayIL } from "../../../lib/cockpit/arAging";
import { SCENARIO_LABEL, applyScenario, buildForecast, compareToBase, planInflows } from "../../../lib/cockpit/cashFlow";
import type { CashItem, CashSettings, Scenario } from "../../../lib/cockpit/cashFlow";

export interface SettingsRow { opening_balance: number; balance_as_of: string | null; credit_facility: number; safety_reserve: number }
type ScenarioKey = Scenario["kind"];
const KEYS: ScenarioKey[] = ["BASE", "DELAY_TOP_CLIENTS", "FIRM_DSO_SHOCK", "WINDFALL"];
const SCHEDULE: Record<string, string> = { MONTHLY: "חודשי", ONCE: "חד פעמי" };

export function CashFlowTab({ firmId, customers, docs, payments, settings, items, onChange }: {
  firmId: string; customers: FinCustomer[]; docs: FinDocument[]; payments: FinPayment[]; settings: SettingsRow | null; items: CashItem[]; onChange: () => void;
}) {
  const today = todayIL();
  const cfg: CashSettings = { openingBalance: settings?.opening_balance ?? 0, creditFacility: settings?.credit_facility ?? 0, safetyReserve: settings?.safety_reserve ?? 50000 };
  const [kind, setKind] = useState<ScenarioKey>("BASE");
  const [days, setDays] = useState("30");
  const [clients, setClients] = useState("2");
  const [amount, setAmount] = useState("150000");
  const [week, setWeek] = useState("6");
  const [form, setForm] = useState({ opening: String(cfg.openingBalance), facility: String(cfg.creditFacility), reserve: String(cfg.safetyReserve) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [item, setItem] = useState({ label: "", direction: "OUT", schedule: "MONTHLY", day: "1", on: today, amount: "" });

  const plan = useMemo(() => planInflows(customers, docs, payments, today), [customers, docs, payments, today]);
  const base = useMemo(() => buildForecast(plan.inflows, items, cfg, today), [plan, items, cfg.openingBalance, cfg.creditFacility, cfg.safetyReserve, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenario: Scenario = kind === "DELAY_TOP_CLIENTS" ? { kind, clients: Number(clients) || 0, days: Number(days) || 0 }
    : kind === "FIRM_DSO_SHOCK" ? { kind, days: Number(days) || 0 } : kind === "WINDFALL" ? { kind, amount: Number(amount) || 0, weekNumber: Number(week) || 1 } : { kind };
  const sim = useMemo(() => {
    const s = applyScenario(plan.inflows, scenario, today);
    return buildForecast(s.inflows, items, cfg, today, s.extra);
  }, [plan, items, kind, days, clients, amount, week, cfg.openingBalance, cfg.creditFacility, cfg.safetyReserve, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = kind === "BASE" ? base : sim;
  const cmp = compareToBase(base, sim);
  const stale = settings?.balance_as_of ? Math.round((Date.parse(today) - Date.parse(settings.balance_as_of)) / 86400000) : null;

  async function saveSettings() {
    if (!supabase) return;
    const row = { firm_id: firmId, opening_balance: Number(form.opening), credit_facility: Number(form.facility), safety_reserve: Number(form.reserve), balance_as_of: today };
    if (![row.opening_balance, row.credit_facility, row.safety_reserve].every(Number.isFinite) || row.credit_facility < 0 || row.safety_reserve < 0) return setMsg({ ok: false, text: "הסכומים אינם תקינים." });
    const { error } = await supabase.from("lalum_fin_cashflow_settings").upsert(row);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "יתרת הפתיחה נשמרה, בתאריך של היום." }); onChange();
  }
  async function addItem() {
    if (!supabase) return;
    const amt = Number(item.amount), day = Number(item.day);
    if (!item.label.trim()) return setMsg({ ok: false, text: "שם הסעיף חובה." });
    if (!(amt > 0)) return setMsg({ ok: false, text: "הסכום חייב להיות גדול מאפס." });
    if (item.schedule === "MONTHLY" && !(day >= 1 && day <= 31)) return setMsg({ ok: false, text: "יום בחודש הוא בין 1 ל-31." });
    const { error } = await supabase.from("lalum_fin_cashflow_items").insert({
      firm_id: firmId, label: item.label.trim(), direction: item.direction, schedule: item.schedule, amount: amt,
      day_of_month: item.schedule === "MONTHLY" ? day : null, on_date: item.schedule === "ONCE" ? item.on : null,
    });
    if (error) return setMsg({ ok: false, text: error.message });
    setItem({ ...item, label: "", amount: "" }); setMsg(null); onChange();
  }
  async function removeItem(id: string) {
    if (!supabase || !window.confirm("למחוק את הסעיף?")) return;
    await supabase.from("lalum_fin_cashflow_items").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="ck-stack">
      <div className="ck-meta">
        תזרים ישיר ל-13 שבועות, מסתיים בימי שישי. תקבולים נקבעים לפי ימי הגבייה ההיסטוריים של הלקוח ולא לפי מועד התשלום בחשבונית. כספי נאמנות וחשבוניות פרופורמה אינם נכללים.
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      {stale !== null && stale > 7 && <div className="ck-warn">יתרת הפתיחה עודכנה לפני {stale} ימים. עדכנו אותה לפני שמסתמכים על התחזית.</div>}
      {settings === null && <div className="ck-warn">טרם הוזנה יתרת פתיחה. התחזית מניחה אפס.</div>}
      {shown.weeksBelowReserve > 0 && <div className="ck-err">ב-{shown.weeksBelowReserve} שבועות היתרה יורדת מתחת לסף הביטחון (<bdi>{money(cfg.safetyReserve)}</bdi>). שפל ב<bdi>שבוע {shown.minWeek}</bdi>: <bdi>{money(shown.minEnding)}</bdi>.</div>}

      <div className="ck-card ck-stack">
        <b>יתרת פתיחה ומסגרת</b>
        <div className="ck-grid2">
          <label className="ck-field">יתרת עו"ש היום<input className="ck-input" dir="ltr" inputMode="decimal" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} /></label>
          <label className="ck-field">מסגרת אשראי שלא נוצלה<input className="ck-input" dir="ltr" inputMode="decimal" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} /></label>
          <label className="ck-field">סף ביטחון<input className="ck-input" dir="ltr" inputMode="decimal" value={form.reserve} onChange={(e) => setForm({ ...form, reserve: e.target.value })} /></label>
        </div>
        <div className="ck-row"><button className="ck-btn primary" onClick={() => void saveSettings()}>שמירה</button></div>
      </div>

      <div className="ck-card ck-stack">
        <b>תרחיש</b>
        <div className="fin-subtabs" role="tablist" aria-label="תרחישים">
          {KEYS.map((k) => <button key={k} role="tab" aria-selected={kind === k} className="fin-subtab" onClick={() => setKind(k)}>{SCENARIO_LABEL[k]}</button>)}
        </div>
        {kind === "DELAY_TOP_CLIENTS" && <div className="ck-grid2">
          <label className="ck-field">מספר לקוחות גדולים (לפי יתרה פתוחה)<input className="ck-input" dir="ltr" inputMode="numeric" value={clients} onChange={(e) => setClients(e.target.value)} /></label>
          <label className="ck-field">ימי עיכוב<input className="ck-input" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></label>
        </div>}
        {kind === "FIRM_DSO_SHOCK" && <label className="ck-field">ימי עיכוב לכל התקבולים<input className="ck-input" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></label>}
        {kind === "WINDFALL" && <div className="ck-grid2">
          <label className="ck-field">סכום<input className="ck-input" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="ck-field">שבוע (1 עד 13)<input className="ck-input" dir="ltr" inputMode="numeric" value={week} onChange={(e) => setWeek(e.target.value)} /></label>
        </div>}
        {kind !== "BASE" && <div className="ck-meta">הסימולציה מחושבת על עותק. נתוני החשבוניות והתשלומים אינם משתנים. מול הבסיס: שפל <bdi>{money(cmp.minEndingDelta)}</bdi>, יתרת סגירה <bdi>{money(cmp.finalEndingDelta)}</bdi>, {cmp.extraWeeksBelowReserve >= 0 ? `${cmp.extraWeeksBelowReserve} שבועות נוספים` : `${-cmp.extraWeeksBelowReserve} שבועות פחות`} מתחת לסף.</div>}
      </div>

      <div className="ck-table-wrap"><table className="ck-table"><thead><tr>
        <th>שבוע</th><th className="fin-num">תקבולי חשבוניות</th><th className="fin-num">תקבולים אחרים</th><th className="fin-num">תשלומים</th><th className="fin-num">נטו</th><th className="fin-num">יתרת סגירה</th><th className="fin-num">נזילות זמינה</th>
      </tr></thead><tbody>
        {shown.weeks.map((w) => (
          <tr key={w.number} style={w.belowReserve ? { background: "rgba(179, 64, 47, .10)" } : undefined}>
            <td>{w.number}, עד {fmtDay(w.weekEnding)}</td>
            <td className="fin-num">{w.invoiceInflows ? money(w.invoiceInflows) : ""}</td><td className="fin-num">{w.otherInflows ? money(w.otherInflows) : ""}</td>
            <td className="fin-num">{w.outflows ? money(w.outflows) : ""}</td><td className="fin-num">{money(w.net)}</td>
            <td className="fin-num"><b>{money(w.endingCash)}</b></td><td className="fin-num">{money(w.liquidity)}</td>
          </tr>))}
      </tbody></table></div>
      <div className="ck-meta">
        מחוץ לתחזית: <bdi>{money(plan.excludedTotal)}</bdi> בחשבוניות שעברו את מועד התשלום ביותר מ-90 יום ({plan.excluded.length}), ו-<bdi>{money(shown.beyondHorizon)}</bdi> שצפויים אחרי 13 השבועות.
        חשבונית שמועד התקבול הצפוי שלה כבר חלף מוצבת שבוע קדימה מהיום.
      </div>

      <div className="ck-card ck-stack">
        <b>תשלומים ותקבולים קבועים (שכר, שכר דירה, מע"מ, הלוואות)</b>
        <div className="ck-grid2">
          <label className="ck-field">שם הסעיף<input className="ck-input" value={item.label} onChange={(e) => setItem({ ...item, label: e.target.value })} /></label>
          <label className="ck-field">סכום<input className="ck-input" dir="ltr" inputMode="decimal" value={item.amount} onChange={(e) => setItem({ ...item, amount: e.target.value })} /></label>
          <label className="ck-field">כיוון<select className="ck-select" value={item.direction} onChange={(e) => setItem({ ...item, direction: e.target.value })}><option value="OUT">תשלום</option><option value="IN">תקבול</option></select></label>
          <label className="ck-field">תדירות<select className="ck-select" value={item.schedule} onChange={(e) => setItem({ ...item, schedule: e.target.value })}><option value="MONTHLY">חודשי</option><option value="ONCE">חד פעמי</option></select></label>
          {item.schedule === "MONTHLY"
            ? <label className="ck-field">יום בחודש<input className="ck-input" dir="ltr" inputMode="numeric" value={item.day} onChange={(e) => setItem({ ...item, day: e.target.value })} /></label>
            : <label className="ck-field">תאריך<input className="ck-input" dir="ltr" type="date" value={item.on} onChange={(e) => setItem({ ...item, on: e.target.value })} /></label>}
        </div>
        <div className="ck-row"><button className="ck-btn primary" onClick={() => void addItem()}>הוספת סעיף</button></div>
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>סעיף</th><th>כיוון</th><th>תדירות</th><th className="fin-num">סכום</th><th></th></tr></thead><tbody>
          {items.length ? items.map((i) => (
            <tr key={i.id}><td>{i.label}</td><td>{i.direction === "OUT" ? "תשלום" : "תקבול"}</td>
              <td>{SCHEDULE[i.schedule]}{i.schedule === "MONTHLY" ? `, ב-${i.day_of_month} בחודש` : `, ${i.on_date ? fmtDay(i.on_date) : ""}`}</td>
              <td className="fin-num">{money(i.amount)}</td><td className="fin-actions-cell"><button className="ck-btn sm" onClick={() => void removeItem(i.id)}>מחיקה</button></td></tr>))
            : <tr><td colSpan={5}>לא הוגדרו סעיפים קבועים</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
