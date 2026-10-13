// Partner and matter views built ON the existing finance ledger (finance.ts), so there is one set of money rules.
// Invoice4U is the source of truth for invoices, receipts and credits: AR aging, collections and the inflow side of the
// forecast are computed from FinDocument / FinPayment rows, exactly the rows the ledger and the Invoice4U mirror produce.
// Everything Invoice4U cannot know (bank balance, trust money, payroll and rent, hours) is a separate, labelled input.
import { openBalance } from "./finance.ts";
import type { FinDocument, FinPayment } from "./finance.ts";

export const DAY = 86400000;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Local-date parse, so a YYYY-MM-DD never shifts a day with the time zone. */
export const parseDay = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

// ---------- Receivables (from the Invoice4U-backed ledger) ----------

export interface OpenInvoice { doc: FinDocument; open: number; dueOn: string; overdueDays: number }
export interface Aging { current: number; d1_30: number; d31_60: number; d60plus: number; total: number; invoices: OpenInvoice[] }

/** Due date: the document's own, else issue date. Terms are not guessed here. */
export function openInvoices(docs: FinDocument[], pays: FinPayment[], today: Date): OpenInvoice[] {
  return docs
    .map((doc) => ({ doc, open: openBalance(doc, docs, pays) }))
    .filter((x) => x.open > 0)
    .map(({ doc, open }) => {
      const dueOn = doc.due_date ?? doc.issue_date;
      return { doc, open, dueOn, overdueDays: Math.max(0, daysBetween(parseDay(dueOn), today)) };
    });
}

export function arAging(docs: FinDocument[], pays: FinPayment[], today: Date): Aging {
  const invoices = openInvoices(docs, pays, today);
  const a: Aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0, total: 0, invoices };
  for (const i of invoices) {
    const k = i.overdueDays === 0 ? "current" : i.overdueDays <= 30 ? "d1_30" : i.overdueDays <= 60 ? "d31_60" : "d60plus";
    a[k] = r2(a[k] + i.open);
    a.total = r2(a.total + i.open);
  }
  return a;
}

/** Cash actually received in the window, from ledger payments (Invoice4U receipts included). */
export function collected(pays: FinPayment[], from: Date, to: Date): number {
  return r2(pays.filter((p) => p.paid_on >= iso(from) && p.paid_on <= iso(to)).reduce((s, p) => s + p.amount, 0));
}

/** Historical days sales outstanding: mean days from issue to payment over fully paid invoices. null when no history. */
export function historicalDso(docs: FinDocument[], pays: FinPayment[]): number | null {
  const gaps: number[] = [];
  for (const inv of docs) {
    if (inv.doc_type !== "INVOICE" || inv.status !== "ISSUED") continue;
    const mine = pays.filter((p) => p.document_id === inv.id);
    if (!mine.length || openBalance(inv, docs, pays) > 0) continue;
    const last = mine.map((p) => p.paid_on).sort().pop() as string;
    gaps.push(daysBetween(parseDay(inv.issue_date), parseDay(last)));
  }
  return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
}

// ---------- 13 week rolling forecast ----------

export interface Obligation { id: string; label: string; kind: "PAYROLL" | "RENT" | "TAX" | "SUPPLIER"; amount: number; every: "WEEK" | "MONTH"; /** day of month for MONTH */ day?: number }
export interface Week { friday: string; inflow: number; outflow: number; closing: number }
export interface Forecast { weeks: Week[]; opening: number; dso: number; minThreshold: number; firstBreach: number | null; lowest: number }

/** Friday on or after d. Weeks are labelled by their Friday, as the brief asks. */
export function fridayOnOrAfter(d: Date): Date { return addDays(d, (5 - d.getDay() + 7) % 7); }

export function forecast13(
  inputs: { docs: FinDocument[]; pays: FinPayment[]; obligations: Obligation[]; openingCash: number; minThreshold: number; fallbackDso: number },
  today: Date,
): Forecast {
  const dso = historicalDso(inputs.docs, inputs.pays) ?? inputs.fallbackDso;
  const first = fridayOnOrAfter(today);
  const weeks: Week[] = Array.from({ length: 13 }, (_, i) => ({ friday: iso(addDays(first, i * 7)), inflow: 0, outflow: 0, closing: 0 }));
  const bucket = (d: Date) => { const k = Math.max(0, Math.ceil(daysBetween(first, d) / 7)); return k < 13 ? k : -1; };

  // Inflow: each open invoice lands on its due date, or issue date plus historical DSO when it has no due date.
  // An invoice already past that date is assumed to land in the first week, which is the optimistic reading and is shown as such.
  for (const i of openInvoices(inputs.docs, inputs.pays, today)) {
    const expected = i.doc.due_date ? parseDay(i.doc.due_date) : addDays(parseDay(i.doc.issue_date), dso);
    const k = bucket(expected < today ? today : expected);
    if (k >= 0) weeks[k].inflow = r2(weeks[k].inflow + i.open);
  }
  for (const o of inputs.obligations) {
    for (let w = 0; w < 13; w++) {
      const fri = parseDay(weeks[w].friday), start = addDays(fri, -6);
      if (o.every === "WEEK") weeks[w].outflow = r2(weeks[w].outflow + o.amount);
      else for (let d = 0; d < 7; d++) if (addDays(start, d).getDate() === (o.day ?? 1)) weeks[w].outflow = r2(weeks[w].outflow + o.amount);
    }
  }
  let bal = inputs.openingCash, lowest = bal, firstBreach: number | null = null;
  weeks.forEach((w, i) => {
    bal = r2(bal + w.inflow - w.outflow); w.closing = bal; lowest = Math.min(lowest, bal);
    if (firstBreach == null && bal < inputs.minThreshold) firstBreach = i;
  });
  return { weeks, opening: inputs.openingCash, dso, minThreshold: inputs.minThreshold, firstBreach, lowest };
}

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
