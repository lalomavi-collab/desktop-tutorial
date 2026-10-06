// One-off design QA sweep (not wired into the build): checks every route in
// STATIC_ROUTES's representative set, at desktop and mobile widths, for
// horizontal overflow (scrollWidth > clientWidth, the recurring class of bug
// this project has hit before: a menu rule dropped, a fixed element measured
// against the wrong containing block) and any JS console error.
//
// Usage:
//   npm run build
//   node scripts/design-qa.mjs

import { chromium } from "playwright";
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

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 780 },
];

const server = await preview({ preview: { port: 4323, strictPort: true } });
const base = `http://localhost:4323`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

const overflow = [];
const errors = [];
let scanned = 0;

for (const vp of VIEWPORTS) {
  for (const [path, label] of ROUTES) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    try {
      const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 15000 });
      if (!res || res.status() >= 400) {
        console.log(`[skip] ${vp.name} ${path} -> HTTP ${res?.status()}`);
        await page.close();
        continue;
      }
      await page.waitForTimeout(700);
      const widths = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      scanned++;
      if (widths.scrollWidth > widths.clientWidth + 1) {
        overflow.push({ vp: vp.name, path, label, ...widths });
      }
      if (consoleErrors.length) errors.push({ vp: vp.name, path, label, error: consoleErrors[0] });
    } catch (e) {
      console.log(`[error] ${vp.name} ${path}: ${e.message}`);
    } finally {
      await page.close();
    }
  }
}

await browser.close();
await server.close();

console.log(`\n${scanned} page/viewport combinations scanned\n`);

if (overflow.length) {
  console.log(`--- horizontal overflow (${overflow.length}) ---`);
  for (const o of overflow) {
    console.log(`[${o.vp}] ${o.path} (${o.label}): scrollWidth=${o.scrollWidth} clientWidth=${o.clientWidth} (+${o.scrollWidth - o.clientWidth}px)`);
  }
} else {
  console.log("No horizontal overflow found.");
}

if (errors.length) {
  console.log(`\n--- console errors (${errors.length}) ---`);
  for (const e of errors) console.log(`[${e.vp}] ${e.path} (${e.label}): ${e.error}`);
} else {
  console.log("\nNo JS console errors found.");
}
