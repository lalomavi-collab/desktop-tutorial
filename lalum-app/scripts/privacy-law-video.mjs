// Renders the privacy law explainer (public/media/lalum-privacy-law.mp4 and its poster):
// a silent 16:9 Hebrew video of about 72 seconds, animated on-screen text only.
//
// Source of every legal statement on screen: src/data/privacyLaw.json (the unified text
// of the Protection of Privacy Law as read for that guide), with the section number shown
// next to each statement. Nothing is added beyond that file:
//   * the amounts are the base amounts of the text, shown with the note that they are
//     updated every year;
//   * no date of entry into force is stated;
//   * the AI points are labelled as our interpretation, and the video says plainly that
//     the text has no explicit reference to artificial intelligence.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/privacy-law-video.mjs
//   PREVIEW=3,10,24 ...   renders only those moments to PNG files and stops.
//   CHECK=1 ...           prints the word count and reading time of every scene and stops.
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const chromium = pw.chromium || pw.default.chromium;
const W = 1280, H = 720, FPS = 30, DUR = 73.5;
const out = path.join(root, "public/media");
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-privacy-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

// Scenes: id, start, end (seconds). Items inside a scene carry data-t, their reveal time.
const SCENES = [["A", 0.2, 4.7], ["B", 4.7, 18.2], ["C", 18.2, 33.0], ["D", 33.0, 46.8], ["E", 46.8, 59.3], ["F", 59.3, 67.6], ["G", 67.6, 73.4]];

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 30%,#1f3626 0%,#142019 55%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:56px 56px}
.wm{position:absolute;left:50%;bottom:30px;width:150px;transform:translateX(-50%);opacity:.7}
.sc{position:absolute;left:90px;right:90px;top:0;bottom:80px;display:flex;flex-direction:column;justify-content:center;opacity:0}
.h{font-size:76px;line-height:1.15;font-weight:700;letter-spacing:-1px}
.amber{color:#e7c27a}.green{color:#9fc4a2}
.tag{font-size:28px;font-weight:700;color:#9fc4a2;margin-bottom:18px}
.sub{font-size:40px;line-height:1.35;color:#cfd9cb;margin-top:22px}
.r{opacity:0}
.bd{display:inline-block;font-size:26px;font-weight:700;color:#e7c27a;border:2px solid #e7c27a;border-radius:10px;padding:2px 14px;white-space:nowrap}
.ct{font-size:36px;font-weight:700;line-height:1.2}
.cx{font-size:28px;line-height:1.35;color:#cfd9cb}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{padding:20px 24px;border-radius:18px;border:2px solid #3a5a42;background:#16241b;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.card.am{border-color:#e7c27a}
.rows{display:flex;flex-direction:column;gap:10px}
.row{display:flex;gap:24px;align-items:flex-start;padding:12px 24px;border-radius:18px;border:2px solid #3a5a42;background:#16241b}
.row .bd{flex:none;min-width:175px;text-align:center;margin-top:4px}
.row .b{flex:1;display:flex;flex-direction:column;gap:6px}
.cols{display:flex;gap:22px;align-items:stretch}
.col{display:flex;flex-direction:column;gap:14px}
.amt{display:flex;gap:18px;align-items:baseline;padding:14px 22px;border-radius:16px;border:2px solid #e7c27a;background:#16241b}
.amt b{font-size:40px;color:#e7c27a;white-space:nowrap}
.amt span{font-size:28px;color:#cfd9cb;line-height:1.3}
.note{font-size:28px;line-height:1.35;color:#9fc4a2;font-weight:700}
.big{font-size:52px;line-height:1.2;font-weight:700}
.chk{display:flex;gap:20px;align-items:flex-start;font-size:32px;line-height:1.35;font-weight:700;padding:11px 0}
.chk:before{content:"";flex:none;width:30px;height:30px;margin-top:5px;border:3px solid #9fc4a2;border-radius:8px}
.chk small{font-size:28px;font-weight:400;color:#9fb09c}
.end{text-align:center;align-items:center}
.end .nm{font-size:56px;font-weight:700;margin-top:6px}
.end .src{font-size:28px;line-height:1.5;color:#b8c7b3;margin-top:38px;max-width:980px}
</style><body>
<div class="bg"></div><div class="grid"></div>

<div class="sc" id="A">
  <div class="tag r" data-t="0.2">מדריך קצר לארגון</div>
  <div class="h r" data-t="0.5">חוק הגנת הפרטיות<br><span class="amber">אחרי תיקון 13</span></div>
  <div class="sub r" data-t="1.9">מה זה אומר לארגון שמעבד מידע אישי</div>
</div>

<div class="sc" id="B">
  <div class="tag r" data-t="0.4">מה השתנה בהגדרות</div>
  <div class="grid2">
    <div class="card r" data-t="1.2"><span class="bd">סעיף 3</span><div class="ct">מידע אישי</div><div class="cx">נתון על אדם שניתן לזהותו במאמץ סביר, גם במזהה מקוון ובנתוני מיקום</div></div>
    <div class="card r" data-t="3.5"><span class="bd">סעיף 3</span><div class="ct">מידע בעל רגישות מיוחדת</div><div class="cx">קטגוריה של 12 פסקאות, כמו מצב בריאותי ומידע גנטי</div></div>
    <div class="card r" data-t="5.9"><span class="bd">סעיף 3</span><div class="ct">בעל שליטה ומחזיק</div><div class="cx">״בעל שליטה״ במקום ״בעל מאגר״, ו״מחזיק״ הוא גורם חיצוני שמעבד בעבורו</div></div>
    <div class="card r" data-t="8.2"><span class="bd">סעיף 3</span><div class="ct">עיבוד</div><div class="cx">כל פעולה על מידע אישי, כולל איסוף, אחסון והעברה</div></div>
  </div>
</div>

<div class="sc" id="C">
  <div class="tag r" data-t="0.4">החובות</div>
  <div class="rows">
    <div class="row r" data-t="1.1"><span class="bd">סעיף 8</span><div class="b"><div class="ct">עיבוד חוקי</div><div class="cx">רק למטרת המאגר ובהרשאת בעל השליטה</div></div></div>
    <div class="row r" data-t="4.1"><span class="bd">סעיף 11</span><div class="b"><div class="ct">הודעה בעת איסוף</div><div class="cx">מציינים את בעל השליטה, זכויות עיון ותיקון, והאם המסירה חובה או בהסכמה</div></div></div>
    <div class="row r" data-t="7.7"><span class="bd">סעיף 8א</span><div class="b"><div class="ct">רישום או הודעה</div><div class="cx">רישום: מאגר למסירה לאחר כדרך עיסוק, מעל 10,000 בני אדם. הודעה תוך 30 ימים: מידע רגיש, מעל 100,000</div></div></div>
    <div class="row r" data-t="11.2"><span class="bd">סעיף 17ב1</span><div class="b"><div class="ct">ממונה על הגנת הפרטיות</div><div class="cx">חובה, בין השאר, בגוף ציבורי ובניטור שיטתי או מידע רגיש בהיקף ניכר</div></div></div>
  </div>
</div>

<div class="sc" id="D">
  <div class="tag r" data-t="0.5">אכיפה</div>
  <div class="cols">
    <div class="col" style="flex:1.05">
      <div class="card r" data-t="1.0"><span class="bd">סעיפים 23ט עד 23יב</span><div class="cx"><b>מפקחים</b> רשאים לדרוש מסמכים ולהיכנס למקום עם מאגר</div></div>
      <div class="card am r" data-t="7.0"><span class="bd">סעיף 15א</span><div class="cx"><b>פיצוי לדוגמה</b> עד 10,000 ש״ח לכל הפרה, בלי הוכחת נזק</div></div>
      <div class="card r" data-t="9.8"><span class="bd">סעיפים 23נג עד 23נז</span><div class="cx"><b>עבירות</b>: עיבוד ממאגר בלא הרשאה, מאסר 3 שנים</div></div>
    </div>
    <div class="col" style="flex:1">
      <div class="r" data-t="2.3" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><span class="bd">סעיפים 23כו עד 23לב</span><div class="ct">עיצומים כספיים</div></div>
      <div class="amt r" data-t="3.2"><b>153,540 ש״ח</b><span>רישום והודעה</span></div>
      <div class="amt r" data-t="4.8"><b>15,350 ש״ח</b><span>זכויות הפרט</span></div>
      <div class="amt r" data-t="6.0"><b>307,080 ש״ח</b><span>מסירת מסמך למפקח</span></div>
      <div class="note r" data-t="7.9">סכומי בסיס<br>מתעדכנים ב-1 בינואר בכל שנה</div>
    </div>
  </div>
</div>

<div class="sc" id="E">
  <div class="tag r" data-t="0.4">ובבינה מלאכותית? הפרשנות שלנו, לפי הסעיף</div>
  <div class="big amber r" data-t="0.8" style="margin-bottom:22px">בנוסח אין התייחסות מפורשת לבינה מלאכותית</div>
  <div class="rows">
    <div class="row r" data-t="3.0"><span class="bd">סעיף 3</span><div class="b"><div class="ct">הזנת מידע לכלי היא עיבוד</div><div class="cx">כולל שמירת הנחיות ופלטים ומתן גישה לספק הכלי</div></div></div>
    <div class="row r" data-t="6.0"><span class="bd">סעיפים 3 ו-17</span><div class="b"><div class="ct">ספק הכלי הוא מחזיק</div><div class="cx">שניהם אחראים לאבטחה, ותקנה 15 דורשת הסכם</div></div></div>
    <div class="row r" data-t="9.0"><span class="bd">סעיף 3, פסקה 8</span><div class="b"><div class="ct">הערכת אישיות היא מידע רגיש</div><div class="cx">והנוסח אינו מחייב שהמעריך יהיה אדם</div></div></div>
  </div>
</div>

<div class="sc" id="F">
  <div class="tag r" data-t="0.5">רשימת בדיקה קצרה</div>
  <div class="chk r" data-t="1.0"><div>מפו מידע אישי וסמנו מה רגיש <small>(סעיף 3)</small></div></div>
  <div class="chk r" data-t="2.6"><div>בדקו חובת רישום, הודעה וממונה <small>(סעיפים 8א ו-17ב1)</small></div></div>
  <div class="chk r" data-t="4.4"><div>הסדירו בהסכם כל ספק, גם ספקי בינה מלאכותית <small>(סעיף 17, תקנה 15)</small></div></div>
  <div class="chk r" data-t="6.2"><div>היערכו לדרישת מפקח <small>(סעיף 23י)</small></div></div>
</div>

<div class="sc end" id="G">
  <div class="tag r" data-t="0.3">הסרטון הוכן על ידי</div>
  <div class="nm r" data-t="0.6">ד״ר עו״ד אברהם ללום</div>
  <div class="src r" data-t="1.6">הסרטון אינו ייעוץ משפטי.<br>מקור: נוסח חוק הגנת הפרטיות המאוחד, דין ישראלי בלבד</div>
</div>
${logo}
<script>
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const win=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));
const SC=${JSON.stringify(SCENES)};
window.render=function(t){
  document.body.style.opacity=t>${DUR - 0.6}?clamp((${DUR}-t)/.6):1;
  SC.forEach(([id,a,b])=>{const k=win(t,a,b);const e=document.getElementById(id);e.style.opacity=k;e.style.transform="translateY("+((1-k)*20)+"px)";
    e.querySelectorAll(".r").forEach(n=>{const k2=ease((t-(a+parseFloat(n.dataset.t)))/.45);n.style.opacity=k2;n.style.transform="translateY("+((1-k2)*14)+"px)"})});
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

if (process.env.CHECK) {
  // Reading time rule: at least 2 seconds per 10 words, plus one second of fade in and out.
  const rows = await page.evaluate((sc) => sc.map(([id, a, b]) => {
    const e = document.getElementById(id);
    return [id, a, b, e.innerText.split(/\s+/).filter(Boolean).length];
  }), SCENES);
  let ok = true;
  for (const [id, a, b, n] of rows) {
    const need = n * 0.2 + 1;
    const pass = b - a >= need;
    if (!pass) ok = false;
    console.log(`${id}: ${n} words, ${(b - a).toFixed(1)}s on screen, needs ${need.toFixed(1)}s, ${pass ? "ok" : "TOO SHORT"}`);
  }
  await browser.close();
  process.exit(ok ? 0 : 1);
}

if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(",").map(Number)) {
    await page.evaluate((x) => window.render(x), t);
    await page.screenshot({ path: path.join(frames, `preview_${t}.png`) });
  }
  await browser.close();
  console.log("previews in " + frames);
  process.exit(0);
}

for (let i = 0; i < Math.round(DUR * FPS); i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
await page.evaluate(() => window.render(4));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-privacy-law.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-vf", "scale=960:-2", "-q:v", "4", path.join(out, "lalum-privacy-law.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-privacy-law.mp4 and .jpg");
