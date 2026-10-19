// Renders the quote cards of one short interview, and refuses to unless every
// integrity rule in docs/interviews/README.md is recorded as met in the record.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright \
//     node scripts/interview-cards.mjs docs/interviews/records/2026-01.json [--out DIR]
//
// The gate is the point. A card carries a person's name, role and words, so it
// is only made when: the role was verified from a public source, the consent is
// signed, the transcript passed the anonymization check, each answer was
// approved by the interviewee in writing, and the owner marked the record
// approvedForPublication. Anything missing stops the script with the list of
// what is missing. Output goes to posts/interviews/<id>/ (a draft area, not the
// site); posting follows the approval flow in CLAUDE.md.
//
// The wordmark is the supplied artwork (public/lalum-logo-inverse.svg).
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordPath = process.argv[2];
const outFlag = process.argv.indexOf("--out");
if (!recordPath) {
  console.error("usage: node scripts/interview-cards.mjs <record.json> [--out DIR]");
  process.exit(2);
}
const rec = JSON.parse(readFileSync(path.resolve(recordPath), "utf8"));

// ---- the gate ----
const missing = [];
const need = (ok, what) => { if (!ok) missing.push(what); };
const who = rec.interviewee || {};
need(rec.id, "id");
need(who.name?.trim(), "interviewee.name");
need(who.role?.trim(), "interviewee.role");
need(who.organization?.trim(), "interviewee.organization");
need(/^https?:\/\//.test(who.roleSourceUrl || ""), "interviewee.roleSourceUrl (a public source)");
need(who.roleVerified === true, "interviewee.roleVerified");
need(rec.consentSigned === true, "consentSigned");
need(rec.anonymizationChecked === true, "anonymizationChecked");
need(Array.isArray(rec.answers) && rec.answers.length === 3, "exactly three answers");
(rec.answers || []).forEach((a, i) => {
  need(a.quote?.trim(), `answers[${i}].quote`);
  need(a.approvedByInterviewee === true, `answers[${i}].approvedByInterviewee`);
});
need(rec.approvedForPublication === true, "approvedForPublication (set by the owner)");
if (missing.length) {
  console.error("REFUSED. Not met:\n  - " + missing.join("\n  - "));
  process.exit(1);
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="logo" ');
const out = outFlag > -1 ? path.resolve(process.argv[outFlag + 1]) : path.resolve(root, "../posts/interviews", rec.id);
mkdirSync(out, { recursive: true });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card(i, w, h) {
  const a = rec.answers[i];
  const big = w === 1200 ? 46 : 54;
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif}
.c{width:${w}px;height:${h}px;position:relative;padding:${w === 1200 ? 70 : 90}px;background:linear-gradient(145deg,#1B1B1B 0%,#0A0A0A 62%,#1a0a0f 100%);display:flex;flex-direction:column;justify-content:center}
.bar{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#D4AF37,#F5E6A3,#D4AF37)}
.k{color:#D4AF37;font-size:26px;font-weight:700;letter-spacing:1px;margin-bottom:18px}
.q{color:#FFFDD0;opacity:.75;font-size:26px;line-height:1.35;margin-bottom:28px}
.t{color:#FFFDD0;font-size:${big}px;line-height:1.3;font-weight:700}
.r{width:110px;height:6px;background:#800020;margin:34px 0 22px}
.n{color:#D4AF37;font-size:30px;font-weight:700}
.o{color:#FFFDD0;opacity:.8;font-size:24px;margin-top:6px}
.logo{position:absolute;bottom:${w === 1200 ? 36 : 54}px;right:${w === 1200 ? 70 : 90}px;width:180px;opacity:.95}
</style><body><div class="c"><div class="bar"></div>
<div class="k">ראיון קצר · שאלה ${i + 1} מתוך 3</div>
<div class="q">${esc(a.question)}</div>
<div class="t">״${esc(a.quote)}״</div>
<div class="r"></div>
<div class="n">${esc(who.name)}</div>
<div class="o">${esc(who.role)}, ${esc(who.organization)}</div>
${logo}</div></body></html>`;
}

const browser = await chromium.launch();
for (let i = 0; i < 3; i++) {
  for (const [tag, w, h] of [["wide", 1200, 630], ["square", 1080, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(card(i, w, h));
    await page.screenshot({ path: path.join(out, `q${i + 1}_${tag}.png`) });
    await page.close();
  }
}
await browser.close();
console.log(`wrote 6 cards to ${out}`);
