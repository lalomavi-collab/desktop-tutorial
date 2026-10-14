// Checks the rules that decide what a screen shows for a matter (src/lib/cockpit/clientNames.ts). Run: npm run client-names-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/cockpit/clientNames.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "cn-"));
const file = join(dir, "clientNames.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { displayName, matchesQuery, idleExpired, REVEAL_IDLE_MS } = await import(pathToFileURL(file).href);

const m = { matter_code: "L-2026-0017", title: "שם לקוח לדוגמה" };
// hidden: the code, and the title never appears
assert.equal(displayName(false, m), "L-2026-0017");
assert.ok(!displayName(false, m).includes("לקוח"));
assert.equal(displayName(false, { matter_code: null, title: "שם לקוח לדוגמה" }), "תיק", "no code: still no name");
assert.equal(displayName(false, { matter_code: "  ", title: "שם" }), "תיק", "blank code counts as none");
assert.equal(displayName(false, undefined), "תיק");
assert.equal(displayName(false, null), "תיק");
// revealed: the title, falling back to the code, then to a neutral word
assert.equal(displayName(true, m), "שם לקוח לדוגמה");
assert.equal(displayName(true, { matter_code: "L-2026-0001", title: "  " }), "L-2026-0001");
assert.equal(displayName(true, {}), "תיק");
// search never leaks a name: while hidden a query that matches only the title finds nothing
assert.equal(matchesQuery(false, m, "לקוח"), false);
assert.equal(matchesQuery(false, m, "l-2026-0017"), true);
assert.equal(matchesQuery(false, m, "0017"), true);
assert.equal(matchesQuery(true, m, "לקוח"), true);
assert.equal(matchesQuery(true, m, "0017"), true);
assert.equal(matchesQuery(false, m, ""), true);
assert.equal(matchesQuery(false, m, "   "), true);
assert.equal(matchesQuery(true, { matter_code: null, title: "אבג" }, "אב"), true);
// idle expiry
assert.equal(REVEAL_IDLE_MS, 300000);
assert.equal(idleExpired(0, REVEAL_IDLE_MS - 1), false);
assert.equal(idleExpired(0, REVEAL_IDLE_MS), true);
assert.equal(idleExpired(1000, 1000 + 10, 10), true);
console.log("client-names-check: ok");
