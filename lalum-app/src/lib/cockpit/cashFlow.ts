// 13 week direct cash forecast with what-if scenarios. Pure functions, no I/O, inputs are never mutated.
// Verified by: npm run cashflow-check
//
// Direct method: only cash movements, never accruals. Weeks end on Friday. Week 1 runs from today to the first Friday
// on or after today, so it can be shorter than seven days.
//
// What counts as an inflow: the open balance of issued, non test INVOICE documents (via agingReport), placed in the
// week of its EXPECTED payment date, issue date plus the customer's historical DSO, not the contractual due date.
// Pro formas, drafts and test documents are never inflows. Client trust money is not in this ledger at all.
//
// Assumptions the screen shows to the partner, each a parameter below and not a hidden constant:
//  * Customer DSO is used when it rests on at least DSO_MIN_SAMPLE settled invoices, else the firm DSO on the same
//    rule, else the invoice's own payment term (due date minus issue date).
//  * An invoice whose expected date has already passed is moved to today plus LATE_PUSH_DAYS, never into the past.
//  * An invoice more than EXCLUDE_AFTER_DAYS past due is left out of the forecast and reported separately.
import { r2 } from "./finance.ts";
import type { FinCustomer, FinDocument, FinPayment } from "./finance.ts";
import { addDays, agingReport, computeDso, daysBetween, DSO_MIN_SAMPLE, dueDateOf } from "./arAging.ts";

export const HORIZON_WEEKS = 13;
export const LATE_PUSH_DAYS = 7;
export const EXCLUDE_AFTER_DAYS = 90;

export interface CashSettings { openingBalance: number; creditFacility: number; safetyReserve: number }
export interface CashItem {
  id: string; label: string; direction: "IN" | "OUT"; schedule: "MONTHLY" | "ONCE";
  day_of_month: number | null; on_date: string | null; amount: number; active: boolean;
}
export type InflowBasis = "CUSTOMER_DSO" | "FIRM_DSO" | "TERMS";
export interface Inflow {
  documentId: string; customerId: string; customerName: string; balance: number; expectedOn: string; basis: InflowBasis;
}
export interface Excluded { documentId: string; customerName: string; balance: number; daysPastDue: number }

export interface Week {
  number: number; start: string; weekEnding: string;
  invoiceInflows: number; otherInflows: number; outflows: number; net: number;
  startingCash: number; endingCash: number; liquidity: number; belowReserve: boolean;
}
export interface Forecast {
  weeks: Week[]; inflows: Inflow[];
  /** Expected after the last Friday of the horizon. */
  beyondHorizon: number;
  minEnding: number; minWeek: number; weeksBelowReserve: number; finalEnding: number;
}
export interface Plan { inflows: Inflow[]; excluded: Excluded[]; excludedTotal: number }

// ---- calendar ----

const dow = (iso: string): number => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** The Friday on or after the date. A Friday returns itself. */
export const fridayOnOrAfter = (iso: string): string => addDays(iso, (5 - dow(iso) + 7) % 7);
export function weekEndings(today: string, n = HORIZON_WEEKS): string[] {
  const first = fridayOnOrAfter(today);
  return Array.from({ length: n }, (_, i) => addDays(first, i * 7));
}
const lastDayOfMonth = (y: number, m1: number): number => new Date(Date.UTC(y, m1, 0)).getUTCDate();

/** Dates in [from, to] on which a cash item happens. A monthly day beyond the month's end falls on its last day. */
export function itemDates(it: CashItem, from: string, to: string): string[] {
  if (!it.active) return [];
  if (it.schedule === "ONCE") return it.on_date && it.on_date >= from && it.on_date <= to ? [it.on_date] : [];
  if (!it.day_of_month) return [];
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const day = Math.min(it.day_of_month, lastDayOfMonth(y, m));
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= from && iso <= to) out.push(iso);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// ---- inflow plan ----

export interface PlanOptions { latePushDays?: number; excludeAfterDays?: number; minSample?: number }

/** Expected payment date per open invoice, from DSO behaviour and not from the contractual due date. */
export function planInflows(customers: FinCustomer[], docs: FinDocument[], pays: FinPayment[], today: string, opt: PlanOptions = {}): Plan {
  const push = opt.latePushDays ?? LATE_PUSH_DAYS, cutoff = opt.excludeAfterDays ?? EXCLUDE_AFTER_DAYS, minSample = opt.minSample ?? DSO_MIN_SAMPLE;
  const aging = agingReport(customers, docs, pays, today);
  const firm = computeDso(docs, pays, today);
  const invoiceById = new Map(docs.map((d) => [d.id, d]));
  const inflows: Inflow[] = [], excluded: Excluded[] = [];
  for (const c of aging.customers) {
    const own = computeDso(docs, pays, today, c.customerId);
    for (const row of c.rows) {
      if (row.daysPastDue > cutoff) { excluded.push({ documentId: row.documentId, customerName: c.name, balance: row.balance, daysPastDue: row.daysPastDue }); continue; }
      const inv = invoiceById.get(row.documentId)!;
      let lag: number, basis: InflowBasis;
      if (own.days !== null && own.sample >= minSample) { lag = own.days; basis = "CUSTOMER_DSO"; }
      else if (firm.days !== null && firm.sample >= minSample) { lag = firm.days; basis = "FIRM_DSO"; }
      else { lag = Math.max(0, daysBetween(inv.issue_date, dueDateOf(inv))); basis = "TERMS"; }
      let expectedOn = addDays(inv.issue_date, lag);
      if (expectedOn < today) expectedOn = addDays(today, push);
      inflows.push({ documentId: row.documentId, customerId: c.customerId, customerName: c.name, balance: row.balance, expectedOn, basis });
    }
  }
  inflows.sort((a, b) => (a.expectedOn < b.expectedOn ? -1 : a.expectedOn > b.expectedOn ? 1 : b.balance - a.balance));
  return { inflows, excluded, excludedTotal: r2(excluded.reduce((a, e) => a + e.balance, 0)) };
}

