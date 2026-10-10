// Client mirror of the finance ledger rules (migration 0014). The database computes the totals that
// are stored; this file computes the same numbers for the live preview and for the reports, and
// `npm run finance-check` pins both to the same cases.

export type DocType = "PROFORMA" | "INVOICE" | "RECEIPT" | "INVOICE_RECEIPT" | "CREDIT";
export type PayMethod = "CARD" | "CHEQUE" | "TRANSFER" | "CASH" | "BIT" | "PAYBOX";

export interface Line { name: string; qty: number; price: number }
export interface Totals { subtotal: number; vat: number; total: number }

export interface FinCustomer {
  id: string; name: string; tax_id: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; notes: string | null; archived: boolean; i4u_customer_id: number | null;
}
export interface FinDocument {
  id: string; customer_id: string; doc_type: DocType; status: "DRAFT" | "ISSUED"; subject: string;
  tax_included: boolean; vat_rate: number; lines: Line[]; subtotal: number; vat_amount: number; total: number;
  issue_date: string; due_date: string | null; payment_method: PayMethod | null; payment_ref: string | null;
  related_doc_id: string | null; send_email: boolean; doc_number: number | null; i4u_doc_id: string | null; allocation_number: string | null;
  pdf_url: string | null; is_test: boolean; last_error: string | null; issued_at: string | null;
}
export interface FinPayment {
  id: string; customer_id: string | null; document_id: string | null; paid_on: string; amount: number;
  method: PayMethod; reference: string | null; notes: string | null;
}
export interface FinExpense {
  id: string; spent_on: string; supplier: string; category: string; description: string | null; total: number;
  vat_amount: number; vat_recoverable_pct: number; supplier_doc_ref: string | null; payment_method: PayMethod | null;
}

export const DOC_TYPE: Record<DocType, string> = {
  PROFORMA: "חשבון עסקה",
  INVOICE: "חשבונית מס",
  RECEIPT: "קבלה",
  INVOICE_RECEIPT: "חשבונית מס קבלה",
  CREDIT: "חשבונית זיכוי",
};
export const PAY_METHOD: Record<PayMethod, string> = {
  CARD: "כרטיס אשראי", CHEQUE: "שיק", TRANSFER: "העברה בנקאית", CASH: "מזומן", BIT: "ביט", PAYBOX: "פייבוקס",
};
export const EXPENSE_CATEGORY: Record<string, string> = {
  OFFICE: "משרד וציוד", SOFTWARE: "תוכנה ומנויים", PROFESSIONAL: "שירותים מקצועיים", TRAVEL: "נסיעות",
  VEHICLE: "רכב", COMMUNICATION: "תקשורת", MARKETING: "שיווק ופרסום", FEES: "אגרות ודמי חבר",
  EDUCATION: "השתלמויות", OTHER: "אחר",
};

/** Default VAT rate for a new document. Stored on each document, so a later change never rewrites history. */
export const DEFAULT_VAT_RATE = 18;

/** Documents that carry a payment, and so need a payment method. */
export const NEEDS_PAYMENT: DocType[] = ["RECEIPT", "INVOICE_RECEIPT"];

const r2 = (n: number): number => Math.round(Number(n.toFixed(6)) * 100) / 100;

/** Same rounding as lalum_fin_totals: sum the lines first, round once. */
export function computeTotals(lines: Line[], vatRate: number, taxIncluded: boolean): Totals {
  const s = lines.reduce((a, l) => a + l.qty * l.price, 0);
  if (taxIncluded) {
    const total = r2(s);
    const subtotal = r2(s / (1 + vatRate / 100));
    return { subtotal, vat: r2(total - subtotal), total };
  }
  const subtotal = r2(s);
  const vat = r2((subtotal * vatRate) / 100);
  return { subtotal, vat, total: r2(subtotal + vat) };
}

