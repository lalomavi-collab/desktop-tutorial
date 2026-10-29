// Text clarity floor for the cockpit (management system). Run with: npm run cockpit-text-check
// 1) No text smaller than 13px in the cockpit stylesheets or in inline styles of the cockpit screens (raised from 12px, 29.10.2026).
// 2) Every text and status token clears WCAG AA (4.5:1) on every surface it sits on, in both themes.
// The tokens are read from the stylesheets themselves, so a palette edit that breaks legibility fails here.
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const dir = new URL("../src/styles/", import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), "utf8");
const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

// 1) font-size floor
const MIN = 13;
t(`no cockpit text under ${MIN}px`, () => {
  const bad = [];
  for (const f of readdirSync(dir).filter((x) => /^cockpit.*\.css$/.test(x))) {
    read(f).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/font-size:\s*([\d.]+)px/g)) if (parseFloat(m[1]) < MIN) bad.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  const src = new URL("../src/", import.meta.url);
  for (const d of ["pages/cockpit/", "pages/cockpit/finance/", "components/cockpit/"]) {
    for (const f of readdirSync(new URL(d, src)).filter((x) => x.endsWith(".tsx"))) {
      readFileSync(new URL(d + f, src), "utf8").split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/fontSize:\s*([\d.]+)\b/g)) if (parseFloat(m[1]) < MIN) bad.push(`${d}${f}:${i + 1} ${m[0]}`);
      });
    }
  }
  assert.deepEqual(bad, [], `text below ${MIN}px:\n${bad.join("\n")}`);
});

// 2) token contrast
const block = (css, sel) => {
  const i = css.indexOf(sel + " {");
  assert.ok(i >= 0, `block not found: ${sel}`);
  return css.slice(i, css.indexOf("}", i));
};
const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
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

const base = tokens(block(read("cockpit.css"), ".ck-root"));
const themes = {
  "dark (instrument panel)": { ...base, ...tokens(block(read("cockpit-mint.css"), '.ck-root[data-ck-theme="dark"]')) },
  "mint (light)": { ...base, ...tokens(block(read("cockpit-mint.css"), '.ck-root[data-ck-theme="mint"]')) },
};
for (const [name, tk] of Object.entries(themes)) {
  t(`AA contrast: ${name}`, () => {
    const ivory = rgb(tk.ivory);
    const surfaces = { canvas: ivory, card: rgb(tk.card, ivory), tint: rgb(tk["clay-tint"], ivory) };
    const fails = [];
    for (const [sn, s] of Object.entries(surfaces)) {
      for (const k of ["ink", "slate", "clay", "danger", "warning", "success"]) {
        const r = ratio(rgb(tk[k], s), s);
        if (r < 4.5) fails.push(`${k} on ${sn}: ${r.toFixed(2)}:1`);
      }
    }
    const fill = ratio(rgb(tk["on-clay"]), rgb(tk.clay));
    if (fill < 4.5) fails.push(`on-clay on clay fill: ${fill.toFixed(2)}:1`);
    assert.deepEqual(fails, [], fails.join("\n"));
  });
}
