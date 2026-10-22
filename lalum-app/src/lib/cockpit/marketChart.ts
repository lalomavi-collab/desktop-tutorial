// Pure geometry for the cockpit's market style charts: a smooth curve that never overshoots its data, round axis ticks,
// and a moving average. No React and no DOM, so scripts/market-chart-check.mjs can test it.

export type Pt = [number, number];

/** Monotone cubic path (Fritsch and Carlson) through the points. Between two points the curve never leaves the band of
 *  their two values, so a smoothed count cannot invent a peak or dip that is not in the data. */
export function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => +v.toFixed(2);
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const dx: number[] = [], dy: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); }
  const sec = dx.map((d, i) => (d === 0 ? 0 : dy[i] / d));
  m[0] = sec[0]; m[n - 1] = sec[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = sec[i - 1] * sec[i] <= 0 ? 0 : (sec[i - 1] + sec[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (sec[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / sec[i], b = m[i + 1] / sec[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * sec[i]; m[i + 1] = t * b * sec[i]; }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += ` C${f(pts[i][0] + h / 3)} ${f(pts[i][1] + (m[i] * h) / 3)} ${f(pts[i + 1][0] - h / 3)} ${f(pts[i + 1][1] - (m[i + 1] * h) / 3)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}

/** Closes a curve down to the baseline so it can be filled. */
export function areaPath(curve: string, pts: Pt[], baseY: number): string {
  if (pts.length < 2) return "";
  const f = (v: number) => +v.toFixed(2);
  return `${curve} L${f(pts[pts.length - 1][0])} ${f(baseY)} L${f(pts[0][0])} ${f(baseY)} Z`;
}

/** Simple moving average over `win` values; the first win-1 entries average what exists so far. */
export function movingAverage(values: number[], win: number): number[] {
  return values.map((_, i) => { const from = Math.max(0, i - win + 1); const part = values.slice(from, i + 1); return part.reduce((a, v) => a + v, 0) / part.length; });
}

/** Round axis ticks from lo to hi (about `count` of them), on 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count, pow = 10 ** Math.floor(Math.log10(raw)), r = raw / pow;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/** Index of the point nearest to an x position (points are evenly spaced from x0 by `step`). */
export function nearestIndex(x: number, x0: number, step: number, n: number): number {
  if (n <= 1 || step <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.round((x - x0) / step)));
}

/** Short figure for an axis: 76,620 -> 76.6K, 1,250,000 -> 1.25M. */
export function shortNumber(v: number): string {
  const a = Math.abs(v);
  const t = (x: number) => String(+x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2));
  if (a >= 1e6) return (v < 0 ? "-" : "") + t(a / 1e6) + "M";
  if (a >= 1e3) return (v < 0 ? "-" : "") + t(a / 1e3) + "K";
  return String(Math.round(v));
}

/** Running total per bucket: `older` items counted before the first bucket, then each bucket's additions. */
export function runningTotal(added: number[], older: number): number[] {
  let run = older;
  return added.map((v) => (run += v));
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, v) => a + v, 0) / values.length : 0;
}

/** Least squares straight line through (0, v0), (1, v1), ...: value at i is intercept + slope * i. */
export function linearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };
  const mx = (n - 1) / 2, my = mean(values);
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2; });
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}
