// Checks the client mirror of lalum_fin_totals and the report rules.
// Run with: npm run finance-check
import assert from "node:assert/strict";
import { isShekel, computeTotals, draftProblems, openBalance, summarize, monthPeriod, recoverableVat, numberingGaps, formatRanges, archiveSummary, archiveRevenueEffect, splitName, customerProblems, customerGaps, CASUAL_TYPES } from "../src/lib/cockpit/finance.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const doc = (o) => ({
  id: "d1", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", tax_included: false, vat_rate: 18,
  lines: [], subtotal: 1000, vat_amount: 180, total: 1180, issue_date: "2026-10-05", due_date: null, payment_method: null,
  payment_ref: null, related_doc_id: null, send_email: false, doc_number: 1, i4u_doc_id: null, allocation_number: null, pdf_url: null,
  is_test: false, last_error: null, issued_at: null, ...o,
});
const exp = (o) => ({ id: "e1", spent_on: "2026-10-03", supplier: "x", category: "OTHER", description: null, total: 118, vat_amount: 18, vat_recoverable_pct: 100, supplier_doc_ref: null, payment_method: null, ...o });

t("tax excluded: vat on top", () => {
  assert.deepEqual(computeTotals([{ name: "a", qty: 1, price: 1000 }], 18, false), { subtotal: 1000, vat: 180, total: 1180 });
});
t("tax included: net is reverse calculated, vat is the remainder", () => {
  assert.deepEqual(computeTotals([{ name: "a", qty: 1, price: 117 }], 17, true), { subtotal: 100, vat: 17, total: 117 });
  assert.deepEqual(computeTotals([{ name: "a", qty: 1, price: 1180 }], 18, true), { subtotal: 1000, vat: 180, total: 1180 });
});
t("rounding happens once, on the sum", () => {
  const lines = [{ name: "a", qty: 3, price: 0.1 }, { name: "b", qty: 1, price: 0.2 }];
  assert.deepEqual(computeTotals(lines, 18, false), { subtotal: 0.5, vat: 0.09, total: 0.59 });
});
t("a draft is checked before it is saved", () => {
  const base = { customer_id: "c", doc_type: "INVOICE", lines: [{ name: "a", qty: 1, price: 5 }], payment_method: null, related_doc_id: null };
  assert.deepEqual(draftProblems(base), []);
  assert.ok(draftProblems({ ...base, customer_id: "" }).includes("בחרו לקוח"));
  assert.ok(draftProblems({ ...base, doc_type: "INVOICE_RECEIPT" }).includes("בחרו אמצעי תשלום"));
  assert.ok(draftProblems({ ...base, doc_type: "CREDIT" }).length === 1);
  assert.ok(draftProblems({ ...base, lines: [{ name: "", qty: 0, price: 1 }] }).length === 2);
});
t("open balance: payments, receipts and credits reduce it; proforma and test never count", () => {
  const inv = doc({});
  assert.equal(openBalance(inv, [inv], []), 1180);
  assert.equal(openBalance(inv, [inv], [{ id: "p", document_id: "d1", amount: 500, paid_on: "2026-10-06" }]), 680);
  const rcpt = doc({ id: "r", doc_type: "RECEIPT", related_doc_id: "d1", total: 400, subtotal: 0, vat_amount: 0 });
  assert.equal(openBalance(inv, [inv, rcpt], []), 780);
  assert.equal(openBalance(doc({ doc_type: "PROFORMA" }), [], []), 0);
  assert.equal(openBalance(doc({ is_test: true }), [], []), 0);
  assert.equal(openBalance(doc({ status: "DRAFT" }), [], []), 0);
});
t("monthly summary: revenue, credits, recoverable VAT, payable VAT", () => {
  const p = monthPeriod(2026, 10);
  assert.deepEqual(p, { from: "2026-10-01", to: "2026-10-31" });
  const docs = [
    doc({ id: "a" }),
    doc({ id: "b", doc_type: "INVOICE_RECEIPT", subtotal: 500, vat_amount: 90, total: 590 }),
    doc({ id: "c", doc_type: "CREDIT", related_doc_id: "a", subtotal: 100, vat_amount: 18, total: 118 }),
    doc({ id: "d", doc_type: "RECEIPT", subtotal: 0, vat_amount: 0, total: 300 }),
    doc({ id: "e", doc_type: "PROFORMA" }),
    doc({ id: "f", is_test: true }),
    doc({ id: "g", issue_date: "2026-09-30" }),
  ];
  const s = summarize(docs, [], [exp({}), exp({ id: "e2", total: 236, vat_amount: 36, vat_recoverable_pct: 25 })], p);
  assert.equal(s.revenueNet, 1400);
  assert.equal(s.vatOut, 252);
  assert.equal(s.expenses, 100 + 200);
  assert.equal(s.vatIn, 27);
  assert.equal(s.vatPayable, 225);
  assert.equal(s.profit, 1100);
});
t("recoverable VAT follows the stated share", () => {
  assert.equal(recoverableVat({ vat_amount: 36, vat_recoverable_pct: 25 }), 9);
  assert.equal(recoverableVat({ vat_amount: 36, vat_recoverable_pct: 0 }), 0);
});
t("numbering gaps are found and formatted", () => {
  assert.deepEqual(numberingGaps([1, 2, 3]), []);
  assert.deepEqual(numberingGaps([5, 1, 2, 2, 9]), [3, 4, 6, 7, 8]);
  assert.deepEqual(numberingGaps([]), []);
  assert.equal(formatRanges([3, 4, 5, 9, 11, 12]), "3 עד 5, 9, 11 עד 12");
});
t("archive summary groups by type and year", () => {
  const a = (o) => ({ id: "x", i4u_doc_id: "x", i4u_doc_type: 1, doc_number: 1, issue_date: "2026-03-01", i4u_client_id: null, subject: null, currency: "ILS", subtotal: 100, vat_amount: 18, total: 118, allocation_number: null, status_id: null, paid: null, balance: null, ...o });
  const rows = archiveSummary([a({}), a({ doc_number: 2, subtotal: 50.1, vat_amount: 9.02, total: 59.12 }), a({ i4u_doc_type: 4 }), a({ issue_date: "2025-12-31" })]);
  assert.deepEqual(rows[0], { type: 1, year: "2026", count: 2, subtotal: 150.1, vat: 27.02, total: 177.12 });
  assert.equal(rows.length, 3);
  assert.equal(rows[2].year, "2025");
});
const arch = (o) => ({ id: "x", i4u_doc_id: "x", i4u_doc_type: 1, doc_number: 1, issue_date: "2026-10-05", i4u_client_id: null, subject: null, currency: "₪", subtotal: 100, vat_amount: 18, total: 118, allocation_number: null, status_id: null, paid: null, balance: null, ...o });
t("archive revenue: invoices add, credits subtract whatever their stored sign, receipts and pro formas are not revenue", () => {
  assert.deepEqual(archiveRevenueEffect(arch({})), { net: 100, vat: 18 });
  assert.deepEqual(archiveRevenueEffect(arch({ i4u_doc_type: 3 })), { net: 100, vat: 18 });
  assert.deepEqual(archiveRevenueEffect(arch({ i4u_doc_type: 4 })), { net: -100, vat: -18 });
  assert.deepEqual(archiveRevenueEffect(arch({ i4u_doc_type: 4, subtotal: -100, vat_amount: -18 })), { net: -100, vat: -18 });
  assert.deepEqual(archiveRevenueEffect(arch({ i4u_doc_type: 2 })), { net: 0, vat: 0 });
  assert.deepEqual(archiveRevenueEffect(arch({ i4u_doc_type: 5 })), { net: 0, vat: 0 });
  assert.deepEqual(archiveRevenueEffect(arch({ currency: "ILS" })), { net: 100, vat: 18 });
  assert.deepEqual(archiveRevenueEffect(arch({ currency: "US$", rate: "3.612" })), { net: 361.2, vat: 65.02 });
  assert.deepEqual(archiveRevenueEffect(arch({ currency: "US$" })), { net: 0, vat: 0 });
  assert.deepEqual(archiveRevenueEffect(arch({ currency: "€", rate: 0 })), { net: 0, vat: 0 });
  assert.equal(isShekel("₪") && isShekel("NIS") && isShekel("ILS") && isShekel(""), true);
  assert.equal(isShekel("US$"), false);
});
t("archive joins the period summary once; a document also held in the ledger is not double counted", () => {
  const p = monthPeriod(2026, 10);
  const archive = [arch({ i4u_doc_id: "a" }), arch({ i4u_doc_id: "b", i4u_doc_type: 4, subtotal: 40, vat_amount: 7.2 }), arch({ i4u_doc_id: "old", issue_date: "2026-09-30" }), arch({ i4u_doc_id: "dup" })];
  const s0 = summarize([], [], [], p, archive);
  assert.equal(s0.revenueNet, 100 + 100 - 40);
  assert.equal(s0.vatOut, 18 + 18 - 7.2);
  assert.equal(s0.archiveNet, s0.revenueNet);
  const ledgerCopy = doc({ id: "L", i4u_doc_id: "dup", subtotal: 100, vat_amount: 18, total: 118 });
  const s1 = summarize([ledgerCopy], [], [], p, archive);
  assert.equal(s1.revenueNet, s0.revenueNet);
});
t("a customer name that carries its address is split, others are untouched", () => {
  assert.deepEqual(splitName("OZ Investment Holdings Company Limited Address: Landscape House, Dublin 22"), { name: "OZ Investment Holdings Company Limited", address: "Landscape House, Dublin 22" });
  assert.deepEqual(splitName("אקמה בע\"מ כתובת: הרצל 1, תל אביב"), { name: "אקמה בע\"מ", address: "הרצל 1, תל אביב" });
  assert.deepEqual(splitName("G-intentional"), { name: "G-intentional", address: null });
  assert.deepEqual(splitName("Address: only"), { name: "Address: only", address: null });
});
const cf = (o) => ({ name: "Acme", email: "a@b.co", tax_id: "", i4u: "", casual: false, isNew: true, ...o });
t("a new regular customer needs a name and a valid e-mail; a casual one needs a name only", () => {
  assert.deepEqual(customerProblems(cf({})), []);
  assert.ok(customerProblems(cf({ email: "" })).includes('לקוח חדש דורש כתובת דוא"ל'));
  assert.ok(customerProblems(cf({ email: "not-an-email" })).includes('כתובת הדוא"ל אינה תקינה'));
  assert.deepEqual(customerProblems(cf({ email: "", casual: true })), []);
  assert.ok(customerProblems(cf({ name: " ", casual: true })).includes("שם הלקוח חובה"));
  assert.deepEqual(customerProblems(cf({ email: "", isNew: false })), []);
  assert.ok(customerProblems(cf({ tax_id: "12" })).length === 1);
  assert.ok(customerProblems(cf({ i4u: "x1" })).length === 1);
});
t("casual customers are limited to invoice-receipts and credits", () => {
  assert.deepEqual(CASUAL_TYPES, ["INVOICE_RECEIPT", "CREDIT"]);
  const base = { customer_id: "c", doc_type: "INVOICE_RECEIPT", lines: [{ name: "a", qty: 1, price: 5 }], payment_method: "CASH", related_doc_id: null, casual: true };
  assert.deepEqual(draftProblems(base), []);
  assert.ok(draftProblems({ ...base, doc_type: "INVOICE" }).includes("לקוח מזדמן אפשרי רק בחשבונית מס קבלה ובחשבונית זיכוי"));
  assert.ok(draftProblems({ ...base, doc_type: "PROFORMA" }).length >= 1);
});
t("incomplete regular customers are flagged, casual ones are not", () => {
  assert.deepEqual(customerGaps({ email: null, tax_id: null, is_casual: false }), ['דוא"ל', "ת.ז. או ח.פ."]);
  assert.deepEqual(customerGaps({ email: "a@b.co", tax_id: "123456789", is_casual: false }), []);
  assert.deepEqual(customerGaps({ email: null, tax_id: null, is_casual: true }), []);
});
console.log("\nAll finance checks passed");
