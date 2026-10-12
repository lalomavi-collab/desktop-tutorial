// Checks receivables aging (from the due date), historical DSO and the reminder rules.
// Run with: npm run ar-aging-check
import assert from "node:assert/strict";
import { receivablesAging } from "../src/lib/cockpit/financeReports.ts";
import { bucketOf, agingReport, settlementDate, computeDso, tierFor, cooldownState, reminderBlock, daysBetween, addDays, LOCK_AFTER_DAYS, overrideActive } from "../src/lib/cockpit/arAging.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const TODAY = "2026-10-14";
const cust = (o) => ({ id: "c1", name: "לקוח א", is_collections_locked: false, collections_lock_reason: null, ...o });
const inv = (o) => ({
  id: "i1", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", subtotal: 1000, vat_amount: 180, total: 1000,
  issue_date: "2026-09-01", due_date: "2026-10-01", related_doc_id: null, doc_number: 1, is_test: false, ...o,
});
const pay = (o) => ({ id: "p1", document_id: "i1", customer_id: "c1", paid_on: "2026-10-01", amount: 100, ...o });
const only = (docs, pays = [], customers = [cust({})]) => agingReport(customers, docs, pays, TODAY, "ACCRUAL");

t("bucket boundaries: 30 is current, 31 and 60 are one bucket, 61 and 90, 91 is critical", () => {
  assert.equal(bucketOf(-10), "CURRENT"); assert.equal(bucketOf(30), "CURRENT");
  assert.equal(bucketOf(31), "D31_60"); assert.equal(bucketOf(60), "D31_60");
  assert.equal(bucketOf(61), "D61_90"); assert.equal(bucketOf(90), "D61_90");
  assert.equal(bucketOf(91), "D90_PLUS");
});
t("aging runs from the due date, not the issue date", () => {
  const r = only([inv({ issue_date: "2026-06-01", due_date: addDays(TODAY, -20) })]);
  assert.equal(r.customers[0].rows[0].daysPastDue, 20);
  assert.equal(r.totals.CURRENT, 1000);
});
t("an invoice with no due date is due on its issue date", () => {
  const r = only([inv({ issue_date: addDays(TODAY, -45), due_date: null })]);
  assert.equal(r.customers[0].rows[0].daysPastDue, 45);
  assert.equal(r.totals.D31_60, 1000);
});
t("invoices are partitioned into the right buckets and totals add up", () => {
  const mk = (id, past) => inv({ id, due_date: addDays(TODAY, -past), total: 100 });
  const r = only([mk("a", 10), mk("b", 40), mk("c", 70), mk("d", 120)]);
  assert.deepEqual(r.totals, { CURRENT: 100, D31_60: 100, D61_90: 100, D90_PLUS: 100 });
  assert.equal(r.total, 400);
});
t("payments and receipts reduce the open balance; a paid invoice drops out", () => {
  const r = only([inv({ due_date: addDays(TODAY, -40) })], [pay({ amount: 400 })]);
  assert.equal(r.customers[0].total, 600);
  const full = only([inv({ due_date: addDays(TODAY, -40) })], [pay({ amount: 1000 })]);
  assert.equal(full.customers.length, 0);
});
t("pro forma, draft and test documents are never receivables", () => {
  const r = only([inv({ id: "a", doc_type: "PROFORMA" }), inv({ id: "b", status: "DRAFT" }), inv({ id: "c", is_test: true })]);
  assert.equal(r.total, 0);
});
t("billing lock candidate: open balance more than 60 days past due, not before", () => {
  assert.equal(LOCK_AFTER_DAYS, 60);
  assert.equal(only([inv({ due_date: addDays(TODAY, -60) })]).customers[0].shouldLock, false);
  const c = only([inv({ due_date: addDays(TODAY, -61) })]).customers[0];
  assert.equal(c.shouldLock, true); assert.equal(c.overdueOver60, 1000);
});
t("the stored lock and its reason travel with the customer", () => {
  const c = only([inv({})], [], [cust({ is_collections_locked: true, collections_lock_reason: "הסדר פורר" })]).customers[0];
  assert.equal(c.locked, true); assert.equal(c.lockReason, "הסדר פורר");
});
t("not yet due is reported apart from overdue", () => {
  const r = only([inv({ due_date: addDays(TODAY, 10) })]);
  assert.equal(r.notYetDue, 1000); assert.equal(r.totals.CURRENT, 1000);
});

