// Checks the name heuristics of the PII shield on a labelled set. Run with: npm run name-check.
// The shield is cut out of supabase/functions/lalum-pipeline/index.js, so this runs the deployed code, not a model of it.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../supabase/functions/lalum-pipeline/index.js", import.meta.url), "utf8");
const from = src.indexOf("var enc=new TextEncoder");
const to = src.indexOf("var NEUTRAL_REJECTION_MESSAGE");
const dir = mkdtempSync(join(tmpdir(), "names-"));
const file = join(dir, "shield.mjs");
writeFileSync(file, `${src.slice(from, to)};export{EphemeralVault,LalumAnonymizerProxy};`);
const { EphemeralVault, LalumAnonymizerProxy } = await import(pathToFileURL(file).href);

async function names(text) {
  const vault = await EphemeralVault.create();
  const r = await new LalumAnonymizerProxy({ vault }).anonymize(text);
  return r.detections.filter((d) => d.kind === "CLIENT_NAME").map((d) => d.value);
}

// A verb after a party title is not a name.
const NOT_NAMES = [
  "התובע טוען להפרת חוזה.",
  "התובע טוען כי הנתבע הפר את ההסכם.",
  "הנתבעת מבקשת לדחות את התביעה.",
  "המשיב מסכים לתנאים.",
  "התובעת תבעה פיצוי.",
  "הנתבע הודה בחוב.",
  "המבקש עותר לסעד זמני.",
];
for (const t of NOT_NAMES) assert.deepEqual(await names(t), [], `false positive: ${t}`);

// Real names after a title are still found, whole.
const NAMES = [
  ["מר דוד כהן, ת.ז. 123456782", "דוד כהן"],
  ["התובע דוד לוי טוען כי הופר החוזה", "דוד לוי"],
  ["הנתבעת רחל כהן הפרה את ההסכם", "רחל כהן"],
  ["גב' מירב שמעוני חתמה על ההסכם", "מירב שמעוני"],
  ["עו\"ד יוסי אברהם הגיש בקשה", "יוסי אברהם"],
];
for (const [t, want] of NAMES) assert.ok((await names(t)).includes(want), `missed name in: ${t}`);

console.log(`name-check: ${NOT_NAMES.length} verb sentences left alone, ${NAMES.length} titled names still masked`);
