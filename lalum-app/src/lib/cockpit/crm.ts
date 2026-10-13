// Shared types and small helpers for the partner, matter and portal views. Receivables aging and the 13 week
// forecast are NOT computed here: they come from arAging.ts and cashFlow.ts (see crmFinanceCore.ts), the same
// engines the finance tabs use, so there is one set of money rules. What remains here is demo-era matter data
// helpers (hours, trust per matter, what a client may see).
import type { FinDocument } from "./finance.ts";

export const DAY = 86400000;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Local-date parse, so a YYYY-MM-DD never shifts a day with the time zone. */
export const parseDay = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

// ---------- Receivables ----------

export interface OpenInvoice { doc: FinDocument; open: number; dueOn: string; overdueDays: number }

// ---------- 13 week rolling forecast ----------

export interface Obligation { id: string; label: string; kind: "PAYROLL" | "RENT" | "TAX" | "SUPPLIER"; amount: number; every: "WEEK" | "MONTH"; /** day of month for MONTH */ day?: number }
export interface Week { friday: string; inflow: number; outflow: number; closing: number }
export interface Forecast { weeks: Week[]; opening: number; dso: number | null; minThreshold: number; firstBreach: number | null; lowest: number }

// ---------- Hours, WIP, trust ----------

export interface TimeEntry { id: string; matterId: string; on: string; hours: number; rate: number; action: string; billed: boolean }
export const wip = (entries: TimeEntry[]) => {
  const open = entries.filter((e) => !e.billed);
  return { hours: r2(open.reduce((s, e) => s + e.hours, 0)), amount: r2(open.reduce((s, e) => s + e.hours * e.rate, 0)) };
};

export interface TrustEntry { id: string; matterId: string; on: string; kind: "DEPOSIT" | "APPLY" | "REFUND"; amount: number; note: string }
/** Trust money is a liability to clients, never revenue. Balance per matter = deposits minus applied and refunded. */
export function trustBalance(entries: TrustEntry[], matterId?: string): number {
  return r2(entries.filter((e) => !matterId || e.matterId === matterId).reduce((s, e) => s + (e.kind === "DEPOSIT" ? e.amount : -e.amount), 0));
}

// ---------- Client view: what a client may see ----------
// In production this filtering happens in the database (view or RPC that never selects internal rows or columns), so a
// client token cannot read them from the network. This function is the same rule for the demo and is pinned by crm-check.
export function clientMilestones<T extends { clientVisible: boolean; kind: string }>(ms: T[]): T[] {
  return ms.filter((m) => m.clientVisible && m.kind !== "INTERNAL");
}
export function clientMessages<T extends { internal: boolean }>(msgs: T[]): Array<Omit<T, "internal">> {
  return msgs.filter((m) => !m.internal).map((m) => { const { internal: _drop, ...rest } = m; void _drop; return rest; });
}

export type TrustSummary = { state: "loading" } | { state: "none" } | { state: "ready"; held: number };

/** Pure: no account means no trust activity; otherwise the signed sum of the append-only ledger. */
export function summarizeTrust(accountCount: number, amounts: number[]): TrustSummary {
  if (accountCount <= 0) return { state: "none" };
  const held = Math.round(amounts.reduce((a, n) => a + n, 0) * 100) / 100;
  return { state: "ready", held };
}
