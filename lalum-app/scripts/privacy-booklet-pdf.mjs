// Builds the Hebrew PDF booklet on the Privacy Protection Law and Amendment 13
// from src/data/privacyLaw.json (the single home of the legal text).
// The script restyles and paginates only; it does not rewrite any claim.
//
// Usage:  node scripts/privacy-booklet-pdf.mjs
// PLAYWRIGHT_CHROMIUM may point at an existing Chromium executable.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const data = JSON.parse(readFileSync(join(root, "src", "data", "privacyLaw.json"), "utf8"));
const outDir = join(root, "public", "downloads");
const outFile = join(outDir, "lalum-hagnat-hapratiyut-tikun-13.pdf");

const AUTHOR = "ד״ר עו״ד אברהם ללום";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("[privacy-booklet] playwright is not installed.");
  process.exit(1);
}

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const base = "/opt/pw-browsers";
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      const p = join(base, d, "chrome-linux", "chrome");
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const svgUri = (f) =>
  "data:image/svg+xml;base64," + readFileSync(join(root, "public", f)).toString("base64");
const logoInverse = svgUri("lalum-logo-inverse.svg");
const logoLight = svgUri("lalum-logo.svg");

const now = new Date();
const prepared = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;

const tag = (s) => `<bdi class="tag">${esc(s)}</bdi>`;

function item(it) {
  return `<article class="item">
  <div class="item-head">${tag(it.section)}<h3>${esc(it.title)}</h3></div>
  <p class="txt">${esc(it.text)}</p>
  ${it.practical ? `<p class="prac"><strong>בפועל:</strong> ${esc(it.practical)}</p>` : ""}
</article>`;
}

const chapters = [];
let body = "";
const chapter = (id, title, inner, cls = "") => {
  chapters.push({ id, title });
  body += `<section class="chapter ${cls}" id="${id}"><h2>${esc(title)}</h2>${inner}</section>`;
};

chapter("basics", "יסודות החוק", data.basics.map(item).join(""));
data.groups.forEach((g) => chapter("g-" + g.id, g.title, g.items.map(item).join("")));
chapter("ai", "בינה מלאכותית וחוק הגנת הפרטיות",
  `<p class="intro">${esc(data.ai.intro)}</p>` + data.ai.items.map(item).join(""));
chapter("regs", "תקנות רלוונטיות",
  data.regulations.map((r) => `<article class="item"><h3>${esc(r.name)}</h3>
  <ul>${r.duties.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></article>`).join(""));
chapter("checklist", "רשימת בדיקה לארגון",
  `<ol class="check">${data.checklist.map((c) => `<li><span class="box"></span><span>${esc(c)}</span></li>`).join("")}</ol>`);
chapter("limits", "מה שלא נקרא או לא אומת",
  `<ul class="limits">${data.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`, "limits-ch");
chapter("disclaimer", "הערת שלילת אחריות",
  `<div class="disc">${esc(data.disclaimer)}</div>
   <p class="sign">${esc(AUTHOR)}</p>`);

const toc = chapters.map((c, i) => `<li><a href="#${c.id}"><span class="n">${i + 1}</span>${esc(c.title)}</a></li>`).join("");

