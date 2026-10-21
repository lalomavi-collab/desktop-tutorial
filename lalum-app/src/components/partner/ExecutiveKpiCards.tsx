import { money } from "../../lib/cockpit/shared";
import { BUCKETS, BUCKET_LABEL } from "../../lib/cockpit/arAging";
import type { Bucket } from "../../lib/cockpit/arAging";

interface Props {
  bankBalance: number | null;
  monthlyBurn: number;
  collected30: number;
  /** Priced by the database with the firm's rate cards. null while loading or when the member may not see financials: no card. */
  wip: { hours: number; amount: number; withoutRate: number; awaiting: number; nonHourlyHours: number } | null;
  aging: { total: number; notYetDue: number; buckets: Record<Bucket, number> };
  /** null: the firm holds no client money, so the card is not shown. */
  trust: number | null;
}

/** Top tier of the partner view. Source of each figure is printed on its card: Invoice4U ledger, manual input, or hours. */
export function ExecutiveKpiCards({ bankBalance, monthlyBurn, collected30, wip, aging, trust }: Props) {
  const weeks = bankBalance != null && monthlyBurn > 0 ? Math.floor(bankBalance / (monthlyBurn / 4.345)) : null;
  const runwayTone = weeks == null ? "yellow" : weeks < 8 ? "red" : weeks < 13 ? "yellow" : "green";
  return (
    <section className="crm-kpis" aria-label="מדדים מרכזיים">
      <article className="ck-card crm-kpi">
        <small>יתרת עו״ש זמינה</small>
        <b>{bankBalance == null ? "לא הוזנה" : money(bankBalance)}</b>
        {weeks != null && <span className={`ck-badge ${runwayTone}`}>{weeks} שבועות נזילות</span>}
        <small>יתרה: הזנה ידנית (מערכת ההנפקה אינה מחזיקה יתרת בנק). תקבולים ב-30 ימים: {money(collected30)} (מערכת ההנפקה)</small>
      </article>
      {wip != null && (
        <article className="ck-card crm-kpi">
          <small>שעות בצבר (טרם חויבו)</small>
          <b>{money(wip.amount)}</b>
          <span className="ck-badge yellow">{wip.hours} שעות</span>
          {wip.awaiting > 0 && <small>{wip.awaiting} רישומים ממתינים לאישור שותף</small>}
          {wip.withoutRate > 0 && <small style={{ color: "var(--danger)" }}>{wip.withoutRate} רישומים ללא תעריף אינם נכללים בסכום</small>}
          {wip.nonHourlyHours > 0 && <small>בנוסף {wip.nonHourlyHours} שעות בתיקים שאינם לפי שעה (מחיר קבוע, ריטיינר, הצלחה)</small>}
          <small>מקור: רישום זמנים בתיקים, מתומחר בכרטיסי התעריפים של הפירמה</small>
        </article>
      )}
      <article className="ck-card crm-kpi">
        <small>גיול חובות</small>
        <b>{money(aging.total)}</b>
        <div className="crm-split">
          {BUCKETS.map((k) => <span key={k}>{BUCKET_LABEL[k]}<b style={{ fontSize: 13, color: k === "D90_PLUS" && aging.buckets[k] > 0 ? "var(--danger)" : undefined }}>{money(aging.buckets[k])}</b></span>)}
        </div>
        <small>מקור: חשבונות עסקה פתוחים בספר החשבונות (בסיס מזומן). מתוכן טרם הגיע מועד התשלום: {money(aging.notYetDue)}</small>
      </article>
      {trust != null && (
        <article className="ck-card crm-kpi trust">
          <small>כספי לקוחות בנאמנות</small>
          <b>{money(trust)}</b>
          <small>מקור: פנקס הנאמנות של המערכת. אינו נספר בהכנסות ואינו מופיע בתזרים הפירמה</small>
        </article>
      )}
    </section>
  );
}
