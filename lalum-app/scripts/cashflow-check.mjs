// Checks the 13 week direct cash forecast and the what-if scenarios.
// Run with: npm run cashflow-check
import assert from "node:assert/strict";
import { weekEndings, fridayOnOrAfter, itemDates, manualToItems, monthlyToWeekly, planInflows, applyScenario, buildForecast, compareToBase, LATE_PUSH_DAYS } from "../src/lib/cockpit/cashFlow.ts";
import { addDays } from "../src/lib/cockpit/arAging.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const TODAY = "2026-10-14"; // a Wednesday
const ACC = { basis: "ACCRUAL" }; // these cases are written on invoices; the cash basis is covered at the end
const S = { openingBalance: 100000, creditFacility: 200000, safetyReserve: 50000 };
const cust = (id, name) => ({ id, name, is_collections_locked: false });
const customers = [cust("c1", "אלפא"), cust("c2", "בטא"), cust("c3", "גמא")];
const inv = (o) => ({
  id: "i", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", subtotal: 0, vat_amount: 0, total: 1000,
  issue_date: "2026-10-05", due_date: "2026-11-04", related_doc_id: null, doc_number: 1, is_test: false, ...o,
});
const pay = (id, document_id, paid_on, amount) => ({ id, document_id, customer_id: "c1", paid_on, amount });
// three settled invoices for c1, each paid 45 days after issue, so c1's own DSO is 45
const history = [
  inv({ id: "h1", issue_date: "2026-06-01", due_date: "2026-07-01", total: 1000 }),
  inv({ id: "h2", issue_date: "2026-06-10", due_date: "2026-07-10", total: 1000 }),
  inv({ id: "h3", issue_date: "2026-06-20", due_date: "2026-07-20", total: 1000 }),
];
const historyPays = [pay("p1", "h1", "2026-07-16", 1000), pay("p2", "h2", "2026-07-25", 1000), pay("p3", "h3", "2026-08-04", 1000)];
const none = (weeks) => weeks.map((w) => w.invoiceInflows);

