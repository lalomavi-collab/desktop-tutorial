// Renders the picture of the home page film (storyboard: docs/legal-ai-layer/home-film-storyboard.he.md).
// Five rooms in one continuous shot, a thread of amber between them, living people in every room, all drawn in code.
// No burned in subtitles: the site plays them from separate tracks, one per language.
// Timing comes from WORK/narration.json (scripts/home-film-audio.py). The wordmark is the supplied artwork
// (public/lalum-logo-inverse.svg), never a typeface. No dashes as punctuation. The address is lalumapp.com.
//
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs node scripts/home-film-visuals.mjs
//
// PREVIEW  "3:10,50;G:12" renders PNG stills to OUT/preview and exits
// RANGE    "a-b" renders global frames a..b-1 into OUT/part-<a>.mp4; RESUME=1 keeps frames already written
// OUT      output folder (default /tmp/lalum-home-film); WORK narration folder (default /tmp/tts-home); FPS default 24
import { readFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const W = 1920;
const H = 1080;
const FPS = Number(process.env.FPS || 24);
const out = process.env.OUT || "/tmp/lalum-home-film";
const work = process.env.WORK || "/tmp/tts-home";
mkdirSync(path.join(out, "preview"), { recursive: true });
const narr = JSON.parse(readFileSync(path.join(work, "narration.json"), "utf8"));
const order = ["1", "2", "3", "4", "5"];
const offsets = {};
let acc = 0;
for (const n of order) { if (!narr[n]) continue; offsets[n] = acc; acc += narr[n].dur; }
const TOTAL = acc;

const people = readFileSync(path.join(root, "scripts/youtube-essay-people.js"), "utf8");
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0b100c}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 25%,#1f3626 0%,#142019 55%,#0b100c 100%)}
.grid{position:absolute;inset:0;opacity:.05;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:80px 80px}
#world{position:absolute;inset:0;perspective:2600px}
.amber{text-shadow:0 0 26px rgba(231,194,122,.3)}
#stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
#world div,#hud div{position:absolute}
.wm{position:absolute;right:70px;bottom:44px;width:150px;opacity:.5}
.c{left:0;right:0;text-align:center}
.big{font-size:170px;font-weight:700;letter-spacing:-3px}
.h1{font-size:92px;font-weight:700;letter-spacing:-1.5px;line-height:1.1}
.h2{font-size:60px;font-weight:700;letter-spacing:-.5px;line-height:1.15}
.h3{font-size:42px;font-weight:700}
.p{font-size:38px;line-height:1.3;color:#cfd9cb}
.dim{color:#8a9a8c}
.amber{color:#e7c27a}
.green{color:#9cc29f}
.tag{left:90px;top:74px;font-size:26px;color:#9aaa9c;padding-left:16px;border-left:4px solid #769d79;letter-spacing:.3px}
.card{background:#16241b;border:2.5px solid #3a5a42;border-radius:26px}
.card.am{border-color:#e7c27a}
.bar{height:16px;border-radius:8px;background:#35503b;width:0}
.cursor{width:14px;height:30px;background:#e7c27a}
.chip{background:#16241b;border:2px solid #3a5a42;border-radius:14px;font-size:34px;padding:12px 26px;white-space:nowrap}
.lbl{font-size:30px;font-weight:700;text-align:center}
.rtl{direction:rtl;text-align:right}
.rel{position:relative !important}
.mono{font-family:"Liberation Mono","DejaVu Sans Mono",monospace}
#hud .br{width:64px;height:64px;border:3px solid #3a5a42;opacity:.9}
#caps{left:0;right:0;top:984px;height:70px}
.cap{left:0;right:0;top:0;text-align:center;font-size:52px;font-weight:700;white-space:nowrap}
.cap span{display:inline-block;padding:2px 11px;margin:0 3px;border-radius:12px;text-shadow:0 3px 14px rgba(0,0,0,.75)}
.cap span.on{background:#e7c27a;color:#101712;text-shadow:none}
#grain{left:-200px;top:-200px;width:2400px;height:1500px;opacity:.05}
#vig{inset:0;background:radial-gradient(75% 75% at 50% 48%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}
</style><body>
<div class="bg"></div><canvas id="texsrc" width="512" height="512" style="display:none"></canvas><div id="tex" style="position:absolute;left:0;top:0;width:1920px;height:1080px;opacity:.1;background-size:768px 768px"></div><div class="grid"></div>
<div id="world"><div id="stage"></div></div>
${logo}
<div id="hud">
  <div id="title" style="inset:0"></div>
  <div id="leak" style="left:-1920px;top:120px;width:3840px;height:840px;opacity:0;background:linear-gradient(100deg,rgba(231,194,122,0) 38%,rgba(240,170,90,.5) 50%,rgba(231,194,122,0) 62%)"></div>
  <div id="dust" style="inset:0"></div>
  <div id="spot" style="left:200px;top:80px;width:1100px;height:900px;background:radial-gradient(closest-side,rgba(255,236,190,.2),rgba(255,236,190,0))"></div>
  <div id="grade" style="inset:0;background:linear-gradient(135deg,rgba(30,120,130,.16),rgba(0,0,0,0) 45%,rgba(235,150,60,.12))"></div>
  <div id="vig"></div>
  <div id="grain"></div>
  <div id="barT" style="left:0;right:0;top:0;height:90px;background:#000"></div>
  <div id="barB" style="left:0;right:0;bottom:0;height:90px;background:#000"></div>
  <div class="br" style="left:36px;top:106px;border-right:0;border-bottom:0"></div>
  <div class="br" style="right:36px;top:106px;border-left:0;border-bottom:0"></div>
  <div class="br" style="left:36px;bottom:106px;border-right:0;border-top:0"></div>
  <div class="br" style="right:36px;bottom:106px;border-left:0;border-top:0"></div>
  <div id="hudL" class="mono" style="left:90px;top:32px;font-size:22px;letter-spacing:4px;color:#8a9a8c"></div>
  <div id="hudR" class="mono" style="right:90px;top:32px;font-size:22px;letter-spacing:3px;color:#8a9a8c;text-align:right"></div>
  <div id="tags" style="inset:0"></div>
  
  
  <div id="orbL" class="mono" style="left:178px;top:1014px;font-size:15px;letter-spacing:3px;color:#6f806f">AI VOICE</div>
  <div id="orb" style="left:86px;top:984px;width:64px;height:64px"></div>
  <div id="caps"></div>
</div>
<script>
const W=${W},H=${H},FPS=${FPS},TOTAL=${TOTAL};
const OFF=${JSON.stringify(offsets)};


const S0=document.getElementById("stage"),WM=document.querySelector(".wm");
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
let CURP=S0,CUROFF=0;
const BPM=84,BEAT=60/BPM,SIX=BEAT/4;
const snap=t=>Math.round(t/SIX)*SIX;
function mk(cls,html,parent){const e=document.createElement("div");e.className=cls||"";if(html!=null)e.innerHTML=html;(parent||CURP).appendChild(e);return e}
function box(x,y,w,h,cls,html,parent){const e=mk(cls,html,parent);Object.assign(e.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});return e}
function vis(e,t,a,b,d){d=d||.6;b=b==null?1e9:b;const k=Math.min(ease((t-a)/d),ease((b-t)/(d*.8)));e.style.opacity=k;e.style.transform="translateY("+((1-k)*18)+"px)";return k}
function tag(text){return mk("tag",text,document.getElementById("tags"))}
let HITS=[];
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
function ctx(d){
  const P=d.paras,T=P.map(p=>p.words.map(w=>norm(w.t)));
  function idx(p,phrase,occ){const q=phrase.split(" ").map(norm);const A=T[p];let n=0;
    for(let i=0;i+q.length<=A.length;i++){let ok=true;for(let j=0;j<q.length;j++)if(A[i+j]!==q[j]){ok=false;break}
      if(ok){if(n==(occ||0))return i;n++}}
    throw new Error("phrase not found in paragraph "+p+": "+phrase)}
  const len=ph=>ph.split(" ").length;
  return{P,a:i=>P[i].a,b:i=>P[i].b,
    w:(p,ph,o)=>P[p].words[idx(p,ph,o)].a,
    e:(p,ph,o)=>P[p].words[idx(p,ph,o)+len(ph)-1].b,
    ws:(p,ph,o)=>{const i=idx(p,ph,o);return P[p].words.slice(i,i+len(ph)).map(w=>w.a)}};
}
function SC(){const S={items:[],fx:[]};
  S.reg=(e,a,b,d)=>{S.items.push([e,a,b,d]);return e};
  S.run=t=>{S.items.forEach(([e,a,b,d])=>{vis(e,t,a,b,d);if(S.dur&&t>S.dur-.4&&e.classList.contains("tag"))e.style.opacity=0});S.fx.forEach(f=>f(t))};return S}
// dynamic typography: each word slams in on its own time
function x0time(a){return a[0]}
function kin(S,text,times,x,y,w,o){o=o||{};const words=text.split(" ");
  if((o.size||92)>=72)times=times.map(snap);
  const c=box(x,y,w,o.h||220,"c "+(o.cls||"h1"));if((o.size||92)>=84)HITS.push(CUROFF+x0time(times));c.style.fontSize=(o.size||92)+"px";c.style.textAlign=o.align||"center";if(o.color)c.style.color=o.color;
  const tt=i=>times[i]!=null?times[i]:times[times.length-1]+.28*(i-times.length+1);
  const sp=words.map((t,i)=>{const s=document.createElement("span");s.textContent=t;
    const isHi=o.hi&&o.hi.indexOf(i)>=0,am=isHi||o.color==="#e7c27a";
    const ext=(o.size||92)>=100?(am?";text-shadow:0 2px 0 #9b7b2e,0 4px 0 #8a6d2a,0 6px 0 #6e5a26,0 8px 0 #4d3e1a,0 18px 30px rgba(0,0,0,.55)":";text-shadow:0 2px 0 rgba(8,12,9,.6),0 4px 0 rgba(8,12,9,.55),0 6px 0 rgba(8,12,9,.5),0 8px 0 rgba(8,12,9,.45),0 18px 30px rgba(0,0,0,.55)"):"";
    s.style.cssText="display:inline-block;margin:0 .16em;opacity:0;"+(isHi?"color:#e7c27a;":"")+ext;c.appendChild(s);return s});
  const out=o.out==null?1e9:o.out;
  S.fx.push(t=>{sp.forEach((s,i)=>{const k=ease((t-tt(i))/.32);s.style.opacity=k;
      s.style.transform="scale("+(1+(1-k)*.55)+") translateY("+((1-k)*28)+"px) skewX("+((1-k)*-8)+"deg)";s.style.filter=k<1?"blur("+((1-k)*9)+"px)":"none"});
    c.style.opacity=t<tt(0)-.05?0:ease((out-t)/.5)});
  return c}
function strike(S,x,y,w,a,out){const l=box(x,y,0,8,"","");l.style.background="#e7c27a";out=out==null?1e9:out;
  S.fx.push(t=>{const k=ease((t-a)/.5);l.style.width=(w*k)+"px";l.style.opacity=k>0?ease((out-t)/.5):0});return l}
function win(x,y,w,h,title,parent){const e=box(x,y,w,h,"card","",parent);e.style.overflow="hidden";
  const bar=box(0,0,w,64,"",'',e);bar.style.cssText+=";background:#1c2d22;border-bottom:2px solid #3a5a42";
  [0,1,2].forEach(i=>{const d=box(26+i*34,22,18,18,"","",bar);d.style.background=["#c0705f","#e7c27a","#769d79"][i];d.style.borderRadius="50%"});
  const t=box(150,16,w-180,40,"mono",title,bar);t.style.fontSize="24px";t.style.color="#9aaa9c";return e}

// a laptop in 3D: bezel, camera dot, a base slab; the whole device sways a little in the beam
function device(x,y,w,h,parent){
  const wrap=box(x,y,w+60,h+130,"","",parent);wrap.style.perspective="1900px";
  const dev=box(0,0,w+60,h+130,"","",wrap);dev.style.transformStyle="preserve-3d";dev.style.transformOrigin="50% 60%";
  const lid=box(10,0,w+40,h+40,"","",dev);lid.style.cssText+=";background:#080c09;border:3px solid #3a5a42;border-radius:24px;box-shadow:0 40px 70px rgba(0,0,0,.6)";
  const cam=box((w+40)/2-5,6,10,10,"","",lid);cam.style.cssText+=";border-radius:50%;background:#2a3a30";
  const base=box(-20,h+44,w+100,34,"","",dev);base.style.cssText+=";background:linear-gradient(#2a4331,#14221a);border:3px solid #3a5a42;border-radius:6px 6px 30px 30px;box-shadow:0 30px 40px rgba(0,0,0,.5)";
  box((w+100)/2-90,0,180,10,"","",base).style.cssText+=";background:#0b130e;border-radius:0 0 10px 10px";
  return{wrap,dev,lid,sway:t=>{dev.style.transform="rotateY("+(-15+6*Math.sin(t*.5))+"deg) rotateX("+(4+1.5*Math.sin(t*.37))+"deg)"}}}
// technical drawing: paths that draw themselves, labels that type in
function layer(room){const w=box(0,0,1920,1080,"","",room);w.style.pointerEvents="none";return sv("svg",{width:1920,height:1080,viewBox:"0 0 1920 1080",style:"position:absolute;left:0;top:0;overflow:visible"},w)}
function bp(S,svg,d,a,dur,o){o=o||{};const p=sv("path",{d:d,fill:"none",stroke:o.c||"#7fae86","stroke-width":o.w||2,"stroke-linecap":"round","stroke-linejoin":"round"},svg);
  const L=p.getTotalLength();p.setAttribute("stroke-dasharray",L);p.setAttribute("stroke-dashoffset",L);const op=o.o==null?.8:o.o,out=o.out==null?1e9:o.out;
  S.fx.push(t=>{const k=ease((t-a)/dur);p.setAttribute("stroke-dashoffset",L*(1-k));p.style.opacity=(k>0?op:0)*ease((out-t)/.5)});return p}
function bpT(S,svg,txt,x,y,a,o){o=o||{};const e=sv("text",{x:x,y:y,fill:o.c||"#9aaa9c","font-size":o.s||22,"font-family":"Liberation Mono,monospace","letter-spacing":3,"text-anchor":o.anchor||"start"},svg);e.textContent=txt;const out=o.out==null?1e9:o.out;
  S.fx.push(t=>{e.style.opacity=ease((t-a)/.6)*ease((out-t)/.5)*(o.o||1)});return e}
function bpGrid(S,room){const svg=layer(room);let k=0;
  for(let x=240;x<1920;x+=240){bp(S,svg,"M "+x+" 0 L "+x+" 1080",-1.6+k*.07,1.6,{c:"#9cc29f",o:.1,w:1.5});k++}
  for(let y=180;y<1080;y+=180){bp(S,svg,"M 0 "+y+" L 1920 "+y,-1.4+k*.05,1.6,{c:"#9cc29f",o:.1,w:1.5});k++}
  // registration crosses at the crossings of the coarse grid
  [[480,360],[960,360],[1440,360],[480,720],[960,720],[1440,720]].forEach((q,i)=>bp(S,svg,"M "+(q[0]-14)+" "+q[1]+" L "+(q[0]+14)+" "+q[1]+" M "+q[0]+" "+(q[1]-14)+" L "+q[0]+" "+(q[1]+14),-.8+i*.1,.5,{c:"#e7c27a",o:.3,w:2}))}

${people}

// ---------- the home film: five rooms ----------
const CFG={
  lawyer:{skin:SKIN.d,hair:"#6b4a2b",style:"bun",top:"#2f4a38",glasses:true},
  client:{skin:SKIN.c,hair:"#241a14",style:"short",top:"#d9d3c3",tie:null},
  dev:{skin:SKIN.a,hair:"#2a2a2a",style:"short",top:"#3b5a6b",tie:null},
  mgr:{skin:SKIN.b,hair:"#1d1a17",style:"long",top:"#5a3b4a",tie:null},
  aud:{skin:SKIN.d,hair:"#d9d3c3",style:"short",top:"#26402e",glasses:true,tie:null},
  pres:{skin:SKIN.b,hair:"#2a2a2a",style:"bald",top:"#2f4a38"}
};
function P(S,key,x,y,s,a,b,extra){const pr=person(CURP,Object.assign({x:x,y:y,s:s,ph:x*.003},CFG[key],extra||{}));S.reg(pr.wrap,a,b);return pr}
function slab(S,x,y,w,a,b,col){const e=box(x,y,w,16,"");e.style.cssText+=";background:"+(col||"#26402e")+";border-top:4px solid #4a7054;border-radius:6px";S.reg(e,a,b);return e}
function chipAt(S,txt,x,y,a,b,cls){const e=box(x,y,0,0,"chip"+(cls?" "+cls:""),txt);S.reg(e,a,b);return e}

// live action plates: frames of a generated clip (scripts/home-film-live-prep.sh) shown inside the room, so they
// move with the camera. The frame is chosen from the time, so every render is deterministic. Always labelled.
const PENDING=[];
function livePanel(S,key,x,y,w,h,a,b,o){o=o||{};const L=window.LIVE&&window.LIVE[key];
  const e=box(x,y,w,h,"","");e.style.cssText+=";overflow:hidden;border-radius:"+(o.r==null?18:o.r)+"px;"+(o.border===false?"":"border:2px solid #e7c27a;")+"box-shadow:0 30px 60px rgba(0,0,0,.55);background:#0b100c";
  const im=document.createElement("img");im.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover";e.appendChild(im);
  const tg=box(0,h-44,w,44,"mono","AI-GENERATED PEOPLE");tg.style.cssText+=";font-size:17px;letter-spacing:4px;color:#e7c27a;padding:12px 22px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.6))";e.appendChild(tg);
  S.reg(e,a,b,o.d||.7);
  let last="";
  S.fx.push(t=>{if(!L)return;const sp=o.speed||.5,f=Math.max(0,Math.min(L.n-1,Math.floor((t-a)*sp*48))),src="http://live.local/"+key+"/"+String(f+1).padStart(4,"0")+".jpg";
    if(src!==last){last=src;im.src=src;PENDING.push(im.decode().catch(()=>{}))}
    im.style.transform="scale("+(1+.05*Math.max(0,Math.min(1,(t-a)/(L.n/48/sp+1))))+")"});
  return e}

// ---------- scene 1: the morning ----------
function s1(d){const S=SC(),x=ctx(d);
  kin(S,"AI YOU CAN",[x.w(0,"ai"),x.w(0,"you"),x.w(0,"can")],160,100,1600,{size:96,out:x.a(1)-.2,h:140});
  kin(S,"DEFEND.",[x.w(0,"defend")],160,200,1600,{size:120,color:"#e7c27a",out:x.a(1)-.2,h:160});
  livePanel(S,"office",432,372,1056,603,.2,null,{speed:.5});
  return S}

// ---------- scene 2: the team ----------
function s2(d){const S=SC(),x=ctx(d);
  kin(S,"AI AND LAW IS THE AXIS.",x.ws(0,"ai and law is the axis"),160,105,1600,{size:96,color:"#e7c27a",out:x.a(1)-.2,h:150});
  livePanel(S,"team",120,262,1010,577,.2,null,{speed:.5});
  const tW=[x.w(1,"usage policy"),x.w(1,"audit"),x.w(1,"documentation")];
  const rows=["USAGE POLICY","AUDIT","DOCUMENTATION"].map((tx,i)=>{const r=box(1260,290+i*170,540,120,"mono",tx);r.style.cssText+=";border:3px solid #3a5a42;border-radius:16px;background:#16241b;color:#9aaa9c;font-size:32px;letter-spacing:5px;padding:40px 30px;opacity:0";return r});
  [["ADVISORY","advisory"],["ONGOING","ongoing accompaniment"],["TRAINING","and training"]].forEach((c,i)=>{const e=box(260+i*480,880,420,80,"chip",'<div class="lbl" style="margin-top:12px">'+c[0]+"</div>");S.reg(e,x.w(0,c[1]),x.a(1)-.2)});
  S.fx.push(t=>{rows.forEach((r,i)=>{const k=ease((t-tW[i])/.4);r.style.opacity=k;r.style.borderColor=k>0&&t<tW[i]+1.2?"#e7c27a":"#3a5a42";r.style.color=k>0&&t<tW[i]+1.2?"#f5f1e8":"#9aaa9c"})});
  return S}

// ---------- scene 3: the engine ----------
function s3(d){const S=SC(),x=ctx(d),svg=layer(CURP);
  kin(S,"THE ENGINE RUNS",[x.w(0,"the engine"),x.w(0,"runs"),x.w(0,"inside")],160,120,1600,{size:92,out:x.a(1)-.2,h:150});
  kin(S,"INSIDE YOUR PRACTICE.",[x.w(0,"inside"),x.w(0,"your"),x.w(0,"practice")],160,225,1600,{size:92,color:"#e7c27a",out:x.a(1)-.2,h:150});
  const NX=[250,610,970,1330,1690],NY=560,labels=["INTAKE","CLASSIFY","RISK FLAG","LAWYER DECIDES","TRAIL"];
  const tt=[x.w(0,"engine")+.4,x.w(1,"it audits"),x.w(1,"exposure"),x.w(2,"and it puts"),x.w(1,"documented trail")];
  const nodes=NX.map((nx,i)=>{const e=box(nx-120,NY-60,240,120,"card"+(i==3?" am":""),'<div class="lbl" style="margin-top:38px;font-size:'+(i==3?24:28)+'px">'+labels[i]+"</div>");S.reg(e,tt[i]-.5,null);return e});
  for(let i=0;i<4;i++)bp(S,svg,"M "+(NX[i]+120)+" "+NY+" L "+(NX[i+1]-120)+" "+NY,tt[i]-.2,.6,{c:"#7fae86",o:.9,w:3});
  // the recorded trail: a line under the whole flow that fills as the decisions are written down
  const trail=bp(S,svg,"M "+(NX[0]-120)+" 760 L "+(NX[4]+120)+" 760",x.w(1,"documented trail"),1.8,{c:"#e7c27a",o:.9,w:4});
  bpT(S,svg,"A DOCUMENTED TRAIL ON EVERY DECISION",960,806,x.w(1,"documented trail")+.6,{c:"#e7c27a",s:24,anchor:"middle"});
  // the document that travels and stops only at the lawyer
  const doc=box(0,0,70,90,"","");doc.style.cssText+=";background:#f5f1e8;border-radius:6px;box-shadow:0 12px 24px rgba(0,0,0,.45)";S.reg(doc,.5,null);
  const stops=[NX[0],NX[1],NX[2],NX[3]],st=[tt[0],tt[1],tt[2],tt[3]];
  const lawyer=P(S,"lawyer",NX[3],300,.85,x.w(1,"documented")-.3,null,{propR:"pen",clip:215});
  const cl=P(S,"client",NX[0],330,.6,tt[0]-.4,null,{propR:"paper",clip:200}),au=P(S,"mgr",NX[4],330,.6,x.w(1,"documented")-.3,null,{clip:200}),a1=P(S,"aud",NX[1]-60,330,.6,tt[1]-.4,null,{back:true,clip:200}),a2=P(S,"dev",NX[2]+60,330,.6,tt[2]-.4,null,{clip:200});
  const stamp=box(NX[3]-70,NY+70,140,50,"mono","APPROVED");stamp.style.cssText+=";border:4px solid #9cc29f;color:#9cc29f;font-size:26px;letter-spacing:4px;text-align:center;padding-top:6px;border-radius:8px;transform:rotate(-8deg)";S.reg(stamp,x.w(2,"with the lawyer"),null);
  kin(S,"WITH THE LAWYER.",x.ws(2,"with the lawyer"),160,900,1600,{size:70,color:"#e7c27a",h:110});
  S.fx.push(t=>{
    let px=stops[0],k=0;for(let i=0;i<3;i++){const u=ease((t-st[i+1]+.5)/.9);if(u>0)px=lerp(stops[i],stops[i+1],u)}
    doc.style.left=(px-35)+"px";doc.style.top=(NY-45+Math.sin(t*3)*4)+"px";
    nodes.forEach((n,i)=>{const on=t>tt[i]&&(i==3||t<tt[i]+1.5);n.style.borderColor=(i==3&&t>tt[3])?"#e7c27a":(on?"#9cc29f":"#3a5a42")});
    const sg=t>tt[3]+.6&&t<tt[3]+1.9;
    lawyer.update(t,{look:{x:-.3,y:.4},hr:sg?{x:-30,y:150+Math.sin(t*16)*6}:{x:70,y:-20},smile:.3,tilt:2,ra:sg?20:0});
    a1.update(t,{tilt:Math.sin(t*1.3)*2});cl.update(t,{look:{x:.5,y:.2},hr:{x:60,y:-30+Math.sin(t*1.6)*8},ra:-8,smile:.4,tilt:2});au.update(t,{look:{x:-.5,y:.1},hl:{x:-50,y:60+Math.sin(t*3)*6},smile:.3,tilt:-2});a2.update(t,{look:{x:-.4,y:.2},hl:{x:-60+Math.sin(t*8)*8,y:190},hr:{x:60-Math.sin(t*8)*8,y:190},grip:.5})});
  return S}

// ---------- scene 4: the clinic ----------
function s4(d){const S=SC(),x=ctx(d);
  kin(S,"THE CLINIC",x.ws(0,"that is the clinic"),160,120,1600,{size:112,color:"#e7c27a",out:x.a(1)-.2,h:170});
  slab(S,200,860,900,.2,null);
  const L=P(S,"lawyer",440,640,1.0,.2,null,{propR:"pen",clip:215}),C=P(S,"client",940,660,.95,.35,null,{flip:true,clip:215});
  const board=box(1220,300,560,320,"card","",CURP);S.reg(board,.3,null);
  ["ADVISORY","ONGOING","TRAINING"].forEach((tx,i)=>{const r=box(36,34+i*92,488,64,"mono",tx,board);r.style.cssText+=";border:2px solid #3a5a42;border-radius:10px;color:#9aaa9c;font-size:26px;letter-spacing:5px;padding:14px 18px;opacity:0";r.dataset.k=i;S.fx.push(t=>{const tm=[x.w(0,"advisory"),x.w(0,"ongoing accompaniment"),x.w(0,"and training")][i],k=ease((t-tm)/.4);r.style.opacity=k;r.style.borderColor=(k>0&&t<tm+1.3)?"#e7c27a":"#3a5a42";r.style.color=(k>0&&t<tm+1.3)?"#f5f1e8":"#9aaa9c"})});
  const pres=P(S,"pres",1500,760,.7,.4,null,{clip:210});
  const aud=[1300,1500,1700].map((px,i)=>P(S,["dev","mgr","aud"][i],px,970,.62,.45+i*.05,null,{back:true,clip:180}));
  const tQ=x.w(1,"real questions");
  S.fx.push(t=>{
    const ta=Math.abs(Math.sin(t*4.1))>.35,tb=!ta;
    L.update(t,{look:{x:.5,y:.1},talk:ta&&t>tQ-1?Math.abs(Math.sin(t*9))*.7:0,hr:{x:80,y:20+Math.sin(t*2)*10},smile:.35,tilt:2});
    C.update(t,{look:{x:-.5,y:.1},talk:tb&&t>tQ?Math.abs(Math.sin(t*8))*.6:0,smile:.3,tilt:-2,hl:{x:-50,y:200}});
    pres.update(t,{look:{x:-.3,y:0},talk:Math.abs(Math.sin(t*5))*.6,hl:{x:-200,y:-40+Math.sin(t*2)*18},smile:.3});
    aud.forEach((a,i)=>a.update(t,{tilt:Math.sin(t*1.2+i*2)*3+((t+i)%4<.4?4:0)}))});
  return S}

// ---------- scene 5: the decision room ----------
function s5(d){const S=SC(),x=ctx(d);
  kin(S,"EIGHT QUESTIONS.",x.ws(0,"eight questions"),160,100,1600,{size:84,out:x.a(1)-.2,h:130});
  kin(S,"TWO MINUTES.",x.ws(0,"two minutes"),160,190,1600,{size:84,color:"#e7c27a",out:x.a(1)-.2,h:130});
  kin(S,"THEN WE TALK.",x.ws(0,"then we talk"),160,280,1600,{size:84,out:x.a(1)-.2,h:130});
  slab(S,560,872,800,.1,null);
  const dv=device(700,430,520,300,CURP);
  const scr=box(22,22,476,256,"","",dv.lid);scr.style.cssText+=";background:#0f1b14;border-radius:10px;overflow:hidden";
  const qn=box(0,30,476,110,"c big","1 / 8",scr);qn.style.fontSize="96px";
  const bar=box(30,190,416,16,"bar","",scr);bar.style.width="0px";
  const you=P(S,"client",380,700,1.05,.1,null,{flip:false,clip:215}),lw=P(S,"lawyer",1540,700,1.05,x.w(0,"then we talk"),null,{flip:true,clip:215,propR:"pen"});
  const tA=x.a(0)+.2,tB=x.w(0,"then we talk");
  livePanel(S,"walk",0,0,1920,1080,x.w(1,"start at")-.3,null,{speed:.5,r:0,border:false,d:.9});
  const shade=box(0,0,1920,1080,"","");shade.style.background="rgba(8,12,9,.5)";S.reg(shade,x.w(1,"start at")-.3,null,.9);
  const el=box(700,470,520,200,"","");el.innerHTML=document.querySelector(".wm").outerHTML.replace('class="wm"','style="width:520px;opacity:1"');S.reg(el,x.w(1,"start at"),null,1);
  S.reg(box(0,690,W,80,"c h2","lalumapp.com"),x.w(1,"lalumappcom"),null);
  S.fx.push(t=>{
    const q=clamp((t-tA)/(tB-tA-.4));const n=Math.min(8,1+Math.floor(q*8));qn.textContent=n+" / 8";bar.style.width=(416*q)+"px";
    dv.sway(t);dv.wrap.style.opacity=t>x.w(1,"start at")-.2?Math.max(0,1-(t-x.w(1,"start at")+.2)*2):1;
    you.update(t,{look:{x:.4,y:.3},hl:{x:-40+Math.sin(t*10)*8,y:196},hr:{x:70,y:198-Math.sin(t*10)*8},smile:.2,tilt:2,grip:.5});
    lw.update(t,{look:{x:-.5,y:0},smile:.5,tilt:-2,hl:t>tB?{x:-70,y:-90}:null,brow:t>tB?.6:0})});
  return S}

const SCENES={1:s1,2:s2,3:s3,4:s4,5:s5};

// ---------- the one shot world: six rooms, a camera that travels between them, a thread of amber ----------
const ORDER=[1,2,3,4,5];
const ROOMX={};ORDER.forEach((n,i)=>ROOMX[n]=i*2300);
// where the thread leaves a room and where it lands in the next one (room coordinates)
const OUTP={1:[800,520],2:[960,560],3:[1700,520],4:[1500,430]};
const INP={2:[400,520],3:[250,520],4:[420,520],5:[960,520]};
const CAMP={1:[.045,0,0],2:[.02,-40,0],3:[-.03,0,0],4:[.03,30,-12],5:[.035,0,14]};
const BASE=.78;
let NARR=null,ST={},CAPS=[],THR=[],ROOM={};
const sstep=u=>u*u*(3-2*u);
function idle(n,t){const P=CAMP[n],kf=clamp(t/NARR[n].dur);return{cx:ROOMX[n]+960-P[1]*kf*1.3,cy:540-P[2]*kf*1.3,s:BASE*(1+P[0]*kf)}}
function camera(T){
  for(let i=1;i<5;i++){const t0=OFF[i+1]-1.1,t1=OFF[i+1]+.9;
    if(T>=t0&&T<=t1){const u=(T-t0)/(t1-t0),e=sstep(u),A=idle(i,t0-OFF[i]),B=idle(i+1,t1-OFF[i+1]);
      const m=1-e,cx=m*m*m*A.cx+3*m*m*e*(A.cx+900)+3*m*e*e*(B.cx-900)+e*e*e*B.cx,cy=m*m*m*A.cy+3*m*m*e*(A.cy-140)+3*m*e*e*(B.cy+140)+e*e*e*B.cy;
      const dip=Math.sin(Math.PI*u);
      return{cx,cy,s:lerp(A.s,B.s,e)*(1-.34*dip),roll:2.4*Math.sin(2*Math.PI*u),yaw:-9*dip,trans:i,u,dip}}}
  let n=1;for(let i=1;i<5;i++)if(T>=OFF[i+1]+.9)n=i+1;
  const I=idle(n,T-OFF[n]);return Object.assign({},I,{roll:0,yaw:0,trans:0,u:0,dip:0})}
function sceneAt(T){let n=1;for(let i=1;i<5;i++)if(T>=OFF[i+1]-.25)n=i+1;return n}

(function(){const c=document.getElementById("texsrc"),g=c.getContext("2d"),im=g.createImageData(512,512);let sd=11;const R=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
  const oct=[8,16,32,64].map(n=>{const a=[];for(let i=0;i<(n+1)*(n+1);i++)a.push(R());return{n:n,a:a}});
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){let v=0,ws=0;oct.forEach((o,k)=>{const fx=x/512*o.n,fy=y/512*o.n,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,N=o.n+1,a=o.a,v00=a[iy*N+ix],v10=a[iy*N+ix+1],v01=a[(iy+1)*N+ix],v11=a[(iy+1)*N+ix+1],w=1/(k+1);v+=w*((v00*(1-tx)+v10*tx)*(1-ty)+(v01*(1-tx)+v11*tx)*ty);ws+=w});
    const g8=Math.floor(v/ws*255),i=(y*512+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=g8;im.data[i+3]=255}g.putImageData(im,0,0);document.getElementById("tex").style.backgroundImage="url("+c.toDataURL()+")"})();
const SPOTX={1:560,2:650,3:760,4:900,5:900};
const orb=document.getElementById("orb");
const AV=avatar(orb);
const gr=document.createElement("canvas");gr.width=gr.height=200;{const g=gr.getContext("2d"),im=g.createImageData(200,200);let sd=7;for(let i=0;i<im.data.length;i+=4){sd=(sd*16807)%2147483647;const v=(sd%255);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}g.putImageData(im,0,0)}
document.getElementById("grain").style.backgroundImage="url("+gr.toDataURL()+")";
function buildCaps(){const box0=document.getElementById("caps");box0.innerHTML="";CAPS=[];
  ORDER.forEach(n=>{const d=NARR[n];d.paras.forEach(p=>{let cur=[];const chunks=[];const flush=()=>{if(cur.length){chunks.push(cur);cur=[]}};
    p.words.forEach(w=>{cur.push(w);const txt=cur.map(z=>z.t).join(" ");const end=/[.?!:]$/.test(w.t),comma=/[,;]$/.test(w.t);
      if(end||cur.length>=7||(comma&&cur.length>=3)||txt.length>34)flush()});flush();
    chunks.forEach(ws=>{const e=document.createElement("div");e.className="cap";e.style.opacity=0;
      e.innerHTML=ws.map(w=>"<span>"+w.t+"</span>").join("");box0.appendChild(e);
      CAPS.push({n,ws,e,sp:[...e.children],a:OFF[n]+ws[0].a-.08,b:OFF[n]+ws[ws.length-1].b+.35,o:OFF[n]})})})});
  CAPS.forEach((c,i)=>{const nx=CAPS[i+1];if(nx&&nx.a<c.b)c.b=nx.a})}
const DUST=[];for(let i=0;i<34;i++){const e=document.createElement("div");const z=2+(i%3);e.style.cssText="width:"+z+"px;height:"+z+"px;border-radius:50%;background:#f5f1e8;filter:blur(1px)";document.getElementById("dust").appendChild(e);DUST.push(e)}

window.buildAll=narr=>{CAPS=[];NARR=narr;S0.innerHTML="";document.getElementById("tags").innerHTML="";HITS=[];ST={};
  ORDER.forEach(n=>{const room=box(ROOMX[n],0,1920,1080,"","",S0);ROOM[n]=room;CURP=room;CUROFF=OFF[n];ST[n]=SCENES[n](narr[n]);bpGrid(ST[n],room)});
  CURP=S0;CUROFF=0;
  ORDER.forEach(n=>{ST[n].dur=narr[n].dur;ST[n].run(-100)});
  // the thread: leaves the last thing of a room, lands on the first thing of the next
  const svg=sv("svg",{id:"thread",width:14000,height:1200,style:"position:absolute;left:0;top:0;overflow:visible"},S0);
  THR=[];
  for(let i=1;i<5;i++){const A=[ROOMX[i]+OUTP[i][0],OUTP[i][1]],B=[ROOMX[i+1]+INP[i+1][0],INP[i+1][1]];
    const dd="M "+A[0]+" "+A[1]+" C "+(A[0]+800)+" "+(A[1]-60)+" "+(B[0]-800)+" "+(B[1]+60)+" "+B[0]+" "+B[1];
    const glow=sv("path",{d:dd,fill:"none",stroke:"#e7c27a","stroke-width":22,"stroke-linecap":"round",opacity:.22},svg);
    const core=sv("path",{d:dd,fill:"none",stroke:"#e7c27a","stroke-width":6,"stroke-linecap":"round"},svg);
    const tip=sv("circle",{r:12,fill:"#fff3cf",opacity:0},svg);
    const nodeA=sv("circle",{cx:A[0],cy:A[1],r:18,fill:"none",stroke:"#e7c27a","stroke-width":4,opacity:0},svg),nodeB=sv("circle",{cx:B[0],cy:B[1],r:18,fill:"none",stroke:"#e7c27a","stroke-width":4,opacity:0},svg);
    const L=core.getTotalLength();[glow,core].forEach(e=>{e.setAttribute("stroke-dasharray",L);e.setAttribute("stroke-dashoffset",L)});
    THR.push({i,glow,core,tip,nodeA,nodeB,L,t0:OFF[i+1]-1.1,t1:OFF[i+1]+.9})}
  };

window.render=T=>{
  const n=sceneAt(T),d=NARR[n],t=T-OFF[n];
  // beat
  const bt=T/BEAT,ph=bt%1,pulse=Math.exp(-ph*5.5)*((bt%4)<1?1.7:1);
  // camera
  const C=camera(T);
  // only rooms inside the view are shown and animated (state is a pure function of the clamped time)
  const half=960/C.s+60;
  ORDER.forEach(k=>{const rx=ROOMX[k],vis3=(rx<C.cx+half)&&(rx+1920>C.cx-half);ROOM[k].style.display=vis3?"block":"none";
    if(vis3){const lt=clamp(T-OFF[k],-2,NARR[k].dur+2);if(ST[k].lastT!==lt){ST[k].lastT=lt;ST[k].run(lt)}}});
  let dx=0,dy=0,sc=C.s*(1+.0035*pulse);
  HITS.forEach(h=>{const q=T-h;if(q>=0&&q<.4){const am=8*Math.exp(-q*10);dx+=Math.sin(q*95)*am;dy+=Math.cos(q*83)*am*.6;sc*=1+.012*Math.exp(-q*12)}});
  document.getElementById("stage").style.transform="translate("+dx+"px,"+dy+"px) translate(960px,540px) rotateY("+C.yaw+"deg) rotateZ("+C.roll+"deg) scale("+sc+") translate("+(-C.cx)+"px,"+(-C.cy)+"px)";
  document.getElementById("tex").style.backgroundPosition=(-C.cx*.12)+"px "+(-C.cy*.12)+"px";
  document.getElementById("spot").style.left=(SPOTX[n]-550+40*Math.sin(T*.25))+"px";document.getElementById("spot").style.opacity=.8+.2*pulse;
  document.querySelector(".grid").style.backgroundPosition=(-C.cx*.3)+"px "+(-C.cy*.3)+"px";
  document.querySelector(".grid").style.opacity=.05+.035*pulse;
  // thread
  THR.forEach(h=>{const p=clamp((T-(h.t0+.12))/1.5),e=sstep(p),vis2=T<h.t1+.3?1:clamp((h.t1+1.2-T)/.9);
    [h.glow,h.core].forEach(el=>el.setAttribute("stroke-dashoffset",h.L*(1-e)));
    h.glow.style.opacity=.22*vis2;h.core.style.opacity=(T>h.t0?1:0)*vis2;
    const nv=(T>h.t0-.4&&T<h.t1+1.2)?1:0,nr=1+.5*Math.sin(T*8);h.nodeA.setAttribute("opacity",nv*.9*vis2);h.nodeB.setAttribute("opacity",(T>h.t0+.9?1:0)*nv*.9*vis2);h.nodeA.setAttribute("r",18*nr);h.nodeB.setAttribute("r",18*nr);
    if(p>0&&p<1){const pt=h.core.getPointAtLength(h.L*e);h.tip.setAttribute("cx",pt.x);h.tip.setAttribute("cy",pt.y);h.tip.setAttribute("opacity",1)}else h.tip.setAttribute("opacity",0)});
  // hud
  
  const mm=q=>String(Math.floor(q/60)).padStart(2,"0")+":"+String(Math.floor(q%60)).padStart(2,"0");
  
  
  CAPS.forEach(c=>{const on=T>=c.a&&T<c.b;c.e.style.opacity=on?Math.min(1,(T-c.a)/.12):0;
    if(on)c.sp.forEach((sp,i)=>sp.className=(T-c.o>=c.ws[i].a&&T-c.o<c.ws[i].b+.06)?"on":"")});
  const env=d.env[Math.max(0,Math.min(d.env.length-1,Math.floor(t*FPS)))]||0;
  AV(T,env);
  const fr=Math.floor(T*FPS);document.getElementById("grain").style.transform="translate("+(-(fr*37%200))+"px,"+(-(fr*91%200))+"px)";
  document.getElementById("grade").style.opacity=.85+.15*pulse;
  DUST.forEach((e,i)=>{const x=(((i*173+T*(8+(i%5)*3)-C.cx*.04*(1+i%3))%1960)+1960)%1960-20,y=120+(((i*97)%840)-T*(5+(i%4)*2)+840*10)%840;e.style.left=x+"px";e.style.top=y+"px";e.style.opacity=.16+.16*Math.sin(T*1.3+i)});
  const lk=document.getElementById("leak");lk.style.opacity=C.trans?C.dip*.85:0;lk.style.transform="translateX("+((C.u-.1)*1700)+"px)";
  document.getElementById("world").style.opacity=Math.min(1,T/.5,(TOTAL-T)/1.2);
  return Promise.all(PENDING.splice(0));
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => { console.error("PAGE ERROR", e.message); process.exit(1); });
const LIVEDIR = process.env.LIVE || "/tmp/hf-live";
const liveCfg = {};
if (existsSync(LIVEDIR)) for (const k of readdirSync(LIVEDIR)) { const n = readdirSync(path.join(LIVEDIR, k)).filter((f) => f.endsWith(".jpg")).length; if (n) liveCfg[k] = { n }; }
await page.route("http://live.local/**", (route) => route.fulfill({ path: path.join(LIVEDIR, new URL(route.request().url()).pathname) }));
await page.setContent(html);
await page.evaluate((c) => { window.LIVE = c; }, liveCfg);
await page.evaluate(() => document.fonts.ready);
await page.evaluate((nr) => window.buildAll(nr), narr);

if (process.env.PREVIEW) {
  // "3:10,50;5:20" local moments of a scene, or "G:123.4" for a global time
  for (const spec of process.env.PREVIEW.split(";")) {
    const [n, ts] = spec.split(":");
    for (const t of ts.split(",")) {
      const T = n === "G" ? Number(t) : offsets[n] + Number(t);
      await page.evaluate((x) => window.render(x), T);
      await page.screenshot({ path: path.join(out, "preview", `${n === "G" ? "g" : "s" + n}-t${t}.png`) });
    }
  }
  await browser.close();
  console.log("previews in", path.join(out, "preview"));
  process.exit(0);
}

// RANGE="a-b" renders global frames a..b-1 into OUT/part-<a>.mp4 (default: the whole film)
const totalFrames = Math.floor(TOTAL * FPS);
const [fa, fb] = (process.env.RANGE || "0-" + totalFrames).split("-").map(Number);
const frames = path.join(process.env.TMPDIR || "/tmp", `lalum-yt-frames-${fa}`);
// RESUME=1 keeps frames that were already written (the last one may be partial, so it is redone)
if (!process.env.RESUME && existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });
if (process.env.RESUME) {
  const have = readdirSync(frames).filter((f) => f.endsWith(".jpg")).sort();
  if (have.length) rmSync(path.join(frames, have[have.length - 1]));
}
for (let i = fa; i < Math.min(fb, totalFrames); i++) {
  if (process.env.RESUME && existsSync(path.join(frames, `f${String(i - fa).padStart(5, "0")}.jpg`))) continue;
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i - fa).padStart(5, "0")}.jpg`), type: "jpeg", quality: 88 });
}
const file = path.join(out, `part-${String(fa).padStart(6, "0")}.mp4`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%05d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", "-an", file], { stdio: "inherit" });
rmSync(frames, { recursive: true });
console.log("wrote", file);
await browser.close();
