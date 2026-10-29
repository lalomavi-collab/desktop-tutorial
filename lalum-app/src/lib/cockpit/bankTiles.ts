// What the finance dashboard's tiles draw (BankDashboardTab): the range the trend tiles share, a bridge from one figure to
// another (the drawable salary), the 30 day forecast as one point a day, money per day of a month, the recurring list
// as a monthly load, and the last days of movement. Pure functions over bankDashboard's outputs; no new figure is
// computed here that the dashboard did not already show, only its shape. Checked by `npm run bank-dashboard-check`.
import { addDays, addMonths, monthOf } from "./bankDashboard.ts";
import type { Classified, Forecast, Recurring } from "./bankDashboard.ts";
import { r2 } from "./finance.ts";

// ---------- The range the trend tiles share ----------

export type Range = "6" | "12" | "all";
export const RANGES: Array<{ key: Range; label: string }> = [{ key: "6", label: "6 חודשים" }, { key: "12", label: "שנה" }, { key: "all", label: "הכל" }];

/** The last months of a list kept oldest first: six, twelve, or all of them. */
export function lastMonths<T extends { month: string }>(rows: T[], range: Range): T[] {
  return range === "all" ? rows : rows.slice(-Number(range));
}

/** The daily balance cut to the same range, counted back from its last day (at least two points stay, so a line can be drawn). */
export function balanceWindow<T extends { date: string }>(series: T[], range: Range): T[] {
  if (range === "all" || series.length <= 2) return series;
  const last = series[series.length - 1].date;
  const from = `${addMonths(monthOf(last), -Number(range))}-${last.slice(8)}`;
  const cut = series.filter((p) => p.date > from);
  return cut.length >= 2 ? cut : series.slice(-2);
}

// ---------- A bridge from one figure to another ----------

export interface BridgeRow { label: string; value: number; from: number; to: number; kind: "start" | "step" | "total"; note?: string }

/** A waterfall: the start figure, each signed step from where the last one ended, and the result from zero. A step of zero
 *  stays in the list (it says the item was looked at and is nothing), drawn as a tick. */
export function bridge(start: { label: string; value: number }, steps: Array<{ label: string; value: number; note?: string }>, total: { label: string }): BridgeRow[] {
  const rows: BridgeRow[] = [{ label: start.label, value: r2(start.value), from: 0, to: r2(start.value), kind: "start" }];
  let at = r2(start.value);
  for (const s of steps) {
    const to = r2(at + s.value);
    rows.push({ label: s.label, value: r2(s.value), from: at, to, kind: "step", note: s.note });
    at = to;
  }
  rows.push({ label: total.label, value: at, from: 0, to: at, kind: "total" });
  return rows;
}

/** The scale a bridge is drawn on: from the lowest to the highest point it reaches, zero always inside. */
export function bridgeScale(rows: BridgeRow[]): { lo: number; hi: number } {
  const pts = rows.flatMap((r) => [r.from, r.to]);
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts);
  return { lo, hi: hi === lo ? lo + 1 : hi };
}

// ---------- The next 30 days, one point a day ----------

/** The forecast's running balance at the end of every day from its start to its end: without any receipt, and with the
 *  expected ones. A day with no item keeps the day before; the first point is the starting balance. */
export function forecastDays(fc: Forecast): Array<{ date: string; balance: number; withReceipts: number }> {
  const out: Array<{ date: string; balance: number; withReceipts: number }> = [];
  let a = fc.start, b = fc.start, i = 0;
  for (let d = fc.startOn; d <= fc.end; d = addDays(d, 1)) {
    while (i < fc.timeline.length && fc.timeline[i].date <= d) { a = fc.timeline[i].balance; b = fc.timeline[i].withReceipts; i++; }
    out.push({ date: d, balance: a, withReceipts: b });
  }
  return out;
}

// ---------- Money per day ----------

const daysIn = (ym: string): number => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/** What came in, or went out of the business, on each day of one month (1 to the last day), as positive amounts. */
export function flowByDay(lines: Classified[], month: string, flow: "IN" | "OUT"): number[] {
  const days = Array.from({ length: daysIn(month) }, () => 0);
  for (const l of lines) if (monthOf(l.value_date) === month && l.cat.flow === flow) days[Number(l.value_date.slice(8)) - 1] += flow === "IN" ? l.amount : -l.amount;
  return days.map((v) => r2(v));
}

/** One of five steps of a single hue for a calendar heat map: 0 for a day with nothing, then 1 to 4 by quarter of the
 *  month's heaviest day, so the darkest cell is always that day. */
export function heatStep(v: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(v > 0) || !(max > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((v / max) * 4))) as 1 | 2 | 3 | 4;
}

/** In and out of the business for each of the last n days up to the given day, oldest first. Moves between the owner's
 *  accounts are left out, as everywhere on the dashboard; the owner's draws count as out, since they leave the account. */
export function recentDays(lines: Classified[], asOf: string, n = 14): Array<{ date: string; inflow: number; outflow: number }> {
  const from = addDays(asOf, -(n - 1));
  const out = Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), inflow: 0, outflow: 0 }));
  for (const l of lines) {
    if (l.value_date < from || l.value_date > asOf || l.cat.flow === "MOVE") continue;
    const row = out[Math.round((Date.parse(l.value_date) - Date.parse(from)) / 86400000)];
    if (l.amount > 0) row.inflow += l.amount; else row.outflow -= l.amount;
  }
  return out.map((r) => ({ ...r, inflow: r2(r.inflow), outflow: r2(r.outflow) }));
}

// ---------- Recurring as a monthly load ----------

export interface LoadRow { key: string; label: string; catLabel: string; amount: number; monthly: number; cadence: Recurring["cadence"]; next: string; last: string; changePct: number | null; stale: boolean }

/** The recurring list as what it costs, or brings, a month: a charge every two months counts half. Stopped series stay
 *  in the rows (last, marked) and out of the two totals, like the forecast leaves them out. Largest first. */
export function recurringLoad(rec: Recurring[]): { inflow: number; outflow: number; rows: LoadRow[] } {
  const rows = rec.map((r) => ({
    key: r.key, label: r.label, catLabel: r.cat.label, amount: r.amount, monthly: r2(r.cadence === "MONTHLY" ? r.amount : r.amount / 2),
    cadence: r.cadence, next: r.next, last: r.last, changePct: r.changePct, stale: r.stale,
  })).sort((a, b) => Number(a.stale) - Number(b.stale) || Math.abs(b.monthly) - Math.abs(a.monthly));
  const live = rows.filter((r) => !r.stale);
  return {
    inflow: r2(live.filter((r) => r.monthly > 0).reduce((s, r) => s + r.monthly, 0)),
    outflow: r2(-live.filter((r) => r.monthly < 0).reduce((s, r) => s + r.monthly, 0)),
    rows,
  };
}

// ---------- Parts of a whole ----------

/** Parts of one whole for a meter: negative parts count as zero, each with its rounded share; the shares of a whole of
 *  zero are all zero. */
export function shares<T extends { value: number }>(parts: T[]): Array<T & { pct: number }> {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return parts.map((p) => ({ ...p, pct: total > 0 ? Math.round((Math.max(0, p.value) / total) * 100) : 0 }));
}
