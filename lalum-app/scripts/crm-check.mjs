// Checks the partner/matter/portal rules. Run with: npm run crm-check
import assert from "node:assert/strict";
import { summarizeTrust, trustBalance, wip, clientMessages, clientMilestones } from "../src/lib/cockpit/crm.ts";
import { calculateDeadline, VERIFIED_RULES } from "../src/lib/cockpit/deadlines.ts";
import { buildDemo } from "../src/lib/cockpit/crmDemo.ts";
import { partnerFinance } from "../src/lib/cockpit/crmFinanceCore.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const today = new Date(2026, 9, 10); // Saturday 10 Oct 2026
const d = buildDemo(today);

t("trust is a signed balance and WIP counts only unbilled time", () => {
  assert.equal(trustBalance(d.trust, "m1"), 12000);
  assert.equal(wip(d.time).hours, 10.75);
});
t("the client never receives internal messages or hidden milestones", () => {
  const msgs = clientMessages(d.messages);
  assert.equal(msgs.length, 2);
  assert.ok(msgs.every((m) => !("internal" in m)));
  assert.ok(clientMilestones(d.milestones).every((m) => m.clientVisible && m.kind !== "INTERNAL"));
  assert.equal(clientMilestones(d.milestones).length, 2);
});
t("deadline mechanics: plain count, freeze and roll forward (no legal values encoded)", () => {
  const base = { eventDate: "2026-01-01", days: 5, frozen: [], rollForward: false, closedWeekdays: [], closedDays: [], countEventDay: false };
  assert.equal(calculateDeadline(base).due, "2026-01-06");
  assert.equal(calculateDeadline({ ...base, countEventDay: true }).due, "2026-01-05");
  assert.equal(calculateDeadline({ ...base, frozen: [{ from: "2026-01-03", to: "2026-01-04", label: "x" }] }).due, "2026-01-08");
  assert.equal(calculateDeadline({ ...base, days: 2, rollForward: true, closedWeekdays: [6] }).due, "2026-01-04");
  assert.equal(VERIFIED_RULES.length, 0, "no rule may be added without two source verification");
});

t("trust summary: no account means no card, otherwise the signed ledger sum", () => {
  assert.deepEqual(summarizeTrust(0, []), { state: "none" });
  assert.deepEqual(summarizeTrust(0, [500]), { state: "none" });
  assert.deepEqual(summarizeTrust(2, []), { state: "ready", held: 0 });
  assert.deepEqual(summarizeTrust(1, [1000.1, 200.2, -300.3]), { state: "ready", held: 900 });
});

const rc = { id: "c1", name: "לקוח א", is_collections_locked: false, collections_lock_reason: null };
const rinv = (o) => ({ id: "i1", customer_id: "c1", doc_type: "PROFORMA", status: "ISSUED", source_proforma_id: null, subject: "", subtotal: 1000, vat_amount: 180, total: 1000, issue_date: "2026-08-01", due_date: "2026-09-01", related_doc_id: null, doc_number: 7, is_test: false, ...o });

t("partner figures come from the real engines: aging, overdue queue, collections", () => {
  const docs = [rinv({}), rinv({ id: "i2", doc_number: 8, issue_date: "2026-10-01", due_date: "2026-10-30" })];
  const pays = [{ id: "p1", document_id: "i1", customer_id: "c1", paid_on: "2026-10-05", amount: 400 }];
  // The practice works on the cash basis: what a customer owes is an open pro forma (a tax invoice is issued when money arrives).
  const r = partnerFinance([rc], docs, pays, { opening_balance: 80000, balance_as_of: "2026-10-01", credit_facility: 0, safety_reserve: 50000 }, [], "2026-10-14");
  assert.equal(r.aging.total, 2000); // an open pro forma counts whole on the cash basis, a part payment does not shrink it
  assert.equal(r.aging.notYetDue, 1000);
  assert.equal(r.overdue.length, 1);
  assert.equal(r.overdue[0].overdueDays, 43);
  assert.equal(r.overdue[0].open, 1000);
  assert.equal(r.collected30, 400);
  assert.equal(r.bankBalance, 80000);
  assert.equal(r.forecast.weeks.length, 13);
  assert.equal(r.forecast.opening, 80000);
});

t("partner figures: no settings row means no bank balance, and an empty ledger is all zeros", () => {
  const r = partnerFinance([], [], [], null, [], "2026-10-14");
  assert.equal(r.bankBalance, null);
  assert.equal(r.aging.total, 0);
  assert.equal(r.overdue.length, 0);
  assert.equal(r.forecast.dso, null);
  assert.equal(r.monthlyBurn, 0);
});

t("partner forecast marks the first week below the safety reserve", () => {
  const r = partnerFinance([rc], [], [], { opening_balance: 60000, balance_as_of: null, credit_facility: 0, safety_reserve: 50000 }, [{ week_ending: "2026-10-16", category: "OUTFLOW_PAYROLL", projected_amount: 20000 }], "2026-10-14");
  assert.equal(r.forecast.firstBreach, 0);
  assert.equal(r.forecast.lowest, 40000);
  assert.ok(r.monthlyBurn > 0);
});
