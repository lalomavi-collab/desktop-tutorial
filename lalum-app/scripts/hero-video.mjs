// Renders the home hero video (public/media/lalum-hero.mp4 and its poster).
//
// Concept: "the contract, read back". A sample clause is scanned, the phrases
// worth a lawyer's attention are flagged, they lift out of the text and become
// the nodes of a network (compliance, insurance, documentation, regulator), and
// the network settles into the scales of justice. The machine flags, the human
// decides. It is the one thing only a practice that is both AI and law can
// show, so the clip is about the join, not about either side alone.
//
// Colour carries meaning here: red for a high risk flag, amber for a point to check, green for what a lawyer has approved.
//
// Silent 16 second loop, drawn in code so the text can be edited and the clip
// regenerated instead of re-shot. The wordmark is the supplied artwork
// (public/lalum-logo-inverse.svg), never a typeface. The clause is invented for
// illustration and says so on screen; nothing here asserts a legal position.
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

// Hebrew copy. No dashes as punctuation (CLAUDE.md).
const SCENES = [
  { a: 2.4, b: 6.4, h: "AI קורא את החוזה", p: "ומסמן סעיפים שכדאי לעצור עליהם" },
  { a: 6.6, b: 10.2, h: "ומדרג כל סיכון", p: "ציות, ביטוח, תיעוד ורגולציה, במבט אחד" },
  { a: 10.4, b: 13.8, h: "המכונה מסמנת. האדם מכריע.", p: "ייעוץ משפטי בעידן הבינה המלאכותית" },
];

