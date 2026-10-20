// Checks the partner/matter/portal rules. Run with: npm run crm-check
import assert from "node:assert/strict";
import { summarizeTrust, trustBalance, wip, clientMessages, clientMilestones } from "../src/lib/cockpit/crm.ts";
import { calculateDeadline, VERIFIED_RULES } from "../src/lib/cockpit/deadlines.ts";
import { buildDemo } from "../src/lib/cockpit/crmDemo.ts";
import { partnerFinance } from "../src/lib/cockpit/crmFinanceCore.ts";
import { parseOverview, parseMatterWip, rpcFailure } from "../src/lib/cockpit/billingWipCore.ts";
import { isUuid, timeSummary, hours, stageIndex } from "../src/lib/cockpit/matter360Core.ts";
import { parseHoursIndex, ratios, totals, flags, fmtHM, fmtPct, monthRange, billableFor, clockError, buildHoursDemo, HOURS_DEMO_NOTE } from "../src/lib/cockpit/hoursIndexCore.ts";

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

t("matter 360: uuid check, hours by status, stage order", () => {
  assert.ok(isUuid("0b9f4d3e-1a2b-4c5d-8e9f-0123456789ab"));
  assert.ok(!isUuid("m1") && !isUuid(null) && !isUuid("../../etc"));
  const rows = [
    { id: "1", work_date: "2026-10-01", billable_minutes: 60, narrative: "", status: "draft" },
    { id: "2", work_date: "2026-10-02", billable_minutes: 90, narrative: "", status: "approved" },
    { id: "3", work_date: "2026-10-03", billable_minutes: 30, narrative: "", status: "billed" },
    { id: "4", work_date: "2026-10-04", billable_minutes: 12, narrative: "", status: "submitted" },
    { id: "5", work_date: "2026-10-05", billable_minutes: 600, narrative: "", status: "written_off" },
  ];
  const s = timeSummary(rows);
  assert.equal(s.approvedUnbilled, 90);
  assert.equal(s.totalBillable, 60 + 90 + 30 + 12, "written-off time is not billable");
  assert.equal(s.writtenOff, 600);
  assert.equal(hours(90), 1.5);
  assert.equal(hours(100), 1.67);
  assert.equal(stageIndex("INTAKE_PENDING"), 0);
  assert.equal(stageIndex("ARCHIVED"), 3);
  assert.equal(stageIndex("nope"), -1);
});

t("billing RPC results parse to numbers, keep a missing rate as null, and reject non-objects", () => {
  const o = parseOverview({ wip_value: "12500.50", wip_hours: 10, entries_without_rate: 2, entries_awaiting_approval: "3", unbilled_hours_non_hourly_matters: 4.5,
    trust_below_threshold: [{ matter_id: "m", title: "תיק", balance: "800", threshold: 4000 }] });
  assert.equal(o.wipValue, 12500.5);
  assert.equal(o.awaitingApproval, 3);
  assert.equal(o.entriesWithoutRate, 2);
  assert.deepEqual(o.lowRetainers, [{ matterId: "m", title: "תיק", balance: 800, threshold: 4000 }]);
  assert.equal(parseOverview(null), null);
  assert.equal(parseOverview([]), null);
  assert.deepEqual(parseOverview({}).lowRetainers, []);
  const w = parseMatterWip({ time_entries: [
    { id: "a", work_date: "2026-10-01", timekeeper: "דנה", billable_minutes: 90, rate: 800, amount: 1200, narrative: "x", status: "approved", reserved: false },
    { id: "b", work_date: "2026-10-02", timekeeper: null, billable_minutes: 60, rate: null, amount: null, narrative: "y", status: "submitted", reserved: true },
  ], billable_time_value: 1200, disbursements_total: "150", entries_without_rate: 1, awaiting_approval: 1 });
  assert.equal(w.entries[0].amount, 1200);
  assert.equal(w.entries[1].rate, null);
  assert.equal(w.entries[1].amount, null);
  assert.equal(w.entries[1].reserved, true);
  assert.equal(w.disbursementsTotal, 150);
  assert.equal(parseMatterWip("x"), null);
});

t("an RPC missing from the database reads as unavailable, a refusal as denied", () => {
  assert.equal(rpcFailure({ code: "PGRST202", message: "Could not find the function public.x in the schema cache" }), "unavailable");
  assert.equal(rpcFailure({ code: "42883", message: "function does not exist" }), "unavailable");
  assert.equal(rpcFailure({ code: "P0001", message: "FORBIDDEN" }), "denied");
  assert.equal(rpcFailure(null), "denied");
});