t("settlement date: the day payments and receipts together reach the amount owed", () => {
  const i = inv({ total: 1000 });
  const r1 = { id: "r1", customer_id: "c1", doc_type: "RECEIPT", status: "ISSUED", is_test: false, related_doc_id: "i1", total: 400, issue_date: "2026-09-20" };
  assert.equal(settlementDate(i, [i, r1], [pay({ paid_on: "2026-09-25", amount: 600 })], "ACCRUAL"), "2026-09-25");
  assert.equal(settlementDate(i, [i, r1], [pay({ paid_on: "2026-09-25", amount: 500 })], "ACCRUAL"), null);
});
t("a credit lowers the target, so a smaller payment still settles it", () => {
  const i = inv({ total: 1000 });
  const cr = { id: "k", customer_id: "c1", doc_type: "CREDIT", status: "ISSUED", is_test: false, related_doc_id: "i1", total: 300, issue_date: "2026-09-10" };
  assert.equal(settlementDate(i, [i, cr], [pay({ paid_on: "2026-09-30", amount: 700 })], "ACCRUAL"), "2026-09-30");
});
t("DSO is the amount weighted lag, over the last year only, and ignores INVOICE_RECEIPT", () => {
  const a = inv({ id: "a", issue_date: "2026-06-01", total: 1000 }), b = inv({ id: "b", issue_date: "2026-06-01", total: 3000 });
  const old = inv({ id: "o", issue_date: "2024-01-01", total: 9999 });
  const ir = inv({ id: "ir", doc_type: "INVOICE_RECEIPT", issue_date: "2026-06-01", total: 5000 });
  const pays = [
    pay({ id: "pa", document_id: "a", paid_on: "2026-06-21", amount: 1000 }),   // 20 days
    pay({ id: "pb", document_id: "b", paid_on: "2026-07-31", amount: 3000 }),   // 60 days
    pay({ id: "po", document_id: "o", paid_on: "2024-03-01", amount: 9999 }),   // outside the window
  ];
  const d = computeDso([a, b, old, ir], pays, TODAY, "c1", "ACCRUAL");
  assert.equal(d.sample, 2); assert.equal(d.days, 50);                           // (20*1000 + 60*3000) / 4000
  assert.deepEqual(computeDso([], [], TODAY, "c1", "ACCRUAL"), { days: null, sample: 0 });
});

