// Charts for the finance dashboard's tiles (BankDashboardTab), drawn to the rules every cockpit chart follows: thin marks,
// columns at most 24px wide with a 4px rounded data end and a square foot on the baseline, a 2px surface gap between
// touching fills, solid hairline grids, one hover or focus readout per mark, and a text alternative that carries every
// number. Colours are theme tokens only, so the light and the dark cockpit both hold. Numeric drawings run left to right
// in every language, like MarketChart; the text around them stays right to left.
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { Amt } from "./Amt";
import { acctText } from "../../lib/cockpit/accounting";
import { areaPath, monotonePath, niceTicks, shortNumber } from "../../lib/cockpit/marketChart";
import type { Pt } from "../../lib/cockpit/marketChart";
import { bridgeScale, heatStep, shares } from "../../lib/cockpit/bankTiles";
import type { BridgeRow } from "../../lib/cockpit/bankTiles";
import { IN, OK, OUT, quiet } from "./finChartColors";
import "../../styles/cockpit-charts.css";

const ils = (v: number) => `${acctText(v)} ₪`;

/** The width the drawing really has, so a label is the same size in pixels on a phone and on a desktop. */
function useWidth(min: number, initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(min, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}

function Tip({ x, y, flip, children }: { x: number; y: number; flip?: boolean; children: ReactNode }) {
  return <div className={`ck-tip${flip ? " flip" : ""}`} style={{ left: x, top: y }} role="presentation">{children}</div>;
}

/** Arrows step between the marks, Home and End jump, Escape clears; the drawing is left to right, so right is later. */
function stepper(n: number, cur: number | null, set: (i: number | null) => void) {
  return (e: KeyboardEvent) => {
    const last = n - 1, at = cur ?? last;
    const to = e.key === "ArrowRight" ? Math.min(last, at + 1) : e.key === "ArrowLeft" ? Math.max(0, at - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "Escape" ? null : undefined;
    if (to === undefined) return;
    e.preventDefault(); set(to);
  };
}

/** A column from the baseline y0 to the data end y1: the data end rounded (4px or less), the foot square. */
function col(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const r = Math.min(4, w / 2, h), up = y1 < y0;
  const e = up ? y1 + r : y1 - r, s = up ? 1 : 0;
  return `M${x},${y0} L${x},${e} A${r},${r} 0 0 ${s} ${x + r},${y1} L${x + w - r},${y1} A${r},${r} 0 0 ${s} ${x + w},${e} L${x + w},${y0} Z`;
}

// ---------- Sparkline ----------

/** A trend line for a stat tile: the line and a light wash under it, the last point marked, a readout on hover. */
export function Spark({ values, labels, color = OK, label, format = ils }: {
  values: number[]; labels: string[]; color?: string; label: string; format?: (v: number) => string;
}) {
  const [ref, W] = useWidth(120, 240);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  if (n < 2) return null;
  const H = 46, T = 6, B = 6;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const x = (i: number) => 5 + ((W - 10) * i) / (n - 1), y = (v: number) => T + (H - T - B) * (1 - (v - lo) / span);
  const pts: Pt[] = values.map((v, i) => [x(i), y(v)]);
  const d = monotonePath(pts), area = areaPath(d, pts, H - B);
  const at = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round((((e.clientX - r.left) / r.width) * W - 5) / ((W - 10) / (n - 1))))));
  };
  const p = hover != null ? pts[hover] : null;
  return (
    <div ref={ref} className="ck-chart-wrap bd-spark">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" tabIndex={0} style={{ direction: "ltr", display: "block" }}
        aria-label={`${label}: ${labels.map((l, i) => `${l} ${format(values[i])}`).join(", ")}`}
        onPointerMove={at} onPointerDown={at} onPointerLeave={() => setHover(null)} onKeyDown={stepper(n, hover, setHover)} onBlur={() => setHover(null)}>
        <path d={area} fill={color} opacity=".1" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {p && <line x1={p[0]} x2={p[0]} y1={T - 2} y2={H - B} stroke="var(--slate)" strokeOpacity=".5" />}
        <circle cx={(p ?? pts[n - 1])[0]} cy={(p ?? pts[n - 1])[1]} r="4" fill={color} stroke="var(--card-solid, #fff)" strokeWidth="2" />
      </svg>
      {p && hover != null && <Tip x={p[0]} y={p[1] - 4} flip={p[0] > W - 90}><b dir="ltr">{format(values[hover])}</b><span>{labels[hover]}</span></Tip>}
    </div>
  );
}

