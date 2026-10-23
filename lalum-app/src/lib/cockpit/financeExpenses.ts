// Expenses over time: per day, week, month or year, and the split by category for the same range.
// Pure functions, checked by `npm run finance-check`. Amounts are in shekels.
import type { FinExpense } from "./finance.ts";

export type ExpGrain = "day" | "week" | "month" | "year";
export type ExpBasis = "net" | "total";
export interface ExpBucket { key: string; label: string; from: string; to: string; amount: number; count: number; future: boolean }
export interface ExpSeries {
  grain: ExpGrain; buckets: ExpBucket[]; amount: number; count: number;
  /** Mean of the periods that have ended, from the first period with an expense. The running period never enters it. */
  average: number; averageOver: number; hasRunning: boolean; top: ExpBucket | null;
  lastVsPrevious: { last: ExpBucket; previous: ExpBucket; pct: number | null; delta: number } | null;
  categories: Array<{ category: string; amount: number; share: number }>;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const toDate = (d: string): Date => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number): string => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); };
const weekStart = (d: string): string => addDays(d, -toDate(d).getUTCDay());
const dm = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const MONTH_SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/** What one expense counts for: before VAT by default (the cost to the business), or the full amount paid. */
export const expenseAmount = (e: FinExpense, basis: ExpBasis): number => (basis === "net" ? e.total - e.vat_amount : e.total);

/** The last 30 days, the last 12 weeks (Sunday start), the 12 months of `year`, or the last 5 years. A bucket after today is `future`. */
export function expenseBuckets(rows: FinExpense[], grain: ExpGrain, year: number, today: string, basis: ExpBasis = "net"): ExpSeries {
  const defs: Array<{ key: string; label: string; from: string; to: string }> = [];
  if (grain === "day") {
    for (let i = 29; i >= 0; i--) { const d = addDays(today, -i); defs.push({ key: d, label: d.slice(8, 10), from: d, to: d }); }
  } else if (grain === "week") {
    const cur = weekStart(today);
    for (let i = 11; i >= 0; i--) { const from = addDays(cur, -7 * i); defs.push({ key: from, label: dm(from), from, to: addDays(from, 6) }); }
  } else if (grain === "month") {
    for (let m = 1; m <= 12; m++) {
      const from = `${year}-${String(m).padStart(2, "0")}-01`;
      defs.push({ key: from.slice(0, 7), label: MONTH_SHORT[m - 1], from, to: fmt(new Date(Date.UTC(year, m, 0))) });
    }
  } else {
    const ty = Number(today.slice(0, 4));
    for (let y = ty - 4; y <= ty; y++) defs.push({ key: String(y), label: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
  }
  const buckets: ExpBucket[] = defs.map((d) => {
    const rs = rows.filter((e) => e.spent_on >= d.from && e.spent_on <= d.to);
    return { ...d, amount: r2(rs.reduce((a, e) => a + expenseAmount(e, basis), 0)), count: rs.length, future: d.from > today };
  });
  const live = buckets.filter((b) => !b.future);
  const done = live.filter((b) => b.to < today);
  const withData = live.filter((b) => b.count > 0);
  const first = done.findIndex((b) => b.count > 0);
  const avg = first >= 0 ? done.slice(first) : [];
  const last = done[done.length - 1], prev = done[done.length - 2];
  const from = live[0]?.from ?? today, to = live[live.length - 1]?.to ?? today;
  const byCat = new Map<string, number>();
  for (const e of rows) if (e.spent_on >= from && e.spent_on <= to) byCat.set(e.category, (byCat.get(e.category) ?? 0) + expenseAmount(e, basis));
  const amount = r2(live.reduce((a, b) => a + b.amount, 0));
  return {
    grain, buckets, amount, count: live.reduce((a, b) => a + b.count, 0),
    average: avg.length ? r2(avg.reduce((a, b) => a + b.amount, 0) / avg.length) : 0, averageOver: avg.length,
    hasRunning: live.some((b) => b.to >= today),
    top: withData.length ? withData.reduce((a, b) => (b.amount > a.amount ? b : a)) : null,
    lastVsPrevious: last && prev ? { last, previous: prev, pct: prev.amount !== 0 ? Math.round(((last.amount - prev.amount) / Math.abs(prev.amount)) * 1000) / 10 : null, delta: r2(last.amount - prev.amount) } : null,
    categories: [...byCat.entries()].map(([category, a]) => ({ category, amount: r2(a), share: amount ? Math.round((a / amount) * 1000) / 10 : 0 })).filter((c) => c.amount !== 0).sort((a, b) => b.amount - a.amount),
  };
}
