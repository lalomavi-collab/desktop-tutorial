// SVG/HTML charts for the cockpit. Dependency-free, each with a hover tooltip and a text
// alternative (role="img" + aria-label carries every number for anyone who can't see or
// hover the chart). Colours are theme tokens, defined and validated (OKLCH band, chroma
// floor, CVD delta-E, contrast) against both cockpit surfaces in cockpit-mint.css; see the
// comment there for how to re-check them after a change.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import "../../styles/cockpit-charts.css";

const OK = "var(--chart-ok, #216f33)", OK_L = "var(--chart-ok-l, #5a9c62)", WARN = "var(--chart-warn, #d0901e)", BAD = "var(--chart-bad, #b3402f)";
const TRACK = "var(--chart-track, rgba(83,112,86,.12))", GRID = "var(--chart-grid, rgba(83,112,86,.14))";
const nf = (v: number) => v.toLocaleString("he-IL");

/** Smooth path through points (Catmull-Rom to cubic Bezier). */
function smooth(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Hover bubble, positioned in the chart's own local pixel space. Never the only way to read a value (see aria-label). */
function Tip({ x, y, children, flip }: { x: number; y: number; children: ReactNode; flip?: boolean }) {
  return (
    <div className={`ck-tip${flip ? " flip" : ""}`} style={{ left: x, top: y }} role="presentation">{children}</div>
  );
}

/** Area chart. values and labels are in time order (oldest first). Hover shows a crosshair and the exact reading. */
export function AreaChart({ values, labels, unit, id = "ac" }: { values: number[]; labels: string[]; unit: string; id?: string }) {
  // Drawn at the width the box really has (no scaling), so axis labels keep their size on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(620);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setBoxW(Math.max(240, Math.round(el.clientWidth)));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = boxW, H = 230, L = 40, R = 26, T = 16, B = 32;
  const max = Math.max(4, ...values);
  const nice = Math.ceil(max / 4) * 4;
  const step = values.length > 1 ? (W - L - R) / (values.length - 1) : 0;
  // Oldest value at the left edge, newest at the right (time reads left to right; the svg keeps dir=ltr inside the RTL page).
  const p2: Array<[number, number]> = values.map((v, i) => [L + i * step, T + (H - T - B) * (1 - v / nice)]);
  const line = smooth(p2);
  const area = p2.length > 1 ? `${line} L${p2[p2.length - 1][0]},${H - B} L${p2[0][0]},${H - B} Z` : "";
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ y: T + ((H - T - B) * i) / 4, v: Math.round(nice - (nice * i) / 4) }));
  const last = p2[p2.length - 1];
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (step <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(values.length - 1, Math.round((x - L) / step))));
  };
  const hp = hover != null ? p2[hover] : null;
  return (
    <div ref={box} className="ck-chart-wrap" style={{ width: "100%" }}>
      <span className="ck-live-badge"><i className="ck-live-dot" aria-hidden="true" />נתונים עדכניים</span>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${values.map((v, i) => `${labels[i]}: ${v}`).join(", ")} ${unit}`}
        style={{ direction: "ltr", display: "block" }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={WARN} stopOpacity=".4" /><stop offset=".65" stopColor={WARN} stopOpacity=".09" /><stop offset="1" stopColor={WARN} stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((t) => (<g key={t.y}><line x1={L} x2={W - R} y1={t.y} y2={t.y} stroke={GRID} /><text x={L - 8} y={t.y + 4} textAnchor="end" fontSize="12.5" fill="var(--slate)">{nf(t.v)}</text></g>))}
        {area && <path className="ck-area-fill" d={area} fill={`url(#${id}-f)`} />}
        {/* A soft blurred under-stroke (a cheap, broadly-supported stand-in for an SVG glow filter) gives the line the
            lit, instrument-panel look of the reference terminals, under the crisp line the reader actually reads. */}
        {line && <path className="ck-area-glow" d={line} fill="none" stroke={WARN} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".35" />}
        {line && <path className="ck-area-line" d={line} fill="none" stroke={WARN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={100} />}
        {last && (
          <line x1={last[0]} x2={W - 4} y1={last[1]} y2={last[1]} stroke={OK} strokeWidth="1.5" strokeDasharray="2 4" opacity={hp ? 0 : ".7"} aria-hidden="true" />
        )}
        {p2.map((p, i) => (i % Math.ceil(values.length / Math.max(2, Math.floor((W - L - R) / 62))) === 0 || i === values.length - 1) ? <text key={i} x={p[0]} y={H - 8} textAnchor="middle" fontSize="12.5" fill="var(--slate)">{labels[i]}</text> : null)}
        {hp && hover != null && (
          <g aria-hidden="true">
            {/* Trading-terminal crosshair: a full vertical + horizontal hairline, with the exact reading pinned to each axis. */}
            <line x1={hp[0]} x2={hp[0]} y1={T} y2={H - B} stroke="var(--line-strong)" strokeWidth="1" />
            <line x1={L} x2={W - R} y1={hp[1]} y2={hp[1]} stroke="var(--line-strong)" strokeWidth="1" />
            <circle cx={hp[0]} cy={hp[1]} r="9" fill={WARN} opacity=".18" />
            <circle cx={hp[0]} cy={hp[1]} r="5" fill="var(--card-solid, #fff)" stroke={WARN} strokeWidth="3" />
            <g>
              <rect x={2} y={hp[1] - 10} width={L - 6} height="20" rx="5" fill={WARN} />
              <text x={L - 6 - (L - 10) / 2 + 2} y={hp[1] + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#fff">{nf(values[hover])}</text>
            </g>
            <g>
              <rect x={hp[0] - 24} y={H - B + 4} width="48" height="18" rx="5" fill={WARN} />
              <text x={hp[0]} y={H - B + 17} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{labels[hover]}</text>
            </g>
          </g>
        )}
        {!hp && last && (
          <g aria-hidden="true">
            <circle className="ck-live-pulse" cx={last[0]} cy={last[1]} r="9" fill={OK} />
            <circle cx={last[0]} cy={last[1]} r="5" fill="var(--card-solid, #fff)" stroke={OK} strokeWidth="3" />
            {/* The always-on current-value tag a trading terminal pins to its right axis, not just a hover state;
                it overlaps the plot's right edge the same way the reference terminals' price tags do. */}
            <g>
              <rect x={W - 50} y={last[1] - 10} width="46" height="20" rx="5" fill={OK} />
              <text x={W - 27} y={last[1] + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{nf(values[values.length - 1])}</text>
            </g>
          </g>
        )}
      </svg>
      {hp && hover != null && <Tip x={hp[0]} y={hp[1] - 14} flip={hp[0] > W - 90}><b>{nf(values[hover])}</b><span>{unit} · {labels[hover]}</span></Tip>}
    </div>
  );
}

/** Three-or-so rounded vertical bars with the value above, as a compact status breakdown. */
export function PillBars({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(", ")} className="ck-pillbars">
      {items.map((it, i) => (
        <div key={it.label} className="ck-pillcol" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))} onFocus={() => setHover(i)} onBlur={() => setHover((h) => (h === i ? null : h))} tabIndex={0}>
          <span className="ck-pillval">{nf(it.value)}</span>
          <div className="ck-pill" style={{ height: Math.max(26, 140 * (it.value / max)), background: `linear-gradient(180deg, color-mix(in srgb, ${it.color} 75%, white), ${it.color})` }} />
          <span className="ck-pilllabel">{it.label}</span>
          {hover === i && <Tip x={0} y={-8}><b>{nf(it.value)}</b><span>{it.label}</span></Tip>}
        </div>
      ))}
    </div>
  );
}

