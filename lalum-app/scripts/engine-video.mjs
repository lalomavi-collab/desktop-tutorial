// Renders the Engine section video (public/media/lalum-engine.mp4 and poster).
//
// Concept: "the legal production line". One document travels through five
// stations: intake, classification, risk flag, a lawyer's decision, the record.
// The machine stations are fast and green; the fourth is the only one where the
// flow stops, in amber, until a person approves. It is the Engine section's own
// claim ("audits exposure, automates the routine, keeps a documented trail, and
// puts the sharp calls back with the lawyer") shown as a mechanism.
//
// Silent 14 second loop, 16:9, drawn in code so the words can be edited and the
// clip regenerated. No figures, no percentages: nothing on screen is a claim
// about performance. The wordmark is the supplied artwork
// (public/lalum-logo-inverse.svg), never a typeface.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/engine-video.mjs
//
// Needs ffmpeg on PATH.
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const W = 1280;
const H = 720;
const FPS = 30;
const DUR = 14;
const out = path.join(root, "public/media");
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-engine-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });

const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

// Hebrew copy, no dashes as punctuation (CLAUDE.md). Right to left: station 0 is on the right.
const STATIONS = ["קליטה", "סיווג", "סימון סיכון", "הכרעת עורך דין", "תיעוד"];
const CAPTIONS = [
  { a: 0.8, b: 7.4, t: "המכונה מסננת, מסווגת ומסמנת" },
  { a: 7.6, b: 11.0, t: "ועל ההכרעה אחראי אדם" },
  { a: 11.2, b: 13.6, t: "וכל צעד נשמר ברישום" },
];

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 30%,#1f3626 0%,#142019 55%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:56px 56px}
#cap{position:absolute;left:0;right:0;top:78px;text-align:center;font-size:54px;font-weight:700;letter-spacing:-.5px}
svg#s{position:absolute;inset:0;width:${W}px;height:${H}px}
.wm{position:absolute;left:50%;bottom:44px;width:190px;transform:translateX(-50%);opacity:.8}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="cap"></div>
<svg id="s" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round"></svg>
${logo}
<script>
const STATIONS=${JSON.stringify(STATIONS)},CAPTIONS=${JSON.stringify(CAPTIONS)};
const NS="http://www.w3.org/2000/svg",S=document.getElementById("s"),CAP=document.getElementById("cap");
const el=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);(p||S).appendChild(e);return e};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
const X=[1070,850,640,430,210],Y=360;
// the time the token reaches each station, and how long it stays
const ARR=[2.0,3.9,5.8,7.7,11.7],HOLD=[.5,.6,.7,3.3,.8];
const GREEN="#769d79",AMBER="#e7c27a",PAPER="#f5f1e8";

// track
const track=el("line",{x1:X[0]+120,y1:Y,x2:X[4]-120,y2:Y,stroke:"#2e4a35","stroke-width":4});
const trackOn=el("line",{x1:X[0]+120,y1:Y,x2:X[0]+120,y2:Y,stroke:GREEN,"stroke-width":4});

// stations: card + glyph + label + ledger line
const st=STATIONS.map((name,i)=>{
  const g=el("g",{});const human=i==3;
  const box=el("rect",{x:X[i]-84,y:Y-84,width:168,height:168,rx:26,fill:"#16241b",stroke:human?AMBER:"#3a5a42","stroke-width":human?3:2.5},g);
  const ring=el("rect",{x:X[i]-92,y:Y-92,width:184,height:184,rx:32,stroke:human?AMBER:GREEN,"stroke-width":3,opacity:0},g);
  const gl=el("g",{stroke:human?AMBER:"#cfd9cb","stroke-width":5,fill:"none"},g);
  const cx=X[i],cy=Y-6;
  if(i==0){el("path",{d:"M"+(cx-34)+" "+(cy+8)+"v26h68v-26",},gl);el("path",{d:"M"+cx+" "+(cy-34)+"v44M"+(cx-16)+" "+(cy-6)+"l16 16 16-16"},gl)}
  if(i==1){[-22,0,22].forEach((d,k)=>el("path",{d:"M"+(cx-34)+" "+(cy+d)+"h"+(52-k*14)},gl));el("circle",{cx:cx+30,cy:cy-22,r:6},gl)}
  if(i==2){el("path",{d:"M"+cx+" "+(cy-36)+"l38 66h-76z"},gl);el("path",{d:"M"+cx+" "+(cy-10)+"v18"},gl);el("circle",{cx:cx,cy:cy+19,r:2.5,fill:"#cfd9cb"},gl)}
  if(i==3){el("circle",{cx:cx,cy:cy-16,r:17},gl);el("path",{d:"M"+(cx-34)+" "+(cy+40)+"c0-30 14-40 34-40s34 10 34 40z"},gl)}
  if(i==4){[-24,-4,16].forEach((d,k)=>{el("path",{d:"M"+(cx-34)+" "+(cy+d)+"h"+(68-k*8)},gl)});el("path",{d:"M"+(cx-34)+" "+(cy+36)+"h30"},gl)}
  const lb=el("text",{x:X[i],y:Y+128,"text-anchor":"middle","font-size":human?30:28,"font-weight":700,fill:human?AMBER:PAPER,"font-family":"Liberation Sans,Arial"},g);lb.textContent=name;
  // record mark under the station, lit when the token has passed
  const rec=el("circle",{cx:X[i],cy:Y+170,r:9,fill:human?AMBER:GREEN,opacity:0},g);
  return {g,box,ring,gl,lb,rec,human};
});

