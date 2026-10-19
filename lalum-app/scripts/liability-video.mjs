// Renders the "who answers" explainer for the AI and law pages (public/media/lalum-liability.mp4
// and its poster): a silent 50 second 16:9 loop.
//
// Argument: a machine drafts in seconds, so what does a lawyer still sell? Tools
// already take on tasks (drafting, research, screening, redaction); above them
// sits whoever decides; and the Supreme Court has said, in terms, that using an
// AI tool does not release a lawyer from responsibility and professional
// judgment, and what a lawyer breaches by filing a brief built on sources that
// do not exist. The two quotations are verbatim from the official text of HCJ
// 38379-12-24 (23.2.2025), paragraphs 26 and 15 (docs/ai-failures/verified-cases.md).
//
// Nothing else on screen is a claim about the law or about the market: no
// figures, no vendors, no adoption rates. The wordmark is the supplied artwork.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/liability-video.mjs
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const W = 1280, H = 720, FPS = 30, DUR = 50;
const out = path.join(root, "public/media");
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-liability-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 30%,#1f3626 0%,#142019 55%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:56px 56px}
.wm{position:absolute;left:50%;bottom:40px;width:170px;transform:translateX(-50%);opacity:.75}
.sc{position:absolute;left:110px;right:110px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;opacity:0}
.h{font-size:76px;line-height:1.15;font-weight:700;letter-spacing:-1px}
.h2{font-size:58px;line-height:1.2;font-weight:700}
.amber{color:#e7c27a}
.tag{font-size:26px;font-weight:700;color:#9fc4a2;margin-bottom:22px;letter-spacing:.3px}
.sub{font-size:32px;line-height:1.4;color:#cfd9cb;margin-top:22px}
.doc{width:560px;height:20px;border-radius:10px;background:#26402c;margin-top:44px;overflow:hidden}
.doc b{display:block;height:100%;width:0;background:#769d79}
.chips{display:flex;gap:16px;margin-top:36px;flex-wrap:wrap}
.chip{font-size:32px;font-weight:700;padding:14px 26px;border-radius:14px;border:2px solid #3a5a42;background:#16241b;opacity:0}
.ctl{margin-top:34px;padding:22px 30px;border-radius:16px;border:3px solid #e7c27a;color:#e7c27a;font-size:36px;font-weight:700;opacity:0;display:inline-block;align-self:flex-start}
.q{font-size:48px;line-height:1.35;font-weight:700}
.src{font-size:24px;color:#9fc4a2;margin-top:26px}
.duty{font-size:40px;font-weight:700;margin-top:14px;opacity:0}
.duty:before{content:"";display:inline-block;width:14px;height:14px;border-radius:50%;background:#e7c27a;margin-inline-end:18px}
.foot{position:absolute;left:110px;right:110px;bottom:100px;font-size:22px;color:#9fb09c;opacity:0}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div class="sc" id="A"><div class="h">מכונה מנסחת הסכם בשניות.</div><div class="h amber" style="margin-top:14px">מה עורך הדין עדיין מוכר?</div><div class="doc"><b id="bar"></b></div></div>
<div class="sc" id="B"><div class="tag">כלים כבר עושים משימות</div>
  <div class="chips"><span class="chip" id="c1">ניסוח</span><span class="chip" id="c2">מחקר</span><span class="chip" id="c3">סינון</span><span class="chip" id="c4">הסתרת פרטים</span></div>
  <div class="ctl" id="ctl">ומעליהם: מי שמכריע ואחראי</div></div>
<div class="sc" id="C"><div class="tag">בית המשפט העליון, בג״ץ 38379-12-24, 23.2.2025</div>
  <div class="q">״שימוש שעושים עורכי דין בכלי בינה מלאכותית, אין משמעו כי הם יכולים להתפרק <span class="amber">מאחריותם ומשיקול דעתם המקצועי</span>״</div></div>
<div class="sc" id="D"><div class="tag">ומה קורה בכתב טענות שנסמך על אסמכתאות שאינן קיימות?</div>
  <div class="q" style="font-size:42px">״עורך דין המגיש כתב בית-דין שתוכנו בדוי, תוך שהוא נסמך על אסמכתאות שאינן קיימות, <span class="amber">מועל בחובותיו</span>״</div>
  <div class="duty" id="d1">כלפי בעל הדין אותו הוא מייצג</div><div class="duty" id="d2">כלפי בית המשפט</div><div class="duty" id="d3">כלפי הצד שכנגד</div><div class="duty" id="d4">וכלפי מקצוע עריכת הדין</div></div>
<div class="sc" id="E"><div class="h2">מה עורך הדין עדיין מוכר?</div><div class="h amber" style="margin-top:18px">שיקול דעת, ואחריות עליו.</div><div class="sub">המכונה מסמנת. האדם מכריע.</div></div>
<div class="foot" id="foot">הסרטון מצטט פסק דין אחד ואינו ייעוץ משפטי. הציטוטים כלשונם בנוסח הרשמי של בית המשפט העליון.</div>
${logo}
<script>
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const $=id=>document.getElementById(id);
const win=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));
const pop=(id,t,a)=>{const e=$(id),k=ease((t-a)/.4);e.style.opacity=k;e.style.transform="translateY("+((1-k)*14)+"px)"};
window.render=function(t){
  document.body.style.opacity=t>49.4?clamp((50-t)/.6):1;
  [["A",0.2,7.2],["B",7.2,17.2],["C",17.2,30.2],["D",30.2,41.2],["E",41.2,50]].forEach(([id,a,b])=>{const k=win(t,a,b,.5,id==="E"?0.01:.5);const e=$(id);e.style.opacity=k;e.style.transform="translateY("+((1-k)*20)+"px)"});
  $("bar").style.width=(100*ease((t-1.2)/1.4))+"%";
  pop("c1",t,8.4);pop("c2",t,9.4);pop("c3",t,10.4);pop("c4",t,11.4);pop("ctl",t,13.6);
  pop("d1",t,34.0);pop("d2",t,35.4);pop("d3",t,36.8);pop("d4",t,38.2);
  $("foot").style.opacity=ease((t-42.5)/.6)*.9;
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
for (let i = 0; i < DUR * FPS; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
await page.evaluate(() => window.render(21));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-liability.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-vf", "scale=960:-2", "-q:v", "4", path.join(out, "lalum-liability.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-liability.mp4 and .jpg");
