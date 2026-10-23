// Checks the tax engine against a realistic Israeli month, and the parameter registry's staleness rules.
// Expected figures were computed separately (not by the engine) from the same fixture parameters.
// Run with: npm run tax-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAX_CATEGORY, computePnl, normalizeExpense, progressiveTax, selfEmployedBl } from "../src/lib/cockpit/taxEngine.ts";
import { TAX_PARAMS, paramsFor, paramsProblems, paramsStaleness } from "../src/lib/cockpit/taxParams.ts";
import { buildPnl, DEFAULT_TAX_SETTINGS } from "../src/lib/cockpit/taxPnl.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
// The fixture is its own set of figures, so these checks never depend on what the registry holds for a given year.
const P = { ...TAX_PARAMS[2026], status: "VERIFIED", verifiedAt: "2026-01-01", sources: ["a", "b"],
  hishtalmut: { rate: 0.045, incomeCeiling: 300000 }, pension: { deductionRate: 0.11, creditRate: 0.35, creditBaseRate: 0.05, incomeCeiling: 300000 } };
const ex = (total, vat, vatPct, cat, it) => ({ total, vat_amount: vat, vat_recoverable_pct: vatPct, category: cat, tax_category: null, income_tax_recognition_pct: it ?? null });
const month = (o = {}) => ({
  settings: { ...DEFAULT_TAX_SETTINGS }, periodMonths: 1, revenueNet: 50000, vatOut: 9000, pipelineNet: 0, pipelineVat: 0,
  expenses: [ex(11800, 1800, 100, "OFFICE"), ex(3540, 540, 66.67, "VEHICLE"), ex(1180, 180, 100, "OTHER", 80)], ...o,
});