const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${esc(data.title)}</title>
<style>
:root{--obs:#1B1B1B;--gold:#D4AF37;--cream:#FFFDD0;--bur:#800020;--ink:#262626;--mute:#5b5b5b;--line:#e3dfc0}
@page{size:A4;margin:22mm 20mm 24mm 20mm;
  @bottom-center{content:counter(page);font:9pt "Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#777}
  @top-center{content:"חוק הגנת הפרטיות ותיקון 13";font:8.5pt "Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#999;direction:rtl}}
@page :first{margin:0;@bottom-center{content:none}@top-center{content:none}}
*{box-sizing:border-box}
html{direction:rtl}
body{margin:0;font-family:"Liberation Sans","DejaVu Sans","FreeSans",Arial,sans-serif;font-size:10.5pt;line-height:1.65;color:var(--ink);background:#fff;direction:rtl;text-align:right}
.cover{height:297mm;width:210mm;background:var(--obs);color:var(--cream);padding:28mm 24mm;display:flex;flex-direction:column;page-break-after:always;break-after:page;position:relative}
.cover img{width:62mm;display:block;margin-bottom:auto}
.cover .rule{width:34mm;height:1.6mm;background:var(--gold);margin:0 0 9mm}
.cover h1{font-size:30pt;line-height:1.3;margin:0 0 7mm;color:#fff;font-weight:700;text-align:right}
.cover .sub{font-size:15pt;color:var(--gold);margin:0 0 auto}
.cover .meta{border-top:1px solid #444;padding-top:6mm;font-size:11pt;color:var(--cream)}
.cover .meta div{margin-bottom:1.5mm}
h2{font-size:18pt;color:var(--obs);margin:0 0 6mm;padding-bottom:3mm;border-bottom:2px solid var(--gold);break-after:avoid;text-align:right}
h3{font-size:12pt;margin:0;color:var(--obs);text-align:right}
.chapter{margin-bottom:10mm}
.chapter.pb{break-before:page}
.front{break-after:page}
.front h2{margin-top:0}
.toc{list-style:none;padding:0;margin:0 0 8mm}
.toc li{border-bottom:1px solid var(--line);padding:2mm 0}
.toc a{color:var(--ink);text-decoration:none}
.toc .n{display:inline-block;min-width:8mm;color:var(--gold);font-weight:700}
.lead{font-size:11.5pt;text-align:justify;margin:0 0 5mm}
.note{background:var(--cream);border-right:1.2mm solid var(--gold);padding:3mm 4mm;margin:0 0 5mm;text-align:justify}
.item{break-inside:avoid;margin:0 0 5mm;padding:3.5mm 4mm;border:1px solid var(--line);border-right:1.2mm solid var(--gold);border-radius:1mm}
.item-head{display:flex;align-items:center;gap:3mm;margin-bottom:1.5mm}
.tag{display:inline-block;direction:rtl;unicode-bidi:isolate;font-size:8pt;font-weight:700;background:var(--obs);color:var(--gold);padding:0.6mm 2.4mm;border-radius:1mm;white-space:nowrap;font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif}
.txt{margin:0 0 1.5mm;text-align:justify}
.prac{margin:0;color:var(--mute);text-align:justify;font-size:10pt}
.prac strong{color:var(--bur)}
.intro{text-align:justify;margin:0 0 5mm}
ul{margin:2mm 0 0;padding:0 5mm 0 0}
li{margin-bottom:1.5mm;text-align:justify}
.check{list-style:none;padding:0;margin:0}
.check li{display:flex;gap:3mm;align-items:flex-start;break-inside:avoid;border-bottom:1px solid var(--line);padding:2.2mm 0;margin:0}
.box{flex:0 0 4mm;height:4mm;border:1.2px solid var(--obs);margin-top:1.4mm;border-radius:0.6mm}
.limits-ch{break-before:page}
.limits-ch h2{border-bottom-color:var(--bur);color:var(--bur)}
.limits{list-style:none;padding:0;margin:0;background:var(--cream);border:1.5px solid var(--bur);border-radius:1.5mm;padding:5mm 6mm}
.limits li{border-bottom:1px solid #e6d9a0;padding:2.5mm 0;margin:0;font-size:11pt;break-inside:avoid}
.limits li:last-child{border-bottom:0}
.limits li::before{content:"";display:inline-block;width:2.4mm;height:2.4mm;background:var(--bur);margin-left:3mm;border-radius:50%}
.disc{background:var(--obs);color:var(--cream);padding:5mm 6mm;border-radius:1.5mm;text-align:justify;font-size:10.5pt;border-right:1.5mm solid var(--gold)}
.sign{margin:8mm 0 0;font-weight:700;text-align:right;color:var(--obs)}
.ltr{direction:ltr;unicode-bidi:isolate}
</style></head><body>
<section class="cover">
  <img src="${logoInverse}" alt="LALUM">
  <div class="rule"></div>
  <h1>${esc(data.title)}</h1>
  <p class="sub">מדריך מנוסח החוק הישראלי</p>
  <div class="meta"><div>${esc(AUTHOR)}</div><div>תאריך הכנה: ${prepared}</div></div>
</section>
<section class="front">
  <h2>תוכן העניינים</h2>
  <ol class="toc">${toc}</ol>
  <p class="lead">${esc(data.lead)}</p>
  <p class="note">${esc(data.published)}</p>
  <p class="note">חוברת זו מציגה את תוכן המדריך בצורה מסודרת לעיון ולהדפסה. כל סעיף מסומן בתג עם מספר הסעיף, ובסוף החוברת מפורט מה לא נקרא או לא אומת.</p>
</section>
${body}
</body></html>`;

mkdirSync(outDir, { recursive: true });
const htmlPath = process.env.PRIVACY_BOOKLET_HTML;
if (htmlPath) writeFileSync(htmlPath, html);

const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: outFile, format: "A4", printBackground: true, preferCSSPageSize: true });
} finally {
  await browser.close();
}
console.log(`[privacy-booklet] wrote ${outFile} (${(statSync(outFile).size / 1024).toFixed(0)} KB)`);
