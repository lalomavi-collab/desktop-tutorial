// Automatic intake of uploaded expense invoices (the "העלאת חשבוניות" button in ExpensesTab). Pure rules, checked by
// `npm run expense-intake-check`. Each file is read into a draft by lalum-fin-receipt-scan and then, with no row picked by hand:
//   attached to the expense it belongs to: the same supplier invoice number, or else the same amount from the same supplier
//   within a week. A corrected or newer copy of an invoice that is already attached replaces it; the earlier file is kept;
//   or booked as a new expense when nothing in the books fits and every figure was read clearly. It is classified like the
//   same supplier's last expense, else as fully business (Avi, 30.10.2026: everything with an invoice that is a recognised
//   expense goes in as business);
//   or left for review, with the reason, when the reading is unsure, the amounts do not add up, the currency is not shekels,
//   or more than one expense fits. A person then picks the row or fills the form.
import type { FinExpense, FinExpenseDoc } from "./finance.ts";

export interface IntakeDraft {
  spent_on: string | null; supplier: string | null; category: string | null; description: string | null;
  total: number | null; vat_amount: number | null; supplier_doc_ref: string | null; currency?: string | null;
}
export interface NewExpense {
  spent_on: string; supplier: string; category: string; description: string; total: number; vat_amount: number;
  vat_recoverable_pct: number; tax_category: string; income_tax_recognition_pct: number; supplier_doc_ref: string | null;
}
export type ReviewReason = "unreadable" | "unsure" | "vat_mismatch" | "no_vat" | "foreign" | "ambiguous" | "amount_changed" | "date_out_of_range";
export type IntakeDecision =
  | { kind: "attach"; expenseId: string; supersedes: string | null; corrected: boolean; by: "ref" | "amount" }
  | { kind: "create"; row: NewExpense; learnedFrom: string | null }
  | { kind: "review"; reason: ReviewReason; candidates: string[] };

export const REVIEW_TEXT: Record<ReviewReason, string> = {
  unreadable: "לא נקרא סכום מהקובץ.",
  unsure: "חלק מהפרטים לא נקראו בבירור.",
  vat_mismatch: "סכום המע\"מ לא מתאים לסכום הכולל. ייתכן שיש בחשבונית שורות פטורות, וצריך לפצל.",
  no_vat: "המע\"מ לא מופיע בנפרד בחשבונית.",
  foreign: "הסכום אינו בשקלים. צריך שער בנק ישראל מתועד לפני הרישום.",
  ambiguous: "יותר מהוצאה אחת מתאימה לחשבונית.",
  amount_changed: "מספר החשבונית קיים בספרים, אבל בסכום אחר. ייתכן שזו חשבונית מתוקנת שמשנה את הסכום.",
  date_out_of_range: "תאריך החשבונית בעתיד, או לפני יותר משנה.",
};

const r2 = (n: number): number => Math.round(n * 100) / 100;
const days = (a: string, b: string): number => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;

/** A supplier invoice number in comparable form: digits only when it is a number (separators and leading zeros dropped),
 *  else the trimmed lower case text. null when there is nothing to compare. */
export function normRef(ref: string | null | undefined): string | null {
  const s = (ref ?? "").trim();
  if (!s) return null;
  if (/^[\d\s\-/.]+$/.test(s)) {
    const d = s.replace(/\D/g, "").replace(/^0+/, "");
    return d.length >= 3 ? d : null;
  }
  return s.toLowerCase();
}

const STOP = new Set(["בעמ", "בע\"מ", "בע״מ", "ltd", "inc", "llc", "בעמ.", "ישראל", "israel", "שירותי", "חברת", "the"]);
const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/["״׳'`.,()]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));

/** Whether two supplier names are the same business: one contains the other, or they share a word of three letters or more. */
export function sameSupplier(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? "").trim().toLowerCase(), y = (b ?? "").trim().toLowerCase();
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const tx = new Set(tokens(x));
  return tokens(y).some((t) => tx.has(t));
}

/** VAT printed on the invoice against its total: zero (an exempt document), or the rate of the document's date, within
 *  rounding (ten agorot, or half a per mille on a large invoice). Anything further off means lines without VAT in the total. */
export function vatConsistent(total: number, vat: number, date: string): boolean {
  if (vat === 0) return true;
  const rate = date < "2025-01-01" ? 17 : 18;
  return Math.abs(vat - (total * rate) / (100 + rate)) <= Math.max(0.1, total * 0.0005);
}

const live = (docs: FinExpenseDoc[] | undefined): FinExpenseDoc[] =>
  (docs ?? []).filter((d) => !d.superseded_at).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
const asksForCorrection = (e: FinExpense): boolean => /חשבונית מתוקנת/.test(e.description ?? "") && !/התקבלה חשבונית מתוקנת/.test(e.description ?? "");

