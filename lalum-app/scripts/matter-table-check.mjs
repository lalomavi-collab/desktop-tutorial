// Checks the rules of the matters table (src/lib/cockpit/matterTable.ts): the six sorts, the filters, the joined extras,
// and that neither a hit nor the order can tell anything about a hidden client name. Run with: npm run matter-table-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const dir = mkdtempSync(join(tmpdir(), "mtable-"));
for (const f of ["matterTable", "clientNames"]) {
  const src = readFileSync(new URL(`../src/lib/cockpit/${f}.ts`, import.meta.url), "utf8");
  writeFileSync(join(dir, `${f}.js`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const L = await import(pathToFileURL(join(dir, "matterTable.js")).href);
const N = await import(pathToFileURL(join(dir, "clientNames.js")).href);

const row = (o) => ({ matter_id: "m1", matter_code: "LAL-0001", title: "שם לקוח א", practice_area: "REAL_ESTATE", matter_status: "ACTIVE_REVIEW", conflict_status: "CLEAN", risk_level: "CLEAR", partner_response: "ACCEPTED", dispatched_at: "2026-10-01T08:00:00Z", sla_breached: false, ...o });
const rows = [
  row({ matter_id: "a", matter_code: "LAL-0010", title: "תמר", dispatched_at: "2026-10-20T08:00:00Z" }),
  row({ matter_id: "b", matter_code: "LAL-0002", title: "אבנר", dispatched_at: "2026-10-25T08:00:00Z", practice_area: "LITIGATION" }),
  row({ matter_id: "c", matter_code: null, title: "גלעד", dispatched_at: "2026-09-01T08:00:00Z", matter_status: "ARCHIVED" }),
  row({ matter_id: "d", matter_code: "LAL-0003", title: "דנה", dispatched_at: "2026-10-10T08:00:00Z", conflict_status: "POTENTIAL" }),
];
const extras = L.buildExtras({
  matters: [{ id: "a", updated_at: "2026-10-30T09:00:00Z", created_by: "u2" }, { id: "b", updated_at: null, created_by: null }, { id: "d", updated_at: "2026-10-11T00:00:00Z", created_by: "u1" }],
  team: [{ matter_id: "a", user_id: "u1", created_at: "2026-10-21T00:00:00Z" }, { matter_id: "a", user_id: "u3", created_at: "2026-10-20T00:00:00Z" }, { matter_id: "b", user_id: "u2", created_at: "2026-10-25T00:00:00Z" }],
  deadlines: [{ matter_id: "a", due_date: "2026-11-05", kind: "HEARING" }, { matter_id: "d", due_date: "2026-10-29", kind: "FILING" }, { matter_id: "a", due_date: "2026-11-20", kind: "INTERNAL" }],
  tasks: [{ matter_id: "a", due_at: "2026-11-03T21:30:00Z" }, { matter_id: "b", due_at: "2026-11-12T08:00:00Z" }],
  docs: [{ matter_id: "b", created_at: "2026-10-31T07:00:00Z" }],
  people: [{ user_id: "u1", display_name: "עו״ד יעל" }, { user_id: "u2", display_name: "עו״ד בני" }, { user_id: "u3", display_name: "עו״ד צבי" }],
});
const today = "2026-10-31";
const ctx = (revealed, me = null) => ({ me, today, extras, label: (m) => N.displayName(revealed, m), match: (m, q) => N.matchesQuery(revealed, m, q) });
const ids = (list) => list.map((m) => m.matter_id).join("");
const Q = (o) => ({ ...L.DEFAULT_QUERY, ...o });

t("extras: the owner is the first member placed on the matter, else its creator", () => {
  assert.equal(extras.get("a").owner_id, "u3");
  assert.equal(extras.get("a").owner, "עו״ד צבי");
  assert.deepEqual(extras.get("a").team, ["u3", "u1"]);
  assert.equal(extras.get("d").owner, "עו״ד יעל", "no team: the creator");
  assert.equal(extras.get("c"), undefined, "a matter with no extra rows has none");
});
t("extras: the nearest date wins across deadlines and tasks, a task due late at night counts on its Israel day", () => {
  assert.equal(extras.get("a").next_due, "2026-11-03", "21:30Z on 3.11 is 23:30 in Israel, still 3.11");
  assert.equal(extras.get("a").next_kind, "TASK");
  assert.equal(extras.get("d").next_due, "2026-10-29");
  assert.equal(extras.get("d").next_kind, "FILING");
});
t("extras: the last activity is the later of the matter update and its latest document", () => {
  assert.equal(extras.get("b").updated_at, "2026-10-31T07:00:00Z");
  assert.equal(L.lastActivity(rows[2], undefined), rows[2].dispatched_at, "nothing joined: the intake time");
});
t("default view: open matters only, the most recently updated first", () => {
  assert.equal(ids(L.applyQuery(rows, Q({}), ctx(false))), "bad", "c is archived");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all" }), ctx(false))), "badc");
});
t("sort by opened, number, owner and the nearest date; missing values always last", () => {
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "opened", dir: "desc" }), ctx(false))), "badc");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "number", dir: "asc" }), ctx(false))), "bdac", "natural order, no code last");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "number", dir: "desc" }), ctx(false))), "adbc", "no code still last");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "owner", dir: "asc" }), ctx(false))), "bdac", "בני, יעל, צבי, then the unassigned");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "due", dir: "asc" }), ctx(false))), "dabc", "overdue first, no date last");
});
t("sort by name follows the shown label, so a hidden name never sets the order", () => {
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "name", dir: "asc" }), ctx(false))), "cbda", "hidden: by the shown label alone (Hebrew sorts before Latin, so the codeless 'תיק' leads), never by the hidden title");
  assert.equal(ids(L.applyQuery(rows, Q({ status: "all", sort: "name", dir: "asc" }), ctx(true))), "bcda", "revealed: אבנר, גלעד, דנה, תמר");
});
t("search: a hidden matter is found by its code only, never by its name", () => {
  assert.equal(ids(L.applyQuery(rows, Q({ q: "דנה" }), ctx(false))), "");
  assert.equal(ids(L.applyQuery(rows, Q({ q: "דנה" }), ctx(true))), "d");
  assert.equal(ids(L.applyQuery(rows, Q({ q: "lal-000" }), ctx(false))), "bd", "case does not matter");
});
t("filters: practice, mine and needs attention", () => {
  assert.equal(ids(L.applyQuery(rows, Q({ practice: "LITIGATION" }), ctx(false))), "b");
  assert.equal(ids(L.applyQuery(rows, Q({ mine: true }), ctx(false, "u1"))), "ad", "u1 sits on a and created d");
  assert.equal(ids(L.applyQuery(rows, Q({ mine: true }), ctx(false, null))), "", "no signed in member: nothing is mine");
  assert.equal(ids(L.applyQuery(rows, Q({ attention: true }), ctx(false))), "d", "a conflict to check and a missed filing");
  assert.equal(L.needsAttention(row({ sla_breached: true }), undefined, today), true);
  assert.equal(L.needsAttention(row({ risk_level: "HIGH_RISK" }), undefined, today), true);
  assert.equal(L.isFiltered(Q({})), false);
  assert.equal(L.isFiltered(Q({ q: "  " })), false, "blank search is no filter");
  assert.equal(L.isFiltered(Q({ mine: true })), true);
});
t("a click on the same column flips it; another column starts at its natural direction", () => {
  assert.deepEqual(L.toggleSort(Q({ sort: "updated", dir: "desc" }), "updated"), { sort: "updated", dir: "asc" });
  assert.deepEqual(L.toggleSort(Q({ sort: "updated", dir: "desc" }), "due"), { sort: "due", dir: "asc" });
  assert.deepEqual(L.toggleSort(Q({ sort: "due", dir: "asc" }), "name"), { sort: "name", dir: "asc" });
});
t("the remembered view and sort are read back safely", () => {
  assert.equal(L.parseView("cards"), "cards");
  assert.equal(L.parseView("<script>"), "list");
  assert.equal(L.parseView(null), "list");
  assert.deepEqual(L.parseSort("owner:desc"), { sort: "owner", dir: "desc" });
  assert.deepEqual(L.parseSort("due"), { sort: "due", dir: "asc" });
  assert.deepEqual(L.parseSort("title:asc"), { sort: "updated", dir: "desc" });
});
t("due words and short times", () => {
  assert.equal(L.dueState("2026-10-29", today), "overdue");
  assert.equal(L.dueState("2026-10-31", today), "today");
  assert.equal(L.dueState("2026-11-07", today), "week");
  assert.equal(L.dueState("2026-11-08", today), "later");
  assert.equal(L.dueText("2026-10-31", today), "היום");
  assert.equal(L.dueText("2026-11-01", today), "מחר");
  assert.equal(L.dueText("2026-10-30", today), "אתמול, באיחור");
  assert.equal(L.dueText("2026-10-28", today), "באיחור של 3 ימים");
  assert.equal(L.dueText("2026-11-05", today), "5.11");
  assert.equal(L.dueText("2027-01-05", today), "5.1.2027");
  const now = new Date("2026-10-31T12:00:00Z");
  assert.equal(L.agoText("2026-10-31T11:55:00Z", now), "לפני 5 דקות");
  assert.equal(L.agoText("2026-10-31T06:00:00Z", now), "היום 08:00");
  assert.equal(L.agoText("2026-10-30T10:00:00Z", now), "אתמול");
  assert.equal(L.agoText("2026-10-20T10:00:00Z", now), "20.10");
});
t("the copy keeps the house rule: no dash used as punctuation", () => {
  const src = readFileSync(new URL("../src/lib/cockpit/matterTable.ts", import.meta.url), "utf8") + readFileSync(new URL("../src/components/cockpit/MatterTable.tsx", import.meta.url), "utf8");
  assert.equal(/[\u2013\u2014]/.test(src), false, "no en or em dash");
  const prose = src.split("\n").filter((l) => /[\u0590-\u05FF]/.test(l) || /^\s*(\/\/|\/\*|\*)/.test(l));
  assert.deepEqual(prose.filter((l) => / - /.test(l)), [], "no spaced hyphen in Hebrew copy or in a comment");
});
console.log("matter-table-check: all passed");
