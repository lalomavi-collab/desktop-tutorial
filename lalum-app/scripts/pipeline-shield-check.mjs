// Checks the name heuristics of the shield in the repo copy of the deployed lalum-pipeline function (T49, version 27).
// Run with: npm run pipeline-shield-check
// A title after the name ("John Smith, Adv", "Jane Doe Esq.", "Dan Levi CPA", "דוד כהן, עו"ד") must hide the name,
// as a title before it always did. The shield is cut out of supabase/functions/lalum-pipeline/index.js, like
// conflict-check does, so the test runs the deployed code, not a model of it. The source of the change is in
// lalomavi-collab/LALUMap (lib/ai/anonymizerProxy.ts), with the same cases in tests/pii-corpus.test.ts.
// All names are invented.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../supabase/functions/lalum-pipeline/index.js", import.meta.url), "utf8");
const from = src.indexOf("var enc=new TextEncoder");
const to = src.indexOf("var BADGE=");
const probe = /var PROBE='[^']*';/.exec(src);
assert.ok(from > 0 && to > from && probe, "shield markers not found");
const dir = mkdtempSync(join(tmpdir(), "shield-"));
const file = join(dir, "shield.mjs");
writeFileSync(file, `${src.slice(from, to)};${probe[0]};export{LalumAnonymizerProxy,EphemeralVault,PROBE};`);
const { LalumAnonymizerProxy, EphemeralVault, PROBE } = await import(pathToFileURL(file).href);

const mask = async (text) => (await new LalumAnonymizerProxy({ vault: await EphemeralVault.create(), parties: [] }).anonymize(text)).masked;
let n = 0;
const check = async (name, fn) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };

await check("a title after an English name hides the name", async () => {
  const out = await mask("Signed: John Smith, Adv. Copy to Jane Doe Esq. and Dan Levi CPA.");
  for (const name of ["John Smith", "Jane Doe", "Dan Levi"]) assert.ok(!out.includes(name), `leaked ${name}: ${out}`);
});
await check("a title after a Hebrew name, after a comma, hides the name", async () => {
  const out = await mask('בכבוד רב,\nיוסי לוינסון, עו"ד\nרונן אדלר, רו״ח');
  for (const name of ["יוסי לוינסון", "רונן אדלר"]) assert.ok(!out.includes(name), `leaked ${name}: ${out}`);
});
await check("the title and the words around the name stay", async () => {
  assert.equal(await mask("Signed: John Smith, Adv."), "Signed: [CLIENT_NAME_1], Adv.");
  assert.equal(await mask("Dr. John Smith, Esq."), "Dr. [CLIENT_NAME_1], Esq.");
  assert.equal(await mask('בכבוד רב, יוסי לוינסון, עו"ד'), 'בכבוד רב, [CLIENT_NAME_1], עו"ד');
});
await check("stop words or a bare title are not a name", async () => {
  assert.equal(await mask('הגיש אל, עו"ד'), 'הגיש אל, עו"ד');
  assert.equal(await mask('פנה לעו"ד בעניין'), 'פנה לעו"ד בעניין');
});
await check("a title before the name works as before", async () => {
  const out = await mask('עו"ד יוסי לוינסון והשמאי רונן אדלר, ו-Mr. John Smith.');
  for (const name of ["יוסי לוינסון", "רונן אדלר", "John Smith"]) assert.ok(!out.includes(name), `leaked ${name}: ${out}`);
});
await check("/selftest answers the documented string", async () => {
  assert.equal(
    await mask(PROBE),
    'מר [CLIENT_NAME_1], ת.ז. [ID_NUMBER_1], טלפון [PHONE_1], דוא"ל [EMAIL_1], ברחוב [ADDRESS_1], חשבון בנק [BANK_ACCOUNT_1], [CLIENT_NAME_2], Adv',
  );
});
console.log(`pipeline-shield-check: ${n} checks passed`);