/** Donut with a centre label; hover lifts a segment and shows its share. */
export function Donut({ segments, centre, sub }: { segments: Array<{ label: string; value: number; color: string }>; centre: ReactNode; sub: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  const GAP = 3; // px of stroke-length left as a surface gap between segments
  const [hover, setHover] = useState<number | null>(null);
  let off = 0;
  const arcs = segments.map((s, i) => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const a = { ...s, i, len: Math.max(0, len - GAP), off };
    off += len;
    return a;
  });
  return (
    <div className="ck-donut-wrap">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")} className="ck-chart-wrap">
        <circle cx="70" cy="70" r={R} fill="none" stroke={TRACK} strokeWidth="16" />
        {/* Rotation lives on the shared group, never on an individual arc: a CSS transform (the hover scale below)
            and an SVG transform attribute on the same element fight for the same slot in some engines and the
            arc silently stops painting. Splitting them keeps each system to one element. */}
        <g transform="rotate(-90 70 70)">
          {arcs.map((a) => a.value > 0 && (
            <circle key={a.label} className={`ck-donut-arc${hover === a.i ? " hot" : hover != null ? " dim" : ""}`}
              cx="70" cy="70" r={R} fill="none" stroke={a.color} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.off}
              onPointerEnter={() => setHover(a.i)} onPointerLeave={() => setHover((h) => (h === a.i ? null : h))}
              onFocus={() => setHover(a.i)} onBlur={() => setHover((h) => (h === a.i ? null : h))} tabIndex={0}
              role="presentation" />
          ))}
        </g>
        <text x="70" y="68" textAnchor="middle" fontSize="25" fontWeight="800" fill="var(--ink)">{hover != null ? nf(segments[hover].value) : centre}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="11.5" fill="var(--slate)">{hover != null ? segments[hover].label : sub}</text>
      </svg>
      <ul className="ck-legend">
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.label} className={hover != null && hover !== i ? "dim" : undefined} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))}>
              <span className="ck-swatch" style={{ background: s.color }} /><span className="ck-legend-label">{s.label}</span><b>{nf(s.value)}</b><small>{pct}%</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Horizontal progress bar with a status colour. */
