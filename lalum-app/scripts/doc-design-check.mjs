// Checks the document design engine (docDesign.ts) and its renderer (docDesignRender.ts). Run: npm run doc-design-check
// The rule that matters most: a design changes how a document looks, never what it says. Every layout, every table style and every
// density is rendered for every document type, and each required detail of that type must be on the page.
import assert from "node:assert/strict";
import {
  LAYOUTS, FONTS, REQUIRED_FIELDS, QUESTIONS, DEFAULT_ANSWERS, DEFAULT_SPEC, CURATED, buildPalette, checkDesign, contrast, darkenUntil,
  logoColours, suggestDesigns, parseSpec, i4uLogoSize, invoice4uHints, rng,
} from "../src/lib/cockpit/docDesign.ts";
import { renderDocument, sampleDoc, safeLogoUrl, fontsHref, esc, WATERMARK } from "../src/lib/cockpit/docDesignRender.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const issuer = { name: "LALUM", taxId: "031471261", entity: "INDIVIDUAL", address: "מדינת היהודים 85, הרצליה פיתוח", phone: "052-2490420", email: "avraham@lalum.co" };
const brand = { logoUrl: "/lalum-logo.svg", logoAlt: "LALUM", bank: { bank: "לאומי", branch: "855", account: "04122082" }, footerNote: "תודה" };
const reqKeys = (html) => new Set([...html.matchAll(/data-req="([a-z_]+)"/g)].map((m) => m[1]));

t("every layout x table x density renders every required detail of every document type", () => {
  for (const layout of Object.keys(LAYOUTS)) for (const table of ["lines", "zebra", "boxed"]) for (const density of ["airy", "regular", "compact"]) {
    const spec = { ...DEFAULT_SPEC, layout, table, density, showBank: true };
    for (const type of Object.keys(REQUIRED_FIELDS)) {
      const { customer, doc } = sampleDoc(type);
      for (const mode of ["sample", "preview"]) {
        const html = renderDocument(spec, brand, issuer, customer, doc, { mode });
        const have = reqKeys(html);
        for (const k of REQUIRED_FIELDS[type]) assert.ok(have.has(k), `${layout}/${table}/${density} ${type}: missing ${k}`);
        assert.ok(html.includes(esc(WATERMARK[mode])), `${layout} ${type} ${mode}: no watermark`);
        assert.match(html, /<html lang="he" dir="rtl">/);
      }
    }
  }
});

t("the copy label says original or true copy, never nothing", () => {
  const { customer, doc } = sampleDoc("INVOICE");
  assert.match(renderDocument(DEFAULT_SPEC, brand, issuer, customer, doc, { mode: "sample" }), /data-req="copy_label">מקור</);
  assert.match(renderDocument(DEFAULT_SPEC, brand, issuer, customer, doc, { mode: "sample", copy: true }), /data-req="copy_label">העתק נאמן למקור</);
});

