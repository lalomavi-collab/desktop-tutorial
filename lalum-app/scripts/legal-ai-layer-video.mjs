// Renders "the layer" explainer for the AI and law pages (public/media/lalum-legal-ai-layer.mp4
// and its poster): a silent 70 second 16:9 video.
//
// The subject: legal AI has moved from tools lawyers query to agents that carry
// work through, sold by the large platforms, and the real contest is over the
// layer the work will run through. Against the vendors' promise sits what the
// Supreme Court of Israel has said about who answers. Everything stated as fact
// on screen has a primary source (record: docs/legal-ai-layer/verified-claims.md):
//   * Google Cloud, 25.8.2026: announcement of Gemini Enterprise for Legal, in
//     preview at first; its blog (Thomas Kurian) and press release; Reuters of the
//     same day reports a race among technology companies for legal sector demand.
//   * HCJ 38379-12-24 (23.2.2025), paragraphs 26 and 15, verbatim.
// What is our own analysis is labelled as ours. No revenue, investment or adoption
// figures, no law firm names, no claim about vendors' market position.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/legal-ai-layer-video.mjs
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const W = 1280, H = 720, FPS = 30, DUR = 70;
const out = path.join(root, "public/media");
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-layer-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 30%,#1f3626 0%,#142019 55%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:56px 56px}
.wm{position:absolute;left:50%;bottom:36px;width:160px;transform:translateX(-50%);opacity:.7}
.sc{position:absolute;left:100px;right:100px;top:0;bottom:70px;display:flex;flex-direction:column;justify-content:center;opacity:0}
.h{font-size:72px;line-height:1.15;font-weight:700;letter-spacing:-1px}
.h2{font-size:54px;line-height:1.2;font-weight:700}
.amber{color:#e7c27a}.green{color:#9fc4a2}
.tag{font-size:25px;font-weight:700;color:#9fc4a2;margin-bottom:20px;letter-spacing:.3px}
.sub{font-size:31px;line-height:1.4;color:#cfd9cb;margin-top:20px}
.date{font-size:150px;font-weight:700;letter-spacing:-4px;line-height:1;direction:ltr;text-align:right}
.q{font-size:44px;line-height:1.35;font-weight:700}
.en{direction:ltr;text-align:left;font-size:34px;line-height:1.35;font-weight:700;color:#f5f1e8}
.chips{display:flex;gap:14px;margin-top:30px;flex-wrap:wrap}
.chip{font-size:29px;font-weight:700;padding:12px 22px;border-radius:14px;border:2px solid #3a5a42;background:#16241b;opacity:0}
.stack{display:flex;flex-direction:column;gap:12px;width:620px;flex:none}
.lay{font-size:32px;font-weight:700;padding:20px 26px;border-radius:16px;border:2px solid #3a5a42;background:#16241b;opacity:0}
.lay small{display:block;font-size:22px;font-weight:400;color:#9fb09c;margin-top:4px}
.lay.top{border-color:#769d79}
.row2{display:flex;gap:40px;align-items:center}
.card{flex:1;padding:26px 28px;border-radius:18px;border:2px solid #3a5a42;background:#16241b;opacity:0}
.card.am{border-color:#e7c27a}
.duty{font-size:38px;font-weight:700;margin-top:12px;opacity:0}
.duty:before{content:"";display:inline-block;width:13px;height:13px;border-radius:50%;background:#e7c27a;margin-inline-end:16px}
.pill{flex:1;text-align:center;padding:26px 14px;border-radius:18px;border:3px solid #e7c27a;color:#e7c27a;font-size:38px;font-weight:700;opacity:0}
.pill small{display:block;font-size:22px;font-weight:400;color:#cfd9cb;margin-top:8px}
.foot{position:absolute;left:100px;right:100px;bottom:92px;font-size:20px;line-height:1.4;color:#8fa38c;opacity:0}
.end{position:absolute;left:0;right:0;top:240px;text-align:center;opacity:0}
.end b{display:block;font-size:44px}.end>span{display:block;margin-top:14px;font-size:26px;color:#b8c7b3}
</style><body>
<div class="bg"></div><div class="grid"></div>

<div class="sc" id="A">
  <div class="tag">Google Cloud · Reuters</div>
  <div class="date" id="dt">25.8.2026</div>
  <div class="h2" style="margin-top:18px;font-size:46px;white-space:nowrap">גוגל מכריזה על <bdi dir="ltr" class="amber">Gemini Enterprise for Legal</bdi></div>
  <div class="sub">בשלב ראשון: גרסת preview</div>
</div>

<div class="sc" id="B">
  <div class="tag">מה היא מבטיחה, במילים של גוגל</div>
  <div class="en" id="b1">agents that complete work rather than return suggestions</div>
  <div class="q amber" id="b2" style="font-size:46px;margin-top:10px;opacity:0">סוכנים שמשלימים עבודה, במקום להחזיר הצעות</div>
  <div class="chips"><span class="chip" id="t1">בדיקת חוזים ומשא ומתן</span><span class="chip" id="t2">מעקב רגולציה</span><span class="chip" id="t3">בקשות גישה למידע</span><span class="chip" id="t4">הסתרת פרטים בכתבי בית דין</span><span class="chip" id="t5">ניסוח הסכמי סודיות</span></div>
</div>

<div class="sc" id="C">
  <div class="tag">איך זה בנוי, לפי גוגל</div>
  <div class="row2">
    <div class="stack">
      <div class="lay top" id="l3">סוכנים<small>ניסוח, מחקר, סינון, הסתרה</small></div>
      <div class="lay" id="l2">פלטפורמה ובקרה<small>מודל, הרשאות, תיעוד</small></div>
      <div class="lay" id="l1">חיבורים למערכות המשרד<small>ניהול מסמכים, מחקר, חוזים</small></div>
    </div>
    <div style="flex:1">
      <div class="sub" id="c1" style="opacity:0;margin:0">רויטרס: מרוץ בין חברות טכנולוגיה על הביקוש של התחום המשפטי ל-AI.</div>
      <div class="q amber" id="c2" style="opacity:0;margin-top:26px;font-size:40px"><span class="tag" style="display:block;margin:0 0 8px;font-size:22px">הניתוח שלנו</span>הקרב אינו על מי מנסח מהר. הוא על השכבה שדרכה תעבור העבודה.</div>
    </div>
  </div>
</div>

<div class="sc" id="D">
  <div class="tag">ומה נשאר שלא זז</div>
  <div class="row2" style="align-items:stretch">
    <div class="card" id="d1"><div class="tag" style="font-size:21px">גוגל, בבלוג ההשקה</div><div class="en" style="font-size:28px">a duty of confidentiality that does not bend for convenience</div><div class="q" style="font-size:32px;margin-top:12px">חובת סודיות שאינה מתכופפת לנוחות</div></div>
    <div class="card am" id="d2"><div class="tag" style="font-size:21px">בית המשפט העליון, 23.2.2025</div><div class="q" style="font-size:34px">״שימוש שעושים עורכי דין בכלי בינה מלאכותית, אין משמעו כי הם יכולים להתפרק <span class="amber">מאחריותם ומשיקול דעתם המקצועי</span>״</div></div>
  </div>
</div>

<div class="sc" id="E">
  <div class="tag">ומי עונה כשכתב הטענות נסמך על מקורות שאינם קיימים? (בג״ץ 38379-12-24)</div>
  <div class="q" style="font-size:40px">״עורך דין המגיש כתב בית-דין שתוכנו בדוי, תוך שהוא נסמך על אסמכתאות שאינן קיימות, <span class="amber">מועל בחובותיו</span>״</div>
  <div class="duty" id="e1">כלפי בעל הדין אותו הוא מייצג</div><div class="duty" id="e2">כלפי בית המשפט</div><div class="duty" id="e3">כלפי הצד שכנגד</div><div class="duty" id="e4">וכלפי מקצוע עריכת הדין</div>
</div>

<div class="sc" id="F">
  <div class="tag">המשמעות של התחום</div>
  <div class="h2">להפוך שימוש מהיר בכלי לשימוש <span class="amber">שאפשר לעמוד מאחוריו</span></div>
  <div class="row2" style="margin-top:36px;align-items:stretch">
    <div class="pill" id="p1">מי מאשר<small>ממשל</small></div><div class="pill" id="p2">על סמך מה<small>תיעוד</small></div><div class="pill" id="p3">מי חותם<small>בקרת אדם</small></div>
  </div>
</div>

<div class="end" id="end"><div class="h" style="font-size:60px">המכונה מסמנת. <span class="amber">האדם מכריע.</span></div><b style="margin-top:34px">ד״ר עו״ד אברהם ללום</b><span>AI ומשפט</span></div>
<div class="foot" id="foot">מקורות: הודעת Google Cloud ובלוג ההשקה (25.8.2026), Reuters (25.8.2026), בג״ץ 38379-12-24 (23.2.2025), הציטוטים כלשונם. התרגום לעברית של הציטוטים באנגלית הוא שלנו. LALUM אינה קשורה לגוגל. הסרטון אינו ייעוץ משפטי.</div>
${logo}
<script>
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const $=id=>document.getElementById(id);
const win=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));
const pop=(id,t,a,dy=14)=>{const e=$(id),k=ease((t-a)/.45);e.style.opacity=k;e.style.transform="translateY("+((1-k)*dy)+"px)"};
window.render=function(t){
  document.body.style.opacity=t>69.4?clamp((70-t)/.6):1;
  [["A",0.2,9.4],["B",9.4,22.4],["C",22.4,34.4],["D",34.4,46.4],["E",46.4,58.4],["F",58.4,66.2]].forEach(([id,a,b])=>{const k=win(t,a,b,.5,.5);const e=$(id);e.style.opacity=k;e.style.transform="translateY("+((1-k)*20)+"px)"});
  $("dt").style.opacity=ease((t-.6)/.8);
  pop("b1",t,10.4);pop("b2",t,13.0);["t1","t2","t3","t4","t5"].forEach((id,i)=>pop(id,t,15.6+i*.9));
  pop("l1",t,23.4);pop("l2",t,25.0);pop("l3",t,26.6);pop("c1",t,28.6);pop("c2",t,31.0);
  pop("d1",t,35.4);pop("d2",t,39.0);
  ["e1","e2","e3","e4"].forEach((id,i)=>pop(id,t,51.4+i*1.5));
  pop("p1",t,60.2);pop("p2",t,61.6);pop("p3",t,63.0);
  $("end").style.opacity=ease((t-66.6)/.6);
  $("foot").style.opacity=ease((t-66.6)/.6)*.9;
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
// PREVIEW=5,12,30 renders only those moments to frames/preview_*.png and stops.
if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(",").map(Number)) {
    await page.evaluate((x) => window.render(x), t);
    await page.screenshot({ path: path.join(frames, `preview_${t}.png`) });
  }
  await browser.close();
  console.log("previews in " + frames);
  process.exit(0);
}
for (let i = 0; i < DUR * FPS; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
await page.evaluate(() => window.render(30));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-legal-ai-layer.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-vf", "scale=960:-2", "-q:v", "4", path.join(out, "lalum-legal-ai-layer.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-legal-ai-layer.mp4 and .jpg");
