// Rebuild the Open Graph preview cards from the current logo.
//
// The cards are static PNGs because LinkedIn, Facebook and X read Open Graph
// tags out of the raw HTML and never run the page's JavaScript, so every
// shareable route needs a real image file sitting at a real URL.
//
// The wordmark is inlined from public/lalum-logo.svg, which is the vector
// extracted from brand/LALUM-LOGO.pdf. Nothing here draws letters with a font:
// the logo is artwork, and a font stand-in is how a wrong mark creeps back in.
//
// Dev tool, not part of the build. It needs Playwright, which the app does not
// depend on:
//   node scripts/og-cards.mjs
// with Playwright installed anywhere; if it is a global install, point at it,
// because ESM resolution ignores NODE_PATH:
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/og-cards.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORDMARK = readFileSync(join(root, "public", "lalum-logo.svg"), "utf8");

// Track blurbs come from the scoring model itself, so a copy change there
// cannot leave the cards saying something the site no longer says.
const model = readFileSync(join(root, "src", "lib", "riskScore.ts"), "utf8");
const blurbs = [...model.matchAll(/id:\s*"(\w+)"[^}]*?blurb:\s*`([^`]+)`/g)].map((m) => [m[1], m[2]]);
if (blurbs.length !== 3) {
  console.error(`Expected 3 track blurbs in riskScore.ts, found ${blurbs.length}`);
  process.exit(1);
}

// The two areas the practice leads with get a card each, so a share of either
// pillar page shows what the page is about instead of the generic site card.
// The words come out of pillars.ts, for the same reason the track blurbs come
// out of the scoring model: a copy change there must not leave a card saying
// something the site no longer says.
const pillars = readFileSync(join(root, "src", "lib", "pillars.ts"), "utf8");
function hebrewPillar(key, until) {
  const he = pillars.slice(pillars.indexOf("const he:"), pillars.indexOf("const en:"));
  const from = he.indexOf(`  ${key}: {`);
  const block = he.slice(from, until ? he.indexOf(`  ${until}: {`) : undefined);
  const one = (field) => {
    const m = block.match(new RegExp(`${field}: \`([^\`]+)\``));
    if (!m) { console.error(`pillars.ts: no ${field} for ${key}`); process.exit(1); }
    return m[1];
  };
  const cards = [...block.matchAll(/\{ title: `([^`]+)`, body:/g)].map((m) => m[1]);
  if (cards.length < 3) { console.error(`pillars.ts: expected at least 3 cards for ${key}, found ${cards.length}`); process.exit(1); }
  // The title doubles as the page's h1, so it can carry a subtitle after a
  // colon. A card is not the place for it.
  return { eyebrow: one("heroEyebrow"), head: one("title").split(":")[0].trim(), cards: cards.slice(0, 3).map((c) => c.split(":")[0].trim()) };
}

const BANDS = {
  low: { title: "מוכנות גבוהה", fg: "#0f5d52", bg: "#e2f1f1" },
  medium: { title: "מוכנות חלקית", fg: "#8a5a10", bg: "#f7edda" },
  high: { title: "מוכנות נמוכה", fg: "#830020", bg: "#fbeef0" },
};

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #f7f4ee; font-family: "DejaVu Sans", sans-serif; }
  .card { position: relative; width: 1200px; height: 630px; padding: 56px 72px 44px; display: flex; flex-direction: column; }
  .bar { position: absolute; top: 0; bottom: 0; right: 0; width: 14px; background: #9c5b3f; }
  .logo { align-self: flex-end; width: 190px; height: auto; display: block; }
  .logo svg { width: 100%; height: auto; display: block; }
  .mid { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: right; }
  .eyebrow { font-size: 19px; font-weight: 700; letter-spacing: 3px; color: #9c5b3f; }
  .badge { margin-top: 18px; padding: 12px 30px; border-radius: 999px; font-size: 33px; font-weight: 700; }
  .head { margin-top: 26px; font-family: "DejaVu Serif", serif; font-size: 54px; line-height: 1.3; color: #1a1815; max-width: 15ch; }
  .foot { border-top: 1px solid #e0d9cd; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 21px; color: #55514a; }
  .foot .site { color: #9c5b3f; font-weight: 700; }
  .hero { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 30px; }
  .hero .logo { align-self: center; width: 420px; }
  .hero h1 { font-family: "DejaVu Serif", serif; font-size: 52px; line-height: 1.25; color: #1a1815; }
  .hero p { font-size: 30px; color: #55514a; }
  .rule { width: 90px; height: 3px; background: #9c5b3f; }
  .head.pillar { margin-top: 16px; font-size: 50px; max-width: 22ch; }
  .covers { margin-top: 24px; font-size: 24px; line-height: 1.55; color: #55514a; max-width: 36ch; }
`;

function riskCard(track, band) {
  const b = BANDS[band];
  const blurb = blurbs.find(([id]) => id === track)[1];
  return `<div class="card" dir="rtl" lang="he">
    <div class="bar"></div>
    <div class="logo">${WORDMARK}</div>
    <div class="mid">
      <p class="eyebrow">תוצאת מבדק המוכנות</p>
      <p class="badge" style="color:${b.fg};background:${b.bg}">${b.title}</p>
      <h1 class="head">${blurb}</h1>
    </div>
    <div class="foot"><span>מבדק מוכנות Tech-Legal</span><span class="site" dir="ltr">lalumapp.com</span></div>
  </div>`;
}

function introCard() {
  return `<div class="card" dir="rtl" lang="he">
    <div class="bar"></div>
    <div class="logo">${WORDMARK}</div>
    <div class="mid">
      <p class="eyebrow">מבדק מוכנות</p>
      <p class="badge" style="color:#9c5b3f;background:#f3e7de">שלוש שאלות</p>
      <h1 class="head">כמה הארגון שלכם מוכן, באמת?</h1>
    </div>
    <div class="foot"><span>מבדק מוכנות Tech-Legal</span><span class="site" dir="ltr">lalumapp.com</span></div>
  </div>`;
}

function pillarCard(p) {
  return `<div class="card" dir="rtl" lang="he">
    <div class="bar"></div>
    <div class="logo">${WORDMARK}</div>
    <div class="mid">
      <p class="eyebrow">${p.eyebrow}</p>
      <h1 class="head pillar">${p.head}</h1>
      <p class="covers">${p.cards.join(" · ")}</p>
    </div>
    <div class="foot"><span>ד"ר אברהם ללום</span><span class="site" dir="ltr">lalumapp.com</span></div>
  </div>`;
}

function siteCard() {
  return `<div class="card" dir="rtl" lang="he">
    <div class="bar"></div>
    <div class="hero">
      <div class="logo">${WORDMARK}</div>
      <div class="rule"></div>
      <h1>ייעוץ משפטי, טכנולוגי ואסטרטגי</h1>
      <p dir="ltr">Tech-Legal and AI Risk Governance</p>
    </div>
    <div class="foot"><span>ד"ר אברהם ללום</span><span class="site" dir="ltr">lalumapp.com</span></div>
  </div>`;
}

// A global install is CommonJS when imported by path, so chromium arrives on
// the default export rather than as a named one.
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const chromium = pw.chromium || pw.default?.chromium;
if (!chromium) {
  console.error("Playwright not found. Install it, or set PLAYWRIGHT_MODULE to its entry file.");
  process.exit(1);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

mkdirSync(join(root, "public", "og"), { recursive: true });
async function shoot(html, out) {
  await page.setContent(`<style>${CSS}</style>${html}`, { waitUntil: "load" });
  const buf = await page.screenshot({ type: "png" });
  writeFileSync(join(root, "public", out), buf);
  console.log(`  ${out}`);
}

console.log("OG cards:");
await shoot(siteCard(), "og-card-v2.png");
await shoot(siteCard(), "og-card.png");
for (const [track] of blurbs) {
  for (const band of Object.keys(BANDS)) await shoot(riskCard(track, band), `og/risk-${track}-${band}.png`);
}
await shoot(introCard(), "og/risk-intro.png");
await shoot(pillarCard(hebrewPillar("ai", "realEstate")), "og/pillar-ai.png");
await shoot(pillarCard(hebrewPillar("realEstate")), "og/pillar-real-estate.png");
await browser.close();
console.log("done");
