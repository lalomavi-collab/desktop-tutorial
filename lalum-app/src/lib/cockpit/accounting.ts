// Accounting number formatting for the bookkeeping screens: a figure is split into its sign and its digits so the sign can be set
// in its own colour, the digits line up (tabular, two decimals, thousands separated) and the currency sign sits small beside them.
// Pure, so scripts/accounting-check.mjs can test it.

export interface Acct { neg: boolean; zero: boolean; text: string }

/** Absolute value with two decimals and thousands separators; neg is true only when the rounded figure is below zero (-0.004 is a zero). */
export function acct(n: number | null | undefined): Acct {
  const v = n == null || !Number.isFinite(n) ? 0 : n;
  const text = Math.abs(v).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rounded = Math.round(Math.abs(v) * 100);
  return { neg: v < 0 && rounded > 0, zero: rounded === 0, text };
}

/** The same figure as plain text with a real minus sign, for titles and screen readers. */
export function acctText(n: number | null | undefined, plus = false): string {
  const a = acct(n);
  return (a.neg ? "−" : plus && !a.zero ? "+" : "") + a.text;
}

/** A percent change with an explicit sign and a real minus sign: +14.9%, −28%, 0%. */
export function pctText(p: number): string {
  return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) + "%";
}