export function StatusBar({ pct, tone }: { pct: number; tone: "green" | "yellow" | "red" }) {
  const c = tone === "green" ? [OK_L, OK] : tone === "yellow" ? ["#f0cf8f", WARN] : ["#e7b0a6", BAD];
  return <div className="ck-statusbar-track"><div className="ck-statusbar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c[0]}, ${c[1]})` }} /></div>;
}

/** Half-circle gauge for one percentage, with the number in the middle. */
export function Gauge({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const R = 60, C = Math.PI * R;
  const color = p >= 80 ? OK : p >= 60 ? WARN : BAD;
  return (
    <div className="ck-gauge">
      <svg viewBox="0 0 150 90" width="190" role="img" aria-label={`${label}: ${p}%`}>
        <path d="M15 80a60 60 0 0 1 120 0" fill="none" stroke={GRID} strokeWidth="16" strokeLinecap="round" />
        <path className="ck-gauge-arc" d="M15 80a60 60 0 0 1 120 0" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(p / 100) * C} ${C}`} pathLength={C} />
        <text x="75" y="70" textAnchor="middle" fontSize="25" fontWeight="800" fill="var(--ink)">{p}%</text>
      </svg>
      <b className="ck-gauge-label">{label}</b>
      <span className="ck-gauge-sub">{sub}</span>
    </div>
  );
}

/** Horizontal labelled bars with the value at the end. One item with no colour -> every bar shares the brand hue (a value-ramp on nominal categories is a documented anti-pattern); pass colour only when it's a real status read. */
export function BarsH({ items, max }: { items: Array<{ label: string; value: number; color?: string; suffix?: string }>; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="img" aria-label={items.map((i) => `${i.label}: ${i.value}${i.suffix ?? ""}`).join(", ")} className="ck-barsh">
      {items.map((it, i) => (
        <div key={it.label} className={`ck-barsh-row${hover === i ? " hot" : ""}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))} onFocus={() => setHover(i)} onBlur={() => setHover((h) => (h === i ? null : h))} tabIndex={0}>
          <span className="ck-barsh-label">{it.label}</span>
          <div className="ck-barsh-track">
            <div className="ck-barsh-fill" style={{ width: `${Math.max(3, (it.value / m) * 100)}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${it.color ?? OK} 55%, white), ${it.color ?? OK})` }} />
          </div>
          <b className="ck-barsh-val">{nf(it.value)}{it.suffix ?? ""}</b>
        </div>
      ))}
    </div>
  );
}