// the document token
const tk=el("g",{});
el("rect",{x:-30,y:-40,width:60,height:80,rx:8,fill:PAPER},tk);
[-16,-4,8].forEach(d=>el("path",{d:"M-18 "+d+"h36",stroke:"#9aa597","stroke-width":4},tk));
const flag=el("g",{opacity:0},tk);el("path",{d:"M12 -44v26",stroke:AMBER,"stroke-width":5},flag);el("path",{d:"M12 -44h26l-8 8 8 8h-26z",fill:AMBER,stroke:AMBER,"stroke-width":2},flag);
const ok=el("g",{opacity:0},tk);el("circle",{cx:0,cy:0,r:22,fill:"#2f6b3c"},ok);el("path",{d:"M-10 0l7 8 14-16",stroke:PAPER,"stroke-width":5},ok);

function tokenX(t){
  if(t<ARR[0])return X[0];
  for(let i=0;i<4;i++){const leave=ARR[i]+HOLD[i];if(t<leave)return X[i];const next=ARR[i+1];if(t<next)return lerp(X[i],X[i+1],ease((t-leave)/(next-leave)));}
  return X[4];
}

window.render=function(t){
  const fadeOut=t>13.5?clamp((14-t)/.5):1;document.body.style.opacity=fadeOut;
  // intro: track and stations draw in
  const tin=ease((t-.2)/1.0);trackOn.setAttribute("x2",lerp(X[0]+120,X[4]-120,clamp((tokenX(t)-X[0]-120)/(X[4]-120-X[0]-120))));
  st.forEach((s,i)=>{const a=ease((t-.3-i*.12)/.6);s.g.setAttribute("opacity",a);
    const here=t>=ARR[i]&&t<ARR[i]+HOLD[i];const passed=t>=ARR[i]+(s.human?.9:.15);
    // the machine stations glow while the token is inside; the human one pulses until the approval
    const pulse=s.human?(t>=ARR[i]&&t<ARR[i]+HOLD[i]-0.3?.55+.45*Math.sin(t*5):0):(here?1:0);
    s.ring.setAttribute("opacity",pulse*a);
    s.rec.setAttribute("opacity",passed?1:0);
  });
  // token
  let tx=t<2.0?lerp(X[0]+230,X[0],ease((t-1.0)/1.0)):tokenX(t);
  const tin2=ease((t-1.0)/.5);
  tk.setAttribute("transform","translate("+tx+","+Y+")");
  tk.setAttribute("opacity",tin2);
  flag.setAttribute("opacity",t>ARR[2]+.5?1:0);
  ok.setAttribute("opacity",t>ARR[3]+2.6?1:0);
  // captions
  let c=null;CAPTIONS.forEach(k=>{if(t>=k.a&&t<k.b)c=k});
  if(c){const k=Math.min(ease((t-c.a)/.5),ease((c.b-t)/.4));CAP.textContent=c.t;CAP.style.opacity=k;CAP.style.transform="translateY("+((1-k)*14)+"px)";CAP.style.color=(c===CAPTIONS[1])?"#e7c27a":"#f5f1e8"}else{CAP.textContent="";}
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
// Poster: the moment the flow stops for the lawyer, the whole idea in one frame.
await page.evaluate(() => window.render(9.2));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();

execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-engine.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-vf", "scale=960:-2", "-q:v", "4", path.join(out, "lalum-engine.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-engine.mp4 and lalum-engine.jpg");
