// Checks the client mirror of lalum_fin_totals and the report rules.
// Run with: npm run finance-check
import assert from "node:assert/strict";
import { incomeRows, incomeByKind, revenueByCustomer, receivablesAging, toCsv, incomeHtml, revenueBuckets, weekStart } from "../src/lib/cockpit/financeReports.ts";
import { isShekel, computeTotals, draftProblems, openBalance, summarize, monthPeriod, recoverableVat, numberingGaps, formatRanges, archiveSummary, archiveRevenueEffect, splitName, customerProblems, customerGaps, isMobile, CASUAL_TYPES, closedBy, isOpenProforma, trustHeld, trustBreakdown, maskAccount, trustPostProblems, canReverse, trustAccountProblems, trustCloseProblem, reconState, statementProblems, statementCorrectionProblems, trustValueDate, trustHeldAsOf, valueDateProblems, trustAccountLock, trustHealth, reconHealth, healthSummary, trustFlowCoverage, trustNetSince, sharePct } from "../src/lib/cockpit/finance.ts";

import { expenseBuckets, missingBills } from "../src/lib/cockpit/financeExpenses.ts";
import { parseDelimited, mapCustomers } from "../src/lib/cockpit/customerImport.ts";
import { ilIdOk, addressOn } from "../src/lib/cockpit/businessProfileCore.ts";
import { allocationThreshold, allocationGaps, allocationShort, allocationAuthStatus } from "../src/lib/cockpit/financeAllocation.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const doc = (o) => ({
  id: "d1", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", tax_included: false, vat_rate: 18,
  lines: [], subtotal: 1000, vat_amount: 180, total: 1180, issue_date: "2026-10-05", due_date: null, payment_method: null,
  payment_ref: null, related_doc_id: null, send_email: false, doc_number: 1, i4u_doc_id: null, allocation_number: null, pdf_url: null,
  is_test: false, last_error: null, issued_at: null, ...o,
});
const exp = (o) => ({ id: "e1", spent_on: "2026-10-03", supplier: "x", category: "OTHER", description: null, total: 118, vat_amount: 18, vat_recoverable_pct: 100, supplier_doc_ref: null, payment_method: null, ...o });