/** Tiny column chart (one bar per bucket), for a strip under a heading. */
export function MiniBars({ values, labels, color = OK }: { values: number[]; labels: string[]; color?: string }) {
  const m = Math.max(1, ...values);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="img" aria-label={values.map((v, i) => `${labels[i]}: ${v}`).join(", ")} className="ck-minibars">
      {values.map((v, i) => (
        <div key={i} className="ck-minibar-col" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))} onFocus={() => setHover(i)} onBlur={() => setHover((h) => (h === i ? null : h))} tabIndex={0}>
          <div className="ck-minibar" style={{ height: Math.max(6, 66 * (v / m)), background: `linear-gradient(180deg, color-mix(in srgb, ${color} 55%, white), ${color})` }} />
          <span className="ck-minibar-label">{labels[i]}</span>
          {hover === i && <Tip x={0} y={-74 - 10}><b>{nf(v)}</b><span>{labels[i]}</span></Tip>}
        </div>
      ))}
    </div>
  );
}

/** Grouped columns: two or three series side by side per bucket (e.g. income vs. expenses per month), with a legend and a per-bucket hover readout. Replaces a flat PillBars row for genuinely paired data. */
export function GroupedBars({ buckets, series, unit }: { buckets: string[]; series: Array<{ label: string; color: string; values: number[] }>; unit?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setBoxW(Math.max(240, Math.round(el.clientWidth)));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = boxW, H = 220, L = 46, R = 10, T = 10, B = 28;
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4;
  const plotH = H - T - B;
  const n = buckets.length;
  const groupW = n > 0 ? (W - L - R) / n : 0;
  const barGap = 3, barW = Math.max(4, (groupW - barGap * (series.length + 1)) / series.length);
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ y: T + (plotH * i) / 4, v: Math.round(nice - (nice * i) / 4) }));
  const label = series.map((s) => `${s.label}: ${s.values.join(", ")}`).join(" · ");
  return (
    <div ref={box} className="ck-chart-wrap" style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${buckets.join(", ")} — ${label}${unit ? ` (${unit})` : ""}`} style={{ direction: "ltr", display: "block" }}>
        {ticks.map((t) => (<g key={t.y}><line x1={L} x2={W - R} y1={t.y} y2={t.y} stroke={GRID} /><text x={L - 8} y={t.y + 4} textAnchor="end" fontSize="12" fill="var(--slate)">{nf(t.v)}</text></g>))}
        {buckets.map((b, gi) => {
          const gx = L + gi * groupW;
          return (
            <g key={b} onPointerEnter={() => setHover(gi)} onPointerLeave={() => setHover((h) => (h === gi ? null : h))} onFocus={() => setHover(gi)} onBlur={() => setHover((h) => (h === gi ? null : h))} tabIndex={0} role="presentation">
              <rect x={gx} y={T} width={groupW} height={plotH} fill={hover === gi ? "var(--chart-track, rgba(83,112,86,.12))" : "transparent"} rx="6" />
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0;
                const h = nice > 0 ? (v / nice) * plotH : 0;
                const x = gx + barGap + si * (barW + barGap);
                const y = T + plotH - h;
                return <rect key={s.label} x={x} y={y} width={barW} height={Math.max(0, h)} rx={Math.min(4, barW / 2)} fill={s.color} className="ck-group-bar" />;
              })}
              <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--slate)">{b}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tip x={L + hover * groupW + groupW / 2} y={T + 4} flip={L + hover * groupW + groupW / 2 > W - 100}>
          <b>{buckets[hover]}</b>
          {series.map((s) => <span key={s.label}><i className="ck-tip-key" style={{ background: s.color }} />{s.label}: {nf(s.values[hover] ?? 0)}{unit ? ` ${unit}` : ""}</span>)}
        </Tip>
      )}
      <ul className="ck-legend ck-legend-row">
        {series.map((s) => <li key={s.label}><span className="ck-swatch" style={{ background: s.color }} /><span className="ck-legend-label">{s.label}</span></li>)}
      </ul>
    </div>
  );
}
