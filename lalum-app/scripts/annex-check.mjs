// Checks annex assembly: labels, order, escaping, name restore. Run with: npm run annex-check
import assert from "node:assert/strict";
import { annexLabel, buildAssemblyHtml, titleOf } from "../src/lib/cockpit/annex.ts";
import { originals, restore, tokenMap } from "../src/lib/cockpit/originals.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("annex labels run through the Hebrew letters, then numbers", () => {
  assert.equal(annexLabel(0), "נספח א׳");
  assert.equal(annexLabel(1), "נספח ב׳");
  assert.equal(annexLabel(21), "נספח ת׳");
  assert.equal(annexLabel(22), "נספח 23");
});

t("titles drop the extension", () => {
  assert.equal(titleOf("הסכם מכר.txt"), "הסכם מכר");
  assert.equal(titleOf("a.b.docx"), "a.b");
  assert.equal(titleOf(".txt"), "מסמך");
});

const A = { title: "תיק בדיקה", dateLabel: "08.10.2026", main: { title: "ראשי", content: "גוף ראשי" }, annexes: [{ title: "נסח", content: "תוכן א" }, { title: "מפרט", content: "תוכן ב" }] };

t("cover index, main first, annexes in the given order behind dividers", () => {
  const h = buildAssemblyHtml(A);
  assert.ok(h.startsWith("<!doctype html>"));
  assert.match(h, /dir="rtl" lang="he"/);
  const at = (s) => h.indexOf(s);
  assert.ok(at("גוף ראשי") < at('class="big">נספח א׳') && at('class="big">נספח א׳') < at("תוכן א") && at("תוכן א") < at('class="big">נספח ב׳') && at('class="big">נספח ב׳') < at("תוכן ב"));
  assert.equal((h.match(/class="divider"/g) ?? []).length, 2);
  assert.match(h, /<li><span class="lbl">נספח ב׳<\/span> מפרט<\/li>/);
});

t("a main document alone has no divider", () => {
  assert.equal((buildAssemblyHtml({ ...A, annexes: [] }).match(/class="divider"/g) ?? []).length, 0);
});

t("content is escaped, never executed", () => {
  const h = buildAssemblyHtml({ ...A, title: "<b>x</b>", main: { title: "<i>", content: "<script>alert(1)</script> & more" } });
  assert.ok(!h.includes("<script>"));
  assert.ok(h.includes("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more"));
  assert.ok(h.includes("&lt;b&gt;x&lt;/b&gt;"));
});

t("name restore is per document and leaves unknown tokens as they are", () => {
  originals.set("d1", { text: "דנה כהן חתמה", entities: [{ token: "[CLIENT_NAME_1]", kind: "CLIENT_NAME", start: 0, end: 7 }] });
  const m = tokenMap("d1");
  assert.equal(restore("[CLIENT_NAME_1] ו[CLIENT_NAME_2]", m), "דנה כהן ו[CLIENT_NAME_2]");
  assert.equal(tokenMap("d2"), null);
});

console.log("\nAll annex checks passed");
