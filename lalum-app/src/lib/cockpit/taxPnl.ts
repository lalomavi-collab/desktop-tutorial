// Bridge between the finance ledger and the tax engine: reads the same documents, payments and expenses the other
// reports read, so the profit and loss and the VAT card cannot disagree. Checked by `npm run tax-check`.
import { isOpenProforma, summarize } from "./finance.ts";
import type { ArchiveDoc, FinDocument, FinExpense, FinPayment, Period } from "./finance.ts";
import { computePnl } from "./taxEngine.ts";
import type { ExpenseIn, Pnl, TaxSettingsIn } from "./taxEngine.ts";
import { paramsFor, paramsProblems } from "./taxParams.ts";
import type { TaxParams } from "./taxParams.ts";

export const DEFAULT_TAX_SETTINGS: TaxSettingsIn = {
  entity_type: "OSEK_MURSHE", credit_points: 2.25,
  mikdamot_income_tax_paid_ytd: 0, mikdamot_bituach_leumi_paid_ytd: 0, keren_hishtalmut_deposited_ytd: 0, pension_deposited_ytd: 0,
};

/** Settings row as stored (one per firm and tax year), including the basis the firm reports on. */
export interface TaxSettingsRow extends TaxSettingsIn { firm_id: string; tax_year: number; reporting_basis: "CASH" | "ACCRUAL" }

export interface PnlReport { pnl: Pnl; year: number; params: TaxParams | undefined; problems: string[]; final: boolean }

/** Whole months covered by a period, at least one. */
export const monthsIn = (p: Period): number => {
  const a = new Date(p.from), b = new Date(p.to);
  return Math.max(1, Math.round(((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) + 1));
};

/**
 * Profit and loss before and after tax for a period inside one tax year.
 * Cash basis (the practice's setting): revenue is what the issued tax invoices and invoice-receipts carry, because
 * the practice issues them when the money arrives. Accrual adds the open pro formas as revenue; their VAT stays out
 * until a tax invoice is issued. `paramsDb` are rows of `lalum_tax_params`, which override the built in table.
 */
export function buildPnl(
  docs: FinDocument[], payments: FinPayment[], expenses: (FinExpense & Partial<ExpenseIn>)[], archive: ArchiveDoc[], period: Period,
  settings: TaxSettingsIn, basis: "CASH" | "ACCRUAL" = "CASH", paramsDb: TaxParams[] = [],
): PnlReport {
  const year = Number(period.from.slice(0, 4));
  const params = paramsFor(year, paramsDb);
  const problems = paramsProblems(params, year);
  if (period.to.slice(0, 4) !== String(year)) problems.push("התקופה חוצה שנת מס, יש לבחור תקופה בתוך שנה אחת");
  const sum = summarize(docs, payments, expenses, period, archive);
  let pipelineNet = 0, pipelineVat = 0;
  for (const d of docs) if (isOpenProforma(d, docs)) { pipelineNet += d.subtotal; pipelineVat += d.vat_amount; }
  const inPeriod = expenses.filter((e) => e.spent_on >= period.from && e.spent_on <= period.to);
  if (!params) return { pnl: undefined as unknown as Pnl, year, params, problems, final: false };
  const pnl = computePnl({
    settings, periodMonths: monthsIn(period),
    revenueNet: basis === "ACCRUAL" ? sum.revenueNet + pipelineNet : sum.revenueNet, vatOut: sum.vatOut,
    pipelineNet, pipelineVat, expenses: inPeriod,
  }, params);
  return { pnl, year, params, problems, final: problems.length === 0 };
}
