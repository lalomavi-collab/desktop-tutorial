// A market style chart for the cockpit: smooth filled curves (never overshooting the data), a level crosshair with a dot on every series,
// a live readout, high and low marks, a volume strip of per bucket additions underneath, and keyboard stepping. Presentational: the
// caller passes the numbers. The time axis runs left to right in every language (the drawing is LTR, like TrendCard).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { areaPath, linearTrend, mean, monotonePath, movingAverage, nearestIndex, niceTicks, shortNumber } from "../../lib/cockpit/marketChart";
import type { Pt } from "../../lib/cockpit/marketChart";

export interface MarketSeries {
  key: string; label: string; color: string; values: number[];
  /** area: curve with a gradient fill; line: curve only; dashed: dashed curve, drawn under the others. */
  kind: "area" | "line" | "dashed";
}
export interface MarketBars { label: string; values: number[]; color?: string }

const L = 42, R = 18, T = 30;
const nf = (v: number) => v.toLocaleString("he-IL");

export function MarketChart({ title, labels, series, bars, ma, avg, trend, barsAvg, format = nf, axis = shortNumber, height = 230 }: {
  title: string; labels: string[]; series: MarketSeries[]; bars?: MarketBars;
  /** Moving average window over the first series, drawn as a thin dashed line (omit for none). */
  ma?: number;
  /** A level line at the mean of the first filled or plain series, a straight least squares trend line through it, and a mean line on the strip of additions. */
  avg?: boolean; trend?: boolean; barsAvg?: boolean;
  format?: (v: number) => string; axis?: (v: number) => string; height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  // The drawing is as wide as its box (not scaled from a fixed width), so a label is the same size in pixels on a phone and on a desktop.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = labels.length;
  const barsH = bars ? 44 : 0, B = 26 + barsH, plotH = height - T - B, step = n > 1 ? (W - L - R) / (n - 1) : 0;

  const primary = series.find((x) => x.kind !== "dashed") ?? series[0];
  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const maxV = Math.max(1, ...all), minV = Math.min(0, ...all);
    const ticks = niceTicks(minV, maxV, 4);
    const lo = Math.min(minV, ticks[0] ?? minV), hi = Math.max(maxV, ticks[ticks.length - 1] ?? maxV);
    const y = (v: number) => T + plotH - ((v - lo) / Math.max(1e-9, hi - lo)) * plotH;
    const x = (i: number) => (n > 1 ? L + step * i : L + (W - L - R) / 2);
    const lines = series.map((s) => {
      const pts: Pt[] = s.values.map((v, i) => [x(i), y(v)]);
      const d = monotonePath(pts);
      return { s, pts, d, area: s.kind === "area" ? areaPath(d, pts, y(Math.max(0, lo))) : "" };
    });
    const maLine = ma && primary ? (() => { const pts: Pt[] = movingAverage(primary.values, ma).map((v, i) => [x(i), y(v)]); return monotonePath(pts); })() : "";
    const pv = primary?.values ?? [];
    const avgV = mean(pv);
    const tr = linearTrend(pv);
    const trendPts: Pt[] = pv.length > 1 ? [[x(0), y(tr.intercept)], [x(n - 1), y(tr.intercept + tr.slope * (n - 1))]] : [];
    return { ticks, lo, hi, y, x, lines, maLine, avgV, avgY: y(avgV), trendPts, slope: tr.slope };
  }, [series, n, step, plotH, ma, W, primary]);

  const first = series.find((x) => x.kind !== "dashed") ?? series[0];
  const hi = first ? Math.max(...first.values) : 0, lo = first ? Math.min(...first.values) : 0;
  const hiAt = first ? first.values.indexOf(hi) : 0, loAt = first ? first.values.lastIndexOf(lo) : 0;
  const shown = hover ?? n - 1;
  // The change shown is for the series the readout lists first, so the figure next to it is the figure it describes.
  const lead = series[0];
  const pvals = lead?.values ?? [];
  // The currency formatter wraps its output in direction marks; inside a right to left page they pull the sign to the far end, so they are
  // stripped and the whole change is one left to right string: sign, figure, percent.
  const plain = (v: string) => v.replace(/[\u200e\u200f\u061c]/g, "");
  // Direction of the straight trend line: the rise over the whole window against the mean level; within 5% counts as steady.
  const rise = geo.slope * Math.max(0, n - 1), level = Math.max(1e-9, Math.abs(geo.avgV));
  const direction = Math.abs(rise) / level < 0.05 ? "יציבה" : rise > 0 ? "עולה" : "יורדת";
  const delta = shown > 0 && lead ? pvals[shown] - pvals[shown - 1] : null;
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "");
  const deltaPct = delta != null && pvals[shown - 1] > 0 ? Math.round((delta / pvals[shown - 1]) * 100) : null;
  const deltaText = delta == null ? "" : `${sign(delta)}${plain(format(Math.abs(delta)))}${deltaPct != null ? ` (${sign(delta)}${Math.abs(deltaPct)}%)` : ""}`;
  const barMax = bars ? Math.max(1, ...bars.values) : 1;
  const baseY = T + plotH;

  const at = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(nearestIndex(((e.clientX - r.left) / r.width) * W, L, step, n));
  };
  const onKey = (e: KeyboardEvent) => {
    const last = n - 1, cur = hover ?? last;
    const to = e.key === "ArrowRight" ? Math.min(last, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "Escape" ? null : undefined;
    if (to === undefined) return;
    e.preventDefault(); setHover(to);
  };
  const summary = `${title}: ` + labels.map((l, i) => `${l} ` + series.map((s) => `${s.label} ${format(s.values[i])}`).join(", ")).join("; ");

  if (n === 0 || series.length === 0) return null;
  return (
    <div className="mk" ref={box}>
      <div className="mk-read" aria-live="polite">
        <bdi className="mk-when">{labels[shown]}</bdi>
        {series.map((s) => (
          <span key={s.key} className="mk-val"><i style={{ background: s.color }} aria-hidden="true" />{s.label} <b><bdi dir="ltr">{format(s.values[shown])}</bdi></b></span>
        ))}
        {bars && <span className="mk-val"><i className="mk-sq" aria-hidden="true" />{bars.label} <b><bdi dir="ltr">{nf(bars.values[shown])}</bdi></b></span>}
        {delta != null && (
          <span className={`mk-delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
            <span aria-hidden="true">{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}</span> <bdi dir="ltr">{deltaText}</bdi> <span className="mk-vs">לעומת הקודם</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} className="mk-svg" role="img" tabIndex={0} aria-label={summary + ". חצים מזיזים בין הנקודות"} style={{ direction: "ltr" }}
        onPointerMove={at} onPointerDown={at} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <defs>
          {geo.lines.filter((l) => l.s.kind === "area").map((l) => (
            <linearGradient key={l.s.key} id={`${uid}-${l.s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={l.s.color} stopOpacity=".34" /><stop offset="1" stopColor={l.s.color} stopOpacity="0" />
            </linearGradient>
          ))}
          <clipPath id={`${uid}-clip`}><rect x={L - 1} y={T - 4} width={W - L - R + 2} height={plotH + 8} /></clipPath>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--chart-grid, rgba(83,112,86,.14))" strokeDasharray={t === Math.max(0, geo.lo) ? undefined : "2 5"} />
            <text x={L - 7} y={geo.y(t) + 4} textAnchor="end" className="mk-t">{axis(t)}</text>
          </g>
        ))}
        {/* clipped to the plot so a smoothed curve never paints over the axis labels */}
        <g clipPath={`url(#${uid}-clip)`}>
          {geo.lines.filter((l) => l.s.kind === "dashed").map((l) => <path key={l.s.key} d={l.d} fill="none" stroke={l.s.color} strokeWidth="1.6" strokeDasharray="5 4" strokeLinecap="round" opacity=".85" />)}
          {geo.lines.filter((l) => l.s.kind === "area").map((l) => <path key={`a-${l.s.key}`} d={l.area} fill={`url(#${uid}-${l.s.key})`} aria-hidden="true" />)}
          {avg && <line x1={L} x2={W - R} y1={geo.avgY} y2={geo.avgY} stroke="var(--chart-warn, #b8780a)" strokeWidth="1.3" strokeDasharray="7 4" opacity=".9" />}
          {trend && geo.trendPts.length > 1 && <line x1={geo.trendPts[0][0]} y1={geo.trendPts[0][1]} x2={geo.trendPts[1][0]} y2={geo.trendPts[1][1]} stroke="var(--chart-cat-2, #2a75ba)" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />}
          {geo.maLine && <path d={geo.maLine} fill="none" stroke="var(--slate)" strokeWidth="1.3" strokeDasharray="2 4" strokeLinecap="round" opacity=".8" />}
          {geo.lines.filter((l) => l.s.kind !== "dashed").map((l) => <path key={`l-${l.s.key}`} d={l.d} fill="none" stroke={l.s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
        </g>
        {avg && <text x={L + 6} y={geo.avgY - 5} textAnchor="start" className="mk-t mk-avg" aria-hidden="true">{axis(geo.avgV)}</text>}
        {first && hi !== lo && (
          <g className="mk-mark" aria-hidden="true">
            {hiAt !== n - 1 && hiAt !== 0 && <text x={geo.x(hiAt)} y={geo.y(hi) - 8} textAnchor="middle" className="mk-t mk-hi">{axis(hi)}</text>}
            {lo !== 0 && loAt !== hiAt && loAt !== n - 1 && loAt !== 0 && <text x={geo.x(loAt)} y={Math.min(baseY - 4, geo.y(lo) + 17)} textAnchor="middle" className="mk-t">{axis(lo)}</text>}
          </g>
        )}
        {bars && bars.values.map((v, i) => {
          const h = Math.max(v > 0 ? 2 : 0, (v / barMax) * (barsH - 8)), bw = Math.min(26, (n > 1 ? step : 40) * 0.56);
          return <rect key={i} x={geo.x(i) - bw / 2} y={baseY + 16 + (barsH - 8) - h} width={bw} height={h} rx={2} fill={bars.color ?? "var(--slate)"} opacity={hover != null && hover !== i ? 0.2 : 0.42} />;
        })}
        {bars && barsAvg && (() => {
          const m = mean(bars.values), yy = baseY + 16 + (barsH - 8) - (m / barMax) * (barsH - 8);
          return <g aria-hidden="true"><line x1={L} x2={W - R} y1={yy} y2={yy} stroke="var(--chart-warn, #b8780a)" strokeWidth="1.2" strokeDasharray="5 4" /><text x={L - 7} y={yy + 4} textAnchor="end" className="mk-t mk-avg">{+m.toFixed(1)}</text></g>;
        })()}
        {labels.map((lb, i) => (n <= 12 || i % 2 === 0 || i === n - 1) && <text key={i} x={geo.x(i)} y={height - 7} textAnchor="middle" className={`mk-t${i === shown && hover != null ? " mk-on" : ""}`}>{lb}</text>)}
        {hover != null && (
          <g aria-hidden="true">
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={T} y2={height - B + barsH + 6} stroke="var(--slate)" strokeOpacity=".55" strokeDasharray="3 3" />
            {geo.lines.map((l) => <circle key={l.s.key} cx={l.pts[hover][0]} cy={l.pts[hover][1]} r={4.5} fill="var(--card, #fff)" stroke={l.s.color} strokeWidth="2.2" />)}
          </g>
        )}
        {hover == null && geo.lines.filter((l) => l.s.kind !== "dashed").map((l) => {
          const p = l.pts[n - 1];
          return <g key={`e-${l.s.key}`} aria-hidden="true"><circle cx={p[0]} cy={p[1]} r={11} fill={l.s.color} opacity=".16" /><circle cx={p[0]} cy={p[1]} r={5} fill={l.s.color} stroke="var(--card, #fff)" strokeWidth="2" /></g>;
        })}
      </svg>
      <div className="mk-key" aria-hidden="true">
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        {ma && <span><i className="mk-dot" />ממוצע נע {ma}</span>}
        {avg && <span><i className="mk-dash" />ממוצע</span>}
        {trend && <span><i className="mk-trend" />מגמה: <b>{direction}</b></span>}
        {barsAvg && bars && <span><i className="mk-dash" />ממוצע {bars.label}</span>}
      </div>
    </div>
  );
}
