// Checks the intake brief rules on labelled text. Run with: npm run intake-brief-check.
// The module is transpiled from src/lib/cockpit/intakeBrief.ts, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/cockpit/intakeBrief.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "intakebrief-"));
const file = join(dir, "intakeBrief.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const B = await import(pathToFileURL(file).href);
const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("dates: slashed, dotted with a full year, ISO and Hebrew months; clause numbers are not dates", () => {
  assert.deepEqual(B.datesIn("ייכנס לתוקף ביום 15.11.2026 ויסתיים ב-31/12/26. סעיף 5.1.10 קובע"), ["15.11.2026", "31.12.2026"]);
  assert.deepEqual(B.datesIn("נחתם 2026-03-01 ויימסר ב-1 בינואר 2027"), ["1.3.2026", "1 בינואר 2027"]);
  assert.deepEqual(B.datesIn("ביום 45.13.2026 ובסעיף 3.2"), []);
});

t("deadlines: periods in digits or words, and limitation", () => {
  assert.deepEqual(B.deadlinesIn("יש לשלם תוך 30 ימים ממועד החתימה ולא יאוחר מתום 7 ימי עסקים"), ["תוך 30 ימים", "לא יאוחר מתום 7 ימי עסקים"]);
  assert.deepEqual(B.deadlinesIn("ההודעה תימסר בתוך שלושים יום"), ["בתוך שלושים יום"]);
  assert.deepEqual(B.deadlinesIn("טענת התיישנות"), ["אזכור של התיישנות"]);
});

t("amounts: currency before or after, with a million between; a bare number is not money", () => {
  assert.deepEqual(B.amountsIn('התמורה תהיה 1,250,000 ש"ח וכן ₪ 5,000 ו-3 מיליון דולר'), ['1,250,000 ש"ח', "₪ 5,000", "3 מיליון דולר"]);
  assert.deepEqual(B.amountsIn("סעיף 12 קובע כי 30 ימים"), []);
});

t("kind: the opening lines decide before a citation further down", () => {
  assert.equal(B.kindOf("כתב תביעה\nהתובע יטען כפי שנקבע בפסק דין"), "כתב תביעה");
  assert.equal(B.kindOf("הסכם שכירות בלתי מוגנת"), "הסכם שכירות");
  assert.equal(B.kindOf("סיכום שיחה טלפונית"), null);
});

const RE_TEXT = 'הסכם מכר. [CLIENT_NAME_1] ימכור ל-[CLIENT_NAME_2] את הדירה תמורת 2,100,000 ש"ח. המסירה תוך 60 ימים, ביום 1.3.2027. התשלום ב-[CLIENT_NAME_1].';
const reInput = { text: RE_TEXT, practiceArea: "REAL_ESTATE", docOrigin: "ADVERSE", conflictStatus: "POTENTIAL", findings: [
  { ruleId: "r1", ruleName: "ערבות בנקאית חסרה", severity: "RED", fallbackClause: "המוכר ימסור ערבות" },
  { ruleId: "r2", ruleName: "הצמדה", severity: "YELLOW", fallbackClause: null },
  { ruleId: "r3", ruleName: "מסירה", severity: "GREEN", fallbackClause: null },
] };

t("map: parties are counted once per masked name, findings by severity", () => {
  const m = B.readMap(reInput);
  assert.equal(m.kind, "הסכם מכר");
  assert.equal(m.parties, 2);
  assert.deepEqual(m.dates, ["1.3.2027"]);
  assert.deepEqual(m.deadlines, ["תוך 60 ימים"]);
  assert.deepEqual(m.amounts, ['2,100,000 ש"ח']);
  assert.deepEqual(m.red, ["ערבות בנקאית חסרה"]);
  assert.equal(m.yellow, 1);
  assert.equal(m.fallbacks, 1);
});

t("questions: the three that decide come first, the document's own signals next, at most six", () => {
  const m = B.readMap(reInput);
  const qs = B.questionsFor(reInput, m);
  assert.ok(qs.length <= B.MAX_QUESTIONS);
  assert.deepEqual(qs.map((q) => q.id), ["goal", "side", "stage", "deadline", "red", "ask"]);
  assert.ok(qs[1].options.some((o) => o.label === "קונה"), "real estate sides");
  assert.match(qs[3].context, /תוך 60 ימים/);
  for (const q of qs) {
    assert.ok(q.why.length > 10, `${q.id} explains why it asks`);
    assert.ok(q.options.length >= 3, `${q.id} has closed answers`);
    assert.equal(q.options.at(-1).id, "unknown", `${q.id} lets the lawyer say it is not known yet`);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, `${q.id} option ids are unique`);
  }
});