t("a pasted customer list: tabs from Excel, quoted commas, a header row, duplicates and bad rows marked", () => {
  const pasted = "שם\tת.ז. / ח.פ.\tדוא\"ל\tטלפון\nדנה כהן\t123-456-789\tdana@example.com\t501234567\n\"כהן, לוי בע\"\"מ\"\t514000000\t\t\nדנה כהן\t123456789\t\t\nאבי\t12\tnot-an-email\t";
  const r = mapCustomers(parseDelimited(pasted), [{ name: "קיים", tax_id: "514000000" }]);
  assert.equal(r.usedHeader, true);
  assert.deepEqual(r.rows.map((x) => x.status), ["new", "duplicate", "duplicate", "invalid"]);
  assert.equal(r.rows[0].tax_id, "123456789");
  assert.equal(r.rows[0].phone, "0501234567");
  assert.equal(r.rows[1].name, "כהן, לוי בע\"מ");
  assert.deepEqual(r.rows[0].gaps, []);
  assert.ok(r.rows[3].problems.length >= 2);
});
t("a list without a header is read as name, tax id, email, phone, address, city; commas and semicolons both work", () => {
  const a = mapCustomers(parseDelimited("רונית, 300000001, ronit@example.com, 052-1111111, הרצל 5, חיפה"), []);
  assert.equal(a.usedHeader, false);
  assert.deepEqual([a.rows[0].name, a.rows[0].city, a.rows[0].status], ["רונית", "חיפה", "new"]);
  const b = mapCustomers(parseDelimited("משה;300000002;moshe@example.com"), []);
  assert.equal(b.rows[0].email, "moshe@example.com");
  assert.deepEqual(b.rows[0].gaps, []);
  assert.deepEqual(mapCustomers(parseDelimited(""), []).rows, []);
});
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
  const NO_EMAIL = 'כתובת דוא"ל חובה: כל מסמך נשלח ללקוח אוטומטית בעת ההפקה';
  assert.ok(customerProblems(cf({ email: "not-an-email" })).includes('כתובת הדוא"ל אינה תקינה'));
  assert.ok(customerProblems(cf({ email: "" })).includes(NO_EMAIL));
  // Every document is sent to the customer by itself, so an address is required for a casual customer and for an edited card too.
  assert.deepEqual(customerProblems(cf({ email: "", casual: true })), [NO_EMAIL]);
  assert.ok(customerProblems(cf({ name: " ", casual: true })).includes("שם הלקוח חובה"));
  assert.deepEqual(customerProblems(cf({ email: "", isNew: false })), [NO_EMAIL]);
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
  // A casual customer has no tax id to complete, but still needs an address to receive the document.
  assert.deepEqual(customerGaps({ email: null, tax_id: null, is_casual: true }), ['דוא"ל']);
  assert.deepEqual(customerGaps({ email: "a@b.co", tax_id: null, is_casual: true }), []);
  // WhatsApp is preferred, never required: a missing mobile or consent is listed, only when the caller passes the phone fields.
  const wa = { email: "a@b.co", tax_id: "123456789", is_casual: false };
  assert.deepEqual(customerGaps({ ...wa, phone: null, whatsapp_consent_at: null, whatsapp_consent_revoked_at: null }), ["נייד ל-WhatsApp"]);
  assert.deepEqual(customerGaps({ ...wa, phone: "03-1234567", whatsapp_consent_at: null, whatsapp_consent_revoked_at: null }), ["נייד ל-WhatsApp"]);
  assert.deepEqual(customerGaps({ ...wa, phone: "052-1234567", whatsapp_consent_at: null, whatsapp_consent_revoked_at: null }), ["הסכמה ל-WhatsApp"]);
  assert.deepEqual(customerGaps({ ...wa, phone: "052-1234567", whatsapp_consent_at: "2026-10-01T00:00:00Z", whatsapp_consent_revoked_at: "2026-10-02T00:00:00Z" }), ["הסכמה ל-WhatsApp"]);
  assert.deepEqual(customerGaps({ ...wa, phone: "+972 52 123 4567", whatsapp_consent_at: "2026-10-01T00:00:00Z", whatsapp_consent_revoked_at: null }), []);
  assert.ok(isMobile("0521234567") && isMobile("00972521234567") && !isMobile("031234567") && !isMobile(null));
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
  assert.equal(m.lastVsPrevious.last.label, "ספט׳"); assert.equal(m.lastVsPrevious.pct, 0); assert.equal(m.lastVsPrevious.delta, 0);
  // since January: every completed month counts, an empty month as zero (Jan to Sep = 9 months, 20000 in total), the running October stays out
  assert.equal(m.sinceJanuary.months, 9); assert.equal(m.sinceJanuary.first.label, "ינו׳"); assert.equal(m.sinceJanuary.lastDone.label, "ספט׳");
  assert.equal(m.sinceJanuary.average, 2222.22); assert.equal(m.sinceJanuary.delta, 7777.78); assert.equal(m.sinceJanuary.pct, 350);
  assert.equal(revenueBuckets(rows, "week", 2026, "2026-10-12").sinceJanuary, null); assert.equal(revenueBuckets(rows, "year", 2026, "2026-10-12").sinceJanuary, null);
  assert.equal(revenueBuckets([], "month", 2026, "2026-10-12").sinceJanuary.pct, null); // no income at all: no percentage, no division by zero
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
  assert.ok(statementProblems({ ...ok, as_of: "2026-12-01" }, "2026-10-11", ex).includes("תאריך ערך לא יכול להיות עתידי"));
  assert.ok(statementProblems({ ...ok, balance: "abc" }, "2026-10-11", ex).includes("הזינו יתרה מספרית"));
  assert.ok(statementProblems({ ...ok, balance: "" }, "2026-10-11", ex).includes("הזינו יתרה מספרית"));
  assert.ok(statementProblems({ ...ok, as_of: "2026-09-30" }, "2026-10-11", ex).includes("כבר הוזן דף לחשבון הזה בתאריך ערך הזה"));
  assert.deepEqual(statementProblems({ ...ok, balance: "-20" }, "2026-10-11", ex), []);
  // a statement balance is dated by its value date: not before the account existed
  assert.ok(statementProblems({ ...ok, as_of: "2026-08-31" }, "2026-10-11", ex, "2026-09-01").includes("תאריך ערך מוקדם מפתיחת חשבון הנאמנות"));
  assert.deepEqual(statementProblems({ ...ok, as_of: "2026-09-01" }, "2026-10-11", ex, "2026-09-01"), []);
  assert.deepEqual(statementProblems({ ...ok, as_of: "2026-08-31" }, "2026-10-11", ex, null), []);
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
t("allocation authorization: warns three weeks before expiry and after it", () => {
  assert.deepEqual(allocationAuthStatus("2026-10-13", "2027-01-01"), { daysLeft: 80, warn: false });
  assert.deepEqual(allocationAuthStatus("2026-12-11", "2027-01-01"), { daysLeft: 21, warn: true });
  assert.deepEqual(allocationAuthStatus("2026-12-10", "2027-01-01"), { daysLeft: 22, warn: false });
  assert.deepEqual(allocationAuthStatus("2027-01-03", "2027-01-01"), { daysLeft: -2, warn: true });
  assert.equal(allocationAuthStatus("2027-01-03", null).warn, false);
});
t("Israeli id check: valid numbers pass, wrong length or check digit fail", () => {
  assert.equal(ilIdOk("031471261"), true);
  assert.equal(ilIdOk("516908704"), true);
  assert.equal(ilIdOk("031471262"), false);
  assert.equal(ilIdOk("0314717261"), false);
  assert.equal(ilIdOk("abcdefghi"), false);
});
t("business address by date and kind: the latest one that has started", () => {
  const list = [
    { kind: "FINANCE", validFrom: "2000-01-01", street: "A", houseNum: "1", city: "x", zip: "" },
    { kind: "PUBLIC", validFrom: "2000-01-01", street: "B", houseNum: "2", city: "y", zip: "" },
    { kind: "PUBLIC", validFrom: "2027-01-01", street: "C", houseNum: "3", city: "z", zip: "" },
  ];
  assert.equal(addressOn(list, "FINANCE", "2030-01-01").street, "A");
  assert.equal(addressOn(list, "PUBLIC", "2026-12-31").street, "B");
  assert.equal(addressOn(list, "PUBLIC", "2027-01-01").street, "C");
  assert.equal(addressOn(list, "PUBLIC", "1999-01-01"), null);
});
const hacc = (o) => ({ id: "a1", bank_name: "לאומי", branch: "800", account_number: "12345678", closed_on: null, opened_on: "2026-09-01", ...o });
const hm = [{ id: "m1", customer_id: "c1" }];
const st = (checks, id) => checks.find((c) => c.id === id)?.status;
t("health check: an empty ledger reports readiness only", () => {
  const c = trustHealth([], [hacc({})], hm, "2026-10-13");
  assert.equal(st(c, "setup-account"), "ok");
  assert.equal(st(c, "setup-matter"), "ok");
  assert.equal(st(c, "no-rows"), "info");
  assert.equal(st(trustHealth([], [], [], "2026-10-13"), "setup-account"), "fail");
});
t("health check: a clean ledger passes every check", () => {
  const rows = [tx({ id: 1, receipt_no: "TR-000001", amount: 1000, value_date: "2026-10-01" }),
    tx({ id: 2, receipt_no: "TR-000002", tx_type: "EARNED_FEE_TRANSFER", amount: -300, reference_doc_id: "d1", value_date: "2026-10-05" }),
    tx({ id: 3, receipt_no: "TR-000003", tx_type: "REFUND_TO_CLIENT", amount: -100, value_date: "2026-10-06" }),
    tx({ id: 4, receipt_no: "TR-000004", tx_type: "REVERSAL", amount: 100, reverses_entry_id: 3, value_date: "2026-10-06" })];
  const c = trustHealth(rows, [hacc({})], hm, "2026-10-13");
  assert.deepEqual(c.filter((x) => x.status === "fail"), []);
  assert.equal(healthSummary(c), "ok");
});
t("health check: it catches overdraft, a bad reversal, a missing invoice, receipt gaps and bad dates", () => {
  const rows = [tx({ id: 1, receipt_no: "TR-000001", amount: 100 }),
    tx({ id: 2, receipt_no: "TR-000004", tx_type: "DISBURSEMENT_TO_THIRD_PARTY", amount: -500, value_date: "2026-12-31" }),
    tx({ id: 3, receipt_no: "TR-000005", tx_type: "EARNED_FEE_TRANSFER", amount: -1, reference_doc_id: null }),
    tx({ id: 4, receipt_no: "TR-000006", tx_type: "REVERSAL", amount: 7, reverses_entry_id: 1, value_date: "2026-08-01" })];
  const c = trustHealth(rows, [hacc({})], hm, "2026-10-13");
  for (const id of ["overdraft-matter", "overdraft-account", "reversals", "fee-invoice", "receipts", "value-dates"]) assert.equal(st(c, id), "fail", id);
  assert.equal(healthSummary(c), "fail");
});
t("health check: a closed account must be empty and quiet", () => {
  const rows = [tx({ id: 1, receipt_no: "TR-000001", amount: 50, value_date: "2026-10-12" })];
  const c = trustHealth(rows, [hacc({ closed_on: "2026-10-10" })], hm, "2026-10-13");
  assert.equal(st(c, "closed-accounts"), "fail");
});
t("health check: reconciliation folds into the summary", () => {
  const r = (d) => ({ trust_account_id: "a1", bank_name: "x", branch: "1", account_number: "1234", ledger_balance: 0, statement_as_of: d == null ? null : "2026-10-01", statement_balance: d == null ? null : 0, difference_at_statement_date: d });
  assert.equal(reconHealth([r(0)])[0].status, "ok");
  assert.equal(reconHealth([r(null)])[0].status, "warn");
  assert.equal(reconHealth([r(5), r(null)])[0].status, "fail");
});
t("flow coverage: each stage turns on only when live data shows it was exercised", () => {
  const none = trustFlowCoverage([], [], []);
  assert.equal(none.length, 6);
  assert.ok(none.every((x) => !x.done));
  const rows = [tx({ id: 1 }), tx({ id: 2, tx_type: "REFUND_TO_CLIENT", amount: -5 }), tx({ id: 3, tx_type: "REVERSAL", amount: 5, reverses_entry_id: 2 })];
  const c = trustFlowCoverage(rows, [hacc({})], ["a1"]);
  assert.deepEqual(c.filter((x) => !x.done).map((x) => x.id), ["fee"]);
});
console.log("\nAll finance checks passed");

