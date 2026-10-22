// Dashboard card: the firm's matters as a running total, drawn like a market page. A smooth curve for the total, a strip of what each
// week or month added underneath, high and low marks, range tabs and a change chip. Every figure and the sentence are computed from the
// dates passed in, never written by a model.
import { useMemo, useState } from "react";
import { cumulativeSeries, MIN_DELTA_BASE } from "../../lib/cockpit/dashboard";
import { MarketChart } from "./MarketChart";

const RANGES = [
  { k: "w12", label: "12 שבועות", mode: "weekly" as const, n: 12, text: "12 השבועות האחרונים", unit: "בשבוע" },
  { k: "m6", label: "6 חודשים", mode: "monthly" as const, n: 6, text: "6 החודשים האחרונים", unit: "בחודש" },
  { k: "m12", label: "שנה", mode: "monthly" as const, n: 12, text: "12 החודשים האחרונים", unit: "בחודש" },
];
const nf = (v: number) => v.toLocaleString("he-IL");

export function MatterWave({ title, dates, noun }: { title: string; dates: string[]; noun: string }) {
  const [rk, setRk] = useState("m6");
  const r = RANGES.find((x) => x.k === rk) ?? RANGES[1];
  const m = useMemo(() => {
    const c = cumulativeSeries(dates, r.mode, r.n);
    const start = c.values[0] - c.added[0], end = c.values[c.values.length - 1];
    const gained = end - start;
    const pct = start < MIN_DELTA_BASE ? null : Math.round((gained / start) * 100);
    const peakAt = c.added.indexOf(Math.max(...c.added));
    return { c, start, end, gained, pct, peak: c.added[peakAt], peakLabel: c.labels[peakAt] };
  }, [dates, r]);

  const cls = m.pct == null ? "flat" : m.pct > 0 ? "up" : "flat";
  const sentence = m.gained === 0
    ? `אין ${noun} חדשים ב${r.text}. בסך הכול ${nf(m.end)}.`
    : `${nf(m.end)} ${noun} בסך הכול. נוספו ${nf(m.gained)} ב${r.text}` + (m.pct == null ? ` (בתחילת התקופה היו ${nf(m.start)}, מעט מדי להשוואה באחוזים). ` : `, גידול של ${m.pct}% מתחילת התקופה. `) + `השיא: ${nf(m.peak)} ${r.unit === "בשבוע" ? "בשבוע של" : "ב"}${m.peakLabel}.`;

  return (
    <div className="ck-card db-card db-trend">
      <div className="db-head">
        <h3>{title}</h3>
        <div className="db-toggle" role="group" aria-label="טווח זמן">
          {RANGES.map((x) => <button key={x.k} type="button" aria-pressed={rk === x.k} onClick={() => setRk(x.k)}>{x.label}</button>)}
        </div>
      </div>
      <div className="db-trend-top">
        <div className="db-kval"><b>{nf(m.end)}</b><small>{noun}</small></div>
        <span className={`db-delta ${cls}`}>
          <span aria-hidden="true">{m.gained > 0 ? "▲" : "■"}</span> <bdi dir="ltr">{m.gained > 0 ? "+" : ""}{m.gained}</bdi>
          {m.pct != null && <> (<bdi dir="ltr">+{m.pct}%</bdi>)</>}<span className="db-sr"> מתחילת התקופה</span>
        </span>
      </div>
      <MarketChart
        title={title}
        labels={m.c.labels}
        series={[{ key: "total", label: "סך הכול", color: "var(--chart-ok, #216f33)", values: m.c.values, kind: "area" }]}
        bars={{ label: `נוספו ${r.unit}`, values: m.c.added }}
        axis={nf}
        trend
        barsAvg
      />
      <p className="db-trend-note">{sentence}</p>
    </div>
  );
}
