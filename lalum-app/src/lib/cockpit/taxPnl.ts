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
  mikdamot_income_tax_paid_ytd: 0, mikdamot_bituach_leumi_paid_ytd: 0, vat_paid_ytd: 0, keren_hishtalmut_deposited_ytd: 0, pension_deposited_ytd: 0,
};

/** Settings row as stored (one per firm and tax year), including the basis the firm reports on. */
export interface TaxSettingsRow extends TaxSettingsIn { firm_id: string; tax_year: number; reporting_basis: "CASH" | "ACCRUAL" }

/** The bimonthly VAT report that contains the end of the period: its dates, the due date (the 15th after it) and its figures. */
export interface VatPeriod { from: string; to: string; due: string; out: number; in: number; payable: number }
export interface PnlReport { pnl: Pnl; vatPeriod: VatPeriod | null; year: number; params: TaxParams | undefined; problems: string[]; final: boolean }

/** Whole months covered by a period, at least one. */
export const monthsIn = (p: Period): number => {
  const a = new Date(p.from), b = new Date(p.to);
  return Math.max(1, Math.round(((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) + 1));
};

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Bimonthly VAT: January and February, March and April, and so on. Due on the 15th of the month after the pair. */
export function vatPeriodOf(docs: FinDocument[], payments: FinPayment[], expenses: FinExpense[], archive: ArchiveDoc[], onOrBefore: string): VatPeriod {
  const y = Number(onOrBefore.slice(0, 4)), m = Number(onOrBefore.slice(5, 7));
  const first = Math.floor((m - 1) / 2) * 2 + 1, last = first + 1;
  const p = { from: `${y}-${pad2(first)}-01`, to: `${y}-${pad2(last)}-${pad2(new Date(y, last, 0).getDate())}` };
  const s = summarize(docs, payments, expenses, p, archive);
  const dueY = last === 12 ? y + 1 : y, dueM = last === 12 ? 1 : last + 1;
  return { ...p, due: `${dueY}-${pad2(dueM)}-15`, out: s.vatOut, in: s.vatIn, payable: s.vatPayable };
}

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
  // Expenses saved before the tax classification existed are still calculated, from their old category; say how many.
  const unclassified = expenses.filter((e) => e.spent_on >= period.from && e.spent_on <= period.to && !e.tax_category).length;
  const sum = summarize(docs, payments, expenses, period, archive);
  let pipelineNet = 0, pipelineVat = 0;
  for (const d of docs) if (isOpenProforma(d, docs)) { pipelineNet += d.subtotal; pipelineVat += d.vat_amount; }
  const inPeriod = expenses.filter((e) => e.spent_on >= period.from && e.spent_on <= period.to);
  if (!params) return { pnl: undefined as unknown as Pnl, vatPeriod: null, year, params, problems, final: false };
  const pnl = computePnl({
    settings, periodMonths: monthsIn(period),
    revenueNet: basis === "ACCRUAL" ? sum.revenueNet + pipelineNet : sum.revenueNet, vatOut: sum.vatOut,
    pipelineNet, pipelineVat, expenses: inPeriod,
  }, params);
  if (unclassified > 0) pnl.warnings.push(`${unclassified} הוצאות בתקופה לא סווגו למס, והן מחושבות לפי הקטגוריה הישנה (הוצאה רגילה 100%, רכב 45%)`);
  // Data quality: the same expense entered twice, and a margin so high that expenses are probably missing.
  const seen = new Map<string, number>();
  for (const e of inPeriod) { const k = `${e.spent_on}|${e.supplier}|${e.total}|${e.vat_amount}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  const dups = [...seen.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0);
  if (dups > 0) pnl.warnings.push(`${dups} הוצאות נראות ככפילות (אותו תאריך, ספק וסכום). בדקו לפני הסתמכות על הדוח`);
  if (pnl.accounting.revenue > 0 && pnl.accounting.margin > 90) pnl.warnings.push(`שולי הרווח ${pnl.accounting.margin}% חריגים, וכנראה חסרות הוצאות בתקופה`);
  const vp = vatPeriodOf(docs, payments, expenses, archive, period.to);
  return { pnl, vatPeriod: vp, year, params, problems, final: problems.length === 0 };
}
