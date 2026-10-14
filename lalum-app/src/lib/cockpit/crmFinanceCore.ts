// Partner view figures from the firm's real ledger, using the same engines as the finance tabs
// (arAging.ts for receivables, cashFlow.ts for the 13 week forecast) so the two screens cannot disagree.
// Pure: no network, covered by crm-check.
import { BUCKETS, agingReport, computeDso } from "./arAging.ts";
import type { AgingReport, Bucket } from "./arAging.ts";
import { buildForecast, manualToItems, planInflows } from "./cashFlow.ts";
import type { CashSettings, ManualRow } from "./cashFlow.ts";
import type { Forecast, OpenInvoice } from "./crm.ts";
import type { FinCustomer, FinDocument, FinPayment } from "./finance.ts";

export interface SettingsRow { opening_balance: number; balance_as_of: string | null; credit_facility: number; safety_reserve: number }

export interface PartnerFinance {
  aging: AgingReport;
  /** Receivables more than a day past due, for the exception queue. */
  overdue: OpenInvoice[];
  /** The forecast reshaped for the existing chart component. */
  forecast: Forecast;
  /** Average monthly outflow implied by the manual plan over the 13 weeks. */
  monthlyBurn: number;
  collected30: number;
  /** null when no opening balance was ever entered. */
  bankBalance: number | null;
  balanceAsOf: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function partnerFinance(customers: FinCustomer[], docs: FinDocument[], pays: FinPayment[], settings: SettingsRow | null, rows: ManualRow[], today: string): PartnerFinance {
  const cfg: CashSettings = { openingBalance: settings?.opening_balance ?? 0, creditFacility: settings?.credit_facility ?? 0, safetyReserve: settings?.safety_reserve ?? 50000 };
  const aging = agingReport(customers, docs, pays, today);
  const plan = planInflows(customers, docs, pays, today);
  const f = buildForecast(plan.inflows, manualToItems(rows), cfg, today);
  const dso = computeDso(docs, pays, today).days;
  const forecast: Forecast = {
    weeks: f.weeks.map((w) => ({ friday: w.weekEnding, inflow: r2(w.invoiceInflows + w.otherInflows), outflow: w.outflows, closing: w.endingCash })),
    opening: cfg.openingBalance, dso, minThreshold: cfg.safetyReserve,
    firstBreach: f.weeks.findIndex((w) => w.belowReserve) >= 0 ? f.weeks.findIndex((w) => w.belowReserve) : null,
    lowest: f.minEnding,
  };
  const byId = new Map(docs.map((d) => [d.id, d]));
  const overdue: OpenInvoice[] = [];
  for (const c of aging.customers) for (const r of c.rows) {
    const doc = byId.get(r.documentId);
    if (doc && r.daysPastDue > 0) overdue.push({ doc, open: r.balance, dueOn: r.dueDate, overdueDays: r.daysPastDue });
  }
  const from = new Date(Date.parse(today) - 30 * 86400000).toISOString().slice(0, 10);
  return {
    aging, overdue, forecast,
    monthlyBurn: r2((f.weeks.reduce((s, w) => s + w.outflows, 0) / 13) * 4.345),
    collected30: r2(pays.filter((p) => p.paid_on >= from && p.paid_on <= today).reduce((s, p) => s + p.amount, 0)),
    bankBalance: settings ? settings.opening_balance : null,
    balanceAsOf: settings?.balance_as_of ?? null,
  };
}

export type { Bucket };
export { BUCKETS };
