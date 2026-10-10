// Small dependency-free SVG charts for the cockpit dashboard. Each carries a text alternative (role="img" + aria-label) with its numbers.
import type { ReactNode } from "react";

const GREEN = "#3d8d2e", GREEN_L = "#8ed46a", SUN = "#f5c431", SUN_D = "#e0a312", RED = "#cf4b3a";

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

/** Area chart. values and labels are in time order (oldest first). */
export function AreaChart({ values, labels, unit, id = "ac" }: { values: number[]; labels: string[]; unit: string; id?: string }) {
  const W = 620, H = 230, L = 34, R = 14, T = 16, B = 30;
  const max = Math.max(4, ...values);
  const nice = Math.ceil(max / 4) * 4;
  const step = values.length > 1 ? (W - L - R) / (values.length - 1) : 0;
  // Oldest value at the left edge, newest at the right (time reads left to right; the svg keeps dir=ltr inside the RTL page).
  const p2: Array<[number, number]> = values.map((v, i) => [L + i * step, T + (H - T - B) * (1 - v / nice)]);
  const line = smooth(p2);
  const area = p2.length > 1 ? `${line} L${p2[p2.length - 1][0]},${H - B} L${p2[0][0]},${H - B} Z` : "";
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ y: T + ((H - T - B) * i) / 4, v: Math.round(nice - (nice * i) / 4) }));
  const last = p2[p2.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${values.map((v, i) => `${labels[i]}: ${v}`).join(", ")} ${unit}`} style={{ direction: "ltr", display: "block" }}>
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SUN} stopOpacity=".75" /><stop offset="1" stopColor={SUN} stopOpacity=".04" /></linearGradient>
      </defs>
      {ticks.map((t) => (<g key={t.y}><line x1={L} x2={W - R} y1={t.y} y2={t.y} stroke="rgba(47,111,38,.14)" strokeDasharray="3 5" /><text x={L - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--slate)">{t.v}</text></g>))}
      {area && <path d={area} fill={`url(#${id}-f)`} />}
      {line && <path d={line} fill="none" stroke={SUN_D} strokeWidth="3" strokeLinecap="round" />}
      {p2.map((p, i) => (i % Math.ceil(values.length / 8) === 0 || i === values.length - 1) ? <text key={i} x={p[0]} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--slate)">{labels[i]}</text> : null)}
      {last && <g><circle cx={last[0]} cy={last[1]} r="9" fill={GREEN} opacity=".18" /><circle cx={last[0]} cy={last[1]} r="5" fill="#fff" stroke={GREEN} strokeWidth="3" /></g>}
    </svg>
  );
}

/** Three-or-so rounded vertical bars with the value above, as the reference's order summary. */
export function PillBars({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(", ")} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 18, height: 190, padding: "8px 8px 0" }}>
      {items.map((i) => (
        <div key={i.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, maxWidth: 70 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--slate)" }}>{i.value}</span>
          <div style={{ width: 34, height: Math.max(26, 140 * (i.value / max)), borderRadius: 18, background: `linear-gradient(180deg, ${i.color}, color-mix(in srgb, ${i.color} 70%, #1f4d1a))`, boxShadow: "inset 0 2px 0 rgba(255,255,255,.4), 0 6px 12px rgba(54,110,40,.2)" }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--clay)" }}>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut with a centre label. */
export function Donut({ segments, centre, sub }: { segments: Array<{ label: string; value: number; color: string }>; centre: ReactNode; sub: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(47,111,38,.12)" strokeWidth="16" />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * C;
          const el = <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 3)} ${C - Math.max(0, len - 3)}`} strokeDashoffset={-off} strokeLinecap="round" transform="rotate(-90 70 70)" />;
          off += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)">{centre}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="11" fill="var(--slate)">{sub}</text>
      </svg>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        {segments.map((s) => <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: s.color }} /><span>{s.label}</span><b style={{ marginInlineStart: "auto" }}>{s.value}</b></li>)}
      </ul>
    </div>
  );
}

/** Horizontal progress bar with a status colour. */
export function StatusBar({ pct, tone }: { pct: number; tone: "green" | "yellow" | "red" }) {
  const c = tone === "green" ? [GREEN_L, GREEN] : tone === "yellow" ? ["#ffe58a", SUN_D] : ["#f0a79c", RED];
  return <div style={{ height: 10, borderRadius: 6, background: "rgba(47,111,38,.12)", overflow: "hidden", minWidth: 90 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: `linear-gradient(90deg, ${c[0]}, ${c[1]})` }} /></div>;
}