t("expense normalization: unrecognized VAT joins the cost before the income tax rate", () => {
  const v = normalizeExpense(ex(3540, 540, 66.67, "VEHICLE"));
  assert.deepEqual([v.recognizedVat, v.unrecognizedVat, v.accounting, v.deductible, v.itPct], [360.02, 179.98, 3179.98, 1430.99, 45]);
  assert.equal(normalizeExpense(ex(100, 18, 0, "OTHER", 0)).deductible, 0);
});
t("an older vehicle row without a tax category falls back to 45 percent", () => {
  assert.equal(normalizeExpense(ex(118, 18, 100, "VEHICLE")).itPct, 45);
});
t("the sample month reconciles to the agora: accounting, add back, adjusted profit, VAT", () => {
  const r = computePnl(month(), P);
  assert.equal(r.accounting.expenses, 14179.98);
  assert.equal(r.accounting.profit, 35820.02);
  assert.equal(r.reconciliation.addBack, 1948.99);
  assert.equal(r.reconciliation.adjustedProfit, 37769.01);
  assert.equal(r.accounting.revenue - 12230.99, r.reconciliation.adjustedProfit);
  assert.equal(r.vat.in, 2340.02);
  assert.equal(r.vat.payable, 6659.98);
});
t("the sample month: annualized brackets, 52 percent of National Insurance, credits, scaled back to the month", () => {
  const r = computePnl(month(), P);
  assert.equal(r.reconciliation.niDeduction, 2184.93);
  assert.equal(r.reconciliation.taxable, 35584.08);
  assert.equal(r.tax.grossIncomeTax, 8896.33);
  assert.equal(r.tax.creditPointsValue, 544.5);
  assert.equal(r.tax.netIncomeTax, 8351.83);
  assert.deepEqual([r.tax.bl.ni, r.tax.bl.health, r.tax.bl.total], [4201.79, 1803.22, 6005.01]);
  assert.equal(r.tax.total, 14356.84);
  assert.equal(r.net.afterTax, 21463.18);
  assert.equal(r.tax.effectiveRate, 40.08);
});
t("safe to spend: advances already paid are cash out and only the balance is reserved", () => {
  const r = computePnl(month({ settings: { ...DEFAULT_TAX_SETTINGS, mikdamot_income_tax_paid_ytd: 3000, mikdamot_bituach_leumi_paid_ytd: 2000 } }), P);
  assert.equal(r.vaults.incomeTaxBalance, 5351.83);
  assert.equal(r.vaults.blBalance, 4005.01);
  assert.equal(r.vaults.cashIn, 59000);
  assert.equal(r.vaults.cashOut, 16520 + 5000);
  // 59000 - 21520 - VAT 6659.98 - 5351.83 - 4005.01 = 21463.18, the same as profit after tax: nothing double counted.
  assert.equal(r.vaults.safeToSpend, 21463.18);
});
t("an advance larger than the liability is a refund and is never reserved", () => {
  const r = computePnl(month({ settings: { ...DEFAULT_TAX_SETTINGS, mikdamot_income_tax_paid_ytd: 20000 } }), P);
  assert.ok(r.vaults.incomeTaxBalance < 0);
  assert.equal(r.vaults.safeToSpend, r.vaults.cashIn - r.vaults.cashOut - r.vaults.vatVault - r.vaults.blBalance);
});
t("brackets and National Insurance on round annual figures", () => {
  assert.equal(progressiveTax(84120, P.brackets), 8412);
  assert.equal(progressiveTax(120720, P.brackets), 8412 + 5124);
  assert.equal(progressiveTax(600000, P.brackets), 172069.2);
  const low = selfEmployedBl(0, P);
  assert.equal(low.total, r2x((3442 * (0.0447 + 0.0323)) * 12));
});
t("a twelve month period needs no annualization and surtax applies above the threshold", () => {
  const r = computePnl({ ...month(), periodMonths: 12, revenueNet: 1000000, vatOut: 180000, expenses: [] }, P);
  assert.equal(r.reconciliation.taxable, r.reconciliation.adjustedProfit - r.reconciliation.niDeduction);
  assert.ok(r.tax.surtax > 0);
  assert.equal(r.tax.surtax, Math.round((r.reconciliation.taxable - 721560) * 3) / 100);
});
t("keren hishtalmut and pension reduce taxable income; a missing ceiling raises a warning instead of a guess", () => {
  const base = computePnl({ ...month(), periodMonths: 12, revenueNet: 400000, vatOut: 0, expenses: [] }, P);
  const withDep = computePnl({ ...month(), periodMonths: 12, revenueNet: 400000, vatOut: 0, expenses: [], settings: { ...DEFAULT_TAX_SETTINGS, keren_hishtalmut_deposited_ytd: 18000, pension_deposited_ytd: 20000 } }, P);
  assert.equal(withDep.reconciliation.hishtalmutDeduction, 13500); // capped: 4.5 percent of the 300000 ceiling
  assert.equal(withDep.reconciliation.pensionDeduction, 20000);
  assert.ok(withDep.reconciliation.taxable < base.reconciliation.taxable);
  const noCeiling = computePnl({ ...month(), periodMonths: 12, expenses: [], settings: { ...DEFAULT_TAX_SETTINGS, keren_hishtalmut_deposited_ytd: 1000 } }, { ...P, hishtalmut: { rate: 0.045, incomeCeiling: null } });
  assert.equal(noCeiling.reconciliation.hishtalmutDeduction, 0);
  assert.ok(noCeiling.warnings.length === 1);
});
t("a company pays corporate tax on the adjusted profit and no National Insurance; an exempt dealer recovers no VAT", () => {
  const c = computePnl(month({ settings: { ...DEFAULT_TAX_SETTINGS, entity_type: "LTD_COMPANY" } }), P);
  assert.equal(c.tax.corporateTax, Math.round(37769.01 * 23) / 100);
  assert.equal(c.tax.bl.total, 0);
  assert.equal(c.net.afterDividend, Math.round((35820.02 - c.tax.total) * 75) / 100);
  const e = computePnl(month({ settings: { ...DEFAULT_TAX_SETTINGS, entity_type: "OSEK_PATUR" }, vatOut: 0 }), P);
  assert.equal(e.vat.in, 0);
  assert.equal(e.accounting.expenses, 11800 + 3540 + 1180);
});
t("a loss produces no negative tax, and the effective rate is zero", () => {
  const r = computePnl(month({ revenueNet: 1000 }), P);
  assert.equal(r.tax.netIncomeTax, 0);
  assert.equal(r.tax.effectiveRate, 0);
});
t("the registry: the shipped year is a draft, so no figure is final; a verified year needs date and two sources", () => {
  assert.ok(paramsProblems(TAX_PARAMS[2026], 2026).length > 0);
  assert.deepEqual(paramsProblems(P, 2026), []);
  assert.ok(paramsProblems({ ...P, sources: ["a"] }, 2026).length > 0);
  assert.ok(paramsProblems(undefined, 2031)[0].includes("2031"));
  assert.equal(paramsFor(2026, [{ ...P, creditPointAnnual: 1 }]).creditPointAnnual, 1);
});
t("staleness: a missing or draft current year, and the next year from November", () => {
  assert.ok(paramsStaleness("2026-10-23").some((m) => m.includes("טיוטה")));
  assert.ok(paramsStaleness("2026-11-02", { 2026: P }).some((m) => m.includes("2027")));
  assert.deepEqual(paramsStaleness("2026-06-01", { 2026: P }), []);
  assert.ok(paramsStaleness("2030-01-01").length > 0);
});
t("buildPnl refuses to call a draft year final, and rejects a period that crosses a tax year", () => {
  const r = buildPnl([], [], [], [], { from: "2026-10-01", to: "2026-10-31" }, DEFAULT_TAX_SETTINGS);
  assert.equal(r.final, false);
  const x = buildPnl([], [], [], [], { from: "2026-10-01", to: "2027-01-31" }, DEFAULT_TAX_SETTINGS);
  assert.ok(x.problems.some((m) => m.includes("חוצה")));
});
t("the edge function's rate table equals the engine's", () => {
  const src = readFileSync(new URL("../../supabase/functions/lalum-fin-tax-advisor/index.ts", import.meta.url), "utf8");
  for (const [k, v] of Object.entries(TAX_CATEGORY)) {
    const m = src.match(new RegExp(`${k}: \\{ vatPct: ([\\d.]+), itPct: ([\\d.]+), review: (true|false) \\}`));
    assert.ok(m, `missing ${k}`);
    assert.deepEqual([Number(m[1]), Number(m[2]), m[3] === "true"], [v.vatPct, v.itPct, v.review], k);
  }
  assert.ok(!/[\u2013\u2014]/.test(src), "no dashes as punctuation");
});
function r2x(n) { return Math.round(n * 100) / 100; }