/** Reasons a draft cannot be saved or issued yet. Empty means ready. */
export function draftProblems(d: {
  customer_id: string; doc_type: DocType; lines: Line[]; payment_method: PayMethod | null; related_doc_id: string | null;
}): string[] {
  const out: string[] = [];
  if (!d.customer_id) out.push("בחרו לקוח");
  if (d.lines.length === 0) out.push("הוסיפו שורה אחת לפחות");
  if (d.lines.some((l) => !l.name.trim())) out.push("לכל שורה נדרש תיאור");
  if (d.lines.some((l) => !(l.qty > 0) || !(l.price > 0))) out.push("כמות ומחיר חייבים להיות גדולים מאפס");
  if (NEEDS_PAYMENT.includes(d.doc_type) && !d.payment_method) out.push("בחרו אמצעי תשלום");
  if ((d.doc_type === "CREDIT" || d.doc_type === "RECEIPT") && !d.related_doc_id) out.push("קבלה וחשבונית זיכוי חייבות להתייחס למסמך מקור");
  return out;
}

/** VAT that can be claimed back on one expense. */
export const recoverableVat = (e: Pick<FinExpense, "vat_amount" | "vat_recoverable_pct">): number =>
  r2((e.vat_amount * e.vat_recoverable_pct) / 100);

const isLive = (d: FinDocument): boolean => d.status === "ISSUED" && !d.is_test;

/** Signed effect of an issued document on revenue. Receipts and pro formas are not revenue. */
export function revenueEffect(d: FinDocument): { net: number; vat: number } {
  if (!isLive(d)) return { net: 0, vat: 0 };
  if (d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT") return { net: d.subtotal, vat: d.vat_amount };
  if (d.doc_type === "CREDIT") return { net: -d.subtotal, vat: -d.vat_amount };
  return { net: 0, vat: 0 };
}

/** What a customer still owes on an issued invoice: total, less payments and receipts, less credits. */
export function openBalance(inv: FinDocument, docs: FinDocument[], pays: FinPayment[]): number {
  if (inv.doc_type !== "INVOICE" || !isLive(inv)) return 0;
  const received = pays.filter((p) => p.document_id === inv.id).reduce((a, p) => a + p.amount, 0);
  const viaDocs = docs.filter((d) => isLive(d) && d.related_doc_id === inv.id && (d.doc_type === "RECEIPT" || d.doc_type === "CREDIT"))
    .reduce((a, d) => a + d.total, 0);
  return Math.max(0, r2(inv.total - received - viaDocs));
}

export interface Period { from: string; to: string }
const within = (iso: string, p: Period): boolean => iso >= p.from && iso <= p.to;

export interface Summary {
  revenueNet: number; vatOut: number; expenses: number; vatIn: number; vatPayable: number; profit: number; outstanding: number;
  /** Part of revenueNet / vatOut that comes from the Invoice4U archive, shown separately so it is never hidden in the total. */
  archiveNet: number; archiveVat: number;
}

/** Invoice4U writes the shekel as the symbol, not as the ISO code. Foreign currencies come as "US$", "€" and so on. */
export const isShekel = (c: string | null | undefined): boolean => !c || ["₪", "ILS", "NIS"].includes(c.trim().toUpperCase());

/**
 * Revenue effect of an archived Invoice4U document, in shekels. Invoices and invoice-receipts add, credits
 * subtract (the sign is taken from the type, so it does not matter whether Invoice4U stores a credit as positive
 * or negative). Receipts and pro formas are not revenue. A foreign currency document is converted with the rate
 * Invoice4U stored on it; one without a usable rate is left out rather than guessed.
 */
export function archiveRevenueEffect(a: ArchiveDoc): { net: number; vat: number } {
  let k = 1;
  if (!isShekel(a.currency)) {
    k = Number(a.rate);
    if (!(k > 0)) return { net: 0, vat: 0 };
  }
  const net = r2(Math.abs(a.subtotal) * k), vat = r2(Math.abs(a.vat_amount) * k);
  if (a.i4u_doc_type === 1 || a.i4u_doc_type === 3) return { net, vat };
  if (a.i4u_doc_type === 4) return { net: -net, vat: -vat };
  return { net: 0, vat: 0 };
}

/** One period summary: revenue by issue date, expenses by spend date, VAT as output less recoverable input. */
export function summarize(docs: FinDocument[], pays: FinPayment[], exps: FinExpense[], p: Period, archive: ArchiveDoc[] = []): Summary {
  let revenueNet = 0, vatOut = 0;
  for (const d of docs) if (within(d.issue_date, p)) { const e = revenueEffect(d); revenueNet += e.net; vatOut += e.vat; }
  // A document issued here through Invoice4U later shows up in the archive too. Count it once, from the ledger.
  const inLedger = new Set(docs.filter((d) => d.status === "ISSUED" && d.i4u_doc_id).map((d) => d.i4u_doc_id as string));
  let archiveNet = 0, archiveVat = 0;
  for (const a of archive) {
    if (inLedger.has(a.i4u_doc_id)) continue;
    if (!within(a.issue_date, p)) continue;
    const e = archiveRevenueEffect(a); archiveNet += e.net; archiveVat += e.vat;
  }
  revenueNet += archiveNet; vatOut += archiveVat;
  let expenses = 0, vatIn = 0;
  for (const e of exps) if (within(e.spent_on, p)) { expenses += e.total - e.vat_amount; vatIn += recoverableVat(e); }
  const outstanding = docs.reduce((a, d) => a + openBalance(d, docs, pays), 0);
  return {
    revenueNet: r2(revenueNet), vatOut: r2(vatOut), expenses: r2(expenses), vatIn: r2(vatIn),
    vatPayable: r2(vatOut - vatIn), profit: r2(revenueNet - expenses), outstanding: r2(outstanding),
    archiveNet: r2(archiveNet), archiveVat: r2(archiveVat),
  };
}

/** First and last day of a calendar month as ISO dates. */
export function monthPeriod(year: number, month1: number): Period {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month1, 0).getDate();
  return { from: `${year}-${pad(month1)}-01`, to: `${year}-${pad(month1)}-${pad(last)}` };
}