const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101712}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 28%,#223a29 0%,#142019 52%,#0d120e 100%)}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:48px 48px}
.wm{position:absolute;left:50%;width:300px;transform:translateX(-50%)}
#doc{position:absolute;left:50px;width:620px;top:150px;padding:34px 38px 30px;border-radius:18px;background:#f5f1e8;color:#1a1815;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);overflow:hidden}
#doc .lbl{font-size:15px;color:#6b6a63;letter-spacing:.3px;margin-bottom:16px}
#doc .cl{font-size:31px;line-height:1.75;font-weight:700}
#doc .fl{border-radius:6px;padding:0 4px;transition:none}
#beam{position:absolute;left:0;right:0;height:70px;top:-70px;background:linear-gradient(180deg,rgba(118,157,121,0),rgba(118,157,121,.45));border-bottom:3px solid #769d79}
#chips{position:absolute;left:50px;width:620px;top:470px;display:flex;gap:12px;justify-content:flex-start}
.chip{font-size:20px;font-weight:700;padding:9px 16px;border-radius:999px;background:#2b2412;color:#e7c27a;border:1.5px solid #e7c27a}
.chip.hi{background:#3a1713;color:#ff9a8c;border-color:#ff9a8c}
#tiers{position:absolute;left:50px;width:620px;top:560px;display:flex;gap:12px;justify-content:center;opacity:0}
.tier{font-size:22px;font-weight:700;padding:10px 20px;border-radius:999px;border:2px solid}
.tier.g{background:#10301a;color:#7be09a;border-color:#7be09a}.tier.a{background:#2b2412;color:#f2cf86;border-color:#f2cf86}.tier.r{background:#3a1713;color:#ff9a8c;border-color:#ff9a8c}
#stamp{position:absolute;left:50%;top:330px;margin-left:-190px;width:380px;text-align:center;font-size:34px;font-weight:700;color:#7be09a;border:5px solid #7be09a;border-radius:16px;padding:12px 8px;background:rgba(16,48,26,.9);opacity:0;transform:rotate(-7deg)}
#note{position:absolute;left:0;right:0;top:132px;text-align:center;font-size:14px;color:#b8c7b3;opacity:.0}
svg#art{position:absolute;left:0;top:130px;width:${W}px;height:470px}
.txt{position:absolute;left:56px;right:56px;top:640px;text-align:right}
.txt h2{font-size:50px;line-height:1.12;font-weight:700;letter-spacing:-.5px}
.txt p{margin-top:18px;font-size:25px;line-height:1.4;color:#cfd9cb;max-width:26ch}
.rule{display:block;width:64px;height:3px;background:#769d79;margin-bottom:22px}
.name{position:absolute;left:0;right:0;text-align:center}
.name b{display:block;font-size:40px;font-weight:700}
.name span{display:block;margin-top:14px;font-size:24px;color:#b8c7b3}
.name i{display:block;font-style:normal;font-size:54px;line-height:1.15;font-weight:700;margin-bottom:26px;color:#fff}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="wmTop" class="wm" style="top:70px">${logo}</div>
<div id="note">סעיף לדוגמה, להמחשה בלבד</div>
<div id="doc"><div class="lbl">הסכם שירות, סעיף לדוגמה</div>
<div class="cl">הספק לא יישא באחריות <span class="fl" id="f1">לכל נזק, ישיר או עקיף,</span> מכל סיבה שהיא, <span class="fl" id="f2">ובכל סכום.</span></div><div id="beam"></div></div>
<div id="chips"><span class="chip hi" id="c1">סיכון גבוה</span><span class="chip" id="c2">נקודה לבדיקה</span></div>
<div id="tiers"><span class="tier g">מינימלי</span><span class="tier a">מוגבל</span><span class="tier r">גבוה</span></div>
<div id="stamp">אושר על ידי עורך דין</div>
<svg id="art" viewBox="0 0 ${W} 470" fill="none" stroke-linecap="round" stroke-linejoin="round"></svg>
<div class="txt" id="txt"></div>
<div class="name" id="end" style="top:400px"><i>AI שאפשר לסמוך עליו.</i><b>ד״ר עו״ד אברהם ללום</b><span>ייעוץ משפטי בעידן הבינה המלאכותית</span></div>
<script>
const SCENES=${JSON.stringify(SCENES)};
const ART=document.getElementById("art"),TXT=document.getElementById("txt"),END=document.getElementById("end"),WM=document.getElementById("wmTop");
const DOC=document.getElementById("doc"),BEAM=document.getElementById("beam"),NOTE=document.getElementById("note"),CH=document.getElementById("chips");
const TI=document.getElementById("tiers"),ST=document.getElementById("stamp");
const F1=document.getElementById("f1"),F2=document.getElementById("f2"),C1=document.getElementById("c1"),C2=document.getElementById("c2");
const NS="http://www.w3.org/2000/svg";
const el=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);(p||ART).appendChild(e);return e};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
const io=(t,a,b,fi=.5,fo=.5)=>Math.min(ease((t-a)/fi),ease((b-t)/fo));

// Network layout (stage 2) and scales-of-justice layout (stage 3), same 14 nodes.
const A=[[250,200],[420,230],[360,60],[160,120],[560,120],[110,260],[600,270],[250,380],[470,380],[360,300],[360,170],[200,320],[530,200],[300,110]];
const LBL={2:"ציות",3:"ביטוח",4:"תיעוד",5:"רגולטור"};
const E1=[[0,10],[1,10],[10,2],[10,13],[13,3],[2,4],[0,11],[11,5],[11,7],[1,12],[12,6],[12,4],[1,9],[0,9],[9,7],[9,8],[8,6],[3,0],[13,2],[4,1]];
// scale: pole 0-? we map: 0 beam-left,1 beam-right,2 pole-top,3 pan L outer,4 pan R outer,5 pan L inner... see edges
const B=[[200,110],[520,110],[360,50],[130,250],[290,250],[430,250],[590,250],[360,400],[270,420],[450,420],[360,230],[210,300],[510,300],[360,110]];
const E2=[[2,13],[13,10],[10,7],[7,8],[7,9],[0,13],[13,1],[0,3],[0,4],[1,5],[1,6],[3,11],[4,11],[5,12],[6,12],[3,4],[5,6]];
const net=el("g",{});
const e1=E1.map(()=>el("line",{stroke:"#769d79","stroke-width":2},net));
const e2=E2.map(()=>el("line",{stroke:"#9fc4a2","stroke-width":2.5},net));
const nodes=A.map((_,i)=>el("circle",{r:i%3==0?9:6,fill:"#e7ede4"},net));
const labels=Object.keys(LBL).map(i=>{const t=el("text",{"font-size":22,"font-weight":700,fill:"#e7c27a","text-anchor":"middle","font-family":"Liberation Sans,Arial"},net);t.textContent=LBL[i];t._i=+i;return t});
const P=A.map(()=>[0,0]);

function docPoint(span){const r=span.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2-130]}
let S0=null;

function setText(i,t){TXT.innerHTML="";const s=SCENES[i];const d=document.createElement("div");
  d.innerHTML='<i class="rule"></i><h2></h2><p></p>';d.querySelector("h2").textContent=s.h;d.querySelector("p").textContent=s.p;
  TXT.appendChild(d);const k=io(t,s.a,s.b,.55,.4);d.style.opacity=k;d.style.transform="translateY("+((1-k)*22)+"px)";}

window.render=function(t){
  // wordmark
  const intro=ease(t/1.0),end=ease((t-14.3)/.7);
  let y=70,sc=1;if(t>=14.3){y=70+(300-70)*end;sc=1+.2*end}
  WM.style.top=y+"px";WM.style.transform="translateX(-50%) scale("+sc+")";WM.style.opacity=intro;

  // contract card: in at 0.6, scanned 2.6 to 5.0, out at 6.4 to 7.6
  const dIn=ease((t-.6)/.8),dOut=1-ease((t-6.5)/1.0);
  DOC.style.opacity=dIn*dOut;DOC.style.transform="translateY("+((1-dIn)*30)+"px)";
  NOTE.style.opacity=.9*dIn*dOut;
  const bt=clamp((t-2.6)/2.4);BEAM.style.top=(-70+bt*(DOC.offsetHeight+70))+"px";BEAM.style.opacity=(t>2.5&&t<5.1)?1:0;
  const h1=t>3.5,h2=t>4.3;
  F1.style.background=h1?"#f4a79b":"transparent";F2.style.background=h2?"#f2cf86":"transparent";
  CH.style.opacity=dOut;C1.style.opacity=ease((t-3.7)/.4);C2.style.opacity=ease((t-4.5)/.4);

  if(!S0){DOC.style.opacity=1;DOC.style.transform="none";S0=[docPoint(F1),docPoint(F2)];}

  // nodes: 0 and 1 are born from the flagged phrases, then everything flows to the network, then to the scales
  const lift=ease((t-6.2)/1.0);
  A.forEach((a,i)=>{
    const m1=ease((t-6.4-i*.05)/1.2),m2=ease((t-10.4-i*.04)/1.5);
    const st=i<2?S0[i]:[360,150];
    let x=lerp(st[0],a[0],m1),yv=lerp(st[1],a[1],m1);
    x=lerp(x,B[i][0],m2);yv=lerp(yv,B[i][1],m2);
    // the beam tips towards the heavier pan, then settles level
    const tip=(1-ease((t-12.2)/1.2))*ease((t-10.6)/.6);
    if(i==0||i==3||i==4||i==11){yv+=22*tip} if(i==1||i==5||i==6||i==12){yv-=22*tip}
    P[i]=[x,yv];
    const vis=i<2?ease((t-3.7-(i*.8))/.4):ease((t-6.5-i*.06)/.5);
    const c=nodes[i];c.setAttribute("cx",x);c.setAttribute("cy",yv);
    c.setAttribute("opacity",(t<3.7?0:vis)*(1-ease((t-14.3)/.5)));
    c.setAttribute("r",(i%3==0?9:6)*(.5+.5*Math.max(vis,0))*(1+.1*Math.sin(t*3+i)));
    if(i<2&&t<6.4)c.setAttribute("fill",i==0?"#ff9a8c":"#f2cf86");else c.setAttribute("fill","#e7ede4");
  });
  const m2g=ease((t-10.6)/1.4),fade=1-ease((t-14.3)/.5);
  E1.forEach(([a,b],i)=>{const l=e1[i];l.setAttribute("x1",P[a][0]);l.setAttribute("y1",P[a][1]);l.setAttribute("x2",P[b][0]);l.setAttribute("y2",P[b][1]);
    l.setAttribute("opacity",.85*ease((t-7.0-i*.05)/.6)*(1-m2g)*fade)});
  E2.forEach(([a,b],i)=>{const l=e2[i];l.setAttribute("x1",P[a][0]);l.setAttribute("y1",P[a][1]);l.setAttribute("x2",P[b][0]);l.setAttribute("y2",P[b][1]);
    l.setAttribute("opacity",.95*m2g*fade)});
  labels.forEach(l=>{const p=P[l._i];l.setAttribute("x",p[0]);l.setAttribute("y",p[1]-18);
    l.setAttribute("opacity",ease((t-8.0-l._i*.15)/.5)*(1-ease((t-10.4)/.6)))});

  // risk tiers appear while the network forms; the stamp lands when the scales settle
  TI.style.opacity=Math.min(ease((t-8.4)/.5),1-ease((t-10.6)/.5));
  ST.style.opacity=Math.min(ease((t-12.9)/.25),1-ease((t-14.3)/.4));
  ST.style.transform="rotate(-7deg) scale("+(1.5-.5*ease((t-12.9)/.3))+")";

  // captions
  let shown=-1;SCENES.forEach((s,i)=>{if(t>=s.a&&t<s.b)shown=i});
  if(shown>=0)setText(shown,t);else TXT.innerHTML="";
  END.style.opacity=ease((t-14.6)/.6);
  document.body.style.opacity=t>15.55?clamp((16-t)/.45):1;
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
// The flagged phrases' positions are read once, with the card fully shown.
await page.evaluate(() => window.render(4));
const total = DUR * FPS;
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
// Poster: the flagged clause, the frame that says "AI reads contracts" at a glance.
await page.evaluate(() => window.render(4.9));
await page.screenshot({ path: path.join(frames, "poster.png") });
await browser.close();

execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", "-an",
  path.join(out, "lalum-hero.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(frames, "poster.png"), "-q:v", "4", path.join(out, "lalum-hero.jpg")], { stdio: "inherit" });
console.log("wrote public/media/lalum-hero.mp4 and lalum-hero.jpg");
