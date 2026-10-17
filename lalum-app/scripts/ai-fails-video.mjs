// Renders episode 1 of "AI fails in court" ("Five days"): a silent 60 second
// vertical video (9:16) built only from the verified texts of two Supreme Court
// judgments (docs/ai-failures/verified-cases.md, script in
// docs/ai-failures/episode-01.script.he.md).
//
// Every figure and quotation on screen is read from the official judgments:
// HCJ 38379-12-24 (23.2.2025) and HCJ 23602-01-25 (28.2.2025). Where the
// original has a dash inside a quotation, an ellipsis marks the cut. No lawyer
// is named. The three checks at the end are labelled as ours, not the court's.
//
// Output goes to posts/ai-fails/, not to the site: publishing a video follows
// the approval flow in CLAUDE.md.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/ai-fails-video.mjs
//
// Needs ffmpeg on PATH. The wordmark is the supplied artwork
// (public/lalum-logo-inverse.svg), never a typeface.
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const W = 720;
const H = 1280;
const FPS = 30;
const DUR = 60;
const out = path.resolve(root, "../posts/ai-fails");
mkdirSync(out, { recursive: true });
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-aifails-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });

const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 22%,#223a29 0%,#142019 55%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:48px 48px}
.wm{position:absolute;left:50%;top:60px;width:230px;transform:translateX(-50%);opacity:.9}
.sc{position:absolute;left:56px;right:56px;top:310px;opacity:0}
.tag{font-size:26px;font-weight:700;color:#9fc4a2;letter-spacing:.3px;margin-bottom:26px}
.big{font-size:230px;font-weight:700;line-height:1;color:#f5f1e8;letter-spacing:-6px}
.cap{font-size:40px;line-height:1.3;font-weight:700;margin-top:20px}
.sub{font-size:30px;line-height:1.4;color:#cfd9cb;margin-top:18px}
.q{font-size:50px;line-height:1.3;font-weight:700}
.q small{display:block;font-size:26px;font-weight:700;color:#9fc4a2;margin-bottom:16px;letter-spacing:.3px}
.amber{color:#e7c27a}
.rule{display:block;width:70px;height:4px;background:#769d79;margin:0 0 26px}
.sq{display:grid;grid-template-columns:repeat(12,1fr);gap:8px;margin-top:34px}
.sq i{display:block;aspect-ratio:1;border-radius:6px;background:#26402c;border:1.5px solid #3a5a42}
.sq i.x{background:#3a2d12;border-color:#e7c27a}
.stamp{display:inline-block;border:4px solid #e7c27a;color:#e7c27a;border-radius:12px;padding:12px 24px;font-size:40px;font-weight:700;transform:rotate(-3deg);margin-top:30px}
.row{display:flex;align-items:center;gap:20px;margin:34px 0}
.node{width:26px;height:26px;border-radius:50%;background:#e7ede4;flex:none}
.line{flex:1;height:4px;background:#3a5a42;position:relative}
.line b{position:absolute;inset:0;background:#769d79;width:0}
.dt{font-size:34px;font-weight:700}
.chk{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:700;margin:22px 0;opacity:0}
.chk em{flex:none;width:50px;height:50px;border-radius:12px;border:3px solid #769d79;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:34px;color:#9fc4a2}
.foot{position:absolute;left:56px;right:56px;bottom:60px;font-size:22px;color:#9fb09c;line-height:1.4;text-align:center;opacity:0}
.end{position:absolute;left:0;right:0;top:470px;text-align:center;opacity:0}
.end b{display:block;font-size:46px}
.end span{display:block;margin-top:16px;font-size:28px;color:#b8c7b3}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="wmTop" style="position:absolute;inset:0">${logo}</div>

<div class="sc" id="A">
  <div class="tag" dir="ltr" style="text-align:right">בג״ץ 38379-12-24 · 23.2.2025</div>
  <div class="big" id="n36">0</div>
  <div class="cap">פסקי דין שעליהם נסמכה העתירה</div>
  <div class="sq" id="sq"></div>
  <div class="sub amber" id="five" style="opacity:0">חמש מהן: פסקי דין שכלל אינם קיימים במאגרים</div>
</div>

<div class="sc" id="B">
  <div class="tag">מה אמרה באת כוח העותרת</div>
  <div class="q" id="b1" style="opacity:0"><i class="rule"></i>״אתר שהומלץ לה ע״י קולגות״<small style="margin:18px 0 0">לא טרחה לוודא, כך הודתה</small></div>
  <div class="q" id="b2" style="opacity:0;margin-top:46px"><small>הערכת בית המשפט</small>״בסבירות גבוהה״ אתר מבוסס בינה מלאכותית</div>
  <div class="q" id="b3" style="opacity:0;margin-top:46px"><small>והסנקציה?</small><span class="amber">לא הוטלה.</span> ״מקרה ראשון מסוגו״</div>
  <div class="q" id="b4" style="opacity:0;margin-top:40px"><small>אבל</small><span class="amber">״אין זו זכות אלא חובה״</span></div>
</div>

<div class="sc" id="C">
  <div class="tag" dir="ltr" style="text-align:right">בג״ץ 23602-01-25 · 28.2.2025</div>
  <div class="row"><div><div class="dt">23.2</div></div><div class="line"><b id="ln"></b></div><div><div class="dt">28.2</div></div></div>
  <div class="cap" style="font-size:78px;line-height:1.1;margin:10px 0 0" id="c1">חמישה ימים</div>
  <div class="q" id="c2" style="opacity:0;margin-top:50px"><small>כתב השופט סולברג</small>״טרם יבשה הדיו״</div>
  <div id="c3" style="opacity:0"><div class="stamp">נדחתה על הסף</div><div class="sub">חוסר ניקיון כפיים</div></div>
  <div class="cap amber" id="c4" style="opacity:0;margin-top:30px">הוצאות: 7,000 ש״ח</div>
</div>

<div class="sc" id="D">
  <div class="tag">מתוך אותו פסק דין</div>
  <div class="q" style="font-size:56px;line-height:1.35"><i class="rule"></i>״מעתה ואילך, יוחזקו העוסקים במלאכה כ׳<span class="amber">מותרים ועומדים</span>׳; התגובה השיפוטית […] תשתנה בהתאם.״</div>
  <div class="sub" style="margin-top:44px">הצהרת כוונות על תגובה שיפוטית עתידית. לא הלכה על סנקציה מסוימת.</div>
</div>

<div class="sc" id="E">
  <div class="tag">ובשני הפסקים</div>
  <div class="q" id="e1" style="opacity:0"><i class="rule"></i>לא נאמר שאסור להשתמש בכלי.<small style="margin:22px 0 0">נאמר: ״אל לנו לשפוך את התינוק עם המים״,<br>ושאין להסתמך עליו ״הסתמכות עיוורת״</small></div>
  <div class="tag" id="e2" style="opacity:0;margin-top:70px;font-size:30px;color:#e7c27a">שלוש בדיקות לפני הגשה (ההצעה שלנו)</div>
  <div class="chk" id="k1"><em>✓</em><span>האם הפסק קיים במאגר?</span></div>
  <div class="chk" id="k2"><em>✓</em><span>האם הציטוט מופיע בו?</span></div>
  <div class="chk" id="k3"><em>✓</em><span>האם הוא באמת תומך בטענה?</span></div>
</div>

<div class="end" id="end"><b>ד״ר עו״ד אברהם ללום</b><span>AI ומשפט</span></div>
<div class="foot" id="foot">הפרק מתאר שני פסקי דין של בית המשפט העליון ואינו ייעוץ משפטי. מקורות: אתר פסקי הדין של בית המשפט העליון.</div>
<script>
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const $=id=>document.getElementById(id);
const win=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));
const sq=$("sq");for(let i=0;i<36;i++){const e=document.createElement("i");sq.appendChild(e)}
const squares=[...sq.children];
const FIVE=[3,11,19,27,34];
function setIn(el,t,a,fi=.5,dy=18){const k=ease((t-a)/fi);el.style.opacity=k;el.style.transform="translateY("+((1-k)*dy)+"px)";}
window.render=function(t){
  document.body.style.opacity=t>59.4?clamp((60-t)/.6):1;
  $("wmTop").style.opacity=t<56?1:1-ease((t-56)/.6)*0;
  // scenes
  const sc=[["A",0.2,9.6],["B",9.6,22.4],["C",22.4,37.0],["D",37.0,47.0],["E",47.0,56.2]];
  sc.forEach(([id,a,b])=>{const e=$(id);const k=win(t,a,b,.45,.45);e.style.opacity=k;e.style.transform="translateY("+((1-k)*26)+"px)";});
  // A: counter and squares
  const n=Math.round(36*ease((t-0.8)/2.2));$("n36").textContent=n;
  squares.forEach((e,i)=>{e.style.opacity=t>1.2+i*.05?1:0;e.className=(FIVE.includes(i)&&t>5.2+FIVE.indexOf(i)*.35)?"x":""});
  $("five").style.opacity=ease((t-6.4)/.6);
  // B
  setIn($("b1"),t,10.4);setIn($("b2"),t,13.6);setIn($("b3"),t,17.0);setIn($("b4"),t,20.0);
  // C
  $("ln").style.width=(100*ease((t-23.2)/1.6))+"%";
  setIn($("c2"),t,27.0);setIn($("c3"),t,30.2);setIn($("c4"),t,34.0);
  // E
  setIn($("e1"),t,48.0);setIn($("e2"),t,51.0);
  setIn($("k1"),t,52.0,.4);setIn($("k2"),t,53.6,.4);setIn($("k3"),t,55.0,.4);
  $("k1").style.opacity=ease((t-52)/.4);$("k2").style.opacity=ease((t-53.6)/.4);$("k3").style.opacity=ease((t-55)/.4);
  // end card and footer
  $("end").style.opacity=ease((t-56.6)/.6);$("foot").style.opacity=ease((t-56.6)/.6)*.9;
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const total = DUR * FPS;
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
await page.evaluate(() => window.render(20.6));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();

execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "episode-01-five-days.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-q:v", "4", path.join(out, "episode-01-five-days.jpg")], { stdio: "inherit" });
console.log("wrote posts/ai-fails/episode-01-five-days.mp4 and .jpg");