t("13 weeks, every one ending on a Friday, the first on or after today", () => {
  const w = weekEndings(TODAY);
  assert.equal(w.length, 13); assert.equal(w[0], "2026-10-16"); assert.equal(w[12], "2027-01-08");
  for (const d of w) assert.equal(new Date(d + "T00:00:00Z").getUTCDay(), 5);
  assert.equal(fridayOnOrAfter("2026-10-16"), "2026-10-16");
});
t("an invoice with a 45 day client DSO lands in the 45 day Friday, not the 30 day due date Friday", () => {
  const open = inv({ id: "open", issue_date: "2026-10-05", due_date: "2026-11-04", total: 2360 });
  const plan = planInflows(customers, [...history, open], historyPays, TODAY, ACC);
  const f = plan.inflows.find((i) => i.documentId === "open");
  assert.equal(f.expectedOn, "2026-11-19"); assert.equal(f.basis, "CUSTOMER_DSO");
  const fc = buildForecast(plan.inflows, [], S, TODAY);
  const landed = fc.weeks.find((w) => w.invoiceInflows === 2360);
  assert.equal(landed.weekEnding, fridayOnOrAfter("2026-11-19"));
  assert.notEqual(landed.weekEnding, fridayOnOrAfter("2026-11-04"));
  assert.equal(fc.weeks.filter((w) => w.invoiceInflows > 0).length, 1);
});
t("without enough history the firm DSO, then the invoice's own term, is used", () => {
  const open = inv({ id: "open", customer_id: "c2", issue_date: "2026-10-05", due_date: "2026-11-04", total: 500 });
  const withFirm = planInflows(customers, [...history, open], historyPays, TODAY, ACC).inflows.find((i) => i.documentId === "open");
  assert.equal(withFirm.basis, "FIRM_DSO"); assert.equal(withFirm.expectedOn, "2026-11-19");
  const alone = planInflows(customers, [open], [], TODAY, ACC).inflows[0];
  assert.equal(alone.basis, "TERMS"); assert.equal(alone.expectedOn, "2026-11-04");
});
t("pro forma, draft and test documents (and so any deposit request) never become inflows", () => {
  const docs = [inv({ id: "a", doc_type: "PROFORMA", total: 640000 }), inv({ id: "b", status: "DRAFT", total: 5000 }), inv({ id: "c", is_test: true, total: 7000 })];
  const plan = planInflows(customers, docs, [], TODAY, ACC);
  assert.equal(plan.inflows.length, 0);
  assert.deepEqual(none(buildForecast(plan.inflows, [], S, TODAY).weeks), Array(13).fill(0));
});
t("an expected date already in the past is pushed to today plus the late push, never into the past", () => {
  const late = inv({ id: "l", issue_date: "2026-08-01", due_date: "2026-08-31", total: 800 });
  const f = planInflows(customers, [late], [], TODAY, ACC).inflows[0];
  assert.equal(f.expectedOn, addDays(TODAY, LATE_PUSH_DAYS));
});
t("an invoice more than 90 days past due is left out and reported", () => {
  const dead = inv({ id: "d", issue_date: "2026-05-01", due_date: "2026-06-01", total: 900 });
  const plan = planInflows(customers, [dead], [], TODAY, ACC);
  assert.equal(plan.inflows.length, 0); assert.equal(plan.excludedTotal, 900); assert.equal(plan.excluded[0].daysPastDue, 135);
});
t("rent on the 1st, payroll on the 1st and 9th, VAT on the 15th; day 31 clamps to the month's end", () => {
  const it = (day) => ({ id: "x", label: "x", direction: "OUT", schedule: "MONTHLY", day_of_month: day, on_date: null, amount: 1, active: true });
  assert.deepEqual(itemDates(it(15), "2026-10-14", "2027-01-08"), ["2026-10-15", "2026-11-15", "2026-12-15"]);
  assert.deepEqual(itemDates(it(1), "2026-10-14", "2027-01-08"), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.deepEqual(itemDates(it(31), "2026-10-14", "2027-03-01"), ["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
  assert.deepEqual(itemDates({ ...it(1), active: false }, "2026-10-14", "2027-01-08"), []);
});
t("ending cash of every week is the starting cash of the next, and the chain adds up", () => {
  const items = [
    { id: "r", label: "שכר", direction: "OUT", schedule: "MONTHLY", day_of_month: 9, on_date: null, amount: 30000, active: true },
    { id: "v", label: "מעמ", direction: "OUT", schedule: "MONTHLY", day_of_month: 15, on_date: null, amount: 12000, active: true },
  ];
  const open = inv({ id: "open", total: 40000 });
  const fc = buildForecast(planInflows(customers, [...history, open], historyPays, TODAY, ACC).inflows, items, S, TODAY);
  for (let k = 1; k < 13; k++) assert.equal(fc.weeks[k].startingCash, fc.weeks[k - 1].endingCash);
  assert.equal(fc.weeks[0].startingCash, S.openingBalance);
  const sumNet = fc.weeks.reduce((a, w) => a + w.net, 0);
  assert.equal(Math.round((S.openingBalance + sumNet) * 100), Math.round(fc.finalEnding * 100));
  assert.equal(fc.weeks[0].liquidity, fc.weeks[0].endingCash + S.creditFacility);
});
t("the safety reserve: a week ending below it is flagged, and the trough is found", () => {
  const items = [{ id: "o", label: "הלוואה", direction: "OUT", schedule: "ONCE", day_of_month: null, on_date: "2026-10-30", amount: 80000, active: true }];
  const fc = buildForecast([], items, S, TODAY);
  assert.equal(fc.minWeek, 3); assert.equal(fc.minEnding, 20000); assert.ok(fc.weeks[2].belowReserve);
  assert.equal(fc.weeksBelowReserve, 11); assert.equal(fc.weeks[1].belowReserve, false);
});
t("delaying the top two clients 30 days lowers the early week and raises a later one", () => {
  const docs = [
    ...history,
    inv({ id: "a", customer_id: "c1", issue_date: "2026-09-20", due_date: "2026-10-20", total: 50000 }),
    inv({ id: "b", customer_id: "c2", issue_date: "2026-09-20", due_date: "2026-10-20", total: 40000 }),
    inv({ id: "c", customer_id: "c3", issue_date: "2026-09-20", due_date: "2026-10-20", total: 1000 }),
  ];
  const plan = planInflows(customers, docs, historyPays, TODAY, ACC);
  const base = buildForecast(plan.inflows, [], S, TODAY);
  const sc = applyScenario(plan.inflows, { kind: "DELAY_TOP_CLIENTS", clients: 2, days: 30 }, TODAY);
  const sim = buildForecast(sc.inflows, [], S, TODAY, sc.extra);
  const firstBase = base.weeks.findIndex((w) => w.invoiceInflows >= 40000);
  assert.ok(firstBase >= 0);
  assert.ok(sim.weeks[firstBase].endingCash < base.weeks[firstBase].endingCash);
  assert.ok(sim.weeks.some((w, i) => i > firstBase && w.invoiceInflows >= 40000));
  assert.ok(compareToBase(base, sim).minEndingDelta <= 0);
});
t("a firm wide delay never changes the total collected, only when", () => {
  const docs = [...history, inv({ id: "a", total: 20000 })];
  const plan = planInflows(customers, docs, historyPays, TODAY, ACC);
  const shifted = applyScenario(plan.inflows, { kind: "FIRM_DSO_SHOCK", days: 14 }, TODAY);
  const sum = (l) => l.reduce((a, i) => a + i.balance, 0);
  assert.equal(sum(shifted.inflows), sum(plan.inflows));
});
t("a windfall lands in the chosen week and lifts every week after it by that amount", () => {
  const base = buildForecast([], [], S, TODAY);
  const sc = applyScenario([], { kind: "WINDFALL", amount: 150000, weekNumber: 6 }, TODAY);
  const sim = buildForecast(sc.inflows, [], S, TODAY, sc.extra);
  assert.equal(sim.weeks[5].otherInflows, 150000); assert.equal(sim.weeks[4].endingCash, base.weeks[4].endingCash);
  assert.equal(sim.weeks[6].endingCash - base.weeks[6].endingCash, 150000);
  assert.equal(compareToBase(base, sim).finalEndingDelta, 150000);
});
t("running a scenario never changes the base data", () => {
  const docs = Object.freeze([...history, inv({ id: "a", total: 20000 })].map((d) => Object.freeze({ ...d })));
  const plan = planInflows(customers, docs, historyPays, TODAY, ACC);
  const snapshot = JSON.stringify(plan.inflows);
  const sc = applyScenario(plan.inflows, { kind: "DELAY_TOP_CLIENTS", clients: 2, days: 30 }, TODAY);
  buildForecast(sc.inflows, [], S, TODAY, sc.extra);
  assert.equal(JSON.stringify(plan.inflows), snapshot);
  assert.notEqual(sc.inflows, plan.inflows);
});
t("money expected after the last Friday is reported, not silently counted", () => {
  const far = [{ documentId: "z", customerId: "c1", customerName: "x", balance: 700, expectedOn: "2027-03-01", basis: "TERMS" }];
  const fc = buildForecast(far, [], S, TODAY);
  assert.equal(fc.beyondHorizon, 700); assert.equal(fc.finalEnding, S.openingBalance);
});
t("the manual plan feeds outflows, but its collections row is never counted a second time", () => {
  const rows = [
    { week_ending: "2026-10-16", category: "INFLOW_COLLECTIONS", projected_amount: 999999 },
    { week_ending: "2026-10-16", category: "OUTFLOW_PAYROLL", projected_amount: 30000 },
    { week_ending: "2026-10-23", category: "INFLOW_RETAINER", projected_amount: 5000 },
    { week_ending: "2026-10-23", category: "OUTFLOW_RENT_OFFICE", projected_amount: 0 },
  ];
  const items = manualToItems(rows);
  assert.equal(items.length, 2);
  const fc = buildForecast([], items, S, TODAY);
  assert.equal(fc.weeks[0].outflows, 30000); assert.equal(fc.weeks[0].invoiceInflows, 0); assert.equal(fc.weeks[1].otherInflows, 5000);
  assert.equal(fc.weeks[0].endingCash, 70000);
});
t("monthly payroll on the 1st and 9th is spread into the right Fridays", () => {
  const m = monthlyToWeekly(1000, [1, 9], TODAY);
  assert.equal(m.size, 13);
  assert.equal(m.get("2026-11-06"), 1000); // the 1st of November is a Sunday, so its Friday is the 6th
  assert.equal(m.get("2026-11-13"), 1000); // the 9th is a Monday, so its Friday is the 13th
  assert.equal([...m.values()].reduce((a, b) => a + b, 0), 5000); // Nov 1 and 9, Dec 1 and 9, Jan 1. Jan 9 is after the horizon, Oct 1 and 9 are past
});
t("cash basis: an open pro forma is the inflow, placed by the customer's DSO measured pro forma to closing document", () => {
  const pf = (o) => inv({ doc_type: "PROFORMA", status: "ISSUED", source_proforma_id: null, ...o });
  const closer = (id, src, on) => inv({ id, doc_type: "INVOICE_RECEIPT", status: "ISSUED", source_proforma_id: src, issue_date: on });
  const hist = ["a", "b", "c"].map((k, i) => pf({ id: "p" + k, issue_date: `2026-06-0${i + 1}`, total: 1000 }));
  const closers = hist.map((h, i) => closer("c" + i, h.id, `2026-07-1${i + 1}`)); // each closed about 40 days after issue
  const open = pf({ id: "openpf", issue_date: "2026-10-05", due_date: "2026-11-04", total: 3000 });
  const plan = planInflows(customers, [...hist, ...closers, open, inv({ id: "taxinv", total: 8888 })], [], TODAY, { basis: "CASH" });
  assert.equal(plan.inflows.length, 1); assert.equal(plan.inflows[0].documentId, "openpf"); assert.equal(plan.inflows[0].balance, 3000);
  assert.equal(plan.inflows[0].basis, "CUSTOMER_DSO");
  assert.equal(plan.inflows[0].expectedOn, addDays("2026-10-05", 40));
});