// ---- scenarios ----

export type Scenario =
  | { kind: "BASE" }
  | { kind: "DELAY_TOP_CLIENTS"; clients: number; days: number }
  | { kind: "FIRM_DSO_SHOCK"; days: number }
  | { kind: "WINDFALL"; amount: number; weekNumber: number };

export const SCENARIO_LABEL: Record<Scenario["kind"], string> = {
  BASE: "תרחיש בסיס", DELAY_TOP_CLIENTS: "עיכוב לקוחות גדולים", FIRM_DSO_SHOCK: "הארכת זמן גבייה כללית", WINDFALL: "תקבול חריג",
};

/** Returns new inflows and extra one-off cash. The input list and its objects are left untouched. */
export function applyScenario(inflows: Inflow[], s: Scenario, today: string): { inflows: Inflow[]; extra: Array<{ on: string; amount: number }> } {
  const copy = inflows.map((i) => ({ ...i }));
  if (s.kind === "DELAY_TOP_CLIENTS") {
    const exposure = new Map<string, number>();
    for (const i of copy) exposure.set(i.customerId, (exposure.get(i.customerId) ?? 0) + i.balance);
    const top = new Set([...exposure.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, s.clients)).map(([id]) => id));
    for (const i of copy) if (top.has(i.customerId)) i.expectedOn = addDays(i.expectedOn, s.days);
    return { inflows: copy, extra: [] };
  }
  if (s.kind === "FIRM_DSO_SHOCK") {
    for (const i of copy) i.expectedOn = addDays(i.expectedOn, s.days);
    return { inflows: copy, extra: [] };
  }
  if (s.kind === "WINDFALL") {
    const wk = weekEndings(today)[Math.min(HORIZON_WEEKS, Math.max(1, s.weekNumber)) - 1];
    return { inflows: copy, extra: [{ on: wk, amount: s.amount }] };
  }
  return { inflows: copy, extra: [] };
}

// ---- the matrix ----

export function buildForecast(inflows: Inflow[], items: CashItem[], settings: CashSettings, today: string, extra: Array<{ on: string; amount: number }> = []): Forecast {
  const ends = weekEndings(today);
  const horizonEnd = ends[ends.length - 1];
  const idxOf = (iso: string): number => (iso < today || iso > horizonEnd ? -1 : ends.indexOf(fridayOnOrAfter(iso)));
  const inv = ends.map(() => 0), oth = ends.map(() => 0), out = ends.map(() => 0);
  let beyondHorizon = 0;
  for (const i of inflows) {
    if (i.expectedOn > horizonEnd) { beyondHorizon = r2(beyondHorizon + i.balance); continue; }
    inv[idxOf(i.expectedOn < today ? today : i.expectedOn)] += i.balance;
  }
  for (const e of extra) { const k = idxOf(e.on); if (k >= 0) oth[k] += e.amount; }
  for (const it of items) for (const d of itemDates(it, today, horizonEnd)) { const k = idxOf(d); if (k < 0) continue; if (it.direction === "IN") oth[k] += it.amount; else out[k] += it.amount; }
  let cash = settings.openingBalance, minEnding = Infinity, minWeek = 1, below = 0;
  const weeks: Week[] = ends.map((weekEnding, k) => {
    const net = r2(inv[k] + oth[k] - out[k]);
    const startingCash = r2(cash);
    cash = r2(cash + net);
    const belowReserve = cash < settings.safetyReserve;
    if (belowReserve) below += 1;
    if (cash < minEnding) { minEnding = cash; minWeek = k + 1; }
    return {
      number: k + 1, start: k === 0 ? today : addDays(ends[k - 1], 1), weekEnding,
      invoiceInflows: r2(inv[k]), otherInflows: r2(oth[k]), outflows: r2(out[k]), net,
      startingCash, endingCash: cash, liquidity: r2(cash + settings.creditFacility), belowReserve,
    };
  });
  return { weeks, inflows, beyondHorizon, minEnding, minWeek, weeksBelowReserve: below, finalEnding: weeks[weeks.length - 1].endingCash };
}

export interface Comparison { minEndingDelta: number; finalEndingDelta: number; extraWeeksBelowReserve: number }
export const compareToBase = (base: Forecast, sim: Forecast): Comparison => ({
  minEndingDelta: r2(sim.minEnding - base.minEnding), finalEndingDelta: r2(sim.finalEnding - base.finalEnding),
  extraWeeksBelowReserve: sim.weeksBelowReserve - base.weeksBelowReserve,
});
