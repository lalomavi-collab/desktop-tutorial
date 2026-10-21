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
const { displayName, maskedText, matchesQuery, idleExpired, REVEAL_IDLE_MS, customerLabel, casualLabel, hashTail, reasonError, reasonLabel, REVEAL_REASONS } = await import(pathToFileURL(file).href);

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
// free text that identifies a client (billing customer names)
assert.equal(maskedText(false, "שם לקוח"), "מוסתר");
assert.equal(maskedText(false, ""), "");
assert.equal(maskedText(false, null), "");
assert.equal(maskedText(true, "שם לקוח"), "שם לקוח");
assert.equal(maskedText(true, undefined), "");

// Guard against a screen going back to the raw title: no cockpit screen may print a matter's title directly.
// (Task, annex and signature titles are other objects and use other variable names.)
import { readdirSync, statSync } from "node:fs";
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : []; });
const root = new URL("../src/pages/cockpit/", import.meta.url).pathname;
const bad = [];
for (const f of walk(root)) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("archive-content")) return;
    if (/\{(m|mt|matter|x)\.title\}/.test(line) || /\b(matters\.find|titles\.get)\([^)]*\)\??(\.title)?\s*\?\?\s*"/.test(line)) bad.push(`${f.split("src/")[1]}:${i + 1}`);
  });
}
assert.deepEqual(bad, [], `matter titles printed directly, use useClientNames().name(): ${bad.join(", ")}`);

// customers in bookkeeping: hidden shows a neutral label that still tells rows apart, never the name
const cu = { id: "6f1c2a40-aaaa-bbbb-cccc-0123456789ab", name: "שם לקוח לדוגמה", i4u_customer_id: 4711 };
assert.equal(customerLabel(true, cu), "שם לקוח לדוגמה");
assert.equal(customerLabel(false, cu), "לקוח 4711", "the invoicing number when there is one");
assert.ok(!customerLabel(false, cu).includes("לדוגמה"));
assert.equal(customerLabel(false, { id: cu.id, name: cu.name }), "לקוח 89AB", "else the last four of a real id");
assert.notEqual(customerLabel(false, { id: "x-0001" }), customerLabel(false, { id: "x-0002" }), "two customers never share a label");
assert.ok(!customerLabel(false, { id: "casual:דוד כהן" }).includes("כהן") && !customerLabel(false, { id: "casual:abcdef" }).toLowerCase().includes("cdef"), "a key that is a typed name is hashed, never spelled");
assert.equal(customerLabel(false, { id: "casual:אבג" }), customerLabel(false, { id: "casual:אבג" }), "stable");
assert.equal(casualLabel(true, "דוד כהן"), "דוד כהן"); assert.ok(!casualLabel(false, "דוד כהן").includes("כהן")); assert.equal(casualLabel(false, ""), "לקוח מזדמן"); assert.equal(casualLabel(false, "דוד כהן"), casualLabel(false, " דוד כהן "));
assert.equal(hashTail("").length, 0); assert.equal(hashTail("x").length, 4);
assert.equal(customerLabel(true, { id: "a1", name: "  " }), "לקוח");
assert.equal(customerLabel(false, null), "לקוח");
assert.equal(customerLabel(true, undefined), "לקוח");
// the reason a reveal needs: a listed code, and a note for OTHER
assert.equal(reasonError("INVOICE", ""), null);
assert.equal(reasonError("COLLECTION", null), null);
assert.ok(reasonError("", "") && reasonError(null, "x") && reasonError("MADE_UP", "long enough note"), "no reason, or an unknown one, is refused");
assert.ok(reasonError("OTHER", "") && reasonError("OTHER", "abc  "), "OTHER needs a real note");
assert.equal(reasonError("OTHER", "בירור מול רשות המסים"), null);
assert.ok(reasonError("INVOICE", "x".repeat(201)), "a note over 200 characters is refused");
assert.equal(reasonLabel("COLLECTION"), "גבייה ותזכורת");
assert.equal(reasonLabel("nope"), "");
assert.equal(reasonLabel("OTHER"), "אחר", "the picker hint is not part of the phrase");
assert.equal(REVEAL_REASONS.length, 6);
console.log("client-names-check: ok");
