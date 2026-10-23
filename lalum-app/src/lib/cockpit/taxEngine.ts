// Deterministic Israeli tax engine for the practice's finance cockpit: expense normalization, VAT, a dual track
// profit and loss (accounting before tax, and tax adjusted), the tax liability and the "safe to spend" vaults.
// Pure functions, no network and no AI: the AI advisor only classifies expenses and explains these figures.
// Every statutory number comes from TaxParams. Amounts are in shekels; percentages are 0 to 100 on expenses
// (like `vat_recoverable_pct`) and 0 to 1 inside TaxParams. Checked by `npm run tax-check`.
import type { Bracket, TaxParams } from "./taxParams.ts";

export const r2 = (n: number): number => Math.round(Number(n.toFixed(6)) * 100) / 100;

// ---------- Expense normalization ----------

export type TaxCategory =
  | "OPERATIONAL_100" | "VEHICLE_MAINTENANCE" | "VEHICLE_EV_CHARGING" | "OFFICE_REFRESHMENTS" | "CLIENT_GIFTS"
  | "PROFESSIONAL_ATTIRE" | "HOME_OFFICE" | "LOCAL_HOSPITALITY_NON_DEDUCTIBLE" | "FINES_NON_DEDUCTIBLE" | "MIXED_CUSTOM";

export interface CategoryRule { label: string; vatPct: number; itPct: number; /** The default is a starting point that a person must confirm. */ review: boolean }

/** Suggested recognition per category. A suggestion only: the rate saved on each expense is what the engine uses. */
export const TAX_CATEGORY: Record<TaxCategory, CategoryRule> = {
  OPERATIONAL_100: { label: "הוצאה תפעולית מוכרת במלואה", vatPct: 100, itPct: 100, review: false },
  VEHICLE_MAINTENANCE: { label: "אחזקת רכב", vatPct: 66.67, itPct: 45, review: false },
  VEHICLE_EV_CHARGING: { label: "טעינת רכב חשמלי", vatPct: 66.67, itPct: 45, review: true },
  OFFICE_REFRESHMENTS: { label: "כיבוד קל במשרד", vatPct: 100, itPct: 80, review: true },
  CLIENT_GIFTS: { label: "מתנות ללקוחות (מוגבלות בתקרה)", vatPct: 0, itPct: 100, review: true },
  PROFESSIONAL_ATTIRE: { label: "ביגוד מקצועי", vatPct: 0, itPct: 80, review: true },
  HOME_OFFICE: { label: "משרד בבית", vatPct: 100, itPct: 100, review: true },
  LOCAL_HOSPITALITY_NON_DEDUCTIBLE: { label: "אירוח בארץ (לא מוכר)", vatPct: 0, itPct: 0, review: false },
  FINES_NON_DEDUCTIBLE: { label: "קנסות (לא מוכר)", vatPct: 0, itPct: 0, review: false },
  MIXED_CUSTOM: { label: "מעורב, שיעורים מותאמים", vatPct: 100, itPct: 100, review: true },
};

/** Category of the ledger's older expense form, mapped to the tax category it implies when none was chosen. */
const LEGACY: Record<string, TaxCategory> = { VEHICLE: "VEHICLE_MAINTENANCE" };
export const taxCategoryOf = (e: { tax_category?: string | null; category: string }): TaxCategory =>
  (e.tax_category && e.tax_category in TAX_CATEGORY ? e.tax_category : LEGACY[e.category] ?? "OPERATIONAL_100") as TaxCategory;

export interface ExpenseIn {
  total: number; vat_amount: number; vat_recoverable_pct: number; category: string;
  tax_category?: string | null; income_tax_recognition_pct?: number | null;
}
export interface ExpenseNorm {
  /** Cost for the accounting P&L: the total less the VAT that is recovered. */
  accounting: number; recognizedVat: number; unrecognizedVat: number;
  /** Cost recognized by Income Tax: the accounting cost (unrecognized VAT included) times the recognition rate. */
  deductible: number; itPct: number;
}

export function normalizeExpense(e: ExpenseIn): ExpenseNorm {
  const itPct = e.income_tax_recognition_pct ?? TAX_CATEGORY[taxCategoryOf(e)].itPct;
  const recognizedVat = r2((e.vat_amount * e.vat_recoverable_pct) / 100);
  const accounting = r2(e.total - recognizedVat);
  return { accounting, recognizedVat, unrecognizedVat: r2(e.vat_amount - recognizedVat), deductible: r2((accounting * itPct) / 100), itPct };
}

// ---------- Income tax and National Insurance ----------