t("text from the ledger is escaped; a hostile logo source is dropped", () => {
  const { doc } = sampleDoc("INVOICE");
  const html = renderDocument(DEFAULT_SPEC, { ...brand, logoUrl: "javascript:alert(1)" }, { ...issuer, name: "<script>x</script>" },
    { name: '"><img src=x onerror=alert(1)>', taxId: null }, { ...doc, lines: [{ name: "<b>שורה</b>", qty: 1, price: 1 }], notes: "<i>n</i>" }, { mode: "preview" });
  assert.ok(!html.includes("<script>x"), "issuer name not escaped");
  assert.ok(!html.includes("<img src=x") && html.includes("&lt;img src=x"), "customer name not escaped");
  assert.ok(!html.includes("<b>שורה"), "line not escaped");
  assert.ok(!html.includes("javascript:"), "logo source not dropped");
  assert.equal(safeLogoUrl("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safeLogoUrl("data:text/html;base64,PHNjcmlwdD4="), null);
  assert.equal(safeLogoUrl("/lalum-logo.svg"), "/lalum-logo.svg");
  assert.equal(safeLogoUrl('/x" onload="y'), null);
  assert.equal(safeLogoUrl("http://insecure.example/logo.png"), null);
});

t("no forbidden dashes in any rendered page or in the questionnaire (CLAUDE.md)", () => {
  const texts = [JSON.stringify(QUESTIONS), JSON.stringify(Object.values(LAYOUTS)), invoice4uHints(DEFAULT_SPEC).join(" ")];
  for (const type of Object.keys(REQUIRED_FIELDS)) { const { customer, doc } = sampleDoc(type); texts.push(renderDocument(DEFAULT_SPEC, brand, issuer, customer, doc, { mode: "sample" }).replace(/<style>[\s\S]*?<\/style>/, "")); }
  for (const s of texts) assert.ok(!/[–—]| - /.test(s), `dash found in: ${s.slice(0, 120)}`);
});

t("the questionnaire's options are the values the generator understands", () => {
  for (const q of QUESTIONS) assert.ok(q.options.some(([v]) => v === DEFAULT_ANSWERS[q.key]), `${q.key}: default not an option`);
});

t("palettes clear contrast: body text 7:1, secondary and headings 4.5:1, also from a pale logo colour", () => {
  for (const [p, a] of [["#ffd400", "#00a0e0"], ["#d4af37", "#1b1b1b"], ["#f2f2f2", "#cccccc"], ["#1b1b1b", "#d4af37"], ["#00ff00", "#ff00ff"]]) {
    const pal = buildPalette(p, a);
    assert.ok(contrast(pal.ink, pal.paper) >= 7, `ink ${p}`);
    assert.ok(contrast(pal.muted, pal.paper) >= 4.5, `muted ${p}`);
    assert.ok(contrast(pal.primary, pal.paper) >= 4.5, `primary ${p}`);
  }
  assert.ok(contrast(darkenUntil("#ffee88", "#ffffff", 4.5), "#ffffff") >= 4.5);
  for (const c of CURATED) assert.deepEqual(checkDesign({ ...DEFAULT_SPEC, palette: buildPalette(c.primary, c.accent) }), [], c.name);
});

t("logo colours: background and anti-aliasing are not colours; a black wordmark is neutral", () => {
  const px = (r, g, b, a, n) => Array.from({ length: n }, () => [r, g, b, a]).flat();
  const twoColour = [...px(255, 255, 255, 255, 500), ...px(0, 0, 0, 0, 500), ...px(200, 30, 40, 255, 300), ...px(202, 32, 41, 255, 20), ...px(20, 60, 140, 255, 150)];
  const r = logoColours(twoColour);
  assert.equal(r.neutral, false);
  assert.equal(r.colours.length, 2, JSON.stringify(r));
  assert.ok(r.colours[0].startsWith("#c"), r.colours[0]);
  const wordmark = logoColours([...px(255, 255, 255, 255, 800), ...px(20, 20, 20, 255, 400), ...px(128, 128, 128, 255, 40)]);
  assert.equal(wordmark.neutral, true);
});

t("suggestions: valid, distinct, deterministic per page, and there is always a next page", () => {
  const neutral = { colours: [], neutral: true }, red = { colours: ["#c81e28", "#143c8c"], neutral: false };
  for (const logo of [neutral, red]) for (const tone of ["classic", "modern", "minimal", "bold"]) for (const colour of ["restrained", "balanced", "strong"]) for (const type of ["serif", "sans", "mix"]) {
    const a = { ...DEFAULT_ANSWERS, tone, colour, type };
    const p0 = suggestDesigns(a, logo, 0), again = suggestDesigns(a, logo, 0);
    assert.equal(p0.length, 6, `${tone}/${colour}/${type}`);
    assert.deepEqual(p0.map((s) => s.key), again.map((s) => s.key));
    assert.equal(new Set(p0.map((s) => s.key)).size, 6);
    for (const s of p0) { assert.deepEqual(checkDesign(s.spec), [], s.name); assert.ok(!FONTS[s.spec.fonts.body].headingOnly); }
    if (colour === "restrained") for (const s of p0) assert.ok(s.spec.layout !== "band" && s.spec.layout !== "sidebar", "restrained gave a colour band");
    for (let page = 1; page <= 5; page++) assert.ok(suggestDesigns(a, logo, page).length >= 4, `page ${page} ran dry`);
  }
  const fromLogo = suggestDesigns(DEFAULT_ANSWERS, red, 0);
  assert.ok(fromLogo.some((s) => s.why.includes("מהלוגו")), "a coloured logo should lead with its own colours");
  for (const s of fromLogo) assert.ok(s.fonts.length >= 1 && s.fonts.every((f) => typeof f === "string"));
  assert.equal(rng(5)(), rng(5)());
});

t("a damaged stored spec falls back to the default instead of breaking the screen", () => {
  assert.equal(parseSpec(null), DEFAULT_SPEC);
  assert.equal(parseSpec({ v: 1, layout: "nope" }), DEFAULT_SPEC);
  assert.equal(parseSpec({ ...DEFAULT_SPEC, palette: { ...DEFAULT_SPEC.palette, ink: "#eeeeee" } }), DEFAULT_SPEC);
  const ok = { ...DEFAULT_SPEC, layout: "band" };
  assert.equal(parseSpec(ok), ok);
});

t("Invoice4U logo box: the long side becomes 250, the ratio is kept", () => {
  assert.deepEqual(i4uLogoSize(442, 71), { w: 250, h: 40 });
  assert.deepEqual(i4uLogoSize(100, 400), { w: 63, h: 250 });
  assert.deepEqual(i4uLogoSize(0, 0), { w: 250, h: 250 });
});

t("fonts: Google families only from the allow list; the app's own serif loads from this origin", () => {
  assert.equal(fontsHref(["lalumSerif"]), null);
  assert.match(fontsHref(["frank", "heebo", "heebo"]), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Frank\+Ruhl\+Libre[^&]*&family=Heebo/);
});
