// One-off accessibility audit (not wired into the build): runs axe-core
// against a representative page from every distinct template the site
// renders, on the built dist/ output, in Hebrew and once in a translated
// language to catch RTL/LTR-specific issues. Prints violations grouped by
// rule, worst impact first, with every affected route and selector so a fix
// can be verified against the exact same run.
//
// Usage:
//   npm run build
//   node scripts/a11y-audit.mjs

import { chromium } from "playwright";
import { createServer } from "vite";
import { preview } from "vite";

const ROUTES = [
  ["/", "עמוד הבית"],
  ["/advisory/", "ייעוץ"],
  ["/ai-legal-advisory/", "AI pillar"],
  ["/ai-legal-advisory/local-authorities/", "רובריקת מגזר"],
  ["/ai-legal-advisory/tools/", "כלי אבחון"],
  ["/real-estate-legal-advisory/", "נדל\"ן pillar"],
  ["/mediation-dispute-resolution/", "גישור"],
  ["/training/", "הדרכות אינדקס"],
  ["/training/lalum-academy-real-estate/", "קורס"],
  ["/insights/", "אינדקס מאמרים"],
  ["/insights/topics/ai-governance/", "אשכול נושא"],
  ["/knowledge/", "מרכז ידע"],
  ["/rulings/", "פסיקה"],
  ["/faq/", "שאלות ותשובות"],
  ["/risk/", "אבחון סיכון"],
  ["/legal/", "תנאי שימוש"],
  ["/book/", "קביעת פגישה"],
  ["/os", "LALUM LEX"],
  ["/en/", "עמוד הבית, אנגלית (LTR)"],
  ["/ar/", "עמוד הבית, ערבית (RTL)"],
];

// A blog article slug is read from the built index rather than hardcoded,
// since slugs rotate as the content lane publishes.
async function firstArticleSlug() {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { blogMeta } = await server.ssrLoadModule("/src/lib/blogMeta.ts");
    return blogMeta[0]?.slug;
  } finally {
    await server.close();
  }
}

const slug = await firstArticleSlug();
if (slug) ROUTES.push([`/insights/${slug}/`, "מאמר"]);

const server = await preview({ preview: { port: 4322, strictPort: true } });
const base = `http://localhost:4322`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const axeSource = (await import("axe-core")).default.source;

const byRule = new Map();
let pagesScanned = 0;

for (const [path, label] of ROUTES) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  try {
    const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 15000 });
    if (!res || res.status() >= 400) {
      console.log(`[skip] ${path} -> HTTP ${res?.status()}`);
      await page.close();
      continue;
    }
    // Cards on some pages fade in via a staggered CSS animation, and cards
    // below the fold may only reveal on scroll (IntersectionObserver). Both
    // read as false color-contrast violations if scanned mid-fade or
    // off-screen. Scroll through the full page and let it settle first.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      const max = document.body.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(async () => {
      return await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
    });
    pagesScanned++;
    for (const v of results.violations) {
      if (!byRule.has(v.id)) byRule.set(v.id, { impact: v.impact, help: v.help, helpUrl: v.helpUrl, hits: [] });
      const entry = byRule.get(v.id);
      for (const node of v.nodes) {
        const d = node.any?.[0]?.data;
        entry.hits.push({
          path,
          label,
          selector: node.target.join(" "),
          html: node.html.slice(0, 160),
          fg: d?.fgColor,
          bg: d?.bgColor,
          ratio: d?.contrastRatio,
          required: d?.expectedContrastRatio,
          fontSize: d?.fontSize,
          fontWeight: d?.fontWeight,
        });
      }
    }
    if (consoleErrors.length) console.log(`[js-error] ${path}: ${consoleErrors[0]}`);
  } catch (e) {
    console.log(`[error] ${path}: ${e.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
await server.close();

const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rules = [...byRule.entries()].sort(
  (a, b) => (impactOrder[a[1].impact] ?? 9) - (impactOrder[b[1].impact] ?? 9),
);

console.log(`\n${pagesScanned} pages scanned, ${rules.length} distinct rule violations\n`);
for (const [id, { impact, help, helpUrl, hits }] of rules) {
  console.log(`\n[${impact}] ${id}: ${help} (${hits.length}x)`);
  console.log(`  ${helpUrl}`);
  const byPath = new Map();
  for (const h of hits) {
    if (!byPath.has(h.path)) byPath.set(h.path, []);
    byPath.get(h.path).push(h);
  }
  for (const [path, pathHits] of byPath) {
    console.log(`  ${path}`);
    for (const h of pathHits.slice(0, 3)) {
      console.log(`    ${h.selector} :: ${h.html}`);
      if (h.fg) console.log(`      fg=${h.fg} bg=${h.bg} ratio=${h.ratio} needs=${h.required} size=${h.fontSize} weight=${h.fontWeight}`);
    }
    if (pathHits.length > 3) console.log(`    ...and ${pathHits.length - 3} more on this page`);
  }
}

if (!rules.length) console.log("No WCAG 2.0/2.1 A/AA violations found by axe-core on the scanned pages.");

// Every distinct fg/bg pair seen, for turning findings into CSS fixes without
// re-deriving colors from the cascade by hand.
const pairs = new Map();
for (const [id, { hits }] of byRule) {
  for (const h of hits) {
    if (!h.fg) continue;
    const key = `${id} ${h.fg} on ${h.bg}`;
    if (!pairs.has(key)) pairs.set(key, { id, fg: h.fg, bg: h.bg, ratio: h.ratio, required: h.required, selectors: new Set() });
    pairs.get(key).selectors.add(h.selector);
  }
}
console.log(`\n--- distinct color pairs (${pairs.size}) ---`);
for (const { id, fg, bg, ratio, required, selectors } of pairs.values()) {
  console.log(`${id}: ${fg} on ${bg} = ${ratio} (needs ${required})`);
  for (const s of selectors) console.log(`  ${s}`);
}