export function progressiveTax(income: number, brackets: Bracket[]): number {
  let tax = 0, lower = 0;
  for (const b of brackets) {
    const top = b.upTo ?? Infinity;
    if (income > lower) tax += (Math.min(income, top) - lower) * b.rate;
    lower = top;
    if (income <= top) break;
  }
  return r2(tax);
}

/** Annual self-employed National Insurance and health tax on an annual income, from the monthly structure of the law. */
export function selfEmployedBl(annualIncome: number, p: TaxParams): { ni: number; health: number; total: number } {
  const monthly = Math.min(Math.max(annualIncome / 12, p.bl.minMonthly), p.bl.maxMonthly);
  const reduced = Math.min(monthly, p.bl.reducedCeiling), full = monthly - reduced;
  const ni = r2((reduced * p.bl.reducedNi + full * p.bl.fullNi) * 12);
  const health = r2((reduced * p.bl.reducedHealth + full * p.bl.fullHealth) * 12);
  return { ni, health, total: r2(ni + health) };
}

// ---------- The report ----------

export type EntityType = "OSEK_MURSHE" | "LTD_COMPANY" | "OSEK_PATUR";
export interface TaxSettingsIn {
  entity_type: EntityType; credit_points: number;
  mikdamot_income_tax_paid_ytd: number; mikdamot_bituach_leumi_paid_ytd: number;
  keren_hishtalmut_deposited_ytd: number; pension_deposited_ytd: number;
  /** Company only: which dividend rate the "after dividend" line assumes. */
  dividend_holder?: "regular" | "substantial";
}
export interface PnlInput {
  settings: TaxSettingsIn;
  /** Length of the period in months. Under twelve, the annual brackets are applied to the annualized income. */
  periodMonths: number;
  revenueNet: number; vatOut: number;
  pipelineNet: number; pipelineVat: number;
  expenses: ExpenseIn[];
}
export interface Pnl {
  vat: { out: number; in: number; payable: number; pipeline: number; pipelineNet: number };
  accounting: { revenue: number; expenses: number; profit: number; margin: number };
  reconciliation: { addBack: number; adjustedProfit: number; niDeduction: number; hishtalmutDeduction: number; pensionDeduction: number; taxable: number };
  tax: {
    grossIncomeTax: number; surtax: number; creditPointsValue: number; pensionCredit: number; netIncomeTax: number;
    bl: { ni: number; health: number; total: number }; corporateTax: number; total: number; effectiveRate: number;
  };
  net: { afterTax: number; afterDividend: number | null };
  vaults: {
    incomeTaxDue: number; incomeTaxPaid: number; incomeTaxBalance: number;
    blDue: number; blPaid: number; blBalance: number;
    vatVault: number; cashIn: number; cashOut: number; safeToSpend: number;
  };
  warnings: string[];
}

