// Renders the home hero video (public/media/lalum-hero.mp4 and its poster).
//
// The clip is a 16 second silent loop on AI and real estate, drawn in code so
// it can be regenerated and edited as text instead of re-shot. The wordmark is
// the supplied artwork (public/lalum-logo-inverse.svg), never a typeface.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/hero-video.mjs
//
// Needs ffmpeg on PATH. Playwright is a dev tool here, not an app dependency.
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const W = 720;
const H = 900;
const FPS = 30;
const DUR = 16;
const out = path.join(root, "public/media");
const frames = path.join(process.env.TMPDIR || "/tmp", "lalum-hero-frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });

const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

// Hebrew copy. No dashes as punctuation (CLAUDE.md). Claims stay at the level
// the site itself already makes; nothing here asserts a figure or an authority.
const SCENES = [
  { id: "s2", a: 2.6, b: 6.8, h: "AI ומשפט", p: "ממשל, ציות וניהול סיכונים בארגונים שמשתמשים בבינה מלאכותית" },
  { id: "s3", a: 6.8, b: 11.0, h: "נדל״ן והתחדשות עירונית", p: "עסקאות והתחדשות עירונית, בישראל ובחו״ל" },
  { id: "s4", a: 11.0, b: 14.0, h: "שני תחומים, ראייה משפטית אחת", p: "נבנה להחזיק" },
];

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 28%,#223a29 0%,#142019 52%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:48px 48px}
.wm{position:absolute;left:50%;width:300px;transform:translateX(-50%)}
.art{position:absolute;left:0;top:130px;width:${W}px;height:470px}
.txt{position:absolute;left:56px;right:56px;top:640px;text-align:right}
.txt h2{font-size:54px;line-height:1.12;font-weight:700;letter-spacing:-.5px}
.txt p{margin-top:18px;font-size:25px;line-height:1.4;color:#cfd9cb;max-width:26ch}
.rule{display:block;width:64px;height:3px;background:#769d79;margin-bottom:22px;margin-inline-start:0}
.scene{position:absolute;inset:0 auto auto 0;width:100%}
.name{position:absolute;left:0;right:0;text-align:center}
.name b{display:block;font-size:40px;font-weight:700}
.name span{display:block;margin-top:14px;font-size:24px;color:#b8c7b3}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="wmTop" class="wm" style="top:70px">${logo}</div>
<svg class="art" id="art" viewBox="0 0 ${W} 470" fill="none" stroke-linecap="round" stroke-linejoin="round"></svg>
<div class="txt" id="txt"></div>
<div class="name" id="end" style="top:430px"><b>ד״ר עו״ד אברהם ללום</b><span>AI ומשפט · נדל״ן והתחדשות עירונית</span></div>
<script>
const SCENES=${JSON.stringify(SCENES)};
const ART=document.getElementById("art"), TXT=document.getElementById("txt"), END=document.getElementById("end"), WM=document.getElementById("wmTop");
const NS="http://www.w3.org/2000/svg";
const el=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);(p||ART).appendChild(e);return e};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const io=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));

// network (AI): deterministic nodes and edges
const N=[[360,40],[470,70],[560,150],[585,260],[520,350],[400,395],[270,380],[160,320],[120,210],[170,110],[270,60],[330,190],[440,230],[250,250]];
const E=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,0],[0,11],[1,11],[11,12],[12,2],[12,3],[12,4],[11,13],[13,7],[13,6],[13,8],[11,9],[12,5],[13,5]];
const net=el("g",{});
const edges=E.map(([a,b],i)=>{const len=Math.hypot(N[a][0]-N[b][0],N[a][1]-N[b][1]);const l=el("line",{x1:N[a][0],y1:N[a][1],x2:N[b][0],y2:N[b][1],stroke:"#769d79","stroke-width":2,"stroke-dasharray":len,"stroke-dashoffset":len},net);l._len=len;l._i=i;return l});
const nodes=N.map(([x,y],i)=>{const c=el("circle",{cx:x,cy:y,r:i%3==0?9:6,fill:"#e7ede4"},net);c._i=i;return c});

