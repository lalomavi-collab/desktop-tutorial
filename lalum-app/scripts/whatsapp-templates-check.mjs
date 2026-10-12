// Checks the WhatsApp reminder templates against Meta's template rules and against what the sender (lalum-fin-dunning-send) fills in.
// Run with: npm run whatsapp-templates-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templates, payload, EXAMPLE, meta } from "./whatsapp-dunning-templates.mjs";
import { templateName, templateParams } from "../../supabase/functions/_shared/dunning.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("there is one template per tier, named the way the sender looks them up", () => {
  assert.deepEqual(templates.map((x) => x.tier), [1, 2, 3]);
  for (const x of templates) assert.equal(templateName(x.tier, (k) => (k === `WHATSAPP_DUNNING_TEMPLATE_${x.tier}` ? x.name : undefined)), x.name);
  assert.equal(new Set(templates.map((x) => x.name)).size, 3);
});
t("the sender fills exactly three body variables, in order: name, amount, days", () => {
  assert.equal(EXAMPLE.length, 3);
  for (const x of templates) assert.deepEqual([...x.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])), [1, 2, 3], x.name);
  assert.equal(templateParams({ name: "x", amount: 5, days: 1 }).length, 3);
});
t("Meta's body rules: length, no variable at the very start or end, no two variables next to each other, no stray whitespace", () => {
  for (const x of templates) {
    assert.ok(x.body.length <= 1024, `${x.name} length`);
    assert.ok(!/^\s*\{\{/.test(x.body), `${x.name} starts with a variable`);
    assert.ok(!/\}\}\s*[.!?]?\s*$/.test(x.body), `${x.name} ends with a variable`);
    assert.ok(!/\}\}\s*\{\{/.test(x.body), `${x.name} adjacent variables`);
    assert.ok(!/\n\s*\n|\t| {4,}/.test(x.body), `${x.name} whitespace`);
    assert.ok(x.body.split(/\s+/).length >= 20, `${x.name} too short for three variables`);
  }
});
t("the payload carries the language, the category and one example per variable", () => {
  assert.equal(meta.language, "he"); assert.equal(meta.category, "UTILITY");
  for (const x of templates) {
    const p = payload(x);
    assert.equal(p.language, "he"); assert.equal(p.components[0].type, "BODY");
    assert.equal(p.components[0].example.body_text[0].length, 3);
    assert.ok(/^[a-z0-9_]+$/.test(p.name));
  }
});
t("the examples do not break Meta's rule against newlines and long spaces inside a variable", () => {
  for (const v of EXAMPLE) assert.ok(!/[\n\t]| {4,}/.test(v));
});
t("no dash is used as punctuation in the template text", () => {
  const raw = readFileSync(new URL("./whatsapp-dunning-templates.json", import.meta.url), "utf8");
  assert.ok(!/[—–]| - /.test(raw));
});
