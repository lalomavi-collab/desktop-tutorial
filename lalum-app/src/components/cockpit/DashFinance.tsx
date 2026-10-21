// Bookkeeping section of the dashboard. Shown only to members with finance level 1 or more (the loader returns null otherwise).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarsH, GroupedBars } from "./CockpitCharts";
import { money } from "../../lib/cockpit/shared";
import { loadFinanceDash } from "../../lib/cockpit/dashboardFinance";
import type { FinanceDash } from "../../lib/cockpit/dashboardFinance";

/** Income to net for one month: the income bar, the expenses taken off it, and what is left. Net may be negative, so the scale covers zero.
 *  Bars and connectors are SVG; every label is HTML, so the text keeps its size at any card width instead of scaling with the drawing. */
function Waterfall({ income, expenses, label }: { income: number; expenses: number; label: string }) {
  const net = income - expenses;
  const hi = Math.max(income, 0, net), lo = Math.min(0, net), span = Math.max(1, hi - lo);
  const H = 190, T = 30, B = 8, plot = H - T - B;
  const y = (v: number) => T + ((hi - v) / span) * plot;
  const bars = [
    { name: "הכנסות", from: 0, to: income, color: "var(--chart-ok, #216f33)", shown: money(income) },
    { name: "הוצאות", from: income, to: income - expenses, color: "var(--chart-bad, #b3402f)", shown: expenses > 0 ? "−" + money(expenses) : money(0) },
    { name: "נטו", from: 0, to: net, color: net >= 0 ? "var(--chart-ok-l, #5a9c62)" : "var(--chart-bad, #b3402f)", shown: money(net) },
  ];
  const cx = [16.67, 50, 83.33];
  return (
    <div className="db-wf" role="img" aria-label={`${label}: הכנסות ${money(income)}, הוצאות ${money(expenses)}, נטו ${money(net)}`}>
      <div className="db-wf-plot" style={{ height: H }}>
        <svg viewBox={`0 0 300 ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden="true">
          <line x1={0} x2={300} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
          {bars.map((br, i) => {
            const top = Math.min(y(br.from), y(br.to)), h = Math.max(2, Math.abs(y(br.from) - y(br.to)));
            const x0 = (cx[i] / 100) * 300 - 27;
            return (
              <g key={br.name}>
                <rect x={x0} y={top} width={54} height={h} fill={br.color} />
                {i < 2 && <line x1={x0 + 54} x2={(cx[i + 1] / 100) * 300 - 27} y1={y(i === 0 ? income : income - expenses)} y2={y(i === 0 ? income : income - expenses)} stroke="var(--line-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
              </g>
            );
          })}
        </svg>
        {bars.map((br, i) => (
          <span key={br.name} className="db-wf-val" style={{ left: `${cx[i]}%`, top: Math.max(0, Math.min(y(br.from), y(br.to)) - 32) }}><bdi dir="ltr">{br.shown}</bdi></span>
        ))}
      </div>
      <div className="db-wf-names">{bars.map((br) => <span key={br.name}>{br.name}</span>)}</div>
    </div>
  );
}

export function DashFinance({ firmId, preload }: { firmId: string; preload?: FinanceDash }) {
  const [f, setF] = useState<FinanceDash | null | undefined>(preload);
  useEffect(() => { if (!preload) void loadFinanceDash(firmId).then(setF); }, [firmId, preload]);
  if (!f) return null;
  return (
    <>
      <div className="db-grid">
        <div className="ck-card db-card">
          <div className="db-head"><h3>הכנסות והוצאות, 6 חודשים</h3><Link className="ck-link" to="/settings/billing">להנהלת חשבונות</Link></div>
          <GroupedBars buckets={f.months} series={[{ label: "הכנסות", color: "var(--chart-ok, #216f33)", values: f.revenue }, { label: "הוצאות", color: "var(--chart-bad, #b3402f)", values: f.expenses }]} />
          <div className="db-note">לפני מע"מ, לפי תאריך המסמך. הכנסות בירוק, הוצאות באדום.</div>
        </div>
        <div className="ck-card db-card db-center">
          <div className="db-head"><h3>סוגי מסמכים, 12 חודשים</h3></div>
          <BarsH items={f.mix.map((x) => ({ label: x.label, value: x.value }))} />
          <div className="db-note">{f.mixTotal} מסמכים בסך הכול</div>
        </div>
      </div>
      <div className="db-grid b">
        <div className="ck-card db-card">
          <div className="db-head"><h3>חובות פתוחים לפי גיל</h3><span className="ck-badge green">{money(f.receivable)}</span></div>
          <BarsH items={f.aging.map((a) => ({ label: a.label, value: a.value, color: a.label === "טרם הגיע המועד" ? undefined : "var(--chart-bad, #b3402f)" }))} />
          <div className="db-note">חשבונות עסקה פתוחים: <b>{f.openProformas.count}</b>, <bdi>{money(f.openProformas.total)}</bdi>. {f.archiveCount} מסמכים בארכיון ההיסטוריה נכללים בהכנסות.</div>
        </div>
        <div className="ck-card db-card">
          <div className="db-head"><h3>מהכנסות לנטו, החודש</h3><Link className="ck-link" to="/settings/billing">לדוחות</Link></div>
          <Waterfall income={f.revenue[f.revenue.length - 1] ?? 0} expenses={f.expenses[f.expenses.length - 1] ?? 0} label={`החודש ${f.months[f.months.length - 1] ?? ""}`} />
          <div className="db-note">לפני מע"מ, לפי תאריך המסמך. הנטו הוא הכנסות פחות הוצאות שהוזנו, לפני מס הכנסה.</div>
        </div>
      </div>
    </>
  );
}