// skyline (real estate)
const B=[[110,150,70],[190,200,84],[284,240,96],[390,180,80],[480,220,90],[580,140,64]]; // x, height, width
const sky=el("g",{});
const bld=B.map(([x,h,w],i)=>{const g=el("g",{},sky);const r=el("rect",{x:x,y:430-h,width:w,height:h,rx:3,fill:"#1d2b21",stroke:"#769d79","stroke-width":2},g);
  const wins=[];for(let yy=430-h+18;yy<418;yy+=26)for(let xx=x+14;xx<x+w-14;xx+=22){wins.push(el("rect",{x:xx,y:yy,width:9,height:12,rx:1.5,fill:((xx*7+yy*3)%5<2)?"#e7c27a":"#3a5240"},g))}
  g._h=h;g._r=r;g._wins=wins;return g});
el("line",{x1:60,y1:430,x2:660,y2:430,stroke:"#769d79","stroke-width":2},sky);

function setText(i,t){TXT.innerHTML="";const s=SCENES[i];const d=document.createElement("div");
  d.innerHTML='<i class="rule"></i><h2></h2><p></p>';d.querySelector("h2").textContent=s.h;d.querySelector("p").textContent=s.p;
  TXT.appendChild(d);const k=io(t,s.a,s.b,.55,.4);d.style.opacity=k;d.style.transform="translateY("+((1-k)*22)+"px)";}

window.render=function(t){
  // wordmark: big and centered at the start, settles to the top, returns for the end card
  const intro=ease(t/1.2), settle=ease((t-1.8)/.9), end=ease((t-14.2)/.7);
  const topY=70, midY=360;
  let y=topY, sc=1, op=intro;
  if(t<2.7){y=midY+(topY-midY)*settle; sc=1.35-.35*settle}
  if(t>=14.2){y=topY+(300-topY)*end; sc=1+.2*end}
  WM.style.top=y+"px"; WM.style.transform="translateX(-50%) scale("+sc+")"; WM.style.opacity=op;

  // AI network
  const netIn=ease((t-2.4)/.8), netOut=1-ease((t-14)/.5);
  edges.forEach(l=>{const p=ease((t-2.8-l._i*.06)/.9);l.setAttribute("stroke-dashoffset",l._len*(1-p));l.setAttribute("opacity",.85)});
  nodes.forEach(c=>{const p=ease((t-2.6-c._i*.07)/.5);c.setAttribute("opacity",p);c.setAttribute("r",(c._i%3==0?9:6)*(0.4+0.6*p)*(1+.12*Math.sin(t*3+c._i)))});
  // network moves up and shrinks when the skyline arrives, stays small above it
  const m=ease((t-10.8)/1.2);
  const ns=1-.55*m, ny=-145*m;
  net.setAttribute("transform","translate("+(360*(1-ns))+","+(230*(1-ns)+ny)+") scale("+ns+")");
  net.setAttribute("opacity",netIn*netOut*(t>=6.8&&t<11?1-.82*ease((t-6.8)/.7)+.82*ease((t-10.2)/.8):1));

  // skyline rises in scene 3, stays
  bld.forEach((g,i)=>{const p=ease((t-7.0-i*.18)/.9);g._r.setAttribute("y",430-g._h*p);g._r.setAttribute("height",Math.max(.01,g._h*p));
    g._wins.forEach(w=>w.setAttribute("opacity",clamp((p-.7)/.3)))});
  sky.setAttribute("opacity",ease((t-6.9)/.5)*(1-ease((t-14)/.5)));

  // text
  TXT.style.opacity=1;
  let shown=-1;SCENES.forEach((s,i)=>{if(t>=s.a&&t<s.b)shown=i});
  if(shown>=0)setText(shown,t);else TXT.innerHTML="";
  // end card + loop fade
  END.style.opacity=ease((t-14.5)/.6);
  document.body.style.opacity=t>15.55?clamp((16-t)/.45):1;
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
// Poster: the AI scene at its fullest, so the first paint is already on message.
await page.evaluate(() => window.render(5.6));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();

execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-hero.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-q:v", "4", path.join(out, "lalum-hero.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-hero.mp4 and lalum-hero.jpg");