/** The classification a new row of this supplier gets: the same supplier's latest settled row, else fully business. */
export function learnedClass(supplier: string, expenses: FinExpense[]): { category: string | null; tax_category: string; it: number; vat: number; from: string | null } {
  const prev = expenses
    .filter((e) => sameSupplier(e.supplier, supplier) && e.tax_category && e.tax_category !== "MIXED_CUSTOM" && e.income_tax_recognition_pct != null)
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on))[0];
  if (prev) return { category: prev.category, tax_category: prev.tax_category as string, it: Number(prev.income_tax_recognition_pct), vat: Number(prev.vat_recoverable_pct), from: prev.id };
  return { category: null, tax_category: "OPERATIONAL_100", it: 100, vat: 100, from: null };
}

const CHECKED = ["total", "vat_amount", "spent_on", "supplier", "supplier_doc_ref"];

/** What to do with one read invoice. `docsOf` maps an expense to its documents; `today` is YYYY-MM-DD. */
export function decideIntake(d: IntakeDraft, unsure: string[], expenses: FinExpense[], docsOf: Map<string, FinExpenseDoc[]>, today: string): IntakeDecision {
  const review = (reason: ReviewReason, candidates: string[] = []): IntakeDecision => ({ kind: "review", reason, candidates });
  if (d.total == null || !(d.total > 0)) return review("unreadable");
  const total = r2(d.total);
  const ref = normRef(d.supplier_doc_ref);

  // 1. The supplier's own invoice number. A corrected invoice keeps the number, so it lands on the row it corrects.
  if (ref) {
    const byRef = expenses.filter((e) => normRef(e.supplier_doc_ref) === ref && (!d.supplier || !e.supplier || sameSupplier(e.supplier, d.supplier) || /^\d{6,}$/.test(ref)));
    const sameAmount = byRef.filter((e) => Math.abs(r2(e.total) - total) <= 1);
    if (sameAmount.length === 1) {
      const e = sameAmount[0];
      return { kind: "attach", expenseId: e.id, supersedes: live(docsOf.get(e.id))[0]?.id ?? null, corrected: asksForCorrection(e), by: "ref" };
    }
    if (sameAmount.length > 1) return review("ambiguous", sameAmount.map((e) => e.id));
    if (byRef.length) return review("amount_changed", byRef.map((e) => e.id));
  }

  // 2. The same amount from the same supplier within a week: the document of a row that was typed in or imported without it.
  if (d.supplier && d.spent_on) {
    const near = expenses.filter((e) => Math.abs(r2(e.total) - total) <= 0.01 && days(e.spent_on, d.spent_on as string) <= 7 && sameSupplier(e.supplier, d.supplier));
    if (near.length === 1) return { kind: "attach", expenseId: near[0].id, supersedes: null, corrected: asksForCorrection(near[0]), by: "amount" };
    if (near.length > 1) return review("ambiguous", near.map((e) => e.id));
  }

  // 3. Nothing in the books: a new expense, only when every figure was read clearly and adds up.
  if (d.currency && d.currency.toUpperCase() !== "ILS") return review("foreign");
  if (!d.supplier || !d.spent_on || unsure.some((f) => CHECKED.includes(f))) return review("unsure");
  if (d.spent_on > today || days(d.spent_on, today) > 400) return review("date_out_of_range");
  if (d.vat_amount == null) return review("no_vat");
  const vat = r2(d.vat_amount);
  if (vat > total || !vatConsistent(total, vat, d.spent_on)) return review("vat_mismatch");
  const c = learnedClass(d.supplier, expenses);
  return {
    kind: "create", learnedFrom: c.from,
    row: {
      spent_on: d.spent_on, supplier: d.supplier.trim(), category: c.category ?? d.category ?? "OTHER",
      description: `${d.description ? `${d.description.trim()}. ` : ""}נקלט אוטומטית מהחשבונית, ${c.from ? "סיווג כמו ההוצאה הקודמת של הספק" : "עסקי 100% לפי הכלל של 30.10.2026"}`,
      total, vat_amount: vat, vat_recoverable_pct: c.vat, tax_category: c.tax_category, income_tax_recognition_pct: c.it,
      supplier_doc_ref: d.supplier_doc_ref?.trim() || null,
    },
  };
}

/** Rows a person can pick from when a file is left for review: the candidates first, then the closest amounts. */
export function pickList(d: IntakeDraft, candidates: string[], expenses: FinExpense[], max = 8): FinExpense[] {
  const first = expenses.filter((e) => candidates.includes(e.id));
  const rest = expenses.filter((e) => !candidates.includes(e.id))
    .map((e) => ({ e, score: (d.total != null ? Math.abs(e.total - d.total) : 0) + (d.spent_on ? days(e.spent_on, d.spent_on) : 0) / 10 }))
    .sort((a, b) => a.score - b.score).map((x) => x.e);
  return [...first, ...rest].slice(0, max);
}

/** The note added to a row whose description asked for a corrected invoice, once one is attached. */
export const correctedNote = (today: string): string => `. התקבלה חשבונית מתוקנת ${today.split("-").reverse().join(".")}`;
