// Checks the personal display preferences (src/lib/cockpit/ckPrefs.ts and src/styles/cockpit-prefs.css): the stored value is
// read back safely, a default sets no attribute, the zoom of every text size step matches the stylesheet, and every high contrast
// step clears AAA (7:1) for the main and the secondary text on every surface. Run with: npm run prefs-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const dir = mkdtempSync(join(tmpdir(), "ckprefs-"));
const src = readFileSync(new URL("../src/lib/cockpit/ckPrefs.ts", import.meta.url), "utf8");
// The module imports React and its stylesheet; the rules under test need neither, so both are stubbed.
const body = src.replace(/^import .*$/gm, "").replace(/^/, "const useState = () => [null, () => {}]; const useEffect = () => {};\n");
writeFileSync(join(dir, "ckPrefs.js"), ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const P = await import(pathToFileURL(join(dir, "ckPrefs.js")).href);
const css = readFileSync(new URL("../src/styles/cockpit-prefs.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/cockpit/Preferences.tsx", import.meta.url), "utf8");

t("a stored value is read back safely, field by field", () => {
  assert.deepEqual(P.parsePrefs(null), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs("not json"), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs("[1,2]"), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs('{"size":3,"contrast":true}'), { size: 3, contrast: true, motion: false });
  assert.deepEqual(P.parsePrefs('{"size":9,"contrast":"yes","motion":true}'), { size: 1, contrast: false, motion: true }, "an unknown step and a non boolean fall back");
  assert.deepEqual(P.parsePrefs('{"size":2.5}'), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs('{"size":-1}'), P.DEFAULT_PREFS);
});
t("the defaults set no attribute, so nobody who never opened the screen is touched", () => {
  assert.deepEqual(P.prefAttrs(P.DEFAULT_PREFS), { "data-ck-size": null, "data-ck-contrast": null, "data-ck-motion": null });
  assert.equal(P.isDefault(P.DEFAULT_PREFS), true);
  assert.deepEqual(P.prefAttrs({ size: 4, contrast: true, motion: true }), { "data-ck-size": "4", "data-ck-contrast": "high", "data-ck-motion": "reduce" });
  assert.deepEqual(P.prefAttrs({ size: 0, contrast: false, motion: false }), { "data-ck-size": "0", "data-ck-contrast": null, "data-ck-motion": null });
});
t("five text size steps, named in Hebrew and in English, the second is the default", () => {
  assert.equal(P.SIZE_STEPS.length, 5);
  assert.equal(P.SIZE_STEPS_EN.length, 5);
  assert.equal(P.SIZE_ZOOM.length, 5);
  assert.equal(P.DEFAULT_PREFS.size, 1);
  assert.equal(P.SIZE_ZOOM[1], 1);
  for (let i = 1; i < 5; i++) assert.ok(P.SIZE_ZOOM[i] > P.SIZE_ZOOM[i - 1], "every step is larger than the one before");
});
t("the zoom of every step in the stylesheet matches SIZE_ZOOM, and the default has no rule", () => {
  P.SIZE_ZOOM.forEach((z, i) => {
    const m = css.match(new RegExp(`html\\[data-ck-size="${i}"\\] \\{ --ck-zoom: ([\\d.]+); \\}`));
    if (i === 1) { assert.equal(m, null, "the default step sets nothing"); return; }
    assert.ok(m, `no zoom rule for step ${i}`);
    assert.equal(Number(m[1]), z, `step ${i}`);
  });
  assert.match(css, /zoom: var\(--ck-zoom\)/);
  assert.match(css, /100dvh - 190px\) \/ var\(--ck-zoom\)/, "screen tied heights are divided back");
});
t("every rule is scoped to the system's own roots, so the public site never changes", () => {
  const sels = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith("@media"));
  // Split each selector list on its top level commas only, so the commas inside :is() stay with their selector.
  const split = (s) => { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out; };
  const loose = sels.flatMap(split).filter((x) => !/\.ck-(root|entry|prefs)/.test(x) && !/^html\[data-ck-size="\d"\]$/.test(x));
  assert.deepEqual(loose, []);
});