const hoursRpc = {
  from: "2026-10-01", to: "2026-10-31",
  people: [
    { name: "א", role: "ATTORNEY", attendance_minutes: 480, attendance_days: 1, open_sessions: 0, logged_minutes: 600, billable_minutes: 588, billed_minutes: 0, draft_minutes: 0, written_off_minutes: 0, value: "4900.00", entries_without_rate: 0, days_over: 1, days_no_attendance: 1 },
    { name: "ב", role: "ATTORNEY", attendance_minutes: 0, attendance_days: 0, open_sessions: 1, logged_minutes: 0, billable_minutes: 0, billed_minutes: 0, draft_minutes: 90, written_off_minutes: 0, value: 0, entries_without_rate: 2, days_over: 0, days_no_attendance: 0 },
  ],
  matters: [{ matter_id: "m1", matter_code: "A-1", title: "t", fee_model: "hourly", people: 1, logged_minutes: 600, billable_minutes: 588, billed_minutes: 0, written_off_minutes: 0, value: 4900 }],
  split: [{ matter_id: "m1", name: "א", logged_minutes: 600, billable_minutes: 588 }],
};
t("hours index parses to numbers and rejects non-objects", () => {
  const h = parseHoursIndex(hoursRpc);
  assert.equal(h.people[0].value, 4900);
  assert.equal(h.matters[0].feeModel, "hourly");
  assert.equal(h.split[0].logged, 600);
  assert.equal(parseHoursIndex(null), null);
  assert.equal(parseHoursIndex([]), null);
});
t("hours ratios: presence, logged and billable stay separate, and no denominator means no figure", () => {
  const [a, b] = parseHoursIndex(hoursRpc).people;
  const ra = ratios(a);
  assert.equal(ra.unallocated, 0); // logged above presence is a flag, never a negative gap
  assert.equal(ra.utilization, 600 / 480);
  assert.equal(ra.billableShare, 588 / 600);
  const rb = ratios(b);
  assert.equal(rb.utilization, null);
  assert.equal(rb.billableShare, null);
  assert.equal(rb.billableOfAttendance, null);
  assert.equal(ratios({ attendance: 480, logged: 300, billable: 240 }).unallocated, 180);
  assert.equal(fmtPct(null), "אין נתון");
  assert.equal(fmtPct(0.5), "50%");
});
t("hours totals add up and the flags name what needs the partner", () => {
  const { people } = parseHoursIndex(hoursRpc);
  const tot = totals(people);
  assert.equal(tot.logged, 600);
  assert.equal(tot.draft, 90);
  assert.equal(tot.value, 4900);
  assert.equal(tot.openSessions, 1);
  assert.equal(flags(people[0]).length, 2);
  assert.equal(flags(people[1]).length, 3);
  assert.deepEqual(flags({ ...people[0], daysOver: 0, daysNoAttendance: 0 }), []);
});
t("hours formatting, month range and billable rounding follow the 6 minute rule", () => {
  assert.equal(fmtHM(450), "7:30");
  assert.equal(fmtHM(5), "0:05");
  assert.deepEqual(monthRange(new Date(2026, 9, 20)), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(monthRange(new Date(2026, 9, 20), -1), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(monthRange(new Date(2026, 0, 5), -1), { from: "2025-12-01", to: "2025-12-31" });
  assert.equal(billableFor(1), 0); // under 6 minutes worked, no whole unit fits under the worked time
  assert.equal(billableFor(60), 60);
  assert.equal(billableFor(63), 60);
  assert.equal(billableFor(65), 60);
  for (let w = 1; w <= 1440; w++) { const b = billableFor(w); assert.ok(b % 6 === 0 && b <= w, `worked ${w} gave ${b}`); }
});
t("clock errors read as Hebrew and never leak raw database text", () => {
  assert.match(clockError({ message: "ALREADY_CLOCKED_IN" }), /החתמת כניסה/);
  assert.match(clockError("xx SESSION_TOO_LONG_NEEDS_CORRECTION xx"), /24 שעות/);
  assert.equal(clockError("duplicate key value violates unique constraint"), "הפעולה נכשלה.");
});

t("hours demo: invented data that agrees with itself, like the real report", () => {
  const d = buildHoursDemo(new Date(2026, 9, 20));
  assert.equal(d.from, "2026-10-01");
  assert.equal(d.people.length, 4);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.equal(sum(d.people.map((p) => p.logged)), sum(d.matters.map((m) => m.logged)));
  assert.equal(sum(d.people.map((p) => p.billable)), sum(d.matters.map((m) => m.billable)));
  assert.equal(sum(d.people.map((p) => p.billed)), sum(d.matters.map((m) => m.billed)));
  assert.equal(Math.round(sum(d.people.map((p) => p.value))), Math.round(sum(d.matters.map((m) => m.value))));
  for (const m of d.matters) assert.equal(sum(d.split.filter((s) => s.matterId === m.matterId).map((s) => s.logged)), m.logged);
  for (const p of d.people) { assert.ok(p.billable <= p.logged && p.billable % 6 === 0); assert.ok(p.billed <= p.billable); }
  assert.equal(d.matters.find((m) => m.feeModel === "fixed").value, 0); // a fixed fee matter is never priced by the hour
  assert.ok(d.people.some((p) => p.daysOver > 0) && d.people.some((p) => p.openSessions > 0)); // the preview shows the flags too
  assert.match(HOURS_DEMO_NOTE, /בדויים/);
});
