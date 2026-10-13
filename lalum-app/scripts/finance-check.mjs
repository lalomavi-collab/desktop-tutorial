// Checks the client mirror of lalum_fin_totals and the report rules.
// Run with: npm run finance-check
import assert from "node:assert/strict";
import { incomeRows, incomeByKind, revenueByCustomer, receivablesAging, toCsv, incomeHtml, revenueBuckets, weekStart } from "../src/lib/cockpit/financeReports.ts";
import { isShekel, computeTotals, draftProblems, openBalance, summarize, monthPeriod, recoverableVat, numberingGaps, formatRanges, archiveSummary, archiveRevenueEffect, splitName, customerProblems, customerGaps, CASUAL_TYPES, closedBy, isOpenProforma, trustHeld, trustBreakdown, maskAccount, trustPostProblems, canReverse, trustAccountProblems, trustCloseProblem, reconState, statementProblems, statementCorrectionProblems, trustValueDate, trustHeldAsOf, valueDateProblems, trustAccountLock } from "../src/lib/cockpit/finance.ts";

import { allocationThreshold, allocationGaps, allocationShort } from "../src/lib/cockpit/financeAllocation.ts";

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
});t("a pro forma is open until an ISSUED document settles it; drafts and test documents do not count", () => {
  const pf = doc({ id: "p1", doc_type: "PROFORMA" });
  assert.equal(isOpenProforma(pf, [pf]), true);
  const draft = doc({ id: "i1", doc_type: "INVOICE", status: "DRAFT", source_proforma_id: "p1" });
  assert.equal(isOpenProforma(pf, [pf, draft]), true);
  const inv = doc({ id: "i1", doc_type: "INVOICE", source_proforma_id: "p1", doc_number: 10015 });
  assert.equal(isOpenProforma(pf, [pf, inv]), false);
  assert.equal(closedBy(pf, [pf, inv])?.doc_number, 10015);
  assert.equal(isOpenProforma(doc({ id: "p2", doc_type: "PROFORMA", is_test: true }), []), false);
  assert.equal(isOpenProforma(doc({ id: "p3", doc_type: "PROFORMA", status: "DRAFT" }), []), false);
  assert.equal(isOpenProforma(doc({ id: "x", doc_type: "INVOICE" }), []), false);
});
const tx = (o) => ({ id: 1, trust_account_id: "a1", matter_id: "m1", customer_id: "c1", tx_type: "DEPOSIT", amount: 1000, receipt_no: "TR-000001", reference_doc_id: null, reverses_entry_id: null, counterparty: null, notes: null, created_at: "2026-10-05", ...o });
t("trust held: the ledger is signed, so the balance is the plain sum, narrowed by customer, matter or account", () => {
  const rows = [tx({}), tx({ id: 2, tx_type: "EARNED_FEE_TRANSFER", amount: -300 }), tx({ id: 3, customer_id: "c2", matter_id: "m2", trust_account_id: "a2", amount: 50 })];
  assert.equal(trustHeld(rows), 750);
  assert.equal(trustHeld(rows, { customer: "c1" }), 700);
  assert.equal(trustHeld(rows, { matter: "m2" }), 50);
  assert.equal(trustHeld(rows, { account: "a1" }), 700);
});
t("trust breakdown drops zero balances and sorts largest first", () => {
  const rows = [tx({}), tx({ id: 2, tx_type: "REVERSAL", amount: -1000 }), tx({ id: 3, customer_id: "c2", amount: 50 }), tx({ id: 4, customer_id: "c3", amount: 90 })];
  assert.deepEqual(trustBreakdown(rows, "customer_id"), [{ id: "c3", balance: 90 }, { id: "c2", balance: 50 }]);
});
t("bank account numbers are shown masked", () => {
  assert.equal(maskAccount("123456789"), "***6789");
  assert.equal(maskAccount("123"), "123");
});
t("trust money is never revenue: the summary has no trust figure", () => {
  const sm = summarize([doc({})], [], [], { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(sm.revenueNet, 1000);
  assert.ok(!Object.keys(sm).some((k) => /trust/i.test(k)));
});
const cust = (o) => ({ id: "c1", name: "לקוח א", tax_id: null, email: null, phone: null, address: null, city: null, notes: null, archived: false, i4u_customer_id: 77, is_casual: false, ...o });
const archDoc = (o) => ({ id: "a1", i4u_doc_id: "A1", i4u_doc_type: 1, doc_number: 10001, issue_date: "2026-10-02", i4u_client_id: 77, subject: null, currency: "₪", subtotal: 10000, vat_amount: 1800, total: 11800, allocation_number: null, status_id: null, paid: null, balance: null, ...o });
t("income report: invoices and invoice-receipts add, credits subtract, a document in both places counts once", () => {
  const period = { from: "2026-10-01", to: "2026-10-31" };
  const ledgerInv = doc({ id: "l1", doc_type: "INVOICE", i4u_doc_id: "A1", doc_number: 10001, subtotal: 10000, vat_amount: 1800, total: 11800 });
  const rows = incomeRows([ledgerInv], [archDoc({}), archDoc({ id: "a2", i4u_doc_id: "A2", i4u_doc_type: 4, doc_number: 50001, subtotal: 1000, vat_amount: 180, total: 1180 }), archDoc({ id: "a3", i4u_doc_id: "A3", i4u_doc_type: 2, doc_number: 30001 }), archDoc({ id: "a4", i4u_doc_id: "A4", issue_date: "2026-09-30" })], [cust({})], period);
  assert.equal(rows.length, 2);
  const g = incomeByKind(rows);
  assert.equal(g.net, 9000); assert.equal(g.vat, 1620); assert.equal(g.total, 10620);
  assert.equal(revenueByCustomer(rows)[0].documents, 2);
});
t("test documents and drafts are not income", () => {
  const rows = incomeRows([doc({ is_test: true }), doc({ status: "DRAFT" })], [], [cust({})], { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(rows.length, 0);
});
t("aging by days past the due date: cash basis counts open pro formas only, accrual basis counts unpaid invoices", () => {
  const mk = (id, type, due, o = {}) => doc({ id, doc_type: type, total: 100, due_date: due, ...o });
  const pf = [mk("a", "PROFORMA", "2026-10-20"), mk("b", "PROFORMA", "2026-10-01"), mk("c", "PROFORMA", "2026-08-20"), mk("d", "PROFORMA", "2026-06-01")];
  const c = [cust({ id: "c1", i4u_customer_id: null })];
  const cash = receivablesAging([...pf, mk("i", "INVOICE", "2026-09-01")], [], c, "2026-10-10", "CASH");
  assert.deepEqual(cash.totals, [100, 100, 100, 0, 100]); assert.equal(cash.total, 400); // the invoice is not a debt on the cash basis
  const settled = mk("s", "INVOICE", null, { source_proforma_id: "a", doc_number: 5 });
  assert.equal(receivablesAging([...pf, settled], [], c, "2026-10-10", "CASH").total, 300); // a settled pro forma drops out
  const accrual = receivablesAging([mk("i1", "INVOICE", "2026-10-20"), mk("i2", "INVOICE", "2026-08-20")], [], c, "2026-10-10", "ACCRUAL");
  assert.deepEqual(accrual.totals, [100, 0, 100, 0, 0]);
});
t("csv opens in Excel with Hebrew: byte order mark, quoted text, plain numbers", () => {
  const c = toCsv(["a", "b"], [["x\"y", 1234.5]]);
  assert.ok(c.startsWith("\uFEFF"));
  assert.ok(c.includes('"x""y",1234.50'));
});t("e-mail html escapes customer names", () => {
  const rows = incomeRows([doc({ id: "z", doc_type: "INVOICE" })], [], [cust({ id: "c1", name: "<b>x</b> & co" })], { from: "2026-10-01", to: "2026-10-31" });
  const h = incomeHtml("t", incomeByKind(rows));
  assert.ok(!h.includes("<b>x</b>") && h.includes("&lt;b&gt;x&lt;/b&gt; &amp; co"));
});t("weeks start on Sunday; monthly buckets cover the year; the running bucket is excluded from the comparison", () => {
  assert.equal(weekStart("2026-10-12"), "2026-10-11"); // a Monday goes back to Sunday
  assert.equal(weekStart("2026-10-11"), "2026-10-11");
  const row = (date, net) => ({ date, kind: "INVOICE", number: 1, customer: "x", customerKey: "k", net, vat: net * 0.18, total: net * 1.18, source: "ledger" });
  const rows = [row("2026-08-05", 10000), row("2026-09-02", 12000), row("2026-10-03", 5000), row("2026-09-20", -2000)];
  const m = revenueBuckets(rows, "month", 2026, "2026-10-12");
  assert.equal(m.buckets.length, 12);
  assert.equal(m.buckets[8].net, 10000); // September: 12000 credit 2000
  assert.equal(m.buckets[9].future, false); assert.equal(m.buckets[10].future, true);
  assert.equal(m.net, 25000);
  assert.equal(m.average, 10000); assert.equal(m.averageOver, 2); assert.equal(m.hasRunning, true); // Aug and Sep only: not January to July, not the running October
  assert.equal(m.lastVsPrevious.last.label, "ספט׳"); assert.equal(m.lastVsPrevious.pct, 0);
  const y = revenueBuckets(rows, "year", 2026, "2026-10-12");
  assert.equal(y.buckets.length, 5); assert.equal(y.buckets[4].net, 25000);
  assert.equal(y.averageOver, 0); assert.equal(y.average, 0); // 2026 is still running and earlier years have no income
  assert.equal(revenueBuckets(rows, "week", 2026, "2026-10-12").buckets.length, 12);
});
t("trust posting: withdrawals are capped by matter and account balance, a fee transfer needs an invoice within its open amount", () => {
  const rows = [tx({ amount: 500 }), tx({ id: 2, matter_id: "m2", trust_account_id: "a1", amount: 200 })];
  const ok = { matter_id: "m1", account_id: "a1", type: "REFUND_TO_CLIENT", amount: 500, doc_open: null, doc_id: null };
  assert.deepEqual(trustPostProblems(ok, rows), []);
  assert.ok(trustPostProblems({ ...ok, amount: 501 }, rows).includes("הסכום גבוה מהיתרה המוחזקת בתיק"));
  assert.deepEqual(trustPostProblems({ ...ok, type: "DEPOSIT", amount: 99999 }, rows), []);
  const fee = { ...ok, type: "EARNED_FEE_TRANSFER", amount: 100 };
  assert.ok(trustPostProblems(fee, rows).includes("בחרו חשבונית מס שהופקה"));
  assert.ok(trustPostProblems({ ...fee, doc_id: "d1", doc_open: 50 }, rows).includes("הסכום גבוה מהיתרה הפתוחה בחשבונית"));
  assert.deepEqual(trustPostProblems({ ...fee, doc_id: "d1", doc_open: 100 }, rows), []);
});
t("a trust row can be reversed once, and a reversal cannot be reversed", () => {
  const a = tx({ id: 1 }), r = tx({ id: 2, tx_type: "REVERSAL", amount: -1000, reverses_entry_id: 1 });
  assert.equal(canReverse(a, [a]), true);
  assert.equal(canReverse(a, [a, r]), false);
  assert.equal(canReverse(r, [a, r]), false);
});
t("trust account setup: digits only, no duplicate, and no closing while money is held", () => {
  const ex = [{ id: "a1", bank_name: "לאומי", branch: "800", account_number: "12345678", closed_on: null }];
  const ok = { bank_name: "פועלים", branch: "600", account_number: "998877" };
  assert.deepEqual(trustAccountProblems(ok, ex), []);
  assert.ok(trustAccountProblems({ ...ok, bank_name: " " }, ex).includes("שם הבנק חובה"));
  assert.ok(trustAccountProblems({ ...ok, branch: "ab" }, ex).length === 1);
  assert.ok(trustAccountProblems({ ...ok, account_number: "12" }, ex).length === 1);
  assert.deepEqual(trustAccountProblems({ bank_name: "לאומי", branch: "800", account_number: "12345678" }, ex), ["החשבון כבר קיים"]);
  // editing an account must not collide with itself, only with another account
  assert.deepEqual(trustAccountProblems({ bank_name: "לאומי", branch: "800", account_number: "12345678" }, ex, "a1"), []);
  const two = [...ex, { id: "a2", bank_name: "פועלים", branch: "600", account_number: "998877", closed_on: null }];
  assert.deepEqual(trustAccountProblems({ bank_name: "פועלים", branch: "600", account_number: "998877" }, two, "a1"), ["החשבון כבר קיים"]);
  assert.equal(trustCloseProblem("a1", [tx({ amount: 5 })]) !== null, true);
  assert.equal(trustCloseProblem("a1", [tx({ amount: 5 }), tx({ id: 2, tx_type: "REFUND_TO_CLIENT", amount: -5 })]), null);
});
t("reconciliation: zero difference is matched, none is a missing statement, anything else is different", () => {
  assert.equal(reconState({ difference_at_statement_date: null }), "NO_STATEMENT");
  assert.equal(reconState({ difference_at_statement_date: 0 }), "MATCHED");
  assert.equal(reconState({ difference_at_statement_date: 0.004 }), "MATCHED");
  assert.equal(reconState({ difference_at_statement_date: -12.5 }), "DIFFERENT");
});
t("bank statement entry: account, a past date, a numeric balance, and no repeat of the same account and date", () => {
  const ex = [{ trust_account_id: "a1", statement_as_of: "2026-09-30" }];
  const ok = { account_id: "a1", as_of: "2026-10-05", balance: "1500.50" };
  assert.deepEqual(statementProblems(ok, "2026-10-11", ex), []);
  assert.ok(statementProblems({ ...ok, as_of: "2026-12-01" }, "2026-10-11", ex).includes("תאריך הדף לא יכול להיות עתידי"));
  assert.ok(statementProblems({ ...ok, balance: "abc" }, "2026-10-11", ex).includes("הזינו יתרה מספרית"));
  assert.ok(statementProblems({ ...ok, balance: "" }, "2026-10-11", ex).includes("הזינו יתרה מספרית"));
  assert.ok(statementProblems({ ...ok, as_of: "2026-09-30" }, "2026-10-11", ex).includes("כבר הוזן דף לחשבון הזה בתאריך הזה"));
  assert.deepEqual(statementProblems({ ...ok, balance: "-20" }, "2026-10-11", ex), []);
});
t("statement correction: a different numeric figure and a reason, and only on the live version", () => {
  const cur = { balance: 1500, superseded_at: null };
  assert.deepEqual(statementCorrectionProblems({ balance: "1400", reason: "טעות הקלדה" }, cur), []);
  assert.ok(statementCorrectionProblems({ balance: "1500", reason: "טעות הקלדה" }, cur).includes("היתרה זהה לקיימת"));
  assert.ok(statementCorrectionProblems({ balance: "x", reason: "טעות הקלדה" }, cur).includes("הזינו יתרה מספרית"));
  assert.ok(statementCorrectionProblems({ balance: "1400", reason: " " }, cur).includes("נדרשת סיבת התיקון"));
  assert.ok(statementCorrectionProblems({ balance: "1400", reason: "טעות הקלדה" }, { ...cur, superseded_at: "2026-10-12" }).length === 1);
});
t("value date: falls back to the recording day, and the as-of balance counts by value date", () => {
  assert.equal(trustValueDate({ created_at: "2026-10-12T08:00:00Z", value_date: null }), "2026-10-12");
  assert.equal(trustValueDate({ created_at: "2026-10-12T08:00:00Z", value_date: "2026-10-09" }), "2026-10-09");
  // recorded Monday 12th, value Friday 9th: counted at a Friday statement, not just a Monday one
  const rows = [tx({ amount: 1000, created_at: "2026-10-12T08:00:00Z", value_date: "2026-10-09" }), tx({ id: 2, amount: 200, created_at: "2026-10-08T08:00:00Z" })];
  assert.equal(trustHeldAsOf(rows, "a1", "2026-10-09"), 1200);
  assert.equal(trustHeldAsOf(rows, "a1", "2026-10-08"), 200);
  assert.equal(trustHeldAsOf(rows, "other", "2026-10-31"), 0);
});
t("value date rules: none means today, no future, nothing before the account opened", () => {
  assert.deepEqual(valueDateProblems("", "2026-10-12", "2026-09-01"), []);
  assert.deepEqual(valueDateProblems("2026-10-12", "2026-10-12", "2026-09-01"), []);
  assert.deepEqual(valueDateProblems("2026-10-13", "2026-10-12", null), ["תאריך ערך לא יכול להיות עתידי"]);
  assert.deepEqual(valueDateProblems("2026-08-31", "2026-10-12", "2026-09-01"), ["תאריך ערך מוקדם מפתיחת חשבון הנאמנות"]);
});
t("allocation ceiling steps down by date and is on the amount before VAT", () => {
  assert.equal(allocationThreshold("2023-12-31"), null);
  assert.equal(allocationThreshold("2024-06-01"), 25000);
  assert.equal(allocationThreshold("2025-12-31"), 20000);
  assert.equal(allocationThreshold("2026-05-31"), 10000);
  assert.equal(allocationThreshold("2026-06-01"), 5000);
});
t("allocation gaps: only issued tax invoices above the ceiling, with VAT, without a number", () => {
  const cust = [{ id: "c1", tax_id: "031471261", is_casual: false }, { id: "c2", tax_id: null, is_casual: false }];
  const docs = [
    doc({ id: "a", issue_date: "2026-09-30", subtotal: 22087.5, vat_amount: 3975.75 }),
    doc({ id: "b", issue_date: "2026-09-30", subtotal: 22087.5, vat_amount: 3975.75, allocation_number: "245073463" }),
    doc({ id: "c", issue_date: "2026-09-02", subtotal: 4999.99, vat_amount: 900 }),
    doc({ id: "d", issue_date: "2026-05-02", subtotal: 7800, vat_amount: 1404 }),
    doc({ id: "e", issue_date: "2026-09-02", subtotal: 9000, vat_amount: 0 }),
    doc({ id: "f", issue_date: "2026-09-02", subtotal: 9000, vat_amount: 1620, doc_type: "CREDIT" }),
    doc({ id: "g", issue_date: "2026-09-02", subtotal: 9000, vat_amount: 1620, doc_type: "PROFORMA" }),
    doc({ id: "h", issue_date: "2026-09-02", subtotal: 9000, vat_amount: 1620, is_test: true }),
    doc({ id: "i", issue_date: "2026-09-02", subtotal: 9000, vat_amount: 1620, status: "DRAFT" }),
    doc({ id: "j", issue_date: "2026-09-03", subtotal: 7800, vat_amount: 1404, doc_type: "INVOICE_RECEIPT", customer_id: "c2" }),
  ];
  const g = allocationGaps(docs, cust);
  assert.deepEqual(g.map((x) => x.doc.id), ["a", "j"]);
  assert.equal(g[0].customerHasTaxId, true);
  assert.equal(g[1].customerHasTaxId, false);
  assert.equal(g[0].threshold, 5000);
});
t("trust account lock: any movement or any statement freezes the account details", () => {
  assert.deepEqual(trustAccountLock("a1", [], []), { locked: false, movements: 0, statements: 0 });
  assert.deepEqual(trustAccountLock("a1", [tx({}), tx({ id: 2 }), tx({ id: 3, trust_account_id: "a2" })], []), { locked: true, movements: 2, statements: 0 });
  assert.deepEqual(trustAccountLock("a1", [], ["a1", "a2"]), { locked: true, movements: 0, statements: 1 });
  assert.equal(trustAccountLock("a3", [tx({})], ["a1"]).locked, false);
});
t("allocation number is shown as the nine digits printed on the invoice", () => {
  assert.equal(allocationShort("20261001122751850274098390"), "274098390");
  assert.equal(allocationShort("20260901210815880244089603"), "244089603");
  assert.equal(allocationShort("245073463"), "245073463");
  assert.equal(allocationShort(null), "");
});
t("income report total follows the stored document total, so a rounding line is not lost", () => {
  const a = arch({ i4u_doc_type: 3, subtotal: 22087.5, vat_amount: 3975.75, total: 26063, issue_date: "2026-09-30" });
  const c = arch({ id: "y", i4u_doc_id: "y", i4u_doc_type: 4, doc_number: 2, subtotal: 22087.29, vat_amount: 3975.71, total: 26063, issue_date: "2026-09-30" });
  const rows = incomeRows([], [a, c], [], { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(rows.map((r) => r.total), [26063, -26063]);
  assert.deepEqual(rows.map((r) => r.net), [22087.5, -22087.29]);
});
console.log("\nAll finance checks passed");
