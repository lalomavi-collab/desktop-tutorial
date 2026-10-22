// Checks the WhatsApp reminder templates against Meta's template rules and against what the sender (lalum-fin-dunning-send) fills in.
// Run with: npm run whatsapp-templates-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templates, payload, EXAMPLE, meta, documentTemplate, documentPayload, DOC_EXAMPLE } from "./whatsapp-dunning-templates.mjs";
import { templateName, templateParams } from "../../supabase/functions/_shared/dunning.ts";
import { documentTemplateName, documentTemplateParams } from "../../supabase/functions/_shared/docSend.ts";

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

t("the document template is named the way the sender looks it up and fills exactly three variables, in order: type, number, link", () => {
  assert.equal(documentTemplateName((k) => (k === "WHATSAPP_DOCUMENT_TEMPLATE" ? documentTemplate.name : undefined)), documentTemplate.name);
  assert.deepEqual([...documentTemplate.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])), [1, 2, 3]);
  assert.equal(DOC_EXAMPLE.length, 3);
  assert.deepEqual(documentPayload().components[0].example.body_text[0], DOC_EXAMPLE);
  assert.ok(!templates.some((x) => x.name === documentTemplate.name));
});
t("the document template follows Meta's body rules", () => {
  const b = documentTemplate.body;
  assert.ok(b.length <= 1024);
  assert.ok(!/^\s*\{\{/.test(b) && !/\}\}\s*[.!?]?\s*$/.test(b) && !/\}\}\s*\{\{/.test(b));
  assert.ok(!/\n\s*\n|\t| {4,}/.test(b));
  assert.ok(b.split(/\s+/).length >= 20);
  assert.equal(documentPayload().language, "he"); assert.equal(documentPayload().category, "UTILITY");
  assert.ok(/^[a-z0-9_]+$/.test(documentTemplate.name));
});
t("the document template gets an https link and nothing else, and no dash is used as punctuation", () => {
  assert.equal(documentTemplateParams("INVOICE", 5, "http://x.co/a.pdf"), null);
  assert.equal(documentTemplateParams("INVOICE", 5, "https://x.co/a b.pdf"), null);
  assert.equal(documentTemplateParams("INVOICE", 5, null), null);
  assert.deepEqual(documentTemplateParams("INVOICE", 5, "https://x.co/a.pdf"), ["חשבונית מס", "5", "https://x.co/a.pdf"]);
  assert.ok(!/[—–]| - /.test(documentTemplate.body));
});
