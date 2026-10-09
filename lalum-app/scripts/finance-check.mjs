// Checks the client mirror of lalum_fin_totals and the report rules.
// Run with: npm run finance-check
import assert from "node:assert/strict";
import { computeTotals, draftProblems, openBalance, summarize, monthPeriod, recoverableVat } from "../src/lib/cockpit/finance.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const doc = (o) => ({
  id: "d1", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", tax_included: false, vat_rate: 18,
  lines: [], subtotal: 1000, vat_amount: 180, total: 1180, issue_date: "2026-10-05", due_date: null, payment_method: null,
  payment_ref: null, related_doc_id: null, send_email: false, doc_number: 1, allocation_number: null, pdf_url: null,
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
console.log("\nAll finance checks passed");