// High contrast: every step clears AAA for --ink and --slate on the canvas, the card and the tint, in every look.
const block = (text, sel) => { const i = text.indexOf(sel + " {"); assert.ok(i >= 0, `block not found: ${sel}`); return text.slice(i, text.indexOf("}", i)); };
const tokens = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const rgb = (c, under = [255, 255, 255]) => {
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((o) => parseInt(m[1].slice(o, o + 2), 16));
  m = c.match(/rgba?\(([^)]+)\)/);
  assert.ok(m, `unparsed colour ${c}`);
  const [r, g, b, a = 1] = m[1].split(",").map(Number);
  return [r, g, b].map((v, i) => Math.round(v * a + under[i] * (1 - a)));
};
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const styles = (f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), "utf8");
const base = tokens(block(styles("cockpit.css"), ".ck-root"));
const mint = tokens(block(styles("cockpit-mint.css"), '.ck-root[data-ck-theme="mint"]'));
const dark = tokens(block(styles("cockpit-mint.css"), '.ck-root[data-ck-theme="dark"]'));
const navy = tokens(block(styles("cockpit-navy.css"), '.ck-root[data-ck-theme="mint"][data-ck-skin="navy"]'));
const hi = (sel) => tokens(block(css, `html[data-ck-contrast="high"] ${sel}`));
const looks = {
  beige: [{ ...base, ...mint }, { ...base, ...mint, ...hi('.ck-root[data-ck-theme="mint"]') }],
  navy: [{ ...base, ...mint, ...navy }, { ...base, ...mint, ...navy, ...hi('.ck-root[data-ck-theme="mint"]'), ...hi('.ck-root[data-ck-theme="mint"][data-ck-skin="navy"]') }],
  dark: [{ ...base, ...dark }, { ...base, ...dark, ...hi('.ck-root[data-ck-theme="dark"]') }],
};
const surfaces = (tk) => { const iv = rgb(tk.ivory); return { canvas: iv, card: rgb(tk.card, iv), tint: rgb(tk["clay-tint"], iv) }; };
for (const [name, [normal, high]] of Object.entries(looks)) {
  t(`high contrast, ${name}: main and secondary text reach 7:1 and are never below the normal look`, () => {
    const fails = [];
    const sN = surfaces(normal), sH = surfaces(high);
    for (const tok of ["ink", "slate"]) for (const s of Object.keys(sH)) {
      const h = ratio(rgb(high[tok], sH[s]), sH[s]);
      const n = ratio(rgb(normal[tok], sN[s]), sN[s]);
      if (h < 7) fails.push(`${tok} on ${s}: ${h.toFixed(2)}`);
      if (h + 0.01 < n) fails.push(`${tok} on ${s} drops from ${n.toFixed(2)} to ${h.toFixed(2)}`);
    }
    const onClay = ratio(rgb(high["on-clay"] ?? "#ffffff"), rgb(high.clay));
    if (onClay < 7) fails.push(`text on the accent: ${onClay.toFixed(2)}`);
    assert.deepEqual(fails, []);
  });
}

t("the screen speaks both languages and the copy keeps the house rule: no dash used as punctuation", () => {
  assert.equal(/[–—]/.test(src + css + page), false, "no en or em dash");
  const prose = (src + page + css).split("\n").filter((l) => /[֐-׿]/.test(l) || /^\s*(\/\/|\/\*|\*)/.test(l));
  assert.deepEqual(prose.filter((l) => / - /.test(l)), [], "no spaced hyphen in Hebrew copy or in a comment");
  const tx = [...page.matchAll(/tx\("([^"]*)", "([^"]*)"\)/g)];
  assert.ok(tx.length >= 12, "the copy goes through tx()");
  assert.deepEqual(tx.filter(([, he, en]) => !he || !en || !/[֐-׿]/.test(he) || /[֐-׿]/.test(en)).map((m) => m[0]), [], "each pair is Hebrew then English");
});
console.log("prefs-check: all passed");
