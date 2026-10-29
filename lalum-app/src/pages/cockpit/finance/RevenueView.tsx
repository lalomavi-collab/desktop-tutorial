import { useState } from "react";
import { acctText, pctText } from "../../../lib/cockpit/accounting";
import { Amt } from "../../../components/cockpit/Amt";
import type { Grain, IncomeRow } from "../../../lib/cockpit/financeReports";
import { revenueBuckets } from "../../../lib/cockpit/financeReports";

const GRAINS: Array<[Grain, string]> = [["week", "שבועי"], ["month", "חודשי"], ["year", "שנתי"]];
const HINT: Record<Grain, string> = { week: "12 השבועות האחרונים, כולל השבוע הנוכחי. שבוע מתחיל ביום ראשון.", month: "חודשי השנה שנבחרה.", year: "חמש השנים האחרונות." };
const UNIT: Record<Grain, string> = { week: "שבוע", month: "חודש", year: "שנה" };

/** A change in percent: an arrow and a sign as well as a colour, never colour alone. */
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="fl-delta flat">אין נתון</span>;
  return <span className={`fl-delta ${pct > 0 ? "up" : pct < 0 ? "down" : "flat"}`}><span aria-hidden="true">{pct > 0 ? "\u25B2" : pct < 0 ? "\u25BC" : "\u25A0"}</span> <bdi dir="ltr">{pctText(pct)}</bdi></span>;
}

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

  const period = UNIT[grain] === "שבוע" ? "השבוע" : UNIT[grain] === "חודש" ? "החודש" : "השנה";
  const prevName = UNIT[grain] === "שבוע" ? "השבוע הקודם" : UNIT[grain] === "חודש" ? "החודש הקודם" : "השנה הקודמת";
  const sinceJ = s.sinceJanuary;

  return (
    <div className="ck-card ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="ck-title">הכנסות לאורך זמן, לפני מע"מ</div>
        <div className="ck-row fin-controls">
          <div className="fin-seg" role="group" aria-label="רזולוציית זמן">
            {GRAINS.map(([k, l]) => <button key={k} type="button" aria-pressed={grain === k} onClick={() => setGrain(k)}>{l}</button>)}
          </div>
          {grain === "month" && (
            <select className="ck-select fin-year" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}
            </select>)}
        </div>
      </div>
      <div className="fl-strip">
        <div className="fl-cell"><div className="fl-label">סה"כ בטווח</div><div className="fl-fig"><Amt n={s.net} /></div></div>
        <div className="fl-cell"><div className="fl-label">ממוצע ל{UNIT[grain]}</div><div className="fl-fig"><Amt n={s.average} /></div>
          <div className="fl-note">{s.averageOver ? <>על פני <bdi>{s.averageOver}</bdi> תקופות שהסתיימו, מהראשונה עם הכנסה</> : "אין עדיין תקופה שהסתיימה"}</div></div>
        <div className="fl-cell"><div className="fl-label">{period} החזק{UNIT[grain] === "שנה" ? "ה" : ""}</div><div className="fl-fig">{s.best ? <Amt n={s.best.net} /> : "אין"}</div>{s.best && <div className="fl-note"><bdi>{s.best.label}</bdi></div>}</div>
        <div className="fl-cell"><div className="fl-label">שינוי מול {prevName}</div>
          <div className="fl-fig"><Delta pct={cmp ? cmp.pct : null} /></div>
          {cmp && <dl className="fl-rows">
            <div><dt><bdi>{cmp.previous.label}</bdi></dt><dd><Amt n={cmp.previous.net} bare /></dd></div>
            <div><dt><bdi>{cmp.last.label}</bdi></dt><dd><Amt n={cmp.last.net} bare /></dd></div>
            <div className="fl-diff"><dt>הפרש</dt><dd><Amt n={cmp.delta} plus bare /></dd></div>
          </dl>}</div>
        {sinceJ && (
          <div className="fl-cell"><div className="fl-label">מול הממוצע מתחילת השנה</div>
            <div className="fl-fig"><Delta pct={sinceJ.pct} /></div>
            <dl className="fl-rows">
              <div><dt>ממוצע חודשי</dt><dd><Amt n={sinceJ.average} bare /></dd></div>
              <div><dt><bdi>{sinceJ.lastDone.label}</bdi></dt><dd><Amt n={sinceJ.lastDone.net} bare /></dd></div>
            </dl></div>)}
      </div>
      {sinceJ && <div className="fl-foot">ההשוואה לממוצע מתחילת השנה: על פני <bdi>{sinceJ.months}</bdi> חודשים שהסתיימו, מ<bdi>{sinceJ.first.label}</bdi> עד <bdi>{sinceJ.lastDone.label}</bdi>, חודש ללא הכנסה נספר כאפס. הסכומים בשקלים.</div>}
      <svg viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={`הכנסות לפי ${UNIT[grain]}`} className="fin-chart" direction="ltr">
        <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="var(--line-strong)" />
        {s.buckets.map((b, i) => {
          const h = Math.round((Math.abs(b.net) / max) * (H - 30));
          const x = pad + i * bw + bw * 0.15, w = bw * 0.7;
          return (
            <g key={b.key}>
              <title>{`${b.label}: ${acctText(b.net)} \u20AA (${b.count} מסמכים)`}</title>
              {!b.future && b.net !== 0 && <rect x={x} y={b.net >= 0 ? H - h : H} width={w} height={h} rx={3} fill={b.net >= 0 ? "var(--clay)" : "var(--danger)"} opacity={b.to >= today ? 0.55 : 1} />}
              <text x={x + w / 2} y={H + 16} textAnchor="middle" fontSize="12" fill="var(--slate)">{b.label}</text>
            </g>);
        })}
      </svg>
      <div className="fin-note">{HINT[grain]}{s.hasRunning && " העמודה הדהויה היא התקופה הנוכחית, שעוד לא הסתיימה: היא נכללת בסה\"כ אבל לא בממוצע ולא בהשוואה."} זיכויים מופחתים.</div>
      <div className="ck-table-wrap rev-table"><table className="ck-table fin-ledger"><caption className="sr-only">הכנסות לפי {UNIT[grain]}, בשקלים</caption><thead><tr><th scope="col">{UNIT[grain]}</th><th scope="col" className="fin-num">מסמכים</th><th scope="col" className="fin-num">לפני מע"מ <small>₪</small></th><th scope="col" className="fin-num">מע"מ <small>₪</small></th><th scope="col" className="fin-num">כולל מע"מ <small>₪</small></th></tr></thead><tbody>
        {s.buckets.filter((b) => !b.future).map((b) => (
          <tr key={b.key}><td><bdi>{grain === "week" ? `${b.label} עד ${b.to.slice(8, 10)}.${b.to.slice(5, 7)}` : b.label}</bdi></td><td className="fin-ltr"><span className={`acct${b.count === 0 ? " zero" : ""}`} dir="ltr">{b.count}</span></td><td className="fin-ltr"><Amt n={b.net} bare /></td><td className="fin-ltr"><Amt n={b.vat} bare /></td><td className="fin-ltr"><Amt n={b.total} bare /></td></tr>))}
      </tbody><tfoot><tr className="fin-total"><th scope="row">סה"כ</th><td className="fin-ltr"><span className="acct" dir="ltr">{s.count}</span></td><td className="fin-ltr"><Amt n={s.net} bare /></td><td className="fin-ltr"><Amt n={s.vat} bare /></td><td className="fin-ltr"><Amt n={s.total} bare /></td></tr></tfoot></table></div>
      {/* On a phone the five columns do not fit: each period becomes a small card, the three amounts side by side with their labels. */}
      <ul className="rev-rows" aria-label={`הכנסות לפי ${UNIT[grain]}`}>
        {s.buckets.filter((b) => !b.future).map((b) => (
          <li key={b.key} className={`rev-row${b.count === 0 ? " rev-empty" : ""}`}>
            <div className="rev-head"><b><bdi>{grain === "week" ? `${b.label} עד ${b.to.slice(8, 10)}.${b.to.slice(5, 7)}` : b.label}</bdi></b><span>{b.count === 0 ? "אין מסמכים" : `${b.count} מסמכים`}</span></div>
            {b.count > 0 && <dl className="rev-amts">
              <div><dt>לפני מע"מ</dt><dd><Amt n={b.net} /></dd></div>
              <div><dt>מע"מ</dt><dd><Amt n={b.vat} /></dd></div>
              <div className="rev-total"><dt>כולל מע"מ</dt><dd><Amt n={b.total} /></dd></div>
            </dl>}
          </li>))}
        <li className="rev-row rev-sum">
          <div className="rev-head"><b>סה"כ</b><span>{s.count} מסמכים</span></div>
          <dl className="rev-amts">
            <div><dt>לפני מע"מ</dt><dd><Amt n={s.net} /></dd></div>
            <div><dt>מע"מ</dt><dd><Amt n={s.vat} /></dd></div>
            <div className="rev-total"><dt>כולל מע"מ</dt><dd><Amt n={s.total} /></dd></div>
          </dl>
        </li>
      </ul>
    </div>
  );
}
