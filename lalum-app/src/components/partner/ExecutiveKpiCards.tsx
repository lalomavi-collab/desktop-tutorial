import { money } from "../../lib/cockpit/shared";
import { BUCKETS, BUCKET_LABEL } from "../../lib/cockpit/arAging";
import type { Bucket } from "../../lib/cockpit/arAging";

interface Props {
  bankBalance: number | null;
  monthlyBurn: number;
  collected30: number;
  /** null: there is no real hours source yet, so the card is not shown. */
  wip: { hours: number; amount: number } | null;
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
        <small>יתרה: הזנה ידנית (Invoice4U אינו מחזיק יתרת בנק). תקבולים ב-30 ימים: {money(collected30)} (Invoice4U)</small>
      </article>
      {wip != null && (
        <article className="ck-card crm-kpi">
          <small>שעות בצבר (טרם חויבו)</small>
          <b>{money(wip.amount)}</b>
          <span className="ck-badge yellow">{wip.hours} שעות</span>
          <small>מקור: רישום זמנים בתיקים</small>
        </article>
      )}
      <article className="ck-card crm-kpi">
        <small>גיול חובות</small>
        <b>{money(aging.total)}</b>
        <div className="crm-split">
          {BUCKETS.map((k) => <span key={k}>{BUCKET_LABEL[k]}<b style={{ fontSize: 13, color: k === "D90_PLUS" && aging.buckets[k] > 0 ? "var(--danger)" : undefined }}>{money(aging.buckets[k])}</b></span>)}
        </div>
        <small>מקור: חשבונות עסקה פתוחים בספר Invoice4U (בסיס מזומן). מתוכן טרם הגיע מועד התשלום: {money(aging.notYetDue)}</small>
      </article>
      {trust != null && (
        <article className="ck-card crm-kpi trust">
          <small>כספי לקוחות בנאמנות</small>
          <b>{money(trust)}</b>
          <small>מקור: פנקס הנאמנות של המערכת. אינו נספר בהכנסות ואינו מופיע בתזרים המשרד</small>
        </article>
      )}
    </section>
  );
}