export function computePnl(inp: PnlInput, p: TaxParams): Pnl {
  const s = inp.settings, warnings: string[] = [];
  const f = Math.min(Math.max(inp.periodMonths, 1), 12) / 12;
  const patur = s.entity_type === "OSEK_PATUR";

  // VAT. An exempt dealer collects no VAT and recovers none, so all of it is cost.
  const norm = inp.expenses.map((e) => normalizeExpense(patur ? { ...e, vat_recoverable_pct: 0 } : e));
  const vatOut = patur ? 0 : inp.vatOut;
  const vatIn = r2(norm.reduce((a, n) => a + n.recognizedVat, 0));
  const vatPayable = r2(vatOut - vatIn);

  // Track A: accounting profit before tax.
  const accExpenses = r2(norm.reduce((a, n) => a + n.accounting, 0));
  const profit = r2(inp.revenueNet - accExpenses);
  const margin = inp.revenueNet > 0 ? r2((profit / inp.revenueNet) * 100) : 0;

  // Track B: tax adjusted. Disallowed expenses are added back before any shield.
  const deductible = r2(norm.reduce((a, n) => a + n.deductible, 0));
  const addBack = r2(accExpenses - deductible);
  const adjusted = r2(profit + addBack);

  let niDeduction = 0, hishtalmutDeduction = 0, pensionDeduction = 0, pensionCredit = 0;
  let bl = { ni: 0, health: 0, total: 0 };
  let grossIncomeTax = 0, surtax = 0, creditPointsValue = 0, netIncomeTax = 0, corporateTax = 0, taxable: number;

  if (s.entity_type === "LTD_COMPANY") {
    taxable = Math.max(0, adjusted);
    corporateTax = r2(taxable * p.corporateRate);
    netIncomeTax = corporateTax;
  } else {
    // Work on annual figures so that the annual brackets and ceilings mean what the law says, then scale back.
    const A = Math.max(0, adjusted) / f;
    bl = selfEmployedBl(A, p);
    niDeduction = r2(bl.ni * p.niDeductionRate);
    const hDep = s.keren_hishtalmut_deposited_ytd / f, pDep = s.pension_deposited_ytd / f;
    let hDed = 0, pDed = 0, pCred = 0;
    if (p.hishtalmut.incomeCeiling != null) hDed = Math.min(hDep, p.hishtalmut.rate * Math.min(A, p.hishtalmut.incomeCeiling));
    else if (hDep > 0) warnings.push("תקרת קרן ההשתלמות לא הוגדרה, ההפקדות לא נוכו");
    if (p.pension.incomeCeiling != null) {
      const base = Math.min(A, p.pension.incomeCeiling);
      pDed = Math.min(pDep, p.pension.deductionRate * base);
      pCred = Math.min(pDep - pDed, p.pension.creditBaseRate * base) * p.pension.creditRate;
    } else if (pDep > 0) warnings.push("תקרת הפנסיה לא הוגדרה, ההפקדות לא נוכו ולא זוכו");
    const T = Math.max(0, A - niDeduction - hDed - pDed);
    grossIncomeTax = progressiveTax(T, p.brackets);
    surtax = r2(Math.max(0, T - p.surtax.threshold) * p.surtax.rate);
    creditPointsValue = r2(s.credit_points * p.creditPointAnnual);
    pensionCredit = r2(pCred);
    const net = Math.max(0, grossIncomeTax - creditPointsValue - pensionCredit) + surtax;
    // Scale the annual liability back to the length of the period.
    const k = (n: number) => r2(n * f);
    taxable = k(T); grossIncomeTax = k(grossIncomeTax); surtax = k(surtax); creditPointsValue = k(creditPointsValue);
    pensionCredit = k(pensionCredit); netIncomeTax = k(net);
    bl = { ni: k(bl.ni), health: k(bl.health), total: k(bl.total) };
    niDeduction = k(niDeduction); hishtalmutDeduction = k(hDed); pensionDeduction = k(pDed);
  }

  const totalTax = r2(netIncomeTax + bl.total);
  const afterTax = r2(profit - totalTax);
  const effectiveRate = profit > 0 ? r2((totalTax / profit) * 100) : 0;
  const afterDividend = s.entity_type === "LTD_COMPANY"
    ? r2(Math.max(0, afterTax) * (1 - p.dividendRate[s.dividend_holder ?? "regular"])) : null;
  if (s.entity_type === "LTD_COMPANY") warnings.push("השורה אחרי דיבידנד אינה כוללת מס יסף על הדיבידנד");

  // Vaults. Taxes already paid as advances have left the bank, so they count as cash out, and only the balance is reserved.
  const incomeTaxBalance = r2(netIncomeTax - s.mikdamot_income_tax_paid_ytd);
  const blBalance = r2(bl.total - s.mikdamot_bituach_leumi_paid_ytd);
  const cashIn = r2(inp.revenueNet + vatOut);
  const cashOut = r2(inp.expenses.reduce((a, e) => a + e.total, 0) + s.mikdamot_income_tax_paid_ytd + s.mikdamot_bituach_leumi_paid_ytd);
  const vatVault = Math.max(0, vatPayable);
  const safeToSpend = r2(cashIn - cashOut - vatVault - Math.max(0, incomeTaxBalance) - Math.max(0, blBalance));

  return {
    vat: { out: vatOut, in: vatIn, payable: vatPayable, pipeline: inp.pipelineVat, pipelineNet: inp.pipelineNet },
    accounting: { revenue: inp.revenueNet, expenses: accExpenses, profit, margin },
    reconciliation: { addBack, adjustedProfit: adjusted, niDeduction, hishtalmutDeduction, pensionDeduction, taxable },
    tax: { grossIncomeTax, surtax, creditPointsValue, pensionCredit, netIncomeTax, bl, corporateTax, total: totalTax, effectiveRate },
    net: { afterTax, afterDividend },
    vaults: {
      incomeTaxDue: netIncomeTax, incomeTaxPaid: s.mikdamot_income_tax_paid_ytd, incomeTaxBalance,
      blDue: bl.total, blPaid: s.mikdamot_bituach_leumi_paid_ytd, blBalance,
      vatVault, cashIn, cashOut, safeToSpend,
    },
    warnings,
  };
}
