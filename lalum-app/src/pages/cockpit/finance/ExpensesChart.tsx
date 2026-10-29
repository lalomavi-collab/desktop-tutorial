import { useState } from "react";
import { Amt } from "../../../components/cockpit/Amt";
import { acctText, pctText } from "../../../lib/cockpit/accounting";
import { EXPENSE_CATEGORY } from "../../../lib/cockpit/finance";
import type { FinExpense } from "../../../lib/cockpit/finance";
import { expenseBuckets } from "../../../lib/cockpit/financeExpenses";
import type { ExpBasis, ExpGrain } from "../../../lib/cockpit/financeExpenses";

const GRAINS: Array<[ExpGrain, string]> = [["day", "יומי"], ["week", "שבועי"], ["month", "חודשי"], ["year", "שנתי"]];
const HINT: Record<ExpGrain, string> = { day: "30 הימים האחרונים, כולל היום.", week: "12 השבועות האחרונים, כולל השבוע הנוכחי. שבוע מתחיל ביום ראשון.", month: "חודשי השנה שנבחרה.", year: "חמש השנים האחרונות." };
const UNIT: Record<ExpGrain, string> = { day: "יום", week: "שבוע", month: "חודש", year: "שנה" };
const PREV: Record<ExpGrain, string> = { day: "אתמול", week: "השבוע הקודם", month: "החודש הקודם", year: "השנה הקודמת" };

/** Expenses over time as bars, with the split by category for the same range. */
export function ExpensesChart({ expenses }: { expenses: FinExpense[] }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [grain, setGrain] = useState<ExpGrain>("month");
  const [basis, setBasis] = useState<ExpBasis>("net");
  const [year, setYear] = useState(now.getFullYear());
  const s = expenseBuckets(expenses, grain, year, today, basis);
  const max = Math.max(1, ...s.buckets.map((b) => b.amount));
  const W = 640, H = 190, pad = 24, bw = (W - pad * 2) / s.buckets.length;
  const cmp = s.lastVsPrevious;
  const everyNth = grain === "day" ? 3 : 1;

  return (
    <div className="ck-card ck-stack exp-chart">
      <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="ck-title">הוצאות לאורך זמן</div>
        <div className="ck-row fin-controls">
          <div className="fin-seg" role="group" aria-label="רזולוציית זמן">
            {GRAINS.map(([k, l]) => <button key={k} type="button" aria-pressed={grain === k} onClick={() => setGrain(k)}>{l}</button>)}
          </div>
          <div className="fin-seg" role="group" aria-label="בסיס הסכום">
            <button type="button" aria-pressed={basis === "net"} onClick={() => setBasis("net")}>לפני מע"מ</button>
            <button type="button" aria-pressed={basis === "total"} onClick={() => setBasis("total")}>כולל מע"מ</button>
          </div>
          {grain === "month" && (
            <select className="ck-select fin-year" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}
            </select>)}
        </div>
      </div>
      <div className="fl-strip">
        <div className="fl-cell"><div className="fl-label">סה"כ בטווח</div><div className="fl-fig"><Amt n={s.amount} /></div><div className="fl-note"><bdi>{s.count}</bdi> הוצאות</div></div>
        <div className="fl-cell"><div className="fl-label">ממוצע ל{UNIT[grain]}</div><div className="fl-fig"><Amt n={s.average} /></div>
          <div className="fl-note">{s.averageOver ? <>על פני <bdi>{s.averageOver}</bdi> תקופות שהסתיימו, מהראשונה עם הוצאה</> : "אין עדיין תקופה שהסתיימה"}</div></div>
        <div className="fl-cell"><div className="fl-label">התקופה היקרה ביותר</div><div className="fl-fig">{s.top ? <Amt n={s.top.amount} /> : "אין"}</div>{s.top && <div className="fl-note"><bdi>{s.top.label}</bdi></div>}</div>
        <div className="fl-cell"><div className="fl-label">שינוי מול {PREV[grain]}</div>
          <div className="fl-fig">{cmp?.pct == null ? <span className="fl-delta flat">אין נתון</span>
            : <span className={`fl-delta ${cmp.pct > 0 ? "down" : cmp.pct < 0 ? "up" : "flat"}`}><span aria-hidden="true">{cmp.pct > 0 ? "▲" : cmp.pct < 0 ? "▼" : "■"}</span> <bdi dir="ltr">{pctText(cmp.pct)}</bdi></span>}</div>
          {cmp && <div className="fl-note">הוצאה גבוהה יותר מסומנת באדום</div>}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={`הוצאות לפי ${UNIT[grain]}`} className="fin-chart" direction="ltr">
        {[0.5, 1].map((f) => <line key={f} x1={pad} x2={W - pad} y1={H - f * (H - 30)} y2={H - f * (H - 30)} stroke="var(--line)" strokeDasharray="3 4" />)}
        <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="var(--line-strong)" />
        {s.buckets.map((b, i) => {
          const h = Math.round((b.amount / max) * (H - 30));
          const x = pad + i * bw + bw * 0.15, w = bw * 0.7;
          return (
            <g key={b.key}>
              <title>{`${b.label}: ${acctText(b.amount)} ₪ (${b.count} הוצאות)`}</title>
              {!b.future && b.amount > 0 && <rect x={x} y={H - h} width={w} height={h} rx={3} fill="var(--clay)" opacity={b.to >= today ? 0.55 : 1} />}
              {i % everyNth === 0 && <text x={x + w / 2} y={H + 16} textAnchor="middle" fontSize="12" fill="var(--slate)">{b.label}</text>}
            </g>);
        })}
      </svg>
      <div className="fin-note">{HINT[grain]}{s.hasRunning && " העמודה הדהויה היא התקופה הנוכחית, שעוד לא הסתיימה: היא נכללת בסה\"כ אבל לא בממוצע ולא בהשוואה."}</div>
      {s.categories.length > 0 && (
        <div className="exp-cats">
          <div className="ck-meta exp-cats-title">לפי קטגוריה, באותו טווח</div>
          <ul className="exp-cat-list">
            {s.categories.map((c) => (
              <li key={c.category}>
                <div className="exp-cat-head"><span>{EXPENSE_CATEGORY[c.category] ?? c.category}</span><span className="exp-cat-fig"><Amt n={c.amount} bare /> <small><bdi dir="ltr">{c.share}%</bdi></small></span></div>
                <span className="exp-cat-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(2, c.share))}%` }} /></span>
              </li>))}
          </ul>
        </div>)}
    </div>
  );
}