// ---------- Columns by month ----------

/** One column per month, the month the tile is about in full colour and the rest quieter. Signed values hang from zero:
 *  with tone "net" a month above zero takes the inflow colour and one below the outflow colour. */
export function MonthCols({ values, labels, active, tone, label, height = 64, every }: {
  values: number[]; labels: string[]; active: number; tone: "in" | "out" | "net" | "plain"; label: string; height?: number;
  /** Show every n-th month's name under its column (the active one always). Default: as many as fit. */
  every?: number;
}) {
  const [ref, W] = useWidth(140, 260);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  if (n === 0) return null;
  const LB = 18, H = height + LB, T = 4;
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values), span = hi - lo || 1;
  const y = (v: number) => T + (height - T) * (1 - (v - lo) / span);
  const slot = W / n, bw = Math.min(24, Math.max(4, slot - 2 - slot * 0.3));
  const show = every ?? Math.max(1, Math.ceil(34 / slot));
  const colour = (v: number) => (tone === "in" ? IN : tone === "out" ? OUT : tone === "plain" ? OK : v >= 0 ? IN : OUT);
  const cx = (i: number) => slot * i + slot / 2;
  return (
    <div ref={ref} className="ck-chart-wrap bd-cols">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" tabIndex={0} style={{ direction: "ltr", display: "block" }}
        aria-label={`${label}: ${labels.map((l, i) => `${l} ${ils(values[i])}`).join(", ")}`}
        onPointerLeave={() => setHover(null)} onKeyDown={stepper(n, hover, setHover)} onBlur={() => setHover(null)}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--chart-grid)" />
        {values.map((v, i) => {
          const c = colour(v), on = i === active || i === hover;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={slot * i} y={0} width={slot} height={H} fill="transparent" />
              <path d={col(cx(i) - bw / 2, bw, y(0), y(v))} fill={on ? c : quiet(c)} />
              {(i === active || (i % show === 0 && Math.abs(i - active) >= show)) && (
                <text x={cx(i)} y={H - 4} textAnchor="middle" fontSize="12" fill={i === active ? "var(--ink)" : "var(--slate)"} fontWeight={i === active ? 700 : 400}>{labels[i]}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && <Tip x={cx(hover)} y={Math.min(y(values[hover]), y(0))} flip={cx(hover) > W - 90}><b dir="ltr">{ils(values[hover])}</b><span>{labels[hover]}</span></Tip>}
    </div>
  );
}

// ---------- Paired columns with an axis ----------

/** Columns per month for one or two series side by side (in against out, profit against draws), on one axis with
 *  solid hairline ticks. A month the tile is about (active) keeps full colour, the rest are quieter; the hover readout
 *  lists every series of that month. A single series needs no legend: the tile's title names it. */
export function PairCols({ buckets, series, active, label, height = 200, marks }: {
  buckets: string[]; series: Array<{ label: string; color: string; values: Array<number | null> }>; active?: number; label: string; height?: number;
  /** A suffix on a month's name (the asterisk on a month the statements cover only in part). */
  marks?: string[];
}) {
  const [ref, W] = useWidth(240, 560);
  const [hover, setHover] = useState<number | null>(null);
  const n = buckets.length;
  if (n === 0) return null;
  const L = 44, R = 6, T = 10, B = 24, plotH = height - T - B;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const vMin = Math.min(0, ...all), vMax = Math.max(1, ...all);
  // niceTicks stays inside the data's span, so one more step is added at either end until every column fits under the axis.
  const ticks = niceTicks(vMin, vMax);
  const tStep = ticks.length > 1 ? ticks[1] - ticks[0] : vMax - vMin || 1;
  while (ticks[ticks.length - 1] < vMax) ticks.push(+(ticks[ticks.length - 1] + tStep).toFixed(10));
  while (ticks[0] > vMin) ticks.unshift(+(ticks[0] - tStep).toFixed(10));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => T + plotH * (1 - (v - lo) / (hi - lo || 1));
  const slot = (W - L - R) / n, gap = 2, k = series.length;
  const bw = Math.min(24, Math.max(3, (slot * 0.72 - gap * (k - 1)) / k));
  const gx = (i: number) => L + slot * i + (slot - (bw * k + gap * (k - 1))) / 2;
  const show = Math.max(1, Math.ceil(46 / slot));
  const fmt = (v: number | null) => (v == null ? "לא חושב" : ils(v));
  return (
    <div ref={ref} className="ck-chart-wrap bd-pair">
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" tabIndex={0} style={{ direction: "ltr", display: "block" }}
        aria-label={`${label}: ${buckets.map((b, i) => `${b} ${series.map((s) => `${s.label} ${fmt(s.values[i])}`).join(", ")}`).join("; ")}`}
        onPointerLeave={() => setHover(null)} onKeyDown={stepper(n, hover, setHover)} onBlur={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--chart-grid)"} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--slate)">{shortNumber(t)}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const on = active == null || i === active || i === hover;
          return (
            <g key={b + i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={L + slot * i} y={T} width={slot} height={plotH + B} fill={hover === i ? "var(--chart-track)" : "transparent"} rx="6" />
              {series.map((s, si) => {
                const v = s.values[i];
                return v == null ? null : <path key={s.label} d={col(gx(i) + si * (bw + gap), bw, y(0), y(v))} fill={on ? s.color : quiet(s.color)} />;
              })}
              {(i === active || i === n - 1 || (i % show === 0 && n - 1 - i >= show && (active == null || Math.abs(i - active) >= show))) && (
                <text x={L + slot * i + slot / 2} y={height - 6} textAnchor="middle" fontSize="12" fill={i === active ? "var(--ink)" : "var(--slate)"} fontWeight={i === active ? 700 : 400}>{b}{marks?.[i] ?? ""}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tip x={L + slot * hover + slot / 2} y={T + 4} flip={L + slot * hover + slot / 2 > W - 130}>
          <b>{buckets[hover]}{marks?.[hover] ?? ""}</b>
          {series.map((s) => <span key={s.label}><i className="ck-tip-key" style={{ background: s.color }} />{s.label} <bdi dir="ltr">{fmt(s.values[hover])}</bdi></span>)}
        </Tip>
      )}
      {k > 1 && (
        <ul className="ck-legend ck-legend-row">
          {series.map((s) => <li key={s.label}><span className="ck-swatch" style={{ background: s.color }} /><span className="ck-legend-label">{s.label}</span></li>)}
        </ul>
      )}
    </div>
  );
}

// ---------- In and out, day by day ----------

/** The last days as mirrored columns: what came in above the line, what went out below it. */
export function DayFlows({ days, label }: { days: Array<{ date: string; inflow: number; outflow: number }>; label: string }) {
  const [ref, W] = useWidth(160, 300);
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  if (n === 0) return null;
  const H = 78, LB = 16, mid = (H - LB) / 2, half = mid - 3;
  const max = Math.max(1, ...days.map((d) => Math.max(d.inflow, d.outflow)));
  const slot = W / n, bw = Math.min(14, Math.max(3, slot * 0.55));
  const cx = (i: number) => slot * i + slot / 2;
  const dm = (iso: string) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}`;
  return (
    <div ref={ref} className="ck-chart-wrap bd-cols">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" tabIndex={0} style={{ direction: "ltr", display: "block" }}
        aria-label={`${label}: ${days.map((d) => `${dm(d.date)} נכנס ${ils(d.inflow)}, יצא ${ils(d.outflow)}`).join("; ")}`}
        onPointerLeave={() => setHover(null)} onKeyDown={stepper(n, hover, setHover)} onBlur={() => setHover(null)}>
        <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--chart-grid)" />
        {days.map((d, i) => (
          <g key={d.date} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} opacity={hover != null && hover !== i ? 0.5 : 1}>
            <rect x={slot * i} y={0} width={slot} height={H} fill="transparent" />
            <path d={col(cx(i) - bw / 2, bw, mid - 1, mid - 1 - (d.inflow / max) * half)} fill={IN} />
            <path d={col(cx(i) - bw / 2, bw, mid + 1, mid + 1 + (d.outflow / max) * half)} fill={OUT} />
          </g>
        ))}
        <text x={2} y={H - 3} fontSize="12" fill="var(--slate)">{dm(days[0].date)}</text>
        <text x={W - 2} y={H - 3} fontSize="12" fill="var(--slate)" textAnchor="end">{dm(days[n - 1].date)}</text>
      </svg>
      {hover != null && (
        <Tip x={cx(hover)} y={8} flip={cx(hover) > W - 110}>
          <b>{dm(days[hover].date)}</b>
          <span><i className="ck-tip-key" style={{ background: IN }} />נכנס <bdi dir="ltr">{ils(days[hover].inflow)}</bdi></span>
          <span><i className="ck-tip-key" style={{ background: OUT }} />יצא <bdi dir="ltr">{ils(days[hover].outflow)}</bdi></span>
        </Tip>
      )}
    </div>
  );
}

// ---------- A bridge from one figure to another ----------

/** A waterfall laid on its side, one row per step on a shared scale, so the eye follows the figure from where it starts
 *  to what is left. The labels and the amounts are text (the list is its own table); the bars are drawing only. */
export function Bridge({ rows, caption, extras, strong }: {
  rows: BridgeRow[]; caption: string;
  /** Something to show under a row, by its label (the reserve field under the reserve). */
  extras?: Partial<Record<string, ReactNode>>;
  /** The side that binds: drawn with a stronger frame. */
  strong?: boolean;
}) {
  const { lo, hi } = bridgeScale(rows);
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <figure className={`bd-bridge${strong ? " strong" : ""}`}>
      <figcaption>{caption}</figcaption>
      <ul>
        {rows.map((r) => {
          const a = pos(Math.min(r.from, r.to)), b = pos(Math.max(r.from, r.to));
          const fill = r.kind === "step" ? (r.value < 0 ? OUT : IN) : r.to < 0 ? OUT : r.kind === "total" ? OK : quiet(OK);
          return (
            <li key={r.label} className={r.kind}>
              <span className="bd-br-label">{r.label}{r.note && <small>{r.note}</small>}</span>
              <span className="bd-br-track" aria-hidden="true">
                {lo < 0 && <i className="bd-br-zero" style={{ left: `${pos(0)}%` }} />}
                {b - a < 0.3 ? <i className="bd-br-tick" style={{ left: `${a}%` }} /> : <i className="bd-br-bar" style={{ left: `${a}%`, width: `${b - a}%`, background: fill }} />}
              </span>
              <span className="bd-br-val"><Amt n={r.value} plus={r.kind === "step" && r.value > 0} /></span>
              {extras?.[r.label] && <div className="bd-br-extra">{extras[r.label]}</div>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

// ---------- Parts of one whole ----------

/** A stacked bar for the parts of one whole (what is free against what is owed), a surface gap between the parts and
 *  a legend that names each with its amount and share. */
export function Meter({ parts, label, legend = true }: { parts: Array<{ key: string; label: string; value: number; color: string }>; label: string; legend?: boolean }) {
  const rows = shares(parts);
  const [hover, setHover] = useState<string | null>(null);
  // A whole of nothing has no parts to show.
  if (rows.every((p) => p.pct === 0)) return null;
  return (
    <div className="bd-meter">
      <div className="bd-meter-bar" dir="ltr" role="img" aria-label={`${label}: ${rows.map((p) => `${p.label} ${ils(p.value)} (${p.pct}%)`).join(", ")}`}>
        {rows.filter((p) => p.pct > 0).map((p) => (
          <i key={p.key} style={{ flexGrow: Math.max(0, p.value), background: p.color, opacity: hover && hover !== p.key ? 0.45 : 1 }}
            onPointerEnter={() => setHover(p.key)} onPointerLeave={() => setHover(null)} />
        ))}
      </div>
      {legend && (
        <ul className="bd-meter-key">
          {rows.map((p) => (
            <li key={p.key} className={hover && hover !== p.key ? "dim" : undefined} onPointerEnter={() => setHover(p.key)} onPointerLeave={() => setHover(null)}>
              <span className="ck-swatch" style={{ background: p.color }} />{p.label} <Amt n={p.value} /> <small>{p.pct}%</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A donut beside a list of the same parts, each with its amount, share and a thin bar, as Financy lays out the
 *  categories. Hovering a row lifts its wedge and the other way round. */
export function ShareDonut({ parts, centre, sub }: { parts: Array<{ key: string; label: string; value: number; color: string }>; centre: string; sub: string }) {
  const rows = shares(parts);
  const total = rows.reduce((s, p) => s + Math.max(0, p.value), 0);
  const top = Math.max(1, ...rows.map((p) => p.value));
  const [hover, setHover] = useState<number | null>(null);
  const R = 52, C = 2 * Math.PI * R, GAP = 3;
  const lens = rows.map((p) => (total > 0 ? (Math.max(0, p.value) / total) * C : 0));
  const arcs = rows.map((p, i) => ({ ...p, i, len: Math.max(0, lens[i] - GAP), off: lens.slice(0, i).reduce((s, l) => s + l, 0) }));
  return (
    <div className="bd-share">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={rows.map((p) => `${p.label}: ${ils(p.value)} (${p.pct}%)`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--chart-track)" strokeWidth="16" />
        <g transform="rotate(-90 70 70)">
          {arcs.map((a) => a.len > 0 && (
            <circle key={a.key} className={`ck-donut-arc${hover === a.i ? " hot" : hover != null ? " dim" : ""}`} cx="70" cy="70" r={R} fill="none" stroke={a.color}
              strokeWidth="16" strokeLinecap="butt" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.off}
              onPointerEnter={() => setHover(a.i)} onPointerLeave={() => setHover(null)} role="presentation" />
          ))}
        </g>
        <text x="70" y="68" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--ink)" style={{ direction: "ltr" }}>{hover != null ? Math.round(rows[hover].value).toLocaleString("he-IL") : centre}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="12" fill="var(--slate)">{hover != null ? `${rows[hover].pct}%` : sub}</text>
      </svg>
      <ul className="bd-share-list">
        {rows.map((p, i) => (
          <li key={p.key} className={hover != null && hover !== i ? "dim" : undefined} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <span className="bd-share-name"><span className="ck-swatch" style={{ background: p.color }} />{p.label}</span>
            <small>{p.pct}%</small>
            <span className="bd-share-track" aria-hidden="true"><i style={{ width: `${Math.max(2, (Math.max(0, p.value) / top) * 100)}%`, background: p.color }} /></span>
            <Amt n={p.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- A month as a calendar heat map ----------

const DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** The month as a calendar, each day in one of five steps of a single hue (the darkest is the heaviest day), with the
 *  scale under it. Every day reads its amount on hover or focus. */
export function Heat({ days, month, color, label }: { days: number[]; month: string; color: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...days);
  const firstDow = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const mm = month.slice(5, 7);
  // The steps come from the theme (--heat-1 to --heat-4 in cockpit-bank.css), re-stepped for the dark surface.
  const fill = (s: number) => (s === 0 ? "var(--chart-track)" : `color-mix(in srgb, ${color} var(--heat-${s}, ${[0, 22, 44, 68, 92][s]}%), var(--card-solid, #fff))`);
  return (
    <div className="bd-heat-wrap">
      <div className="bd-heat" role="group" aria-label={`${label}: ${days.map((v, i) => `${i + 1}.${Number(mm)} ${ils(v)}`).join(", ")}`}>
        {DOW.map((x) => <span key={x} className="bd-heat-dow" aria-hidden="true">{x}</span>)}
        {Array.from({ length: firstDow }, (_, i) => <span key={`e${i}`} aria-hidden="true" />)}
        {days.map((v, i) => {
          const s = heatStep(v, max);
          return (
            <span key={i} className={`bd-heat-day s${s}${hover === i ? " hot" : ""}`} style={{ background: fill(s) }} tabIndex={0}
              aria-label={`${i + 1}.${Number(mm)}: ${ils(v)}`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              {i + 1}
              {hover === i && <span className="ck-tip bd-heat-tip" role="presentation"><b dir="ltr">{ils(v)}</b><span>{i + 1}.{mm}</span></span>}
            </span>
          );
        })}
      </div>
      <div className="bd-heat-key" aria-hidden="true">
        <span>פחות</span>{[0, 1, 2, 3, 4].map((s) => <i key={s} style={{ background: fill(s) }} />)}<span>יותר</span>
      </div>
    </div>
  );
}

// ---------- A ranked list with a bar per row ----------

/** Rows ranked by size, each with its bar on a shared scale and its amount; inflow and outflow keep their colours. */
export function RankBars({ rows, label }: {
  rows: Array<{ key: string; label: ReactNode; sub?: ReactNode; value: number; shown?: ReactNode; dim?: boolean; after?: ReactNode }>; label: string;
}) {
  const top = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="bd-rank" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={r.dim ? "dim" : undefined}>
          <span className="bd-rank-name">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="bd-rank-val">{r.shown ?? <Amt n={r.value} plus={r.value > 0} />}{r.after}</span>
          <span className="bd-rank-track" aria-hidden="true"><i style={{ width: `${Math.max(2, (Math.abs(r.value) / top) * 100)}%`, background: r.value >= 0 ? IN : OUT }} /></span>
        </li>
      ))}
    </ul>
  );
}
