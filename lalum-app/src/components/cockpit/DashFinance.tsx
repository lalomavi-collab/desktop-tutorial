// Bookkeeping section of the dashboard. Shown only to members with finance level 1 or more (the loader returns null otherwise).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarsH, Donut, PillBars } from "./CockpitCharts";
import { money } from "../../lib/cockpit/shared";
import { loadFinanceDash } from "../../lib/cockpit/dashboardFinance";
import type { FinanceDash } from "../../lib/cockpit/dashboardFinance";

const MIX_COLORS = ["#537056", "#9bbb9f", "#b3402f"];

export function DashFinance({ firmId, preload }: { firmId: string; preload?: FinanceDash }) {
  const [f, setF] = useState<FinanceDash | null | undefined>(preload);
  useEffect(() => { if (!preload) void loadFinanceDash(firmId).then(setF); }, [firmId, preload]);
  if (!f) return null;
  return (
    <>
      <div className="db-grid">
        <div className="ck-card db-card">
          <div className="db-head"><h3>הכנסות והוצאות, 6 חודשים</h3><Link className="ck-link" to="/settings/billing">להנהלת חשבונות</Link></div>
          <PillBars items={f.months.flatMap((m, i) => [{ label: `${m} הכנסות`, value: f.revenue[i], color: "#537056" }, { label: `${m} הוצאות`, value: f.expenses[i], color: "#b3402f" }])} />
          <div className="db-note">לפני מע"מ, לפי תאריך המסמך. הכנסות בירוק, הוצאות באדום.</div>
        </div>
        <div className="ck-card db-card db-center">
          <div className="db-head"><h3>סוגי מסמכים, 12 חודשים</h3></div>
          <Donut centre={f.mixTotal} sub="מסמכים" segments={f.mix.map((x, i) => ({ ...x, color: MIX_COLORS[i % MIX_COLORS.length] }))} />
        </div>
      </div>
      <div className="db-grid b">
        <div className="ck-card db-card">
          <div className="db-head"><h3>חובות פתוחים לפי גיל</h3><span className="ck-badge green">{money(f.receivable)}</span></div>
          <BarsH items={f.aging.map((a) => ({ label: a.label, value: a.value, color: a.label === "טרם הגיע המועד" ? undefined : "#b3402f" }))} />
        </div>
        <div className="ck-card db-card">
          <div className="db-head"><h3>חשבונות עסקה פתוחים</h3></div>
          <div className="db-kval"><b>{f.openProformas.count}</b><small>{money(f.openProformas.total)}</small></div>
          <div className="db-note">{f.archiveCount} מסמכים בארכיון ההיסטוריה נכללים בהכנסות.</div>
        </div>
      </div>
    </>
  );
}
