// Checks the pure helpers behind the reminder channel (supabase/functions/_shared/dunning.ts).
// Run with: npm run dunning-send-check
import assert from "node:assert/strict";
import { normalizeIsraeliPhone, isEmail, isTier, escapeHtml, emailHtml, templateName, templateParams, SUBJECT } from "../../supabase/functions/_shared/dunning.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("Israeli mobiles are normalised to E.164 digits, in every common spelling", () => {
  for (const raw of ["052-1234567", "0521234567", "+972 52 123 4567", "972521234567", "00972521234567", " (052) 123-4567 "]) assert.equal(normalizeIsraeliPhone(raw), "972521234567", raw);
});
t("landlines, short and foreign numbers are not WhatsApp targets", () => {
  for (const raw of ["03-1234567", "+97231234567", "+12025550123", "0521234", "05212345678", "", null, undefined, "abc"]) assert.equal(normalizeIsraeliPhone(raw), null, String(raw));
});
t("e-mail check accepts a normal address and rejects the rest", () => {
  assert.equal(isEmail("a@b.co"), true);
  for (const bad of ["", "a@b", "a b@c.d", "@c.d", null, undefined, "a@b.c".padEnd(300, "x")]) assert.equal(isEmail(bad), false, String(bad));
});
t("tier is exactly 1, 2 or 3", () => {
  assert.deepEqual([1, 2, 3, 0, 4, "1", null, 1.5].map(isTier), [true, true, true, false, false, false, false, false]);
});
t("the body is escaped, so typed markup cannot become markup in the customer's mail", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  const h = emailHtml("שורה א\nשורה ב\n\n<img src=x onerror=alert(1)>");
  assert.ok(!h.includes("<img")); assert.ok(h.includes("&lt;img")); assert.ok(h.includes("<br>")); assert.ok(h.includes('dir="rtl"'));
  assert.equal((h.match(/<p /g) ?? []).length, 2);
});
t("every tier has its own subject", () => {
  assert.equal(new Set(Object.values(SUBJECT)).size, 3);
});
t("a WhatsApp template is used only when its name is configured and well formed", () => {
  const env = (m) => (k) => m[k];
  assert.equal(templateName(2, env({ WHATSAPP_DUNNING_TEMPLATE_2: "dunning_formal" })), "dunning_formal");
  assert.equal(templateName(1, env({ WHATSAPP_DUNNING_TEMPLATE_2: "dunning_formal" })), null);
  assert.equal(templateName(3, env({ WHATSAPP_DUNNING_TEMPLATE_3: "Bad Name!" })), null);
  assert.equal(templateName(3, env({ WHATSAPP_DUNNING_TEMPLATE_3: "" })), null);
});
t("template parameters are name, amount and days, and nonsense is refused", () => {
  const p = templateParams({ name: "  אלפא\nנדל\"ן ", amount: 38000, days: 72 });
  assert.equal(p.length, 3); assert.equal(p[0], "אלפא נדל\"ן"); assert.ok(p[1].includes("38,000") || p[1].includes("38000")); assert.equal(p[2], "72");
  for (const bad of [{ name: "", amount: 5, days: 1 }, { name: "x", amount: 0, days: 1 }, { name: "x", amount: NaN, days: 1 }, { name: "x", amount: 5, days: -1 }, { name: "x", amount: 5, days: 1.5 }, { name: "x", amount: 1e9, days: 1 }]) assert.equal(templateParams(bad), null, JSON.stringify(bad));
});