t("reminder tiers follow days past due: 31 to 60, 61 to 90, over 90, none under 31", () => {
  assert.equal(tierFor(30), null); assert.equal(tierFor(31), 1); assert.equal(tierFor(60), 1);
  assert.equal(tierFor(61), 2); assert.equal(tierFor(90), 2); assert.equal(tierFor(91), 3);
});
t("cooldown: a second reminder inside 7 days is blocked, on day 7 it is allowed", () => {
  assert.deepEqual(cooldownState(null, TODAY), { active: false, daysLeft: 0 });
  assert.deepEqual(cooldownState(addDays(TODAY, -1), TODAY), { active: true, daysLeft: 6 });
  assert.deepEqual(cooldownState(TODAY, TODAY), { active: true, daysLeft: 7 });
  assert.equal(cooldownState(addDays(TODAY, -6), TODAY).active, true);
  assert.equal(cooldownState(addDays(TODAY, -7), TODAY).active, false);
});
t("reminderBlock: nothing is due under 31 days; cooldown blocks otherwise", () => {
  assert.equal(reminderBlock(20, null, TODAY), "NOT_DUE_YET");
  assert.equal(reminderBlock(45, addDays(TODAY, -3), TODAY), "COOLDOWN");
  assert.equal(reminderBlock(45, addDays(TODAY, -8), TODAY), null);
});
t("date helpers", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-14"), 13);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});
t("the collections aging agrees with the Reports tab aging on the same data", () => {
  const mk = (id, past, total) => inv({ id, customer_id: id.startsWith("x") ? "c2" : "c1", due_date: addDays(TODAY, -past), total });
  const docs = [mk("a", -5, 70), mk("b", 10, 100), mk("c", 40, 200), mk("d", 70, 300), mk("xe", 120, 400), mk("xf", 31, 50)];
  const custs = [cust({}), cust({ id: "c2", name: "לקוח ב" })];
  const mine = agingReport(custs, docs, [], TODAY, "ACCRUAL").totals;
  const theirs = receivablesAging(docs, [], custs, TODAY, "ACCRUAL").totals;
  assert.equal(mine.CURRENT, theirs[0] + theirs[1]);
  assert.equal(mine.D31_60, theirs[2]); assert.equal(mine.D61_90, theirs[3]); assert.equal(mine.D90_PLUS, theirs[4]);
});
t("a partner override is in force through its last day, then the lock applies again", () => {
  assert.equal(overrideActive(null, TODAY), false); assert.equal(overrideActive(undefined, TODAY), false);
  assert.equal(overrideActive(addDays(TODAY, -1), TODAY), false);
  assert.equal(overrideActive(TODAY, TODAY), true); assert.equal(overrideActive(addDays(TODAY, 5), TODAY), true);
});
t("aging reports an active override on the customer and drops an expired one", () => {
  const live = only([inv({})], [], [cust({ is_collections_locked: true, collections_override_until: addDays(TODAY, 3) })]).customers[0];
  assert.equal(live.overrideUntil, addDays(TODAY, 3));
  const gone = only([inv({})], [], [cust({ is_collections_locked: true, collections_override_until: addDays(TODAY, -1) })]).customers[0];
  assert.equal(gone.overrideUntil, null);
});

// ---- cash basis: the practice's own accounting basis, where the debt is an open pro forma ----
const pf = (o) => inv({ id: "pf", doc_type: "PROFORMA", status: "ISSUED", total: 500, source_proforma_id: null, ...o });
const closer = (o) => inv({ id: "cl", doc_type: "INVOICE_RECEIPT", status: "ISSUED", total: 500, source_proforma_id: "pf", issue_date: addDays(TODAY, -3), ...o });
const cashOnly = (docs, customers = [cust({})]) => agingReport(customers, docs, [], TODAY, "CASH");
t("cash basis: an open pro forma is the debt, an issued tax invoice is not", () => {
  const r = cashOnly([pf({ due_date: addDays(TODAY, -40) }), inv({ id: "tax", due_date: addDays(TODAY, -40), total: 9999 })]);
  assert.equal(r.total, 500); assert.equal(r.totals.D31_60, 500);
});
t("cash basis: a pro forma closed by an issued document stops being a debt; a draft closer does not close it", () => {
  assert.equal(cashOnly([pf({}), closer({})]).total, 0);
  assert.equal(cashOnly([pf({}), closer({ status: "DRAFT" })]).total, 500);
});
t("cash basis: draft and test pro formas are never debt", () => {
  assert.equal(cashOnly([pf({ status: "DRAFT" }), pf({ id: "pt", is_test: true })]).total, 0);
});
t("cash basis: DSO is the days from the pro forma to the document that closed it", () => {
  const docs = [pf({ issue_date: addDays(TODAY, -33) }), closer({})];
  assert.equal(settlementDate(docs[0], docs, [], "CASH"), addDays(TODAY, -3));
  const d = computeDso(docs, [], TODAY, "c1", "CASH");
  assert.equal(d.sample, 1); assert.equal(d.days, 30);
  assert.equal(settlementDate(inv({}), [inv({})], [], "CASH"), null);
});
t("the collections aging agrees with the Reports tab aging on the cash basis too", () => {
  const docs = [pf({ id: "a", due_date: addDays(TODAY, -5), total: 70 }), pf({ id: "b", due_date: addDays(TODAY, -45), total: 100 }), pf({ id: "c", due_date: addDays(TODAY, -100), total: 300 })];
  const mine = agingReport([cust({})], docs, [], TODAY, "CASH").totals, theirs = receivablesAging(docs, [], [cust({})], TODAY, "CASH").totals;
  assert.equal(mine.CURRENT, theirs[0] + theirs[1]); assert.equal(mine.D31_60, theirs[2]); assert.equal(mine.D61_90, theirs[3]); assert.equal(mine.D90_PLUS, theirs[4]);
});
