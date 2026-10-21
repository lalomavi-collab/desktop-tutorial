// Dashboard trend card in the manner of a market chart page: a large figure with a change chip, range tabs, a bar chart for counts with
// the current bucket marked, a second series under it, and one sentence computed from the same numbers (never written by a model).
// Counts are drawn as bars on purpose: a smoothed line through values of 0 to 2 invents peaks that never happened.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MIN_DELTA_BASE, series } from "../../lib/cockpit/dashboard";

const RANGES = [
  { k: "w12", label: "12 שבועות", mode: "weekly" as const, n: 12, text: "12 השבועות האחרונים" },
  { k: "m6", label: "6 חודשים", mode: "monthly" as const, n: 6, text: "6 החודשים האחרונים" },
  { k: "m12", label: "שנה", mode: "monthly" as const, n: 12, text: "12 החודשים האחרונים" },
];
const sum = (a: number[]) => a.reduce((t, v) => t + v, 0);
const nf = (v: number) => v.toLocaleString("he-IL");

export function TrendCard({ title, unit, dates, secondDates, secondLabel, to, toLabel }: {
  title: string; unit: string; dates: string[]; secondDates?: string[]; secondLabel?: string; to?: string; toLabel?: string;
}) {
  const [rk, setRk] = useState("w12");
  const [hover, setHover] = useState<number | null>(null);
  const r = RANGES.find((x) => x.k === rk) ?? RANGES[0];
  const m = useMemo(() => {
    const two = series(dates, r.mode, r.n * 2).values;
    const cur = sum(two.slice(r.n)), prev = sum(two.slice(0, r.n));
    const main = series(dates, r.mode, r.n);
    const second = secondDates ? series(secondDates, r.mode, r.n).values : null;
    const pct = prev < MIN_DELTA_BASE ? null : Math.round(((cur - prev) / prev) * 100);
    return { main, second, cur, prev, pct };
  }, [dates, secondDates, r]);

  const { values, labels } = m.main;
  const max = Math.max(1, ...values), peak = values.indexOf(Math.max(...values));
  const W = 640, H = 190, L = 34, R = 6, T = 14, B = 26, plotH = H - T - B, step = (W - L - R) / values.length, bw = Math.min(34, step * 0.62);
  const x = (i: number) => L + step * i + step / 2, y = (v: number) => T + plotH - (v / max) * plotH;
  const sMax = Math.max(1, ...(m.second ?? [1]));
  const arrow = m.pct == null ? "■" : m.pct > 0 ? "▲" : m.pct < 0 ? "▼" : "■";
  const cls = m.pct == null ? "flat" : m.pct > 0 ? "up" : m.pct < 0 ? "down" : "flat";
  const sentence = m.cur === 0
    ? `אין ${unit} ב${r.text}.`
    : `${nf(m.cur)} ${unit} ב${r.text}. ` + (m.pct == null ? `בתקופה הקודמת היו ${nf(m.prev)}, מעט מדי להשוואה באחוזים. ` : `${m.pct > 0 ? "עלייה" : m.pct < 0 ? "ירידה" : "ללא שינוי"}${m.pct !== 0 ? ` של ${Math.abs(m.pct)}%` : ""} לעומת התקופה הקודמת (${nf(m.prev)}). `) + `השיא: ${nf(values[peak])} ב${labels[peak]}.`;
  const shown = hover ?? values.length - 1;
  // Keyboard reach for the readout: arrows step between bars (the drawing is LTR, so right is later), Home and End jump, Escape clears.
  const onKey = (e: React.KeyboardEvent) => {
    const last = values.length - 1, at = hover ?? last;
    const to = e.key === "ArrowRight" ? Math.min(last, at + 1) : e.key === "ArrowLeft" ? Math.max(0, at - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "Escape" ? null : undefined;
    if (to === undefined) return;
    e.preventDefault();
    setHover(to);
  };

  return (
    <div className="ck-card db-card db-trend">
      <div className="db-head">
        <h3>{title}</h3>
        <div className="db-toggle" role="group" aria-label="טווח זמן">
          {RANGES.map((x) => <button key={x.k} type="button" aria-pressed={rk === x.k} onClick={() => { setRk(x.k); setHover(null); }}>{x.label}</button>)}
        </div>
      </div>
      <div className="db-trend-top">
        <div className="db-kval"><b>{nf(m.cur)}</b><small>{unit}</small></div>
        <span className={`db-delta ${cls}`}><span aria-hidden="true">{arrow}</span> {m.pct == null ? "אין בסיס להשוואה" : <bdi dir="ltr">{m.pct > 0 ? "+" : ""}{m.pct}%</bdi>}<span className="db-sr"> לעומת התקופה הקודמת</span></span>
        <span className="db-trend-read" aria-live="polite"><bdi>{labels[shown]}</bdi>: <b>{nf(values[shown])}</b></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="db-trend-svg" role="img" tabIndex={0} aria-label={`${title}: ${labels.map((l, i) => `${l} ${values[i]}`).join(", ")}. חצים מזיזים בין העמודות`} style={{ direction: "ltr" }}
        onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--chart-grid, rgba(83,112,86,.14))" /><text x={L - 6} y={y(max * f) + 4} textAnchor="end" fill="var(--slate)">{nf(Math.round(max * f))}</text></g>)}
        {values.map((v, i) => (
          <g key={i} onPointerEnter={() => setHover(i)}>
            <rect x={x(i) - step / 2} y={T} width={step} height={plotH + B} fill="transparent" />
            <rect x={x(i) - bw / 2} y={y(v)} width={bw} height={Math.max(v > 0 ? 2 : 0, T + plotH - y(v))} rx={3} fill={i === values.length - 1 ? "var(--chart-ok, #216f33)" : "var(--chart-ok-l, #5a9c62)"} opacity={hover != null && hover !== i ? 0.55 : 1} />
            {(values.length <= 12 || i % 2 === 0 || i === values.length - 1) && <text x={x(i)} y={H - 8} textAnchor="middle" fill="var(--slate)">{labels[i]}</text>}
          </g>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + plotH} stroke="var(--line-strong)" strokeDasharray="3 3" />}
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={5.5} fill="var(--chart-ok, #216f33)" stroke="var(--card, #fff)" strokeWidth={2} />
      </svg>
      {m.second && (
        <div className="db-trend-second">
          <span className="db-note">{secondLabel}</span>
          <svg viewBox={`0 0 ${W} 34`} role="img" aria-label={`${secondLabel}: ${m.second.join(", ")}`} style={{ direction: "ltr" }}>
            {m.second.map((v, i) => <rect key={i} x={x(i) - bw / 2} y={34 - (v / sMax) * 30} width={bw} height={Math.max(v > 0 ? 2 : 0, (v / sMax) * 30)} rx={2} fill="var(--slate)" opacity={hover != null && hover !== i ? 0.25 : 0.5} />)}
          </svg>
        </div>
      )}
      <p className="db-trend-note">{sentence}</p>
      {to && <Link className="ck-link" to={to}>{toLabel}</Link>}
    </div>
  );
}
