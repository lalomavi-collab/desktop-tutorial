// Checks the rules of the tasks board (src/lib/cockpit/taskBoard.ts): the buckets on Israel days, the counters, the
// "done this week" week that opens on Sunday, the columns and the short due words. Run with: npm run task-board-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const dir = mkdtempSync(join(tmpdir(), "tboard-"));
const src = readFileSync(new URL("../src/lib/cockpit/taskBoard.ts", import.meta.url), "utf8");
writeFileSync(join(dir, "taskBoard.js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const L = await import(pathToFileURL(join(dir, "taskBoard.js")).href);

// Wednesday 4.11.2026, 12:00 in Israel (winter time, UTC+2). The week opened on Sunday 1.11.
const now = new Date("2026-11-04T10:00:00Z");
const task = (id, o) => ({ id, matter_id: "m1", title: id, due_at: null, assignee: "u2", status: "OPEN", created_at: "2026-10-20T08:00:00Z", closed_at: null, ...o });
const tasks = [
  task("late", { due_at: "2026-11-03T08:00:00Z", assignee: "u1" }),
  task("todayLater", { due_at: "2026-11-04T15:00:00Z", assignee: "u1" }),
  task("todayMissed", { due_at: "2026-11-04T08:00:00Z" }),
  task("tomorrow", { due_at: "2026-11-05T07:30:00Z", assignee: "u1" }),
  task("pastMidnight", { due_at: "2026-11-04T22:30:00Z" }),
  task("inSeven", { due_at: "2026-11-11T10:00:00Z" }),
  task("later", { due_at: "2026-11-20T10:00:00Z" }),
  task("nodue", { created_at: "2026-10-21T08:00:00Z" }),
  task("doneMon", { status: "DONE", due_at: "2026-11-02T10:00:00Z", closed_at: "2026-11-02T09:00:00Z", assignee: "u1" }),
  task("doneLastWeek", { status: "DONE", closed_at: "2026-10-30T09:00:00Z" }),
  task("cancelled", { status: "CANCELLED", closed_at: "2026-11-03T09:00:00Z" }),
];
const by = (id) => tasks.find((x) => x.id === id);
const ids = (list) => list.map((x) => x.id).join(",");

t("buckets on Israel days: a missed hour today is overdue, 00:30 tomorrow is not today", () => {
  assert.equal(L.bucketOf(by("late"), now), "overdue");
  assert.equal(L.bucketOf(by("todayMissed"), now), "overdue");
  assert.equal(L.bucketOf(by("todayLater"), now), "today");
  assert.equal(L.bucketOf(by("tomorrow"), now), "week");
  assert.equal(L.bucketOf(by("pastMidnight"), now), "week", "22:30Z is 00:30 on 5.11 in Israel");
  assert.equal(L.bucketOf(by("inSeven"), now), "week", "seven days ahead is still this week's column");
  assert.equal(L.bucketOf(by("later"), now), "later");
  assert.equal(L.bucketOf(by("nodue"), now), "nodue");
  assert.equal(L.bucketOf(by("cancelled"), now), "closed");
});
t("the Israel week opens on Sunday, also late on Saturday night UTC", () => {
  assert.equal(L.weekStart(now), "2026-11-01");
  assert.equal(L.weekStart(new Date("2026-10-31T22:30:00Z")), "2026-11-01", "00:30 on Sunday in Israel is already the new week");
  assert.equal(L.weekStart(new Date("2026-11-01T00:00:00Z")), "2026-11-01");
});
t("counters: each counts its own tasks, done this week counts DONE only and only since Sunday", () => {
  const c = L.counts(tasks, "all", null, now);
  assert.deepEqual({ ...c }, { open: 8, overdue: 2, today: 1, week: 3, nodue: 1, doneWeek: 1, closed: 3 });
  const mine = L.counts(tasks, "me", "u1", now);
  assert.deepEqual({ overdue: mine.overdue, today: mine.today, week: mine.week, doneWeek: mine.doneWeek }, { overdue: 1, today: 1, week: 1, doneWeek: 1 });
  assert.equal(L.counts(tasks, "me", null, now).open, 0, "no signed in member: nothing is mine");
  assert.equal(L.counts(tasks, "u2", null, now).open, 5, "a named member");
});
t("the board: four columns by due date, tasks with no date at the end of the last one", () => {
  const b = L.board(tasks, "all", null, now);
  assert.equal(ids(b.overdue), "late,todayMissed");
  assert.equal(ids(b.today), "todayLater");
  assert.equal(ids(b.week), "pastMidnight,tomorrow,inSeven", "00:30 on 5.11 comes before 09:30 on 5.11");
  assert.equal(ids(b.later), "later,nodue");
});
t("the list: closed tasks newest first, open ones by due date", () => {
  assert.equal(ids(L.select(tasks, "closed", "all", null, now)), "cancelled,doneMon,doneLastWeek");
  assert.equal(ids(L.select(tasks, "doneWeek", "all", null, now)), "doneMon");
  assert.equal(ids(L.select(tasks, "overdue", "me", "u1", now)), "late");
});
t("due words", () => {
  assert.equal(L.dueWords(null, now), "ללא מועד");
  assert.equal(L.dueWords(by("todayLater").due_at, now), "היום 17:00");
  assert.equal(L.dueWords(by("todayMissed").due_at, now), "היום 10:00, באיחור");
  assert.equal(L.dueWords(by("late").due_at, now), "אתמול, באיחור");
  assert.equal(L.dueWords("2026-11-01T08:00:00Z", now), "באיחור של 3 ימים");
  assert.equal(L.dueWords(by("tomorrow").due_at, now), "מחר 09:30");
  assert.equal(L.dueWords(by("inSeven").due_at, now), "ד׳ 11.11");
  assert.equal(L.dueWords(by("later").due_at, now), "20.11");
  assert.equal(L.dueWords("2027-01-05T10:00:00Z", now), "5.1.2027");
});
t("the remembered view is read back safely", () => {
  assert.equal(L.parseBoardView("list"), "list");
  assert.equal(L.parseBoardView("x"), "board");
  assert.equal(L.parseBoardView(null), "board");
});
t("the copy keeps the house rule: no dash used as punctuation", () => {
  const all = src + readFileSync(new URL("../src/components/cockpit/TaskBoard.tsx", import.meta.url), "utf8");
  assert.equal(/[\u2013\u2014]/.test(all), false, "no en or em dash");
  const prose = all.split("\n").filter((l) => /[\u0590-\u05FF]/.test(l) || /^\s*(\/\/|\/\*|\*)/.test(l));
  assert.deepEqual(prose.filter((l) => / - /.test(l)), [], "no spaced hyphen in Hebrew copy or in a comment");
});
console.log("task-board-check: all passed");
