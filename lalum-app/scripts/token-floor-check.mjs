// Checks that a token number is never issued twice within a document, against the shield code in the
// repo copy of the deployed lalum-pipeline function. Run with: npm run token-floor-check
// The shield is cut out of supabase/functions/lalum-pipeline/index.js (everything before the conflict
// engine) and loaded as a module, so the test runs the same code that is deployed, not a model of it.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../supabase/functions/lalum-pipeline/index.js", import.meta.url), "utf8");
const from = src.indexOf("var enc=new TextEncoder");
const to = src.indexOf("var NEUTRAL_REJECTION_MESSAGE");
assert.ok(from > 0 && to > from, "shield markers not found");
const dir = mkdtempSync(join(tmpdir(), "shield-"));
const file = join(dir, "shield.mjs");
writeFileSync(file, `${src.slice(from, to)};export{EphemeralVault,LalumAnonymizerProxy,PiiLeakError};`);
const { EphemeralVault, LalumAnonymizerProxy } = await import(pathToFileURL(file).href);

const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };

/** What the draft route does. `floor` is what lalum_token_floor returns for the document. */
async function draft(content, floor = null) {
  const vault = await EphemeralVault.create();
  try {
    const shield = new LalumAnonymizerProxy({ vault });
    shield.reserveFrom(content);
    if (floor) for (const [k, n] of Object.entries(floor)) vault.reserve(k, n);
    return (await shield.anonymize(content)).masked;
  } finally { vault.dispose(); }
}

await t("the shield still masks what it masked (regression on the repo copy)", async () => {
  const out = await draft("מר דנה כהן ת.ז. 123456782 דוא\"ל dana@example.com טלפון 052-2490420 גוש 6000 חלקה 12");
  assert.match(out, /\[CLIENT_NAME_1\]/);
  assert.match(out, /\[ID_NUMBER_\d+\]/);
  assert.match(out, /\[EMAIL_1\]/);
  assert.match(out, /\[PHONE_1\]/);
  assert.match(out, /\[LAND_PARCEL_1\].*\[LAND_PARCEL_2\]/);
  assert.ok(!/123456782|dana@example|052-2490420/.test(out), "an identifier survived");
});

await t("failure reproduced: without the floor a deleted token number is reused", async () => {
  // The upload issued _1 (Alice) and _2 (Bob). Bob's sentence is deleted and a new name is typed.
  const content = "[CLIENT_NAME_1] מוכרת את הנכס. הקונה הוא מר שמעון גולן.";
  const out = await draft(content);
  assert.match(out, /\[CLIENT_NAME_2\]/, "expected the old behaviour to reuse _2");
});

await t("fixed: with the floor from everything the document ever held, _2 is not reused", async () => {
  const content = "[CLIENT_NAME_1] מוכרת את הנכס. הקונה הוא מר שמעון גולן.";
  const out = await draft(content, { CLIENT_NAME: 2 });
  assert.ok(!/\[CLIENT_NAME_2\]/.test(out), "token _2 was issued again");
  assert.match(out, /\[CLIENT_NAME_3\]/);
});

await t("the floor is per kind and never lowers a counter", async () => {
  const out = await draft("[CLIENT_NAME_5] ו מר שמעון גולן", { CLIENT_NAME: 2, EMAIL: 9 });
  assert.match(out, /\[CLIENT_NAME_6\]/, "the current content already carries _5, a lower floor must not win");
});

await t("the deployed route actually asks for the floor and ignores a malformed answer", async () => {
  assert.match(src, /sb\.rpc\("lalum_token_floor",\{p_doc:document_id,p_firm:u\.firmId\}\)/);
  assert.match(src, /\/\^\[A-Z\]\[A-Z_\]\*\$\/\.test\(k\)&&Number\.isInteger\(n\)/);
});

console.log("\nAll token floor checks passed");
