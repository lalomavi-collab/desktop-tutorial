// Checks the accounting number formatting. Run: npm run accounting-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/cockpit/accounting.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "accounting-"));
const file = join(dir, "a.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { acct, acctText, pctText } = await import(pathToFileURL(file).href);

assert.deepEqual(acct(76620.34), { neg: false, zero: false, text: "76,620.34" });
assert.deepEqual(acct(-21438.77), { neg: true, zero: false, text: "21,438.77" });
assert.deepEqual(acct(0), { neg: false, zero: true, text: "0.00" });
assert.deepEqual(acct(12000), { neg: false, zero: false, text: "12,000.00" });
assert.equal(acct(1234567.891).text, "1,234,567.89");
// A figure that rounds to zero is a zero, never a red "minus zero".
assert.deepEqual(acct(-0.004), { neg: false, zero: true, text: "0.00" });
assert.deepEqual(acct(0.004), { neg: false, zero: true, text: "0.00" });
assert.equal(acct(-0.005).neg, true);
// Missing or broken input is shown as zero rather than NaN.
for (const bad of [null, undefined, NaN, Infinity, -Infinity]) assert.deepEqual(acct(bad), { neg: false, zero: true, text: "0.00" }, String(bad));
// Every figure in a column has two decimals, so the decimal points line up.
for (const n of [0, 5, 5.5, 5.55, 1000, 99999.999]) assert.match(acct(n).text, /^\d{1,3}(,\d{3})*\.\d{2}$/, String(n));

assert.equal(acctText(-21438.77), "−21,438.77");
assert.equal(acctText(21438.77), "21,438.77");
assert.equal(acctText(21438.77, true), "+21,438.77");
assert.equal(acctText(0, true), "0.00");
assert.equal(acctText(-0.004), "0.00");

assert.equal(pctText(14.9), "+14.9%");
assert.equal(pctText(-28), "−28%");
assert.equal(pctText(0), "0%");
console.log("accounting-check: ok");