// ---- Invoice4U archive (read-only mirror, migration 0015) ----

export interface ArchiveDoc {
  id: string; i4u_doc_id: string; i4u_doc_type: number; doc_number: number; issue_date: string; i4u_client_id: number | null;
  subject: string | null; currency: string; subtotal: number; vat_amount: number; total: number; allocation_number: string | null;
  status_id: number | null; paid: number | null; balance: number | null;
  /** ConversionRate Invoice4U stored on the document (units of NIS per unit of currency). Read from the raw record. */
  rate?: number | string | null;
}
/** Invoice4U DocumentType codes, as documented by Invoice4U. */
export const I4U_TYPE: Record<number, string> = { 1: "חשבונית מס", 2: "קבלה", 3: "חשבונית מס קבלה", 4: "חשבונית זיכוי", 5: "חשבון עסקה" };

/** Document numbers missing between the lowest and highest number held. Numbering must be continuous, so a gap is a finding. */
export function numberingGaps(numbers: number[]): number[] {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) for (let n = sorted[i - 1] + 1; n < sorted[i] && out.length < 500; n++) out.push(n);
  return out;
}
/** Compresses [3,4,5,9] into "3 עד 5, 9". */
export function formatRanges(nums: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i ? `${nums[i]} עד ${nums[j]}` : String(nums[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

export interface ArchiveRow { type: number; year: string; count: number; subtotal: number; vat: number; total: number }
/** Totals per document type and year, for reconciling the archive against Invoice4U's own reports. Credits are shown as positive amounts of their own type. */
export function archiveSummary(docs: ArchiveDoc[]): ArchiveRow[] {
  const m = new Map<string, ArchiveRow>();
  for (const d of docs) {
    const year = d.issue_date.slice(0, 4), k = `${d.i4u_doc_type}|${year}`;
    const r = m.get(k) ?? { type: d.i4u_doc_type, year, count: 0, subtotal: 0, vat: 0, total: 0 };
    r.count++; r.subtotal = r2(r.subtotal + d.subtotal); r.vat = r2(r.vat + d.vat_amount); r.total = r2(r.total + d.total);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.year.localeCompare(a.year) || a.type - b.type);
}

/**
 * Some Invoice4U customer names carry the address inside the name ("Acme Ltd Address: 1 Main St"). The part after
 * the marker is the address; the part before is the name. Names without the marker are returned unchanged.
 */
export function splitName(raw: string): { name: string; address: string | null } {
  const m = /\s+(?:Address|כתובת)\s*:\s*/i.exec(raw);
  if (!m) return { name: raw.trim(), address: null };
  const name = raw.slice(0, m.index).trim(), address = raw.slice(m.index + m[0].length).trim();
  return name ? { name, address: address || null } : { name: raw.trim(), address: null };
}
