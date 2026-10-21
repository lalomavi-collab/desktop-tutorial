import { useState } from "react";
import { money } from "../../../lib/cockpit/shared";
import type { Grain, IncomeRow } from "../../../lib/cockpit/financeReports";
import { revenueBuckets } from "../../../lib/cockpit/financeReports";

const GRAINS: Array<[Grain, string]> = [["week", "שבועי"], ["month", "חודשי"], ["year", "שנתי"]];
const HINT: Record<Grain, string> = { week: "12 השבועות האחרונים, כולל השבוע הנוכחי. שבוע מתחיל ביום ראשון.", month: "חודשי השנה שנבחרה.", year: "חמש השנים האחרונות." };
const UNIT: Record<Grain, string> = { week: "שבוע", month: "חודש", year: "שנה" };

/** Net income over time as bars and a table. Credits already count as negative income. */
export function RevenueView({ rows }: { rows: IncomeRow[] }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [grain, setGrain] = useState<Grain>("month");
  const [year, setYear] = useState(now.getFullYear());
  const s = revenueBuckets(rows, grain, year, today);
  const max = Math.max(1, ...s.buckets.map((b) => Math.abs(b.net)));
  const W = 640, H = 190, pad = 24, bw = (W - pad * 2) / s.buckets.length;
  const cmp = s.lastVsPrevious;

  return (
    <div className="ck-card ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="ck-title">הכנסות לאורך זמן, לפני מע"מ</div>
        <div className="ck-row" role="group" aria-label="רזולוציית זמן">
          {GRAINS.map(([k, l]) => <button key={k} className={`ck-btn sm${grain === k ? " primary" : ""}`} aria-pressed={grain === k} onClick={() => setGrain(k)}>{l}</button>)}
          {grain === "month" && (
            <select className="ck-select" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ maxWidth: 110 }}>
              {[0, 1, 2, 3, 4].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}
            </select>)}
        </div>
      </div>
      <div className="fin-kpis">
        <div><div className="ck-meta">סה"כ בטווח</div><div className="fin-kpi">{money(s.net)}</div></div>
        <div><div className="ck-meta">ממוצע ל{UNIT[grain]}</div><div className="fin-kpi">{money(s.average)}</div><div className="fin-note">{s.averageOver ? <>על פני <bdi>{s.averageOver}</bdi> תקופות שהסתיימו, מהראשונה עם הכנסה</> : "אין עדיין תקופה שהסתיימה"}</div></div>
        <div><div className="ck-meta">{UNIT[grain] === "שבוע" ? "השבוע החזק" : UNIT[grain] === "חודש" ? "החודש החזק" : "השנה החזקה"}</div><div className="fin-kpi">{s.best ? money(s.best.net) : "אין"}</div>{s.best && <div className="fin-note"><bdi>{s.best.label}</bdi></div>}</div>
        <div><div className="ck-meta">שינוי מול {UNIT[grain] === "שבוע" ? "השבוע הקודם" : UNIT[grain] === "חודש" ? "החודש הקודם" : "השנה הקודמת"}</div>
          <div className="fin-kpi">{cmp && cmp.pct !== null ? <bdi>{cmp.pct > 0 ? "+" : ""}{cmp.pct}%</bdi> : "אין נתון"}</div>
          {cmp && <div className="fin-note"><bdi>{cmp.last.label}</bdi> {money(cmp.last.net)} מול <bdi>{cmp.previous.label}</bdi> {money(cmp.previous.net)}<br />הפרש <bdi>{cmp.delta > 0 ? "+" : ""}{money(cmp.delta)}</bdi></div>}</div>
        {s.sinceJanuary && (
          <div><div className="ck-meta">מול הממוצע מתחילת השנה</div>
            <div className="fin-kpi">{s.sinceJanuary.pct !== null ? <bdi>{s.sinceJanuary.pct > 0 ? "+" : ""}{s.sinceJanuary.pct}%</bdi> : "אין נתון"}</div>
            <div className="fin-note"><bdi>{s.sinceJanuary.lastDone.label}</bdi> {money(s.sinceJanuary.lastDone.net)} מול ממוצע חודשי {money(s.sinceJanuary.average)}<br />על פני <bdi>{s.sinceJanuary.months}</bdi> חודשים שהסתיימו, מ<bdi>{s.sinceJanuary.first.label}</bdi> עד <bdi>{s.sinceJanuary.lastDone.label}</bdi>, חודש ללא הכנסה נספר כאפס.</div></div>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={`הכנסות לפי ${UNIT[grain]}`} className="fin-chart" direction="ltr">
        <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="var(--line-strong)" />
        {s.buckets.map((b, i) => {
          const h = Math.round((Math.abs(b.net) / max) * (H - 30));
          const x = pad + i * bw + bw * 0.15, w = bw * 0.7;
          return (
            <g key={b.key}>
              <title>{`${b.label}: ${money(b.net)} (${b.count} מסמכים)`}</title>
              {!b.future && b.net !== 0 && <rect x={x} y={b.net >= 0 ? H - h : H} width={w} height={h} rx={3} fill={b.net >= 0 ? "var(--clay)" : "var(--danger)"} opacity={b.to >= today ? 0.55 : 1} />}
              <text x={x + w / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--slate)">{b.label}</text>
            </g>);
        })}
      </svg>
      <div className="fin-note">{HINT[grain]}{s.hasRunning && " העמודה הדהויה היא התקופה הנוכחית, שעוד לא הסתיימה: היא נכללת בסה\"כ אבל לא בממוצע ולא בהשוואה."} זיכויים מופחתים.</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>{UNIT[grain]}</th><th className="fin-num">מסמכים</th><th className="fin-num">לפני מע"מ</th><th className="fin-num">מע"מ</th><th className="fin-num">כולל מע"מ</th></tr></thead><tbody>
        {s.buckets.filter((b) => !b.future).map((b) => (
          <tr key={b.key}><td><bdi>{grain === "week" ? `${b.label} עד ${b.to.slice(8, 10)}.${b.to.slice(5, 7)}` : b.label}</bdi></td><td className="fin-ltr">{b.count}</td><td className="fin-ltr">{money(b.net)}</td><td className="fin-ltr">{money(b.vat)}</td><td className="fin-ltr">{money(b.total)}</td></tr>))}
        <tr><td><b>סה"כ</b></td><td className="fin-ltr">{s.count}</td><td className="fin-ltr"><b>{money(s.net)}</b></td><td className="fin-ltr">{money(s.vat)}</td><td className="fin-ltr">{money(s.total)}</td></tr>
      </tbody></table></div>
    </div>
  );
}
