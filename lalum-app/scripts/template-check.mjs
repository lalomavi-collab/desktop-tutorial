// Checks the cockpit template language: conditions, nesting, Hebrew agreement, blanks and errors.
// Run with: npm run template-check
import assert from "node:assert/strict";
import { activeFields, blankFields, blockingFields, mergeTemplate, parse, TemplateError } from "../src/lib/cockpit/templates.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("plain fields and blanks", () => {
  assert.equal(mergeTemplate("א {{fee}} ב", { fee: "100" }), "א 100 ב");
  assert.match(mergeTemplate("א {{fee}} ב", {}), /\[שכר הטרחה: להשלמה בקובץ המיוצא\]/);
  assert.match(mergeTemplate("{{client_address}}", { client_address: "הרצל 1" }), /להשלמה בקובץ המיוצא/, "unmasked field never merged");
});

const COND = "{{#if track=פינוי בינוי}}PB{{else}}{{#if track=תמ\"א 38/2}}T2{{else}}OTHER{{/if}}{{/if}}";
t("if / else / nesting", () => {
  assert.equal(mergeTemplate(COND, { track: "פינוי בינוי" }), "PB");
  assert.equal(mergeTemplate(COND, { track: 'תמ"א 38/2' }), "T2");
  assert.equal(mergeTemplate(COND, { track: "x" }), "OTHER");
  assert.equal(mergeTemplate("{{#if track!=a}}N{{/if}}", { track: "b" }), "N");
  assert.equal(mergeTemplate("{{#if track!=a}}N{{/if}}", {}), "", "unset is not 'different'");
});

t("boolean condition", () => {
  assert.equal(mergeTemplate("{{#if parking}}P{{else}}-{{/if}}", { parking: "yes" }), "P");
  assert.equal(mergeTemplate("{{#if parking}}P{{else}}-{{/if}}", { parking: "no" }), "-");
});

t("condition fields are blocking until answered, options come from the body", () => {
  assert.deepEqual(blockingFields(COND, {}).map((s) => s.key), ["track"]);
  const spec = activeFields(COND, {}).find((s) => s.key === "track");
  assert.deepEqual(spec.options, ["פינוי בינוי", 'תמ"א 38/2']);
  assert.deepEqual(blockingFields(COND, { track: "x" }), []);
});

t("only active branches ask for fields", () => {
  const body = "{{#if parking}}{{parking_fee}}{{/if}}";
  assert.deepEqual(activeFields(body, { parking: "no" }).map((s) => s.key), ["parking"]);
  assert.deepEqual(activeFields(body, { parking: "yes" }).map((s) => s.key), ["parking", "parking_fee"]);
  assert.deepEqual(blankFields(body, { parking: "yes" }), ["parking_fee"]);
});

const AGREE = "{{@client:הקונה|הקונה|הקונים|הקונות}} {{@client:מתחייב|מתחייבת|מתחייבים|מתחייבות}}";
t("Hebrew gender and number", () => {
  assert.equal(mergeTemplate(AGREE, { client_gender: "m", client_number: "s" }), "הקונה מתחייב");
  assert.equal(mergeTemplate(AGREE, { client_gender: "f", client_number: "s" }), "הקונה מתחייבת");
  assert.equal(mergeTemplate(AGREE, { client_gender: "m", client_number: "p" }), "הקונים מתחייבים");
  assert.equal(mergeTemplate(AGREE, { client_gender: "f", client_number: "p" }), "הקונות מתחייבות");
  assert.equal(mergeTemplate("{{@client:א|ב|ג}}", { client_gender: "f", client_number: "p" }), "ג", "three forms: feminine plural falls back to masculine plural");
  assert.match(mergeTemplate(AGREE, {}), /\[הלקוח: בחרו מין ומספר\]/);
  assert.deepEqual(blockingFields(AGREE, {}).map((s) => s.key), ["client_gender", "client_number"]);
});

t("malformed templates are rejected, never half rendered", () => {
  for (const bad of ["{{#if a}}x", "x{{/if}}", "{{else}}", "{{@client:א|ב}}", "{{Bad Field}}", "{{#if }}x{{/if}}"]) {
    assert.throws(() => parse(bad), TemplateError, bad);
  }
});

console.log("\nAll template checks passed");
