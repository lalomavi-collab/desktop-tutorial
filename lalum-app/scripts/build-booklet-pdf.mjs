// Print the sector booklets that `npm run build` emits into dist/downloads/
// into the PDFs that ship from public/downloads/.
//
// Why a separate step rather than part of the build: printing needs a browser,
// and the site's build must stay installable and runnable without one. So the
// booklet HTML is generated on every build (it therefore cannot drift from the
// page it is made of), and this script turns it into the file a municipality
// actually downloads.
//
// Usage:
//   npm run build
//   npx playwright@latest install chromium      # once, if you have no browser
//   node scripts/build-booklet-pdf.mjs
//
// PLAYWRIGHT_CHROMIUM points at an existing Chromium if you already have one.

import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const src = join(root, "dist", "downloads");
const out = join(root, "public", "downloads");

if (!existsSync(src)) {
  console.error("[booklet] dist/downloads is missing. Run `npm run build` first.");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("[booklet] playwright is not installed. Run `npx playwright@latest install chromium` and retry, or install playwright as a dev dependency.");
  process.exit(1);
}

// The booklet file name carries the sector slug; the PDF carries the name the
// page links to, so the two are matched here rather than guessed at either end.
const NAMES = {
  "local-authorities": "lalum-rashuyot-mekomiyot-ai.pdf",
  "regulatory-readiness": "lalum-tikun-13-mukhanut.pdf",
  "contract-shield": "lalum-hitkashrut-sapak-ai.pdf",
  "algorithmic-dispute": "lalum-sikhsukh-algoritmi.pdf",
};

const pages = readdirSync(src).filter((f) => f.endsWith("-booklet.html"));
if (!pages.length) {
  console.error("[booklet] no booklet HTML found in dist/downloads.");
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const page = await browser.newPage();

for (const file of pages) {
  const slug = file.replace(/-booklet\.html$/, "");
  const name = NAMES[slug];
  if (!name) {
    console.error(`[booklet] no output name is declared for the sector "${slug}". Add it to NAMES in this script and to that sector's downloads[] in src/lib/sectors.ts.`);
    process.exitCode = 1;
    continue;
  }
  await page.goto(pathToFileURL(join(src, file)).href, { waitUntil: "networkidle" });
  // The booklet loads its Hebrew face from Google Fonts. Printing before the
  // face arrives silently falls back to a default that breaks the line
  // breaking, so wait for the document to say the fonts are ready.
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(out, name),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log(`[booklet] ${slug} -> public/downloads/${name}`);
}

await browser.close();
