import { money } from "../../lib/cockpit/shared";
import type { Aging } from "../../lib/cockpit/crm";

interface Props {
  bankBalance: number | null;
  monthlyBurn: number;
  collected30: number;
  wipHours: number;
  wipAmount: number;
  aging: Aging;
  trust: number;
}

/** Top tier of the partner view. Source of each figure is printed on its card: Invoice4U ledger, manual input, or hours. */
export function ExecutiveKpiCards({ bankBalance, monthlyBurn, collected30, wipHours, wipAmount, aging, trust }: Props) {
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
      <article className="ck-card crm-kpi">
        <small>שעות בצבר (טרם חויבו)</small>
        <b>{money(wipAmount)}</b>
        <span className="ck-badge yellow">{wipHours} שעות</span>
        <small>מקור: רישום זמנים בתיקים</small>
      </article>
      <article className="ck-card crm-kpi">
        <small>גיול חובות</small>
        <b>{money(aging.total)}</b>
        <div className="crm-split">
          <span>שוטף<b style={{ fontSize: 13 }}>{money(aging.current)}</b></span>
          <span>1 עד 30<b style={{ fontSize: 13 }}>{money(aging.d1_30)}</b></span>
          <span>31 עד 60<b style={{ fontSize: 13 }}>{money(aging.d31_60)}</b></span>
          <span>60 ומעלה<b style={{ fontSize: 13, color: aging.d60plus > 0 ? "#8a2f21" : undefined }}>{money(aging.d60plus)}</b></span>
        </div>
        <small>מקור: חשבוניות פתוחות בספר Invoice4U</small>
      </article>
      <article className="ck-card crm-kpi trust">
        <small>כספי לקוחות בנאמנות</small>
        <b>{money(trust)}</b>
        <small>פנקס נאמנות ידני, אינו נספר בהכנסות ואינו מופיע בתזרים המשרד</small>
      </article>
    </section>
  );
}
