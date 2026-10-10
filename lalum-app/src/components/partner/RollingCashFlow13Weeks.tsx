import { money } from "../../lib/cockpit/shared";
import type { Forecast } from "../../lib/cockpit/crm";

const lbl = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };

/** Middle tier: 13 rolling weeks labelled by Friday. Inflows from open Invoice4U invoices, outflows from declared obligations. */
export function RollingCashFlow13Weeks({ f }: { f: Forecast }) {
  const max = Math.max(1, ...f.weeks.map((w) => Math.max(w.inflow, w.outflow)));
  return (
    <section className="ck-card" aria-label="תזרים 13 שבועות">
      <div className="ck-card-head"><h3 className="ck-title">תזרים מתגלגל, 13 שבועות</h3><span className="ck-meta">DSO היסטורי: {f.dso} ימים</span></div>
      {f.firstBreach != null && (
        <div className="crm-banner red" role="alert">
          היתרה צפויה לרדת מתחת לסף התפעולי ({money(f.minThreshold)}) בשבוע המסתיים ב-{lbl(f.weeks[f.firstBreach].friday)}. השפל החזוי: {money(f.lowest)}.
        </div>
      )}
      <div className="crm-bars" role="img" aria-label={f.weeks.map((w) => `${lbl(w.friday)}: נכנס ${w.inflow}, יוצא ${w.outflow}`).join("; ")}>
        {f.weeks.map((w) => (
          <div key={w.friday} title={`${lbl(w.friday)}`}>
            <i className="in" style={{ height: `${(w.inflow / max) * 48}%` }} />
            <i className="out" style={{ height: `${(w.outflow / max) * 48}%` }} />
          </div>
        ))}
      </div>
      <div className="ck-table-wrap">
        <table className="ck-table">
          <thead><tr><th>שבוע (שישי)</th>{f.weeks.map((w) => <th key={w.friday}>{lbl(w.friday)}</th>)}</tr></thead>
          <tbody>
            <tr><th>נכנס</th>{f.weeks.map((w) => <td key={w.friday}>{w.inflow ? Math.round(w.inflow).toLocaleString("he-IL") : ""}</td>)}</tr>
            <tr><th>יוצא</th>{f.weeks.map((w) => <td key={w.friday}>{w.outflow ? Math.round(w.outflow).toLocaleString("he-IL") : ""}</td>)}</tr>
            <tr><th>יתרה</th>{f.weeks.map((w) => <td key={w.friday} style={{ color: w.closing < f.minThreshold ? "#8a2f21" : undefined, fontWeight: 700 }}>{Math.round(w.closing).toLocaleString("he-IL")}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="ck-meta">חשבוניות שמועדן עבר נספרות בשבוע הראשון, וזו הנחה אופטימית. יתרת פתיחה והתחייבויות (שכר, שכירות, ספקים, מס) הן קלט ידני.</div>
    </section>
  );
}