t("trust net movement since a date counts only rows recorded on or after it", () => {
  const rows = [{ amount: 100, created_at: "2026-09-01T10:00:00Z" }, { amount: 50, created_at: "2026-09-20T10:00:00Z" }, { amount: -30, created_at: "2026-09-25T10:00:00Z" }];
  assert.equal(trustNetSince(rows, "2026-09-15"), 20);
  assert.equal(trustNetSince(rows, "2026-09-20"), 20);
  assert.equal(trustNetSince(rows, "2026-10-01"), 0);
  assert.equal(trustNetSince(rows, "2026-01-01"), 120);
});

t("share percent is whole, clamped, and zero for a non-positive total", () => {
  assert.equal(sharePct(50, 200), 25);
  assert.equal(sharePct(1, 3), 33);
  assert.equal(sharePct(300, 200), 100);
  assert.equal(sharePct(-5, 200), 0);
  assert.equal(sharePct(10, 0), 0);
});

t("expense series: day, week, month and year buckets, before and with VAT, running period out of the average", () => {
  const rows = [exp({ id: "a", spent_on: "2026-10-03" }), exp({ id: "b", spent_on: "2026-10-03", total: 236, vat_amount: 36 }), exp({ id: "c", spent_on: "2026-09-10", category: "RENT", total: 590, vat_amount: 90 }), exp({ id: "d", spent_on: "2025-12-31" })];
  const d = expenseBuckets(rows, "day", 2026, "2026-10-05");
  assert.equal(d.buckets.length, 30);
  assert.equal(d.buckets[29].key, "2026-10-05");
  assert.equal(d.buckets.find((b) => b.key === "2026-10-03").amount, 300);
  assert.equal(expenseBuckets(rows, "day", 2026, "2026-10-05", "total").buckets.find((b) => b.key === "2026-10-03").amount, 354);
  const m = expenseBuckets(rows, "month", 2026, "2026-10-05");
  assert.equal(m.buckets.length, 12);
  assert.equal(m.amount, 800);
  assert.equal(m.buckets[9].amount, 300);
  assert.equal(m.buckets[9].future, false);
  assert.equal(m.buckets[10].future, true);
  assert.equal(m.average, 500);
  assert.equal(m.averageOver, 1);
  assert.equal(m.top.key, "2026-09");
  assert.equal(m.hasRunning, true);
  assert.equal(m.categories[0].category, "RENT");
  assert.equal(m.categories.reduce((a, c) => a + c.amount, 0), 800);
  const y = expenseBuckets(rows, "year", 2026, "2026-10-05");
  assert.equal(y.buckets.length, 5);
  assert.equal(y.buckets[3].amount, 100);
  assert.equal(expenseBuckets(rows, "week", 2026, "2026-10-05").buckets.length, 12);
  assert.equal(expenseBuckets([], "month", 2026, "2026-10-05").lastVsPrevious.pct, null);
});
t("a recurring supplier's missing bill is reported once its date and the grace days have passed; arnona and lookalikes are not checked", () => {
  const bills = (supplier, dates) => dates.map((d, i) => exp({ id: `${supplier}${i}`, supplier, spent_on: d }));
  const rows = [
    ...bills("סלקום אנרג'י", ["2026-02-21", "2026-03-21", "2026-04-21", "2026-05-18", "2026-06-18", "2026-07-18", "2026-08-18", "2026-09-18", "2026-10-18"]),
    ...bills("סלקום", ["2026-01-21", "2026-03-14", "2026-04-14", "2026-05-14", "2026-06-14", "2026-07-14", "2026-08-18", "2026-09-14"]),
    ...bills("סלקום ישראל", ["2026-10-14"]),
    ...bills("לינק ניהול תקשורת לעסקים", ["2026-01-04", "2026-02-03", "2026-03-03", "2026-05-03", "2026-06-03", "2026-08-03", "2026-09-03", "2026-10-04"]),
    ...bills("מי נתניה", ["2026-09-28"]),
    ...bills("דור חדש חומרי חשמל", ["2026-02-10"]),
    ...bills("עיריית נתניה, ארנונה", ["2026-01-01"]),
  ];
  const m = missingBills(rows, "2026-10-28");
  assert.deepEqual(m.map((x) => [x.key, x.missing.map((y) => y.expected), x.lapsed]), [
    ["cellcom", ["2026-02-14"], false],
    ["link", ["2026-04-03", "2026-07-03"], false],
  ]);
  assert.equal(m[1].missing[0].label, "אפר׳ 2026");
  // October's electricity bill is due on the 18th: on the 27th it is only late, on the 29th it is missing.
  const noOct = rows.filter((e) => !(e.supplier === "סלקום אנרג'י" && e.spent_on === "2026-10-18"));
  assert.equal(missingBills(noOct, "2026-10-27").some((x) => x.key === "electricity"), false);
  assert.deepEqual(missingBills(noOct, "2026-10-29").find((x) => x.key === "electricity").missing.map((y) => y.expected), ["2026-10-18"]);
  // A water bill every two months: the next one is not due until about 28 November.
  assert.equal(missingBills(rows, "2026-12-07").some((x) => x.key === "water"), false);
  assert.deepEqual(missingBills(rows, "2026-12-09").find((x) => x.key === "water").missing.map((y) => y.expected), ["2026-11-28"]);
  // A service that stopped: three misses in a row at the end read as possibly ended, and the rhythm runs on from December.
  const stopped = missingBills(bills("לינק ניהול תקשורת לעסקים", ["2025-12-03", "2026-01-03", "2026-02-03", "2026-03-03"]), "2026-07-01");
  assert.deepEqual(stopped[0].missing.map((y) => y.expected), ["2026-04-03", "2026-05-03", "2026-06-03"]);
  assert.equal(stopped[0].lapsed, true);
  assert.deepEqual(missingBills(bills("לינק ניהול תקשורת לעסקים", ["2025-12-03", "2026-03-03"]), "2026-03-20")[0].missing.map((y) => y.expected), ["2026-01-03", "2026-02-03"]);
  // A supplier the firm never used is not reported at all.
  assert.deepEqual(missingBills([], "2026-10-28"), []);
});
