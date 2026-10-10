// Checks the partner/matter/portal rules. Run with: npm run crm-check
import assert from "node:assert/strict";
import { arAging, forecast13, fridayOnOrAfter, trustBalance, wip, clientMessages, clientMilestones, parseDay } from "../src/lib/cockpit/crm.ts";
import { calculateDeadline, VERIFIED_RULES } from "../src/lib/cockpit/deadlines.ts";
import { buildDemo } from "../src/lib/cockpit/crmDemo.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const today = new Date(2026, 9, 10); // Saturday 10 Oct 2026
const d = buildDemo(today);

t("aging buckets sum to the total and use open balances", () => {
  const a = arAging(d.docs, d.payments, today);
  assert.equal(Math.round((a.current + a.d1_30 + a.d31_60 + a.d60plus) * 100), Math.round(a.total * 100));
  assert.ok(a.d60plus > 0);
  assert.ok(!a.invoices.some((i) => i.doc.id === "i6"), "a fully paid invoice is not open");
});
t("partial payment reduces the open amount", () => {
  const a = arAging(d.docs, d.payments, today);
  assert.equal(a.invoices.find((i) => i.doc.id === "i1").open, 18600);
});
t("weeks are labelled by Friday and there are 13", () => {
  assert.equal(fridayOnOrAfter(today).getDay(), 5);
  const f = forecast13({ docs: d.docs, pays: d.payments, obligations: d.obligations, openingCash: d.bankBalance, minThreshold: d.minThreshold, fallbackDso: 45 }, today);
  assert.equal(f.weeks.length, 13);
  assert.ok(f.weeks.every((w) => parseDay(w.friday).getDay() === 5));
});
t("forecast closing balance is opening plus cumulative net", () => {
  const f = forecast13({ docs: d.docs, pays: d.payments, obligations: d.obligations, openingCash: 1000, minThreshold: 0, fallbackDso: 45 }, today);
  let b = 1000; f.weeks.forEach((w) => { b = Math.round((b + w.inflow - w.outflow) * 100) / 100; assert.equal(w.closing, b); });
});
t("a breach is reported when the threshold is above the opening balance", () => {
  const f = forecast13({ docs: [], pays: [], obligations: [], openingCash: 100, minThreshold: 500, fallbackDso: 45 }, today);
  assert.equal(f.firstBreach, 0);
});
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
