// Checks the planner of lalum-outlook-sync with fakes. Run with: npm run outlook-sync-check.
// sync.ts is transpiled from supabase/functions/lalum-outlook-sync, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "outlooksync-"));
const src = readFileSync(new URL("../supabase/functions/lalum-outlook-sync/sync.ts", import.meta.url), "utf8");
writeFileSync(join(dir, "sync.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { toUtcIso, mapEvent, planSync, MAX_DELETES } = await import(pathToFileURL(join(dir, "sync.mjs")).href);

const NOW = new Date("2026-10-25T04:15:00Z");
const END = new Date("2027-04-23T04:15:00Z");
const ev = (id, start, over = {}) => ({
  id, subject: `meeting ${id}`, location: { displayName: "" },
  start: { dateTime: `${start}.0000000`, timeZone: "UTC" }, end: { dateTime: `${start}.0000000`, timeZone: "UTC" }, ...over,
});
const row = (id, ext, start, title) => ({ id, external_id: ext, title: title ?? `meeting ${ext}`, starts_at: `${start}+00:00` });
const five = ["2026-10-26T08:00:00", "2026-10-27T08:00:00", "2026-10-28T08:00:00", "2026-10-29T08:00:00", "2026-10-30T08:00:00"]
  .map((s, i) => ev(`g${i}`, s));

// 1. Time: Graph sends UTC wall clock with seven fraction digits and no offset.
assert.equal(toUtcIso("2026-10-28T11:30:00.0000000"), "2026-10-28T11:30:00.000Z");
assert.equal(toUtcIso("2026-10-28T11:30:00Z"), "2026-10-28T11:30:00.000Z");
assert.throws(() => toUtcIso("2026-10-28T13:30:00.0000000", "Israel Standard Time"), /timeZone/);
assert.throws(() => toUtcIso("not a date"), /unreadable/);

// 2. Mapping: the old routine's kind rules, plus Teams invites flagged online.
const k = (over) => mapEvent(ev("x", "2026-10-26T08:00:00", over)).kind;
assert.equal(k({ location: { displayName: "https://us02web.zoom.us/j/1" } }), "zoom");
assert.equal(k({ location: { displayName: "Microsoft Teams Meeting" }, isOnlineMeeting: true }), "zoom");
assert.equal(k({ location: { displayName: "משרד, נתניה" } }), "meeting");
assert.equal(k({ location: null }), "block");
assert.equal(mapEvent(ev("x", "2026-10-26T08:00:00", { isCancelled: true })), null);
assert.equal(mapEvent({ subject: "no id" }), null);
assert.equal(mapEvent(ev("x", "2026-10-26T08:00:00", { subject: "  " })).title, "(ללא נושא)");
assert.equal(mapEvent(ev("x", "2026-10-26T08:00:00", { location: { displayName: "  " } })).location, null);

// 3. A thin fetch writes nothing at all.
const thin = planSync(five.slice(0, 4), [row("r1", "old", "2026-11-01T08:00:00")], NOW, END);
assert.deepEqual(thin, { status: "refused", reason: "too_few_events", fetched: 4 });
// Cancelled events do not count toward the minimum.
assert.equal(planSync([...five.slice(0, 4), ev("c", "2026-11-02T08:00:00", { isCancelled: true })], [], NOW, END).status, "refused");

// 4. The 23.10 state: a meeting stored twice (old id and Outlook's re-issued id) and a conference removed from Outlook.
{
  const fetched = [...five, ev("new28", "2026-10-28T11:30:00", { subject: "פגישה" })];
  const existing = [
    row("dupOld", "old28", "2026-10-28T11:30:00", "פגישה"), row("dupNew", "new28", "2026-10-28T11:30:00", "פגישה"),
    row("conf", "conf5", "2026-11-05T06:30:00", "כנס"), ...five.map((e, i) => row(`r${i}`, e.id, e.start.dateTime.slice(0, 19))),
  ];
  const p = planSync(fetched, existing, NOW, END);
  assert.equal(p.status, "ok");
  assert.deepEqual(p.rekeys, []);
  assert.deepEqual(p.deletes.sort(), ["conf", "dupOld"]);
  assert.equal(p.upserts.length, 6);
}

// 5. First run after the Claude routine: every stored id is in the connector's format, none is a Graph id. Each row is adopted by
//    title and start, so nothing is inserted twice and only the meeting Outlook dropped is deleted.
{
  const existing = [...five.map((e, i) => row(`r${i}`, `AAkALgAAAA${i}`, e.start.dateTime.slice(0, 19), e.subject)),
    row("gone", "AAkALgAAAAz", "2026-11-05T06:30:00", "כנס")];
  const p = planSync(five, existing, NOW, END);
  assert.equal(p.status, "ok");
  assert.deepEqual(p.rekeys, five.map((e, i) => ({ id: `r${i}`, external_id: e.id })));
  assert.deepEqual(p.deletes, ["gone"]);
}

// 6. Rows that started already, rows past the window and duplicate ids in one fetch.
{
  const existing = [row("past", "p1", "2026-10-25T03:00:00"), row("far", "f1", "2027-05-01T08:00:00")];
  const p = planSync([...five, five[0]], existing, NOW, END);
  assert.deepEqual(p.deletes, []);
  assert.equal(p.upserts.length, 5);
}

// 7. More than MAX_DELETES would disappear: no deletes, and no new rows beside the ones left standing. Matched rows still update.
{
  const gone = Array.from({ length: MAX_DELETES + 1 }, (_, i) => row(`gone${i}`, `x${i}`, `2026-11-${String(10 + i).padStart(2, "0")}T08:00:00`));
  const existing = [row("r0", "g0", "2026-10-26T08:00:00"), ...gone];
  const p = planSync(five, existing, NOW, END);
  assert.equal(p.status, "held");
  assert.deepEqual(p.deletes, []);
  assert.deepEqual(p.upserts.map((u) => u.external_id), ["g0"]);
  assert.deepEqual(p.held, { inserts: 4, deletes: MAX_DELETES + 1 });
  // Exactly at the cap is a normal run.
  assert.equal(planSync(five, [row("r0", "g0", "2026-10-26T08:00:00"), ...gone.slice(0, MAX_DELETES)], NOW, END).status, "ok");
}

console.log("outlook-sync-check: ok");