t("questions: with no date in the text the area question comes before the deadline", () => {
  const input = { text: "כתב הגנה מטעם הנתבעת", practiceArea: "LITIGATION", findings: [] };
  assert.deepEqual(B.questionsFor(input, B.readMap(input)).map((q) => q.id), ["goal", "side", "stage", "court", "deadline"]);
});

t("steps: grouped by topic, three at most each, and they follow the answers", () => {
  const m = B.readMap(reInput);
  const steps = B.stepsFor(reInput, m, { deadline: "week", ask: "reply", tabu: "need", goal: "deal", side: "buyer" }, "00000000-0000-0000-0000-000000000001");
  const topics = new Map(B.TOPICS);
  for (const [topic] of B.TOPICS) assert.ok(steps.filter((s) => s.topic === topic).length <= B.MAX_PER_TOPIC, topic);
  for (const s of steps) assert.ok(topics.has(s.topic) && s.when.length > 10, s.id);
  const ids = steps.map((s) => s.id);
  for (const id of ["findings", "deadline", "fallback", "reply", "conflict", "kyc", "tabu", "task", "copy"]) assert.ok(ids.includes(id), `has ${id}`);
  assert.ok(!ids.includes("meet"), "no client meeting when goal and side are known");
  assert.match(steps.find((s) => s.id === "deadline").title, /עכשיו/);
  assert.equal(steps.find((s) => s.id === "deadline").action.to, "/workspace/matter-360?matter=00000000-0000-0000-0000-000000000001");
});

t("steps: a signed document gets no fallback clause, and open questions suggest a meeting", () => {
  const m = B.readMap(reInput);
  const ids = B.stepsFor(reInput, m, { red: "signed", goal: "unknown" }, "x").map((s) => s.id);
  assert.ok(!ids.includes("fallback"));
  assert.ok(ids.includes("meet"));
});

t("no dash used as punctuation in anything the brief shows (CLAUDE.md)", () => {
  const m = B.readMap(reInput);
  const qs = B.questionsFor(reInput, m);
  const all = { deadline: "week", ask: "reply", tabu: "need", dd: "none", employed: "dismissal", red: "unsigned", goal: "claim" };
  const texts = [
    ...qs.flatMap((q) => [q.ask, q.why, q.context ?? "", ...q.options.map((o) => o.label)]),
    ...B.stepsFor({ ...reInput, docOrigin: "CLIENT" }, m, all, "x").flatMap((s) => [s.title, s.when]),
    ...B.TOPICS.map(([, l]) => l),
    B.briefText({ area: 'נדל"ן', type: "חוזה או הסכם", file: "הסכם.docx" }, m, qs, { goal: "deal" }),
  ];
  for (const s of texts) assert.doesNotMatch(s, /[—–]| - /, s);
});

t("summary: names the answers given", () => {
  const m = B.readMap(reInput);
  const qs = B.questionsFor(reInput, m);
  const text = B.briefText({ area: 'נדל"ן', type: null, file: "הסכם.docx" }, m, qs, { goal: "deal", side: "buyer" });
  assert.match(text, /מה הלקוח רוצה להשיג\? לסגור עסקה/);
  assert.match(text, /את מי אנחנו מייצגים\? קונה/);
  assert.match(text, /ממצאים: 1 בסיכון גבוה, 1 לזהירות/);
});

console.log("intake-brief-check: all passed");
