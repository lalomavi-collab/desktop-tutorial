// Renders the picture of the English YouTube essay
// "Google Just Built an AI Lawyer's Assistant. Who Signs?"
// (script and verification ledger: docs/legal-ai-layer/youtube-essay-script.en.md).
//
// The film mixes five techniques, all drawn in code so every word can be checked:
//   1 motion graphics   diagrams, stacks, flows
//   2 filmed footage    NOT here: needs a camera or licensed stock (see "Inserts" in the script doc)
//   3 cinematic         slow push, vignette, film grain, scene title cards, fades through black
//   4 mockup            an agent run window and a review screen (generic, labelled "illustrative")
//   5 avatar            a voice reactive narrator orb driven by the real audio level
// plus dynamic typography: key phrases slam in on the exact word of the narration, and the
// captions highlight the word being spoken.
//
// Timing comes from WORK/narration.json (scripts/youtube-essay-timing.py). No figure on screen
// that was not traced to a primary source; every quote carries its source tag; our own
// reading is labelled "Our analysis". The wordmark is the supplied artwork
// (public/lalum-logo-inverse.svg), never a typeface. No dashes as punctuation.
//
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs \
//   SCENES=1,2,3 node scripts/youtube-essay-visuals.mjs
//
// SCENES   comma list of 1..6 (default all)
// PREVIEW  "3:10,50;5:20" renders PNG stills of those local moments to OUT/preview and exits
// OUT      output folder (default /tmp/lalum-youtube-essay); clips are not committed
// WORK     folder with narration.json (default /tmp/tts)
// FPS      default 24
//
// Needs ffmpeg on PATH.
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const W = 1920;
const H = 1080;
const FPS = Number(process.env.FPS || 24);
const out = process.env.OUT || "/tmp/lalum-youtube-essay";
const work = process.env.WORK || "/tmp/tts";
mkdirSync(path.join(out, "preview"), { recursive: true });
const narr = JSON.parse(readFileSync(path.join(work, "narration.json"), "utf8"));
const order = ["1", "2", "3", "4", "5", "6"];
const offsets = {};
let acc = 0;
for (const n of order) { if (!narr[n]) continue; offsets[n] = acc; acc += narr[n].dur; }
const TOTAL = acc;

const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0b100c}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 25%,#1f3626 0%,#142019 55%,#0b100c 100%)}
.grid{position:absolute;inset:0;opacity:.05;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:80px 80px}
#world{position:absolute;inset:0}
#stage{position:absolute;inset:0;transform-origin:50% 45%}
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
.tag{left:90px;top:104px;font-size:26px;color:#9aaa9c;padding-left:16px;border-left:4px solid #769d79;letter-spacing:.3px}
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
#caps{left:0;right:0;top:930px;height:80px}
.cap{left:0;right:0;top:0;text-align:center;font-size:56px;font-weight:700;white-space:nowrap}
.cap span{display:inline-block;padding:2px 11px;margin:0 3px;border-radius:12px;text-shadow:0 3px 14px rgba(0,0,0,.75)}
.cap span.on{background:#e7c27a;color:#101712;text-shadow:none}
#grain{left:-200px;top:-200px;width:2400px;height:1500px;opacity:.07;mix-blend-mode:screen}
#vig{inset:0;background:radial-gradient(75% 75% at 50% 48%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="world"><div id="stage"></div></div>
${logo}
<div id="hud">
  <div class="br" style="left:36px;top:36px;border-right:0;border-bottom:0"></div>
  <div class="br" style="right:36px;top:36px;border-left:0;border-bottom:0"></div>
  <div class="br" style="left:36px;bottom:36px;border-right:0;border-top:0"></div>
  <div class="br" style="right:36px;bottom:36px;border-left:0;border-top:0"></div>
  <div id="hudL" class="mono" style="left:90px;top:52px;font-size:24px;letter-spacing:4px;color:#8a9a8c"></div>
  <div id="hudR" class="mono" style="right:90px;top:52px;font-size:24px;letter-spacing:3px;color:#8a9a8c;text-align:right"></div>
  <div id="prog" style="left:90px;right:90px;top:1066px;height:4px;background:#1c2d22"></div>
  <div id="progF" style="left:90px;top:1066px;height:4px;width:0;background:#e7c27a"></div>
  <div id="orbL" class="mono" style="left:84px;top:868px;font-size:16px;letter-spacing:3px;color:#6f806f">AI NARRATOR</div>
  <div id="orb" style="left:90px;top:900px;width:110px;height:110px"></div>
  <div id="caps"></div>
  <div id="title" style="inset:0"></div>
  <div id="vig"></div>
  <div id="grain"></div>
</div>
<script>
const W=${W},H=${H},FPS=${FPS},TOTAL=${TOTAL};
const OFF=${JSON.stringify(offsets)};
const NAMES={1:"THE HOOK",2:"AGENTS",3:"THE LAYER",4:"THE HOUR",5:"WHO ANSWERS",6:"THE THREE QUESTIONS"};
const S0=document.getElementById("stage"),WM=document.querySelector(".wm");
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
function mk(cls,html,parent){const e=document.createElement("div");e.className=cls||"";if(html!=null)e.innerHTML=html;(parent||S0).appendChild(e);return e}
function box(x,y,w,h,cls,html,parent){const e=mk(cls,html,parent);Object.assign(e.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});return e}
function vis(e,t,a,b,d){d=d||.6;b=b==null?1e9:b;const k=Math.min(ease((t-a)/d),ease((b-t)/(d*.8)));e.style.opacity=k;e.style.transform="translateY("+((1-k)*18)+"px)";return k}
function tag(text){return mk("tag",text)}
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
  S.run=t=>{S.items.forEach(([e,a,b,d])=>vis(e,t,a,b,d));S.fx.forEach(f=>f(t))};return S}
// dynamic typography: each word slams in on its own time
function kin(S,text,times,x,y,w,o){o=o||{};const words=text.split(" ");
  const c=box(x,y,w,o.h||220,"c "+(o.cls||"h1"));c.style.fontSize=(o.size||92)+"px";c.style.textAlign=o.align||"center";if(o.color)c.style.color=o.color;
  const tt=i=>times[i]!=null?times[i]:times[times.length-1]+.28*(i-times.length+1);
  const sp=words.map((t,i)=>{const s=document.createElement("span");s.textContent=t;
    s.style.cssText="display:inline-block;margin:0 .16em;opacity:0;"+(o.hi&&o.hi.indexOf(i)>=0?"color:#e7c27a;":"");c.appendChild(s);return s});
  const out=o.out==null?1e9:o.out;
  S.fx.push(t=>{sp.forEach((s,i)=>{const k=ease((t-tt(i))/.32);s.style.opacity=k;
      s.style.transform="scale("+(1+(1-k)*.55)+") translateY("+((1-k)*28)+"px) skewX("+((1-k)*-8)+"deg)";s.style.filter="blur("+((1-k)*9)+"px)"});
    c.style.opacity=t<tt(0)-.05?0:ease((out-t)/.5)});
  return c}
function strike(S,x,y,w,a,out){const l=box(x,y,0,8,"","");l.style.background="#e7c27a";out=out==null?1e9:out;
  S.fx.push(t=>{const k=ease((t-a)/.5);l.style.width=(w*k)+"px";l.style.opacity=k>0?ease((out-t)/.5):0});return l}
function win(x,y,w,h,title){const e=box(x,y,w,h,"card");e.style.overflow="hidden";
  const bar=box(0,0,w,64,"",'',e);bar.style.cssText+=";background:#1c2d22;border-bottom:2px solid #3a5a42";
  [0,1,2].forEach(i=>{const d=box(26+i*34,22,18,18,"","",bar);d.style.background=["#c0705f","#e7c27a","#769d79"][i];d.style.borderRadius="50%"});
  const t=box(150,16,w-180,40,"mono",title,bar);t.style.fontSize="24px";t.style.color="#9aaa9c";return e}

// ---------- scene 1: the hook ----------
function s1(d){const S=SC(),x=ctx(d);
  const g0=x.w(0,"not a chatbot")-.1;
  const date=S.reg(mk("c big","25.8.2026"),.3,g0);date.style.top="400px";
  S.reg(tag("Google Cloud announcement, preview"),.5,g0);
  kin(S,"NOT A CHATBOT.",x.ws(0,"not a chatbot"),0,230,W,{size:64,color:"#8a9a8c",out:x.b(0)+1});
  kin(S,"complete work rather than return suggestions",x.ws(0,"complete work rather than return suggestions"),160,400,1600,{size:96,out:x.b(0)+1,hi:[0,1]});
  S.reg(tag("Google Cloud blog, 25.8.2026"),x.w(0,"agents"),x.b(0)+1);
  const rows=[["Contract review","contract review"],["Negotiation","negotiation"],["Tracking regulation","tracking regulation"],["Redacting court filings","redacting court filings"],["Drafting NDAs","drafting the nda"]];
  rows.forEach((r,i)=>{const e=box(520,190+i*116,880,88,"chip",'<span class="h3">'+r[0]+'</span>');e.style.fontSize="42px";S.reg(e,x.w(1,r[1]),x.b(1)+.9)});
  S.reg(tag("Workflows Google lists"),x.w(1,"contract review"),x.b(1)+.9);
  kin(S,"THE HOURS OF A TRAINED PERSON",x.ws(2,"the hours of a trained person"),160,300,1600,{size:88,hi:[1],out:x.w(2,"now one")-.1});
  const page=box(580,200,760,590,"card");const widths=[620,700,540,690,300,0,660,610,700,480,650];
  const bars=widths.map((w,i)=>{const b=mk("bar","",page);b.style.top=(50+i*46)+"px";b.style.left="56px";return b});
  const cur=mk("cursor","",page);
  const t0=x.w(2,"now one"),t1=x.b(2);
  S.reg(page,t0,x.a(3)+.5);
  S.fx.push(t=>{let act=-1;bars.forEach((b,i)=>{const a=t0+(i/widths.length)*(t1-t0),k=clamp((t-a)/((t1-t0)/widths.length*1.1));b.style.width=(widths[i]*ease(k))+"px";if(k>0&&k<1)act=i});
    if(act>=0){cur.style.opacity=1;cur.style.left=(56+parseFloat(bars[act].style.width)+10)+"px";cur.style.top=(42+act*46)+"px"}else cur.style.opacity=Math.floor(t*2)%2?1:0});
  kin(S,"Can the machine draft? It can.",x.ws(3,"not whether the machine can draft"),160,170,1600,{size:54,color:"#8a9a8c",out:x.w(3,"who decides")-.1});
  kin(S,"WHO DECIDES?",[x.w(3,"who decides"),x.w(3,"decides")],160,230,1600,{size:104});
  kin(S,"ON WHAT BASIS?",x.ws(3,"on what basis").slice(0,3),160,380,1600,{size:104});
  kin(S,"WHO SIGNS?",[x.w(3,"and who signs")+.15,x.w(3,"signs")],160,530,1600,{size:120,color:"#e7c27a"});
  const sig=box(520,740,880,4,"","");sig.style.background="#e7c27a";const xm=box(480,690,60,60,"h1 amber","&times;");
  S.fx.push(t=>{const k=ease((t-x.w(3,"and who signs"))/1.2);sig.style.opacity=k;sig.style.width=(880*k)+"px";xm.style.opacity=k;sig.style.boxShadow="0 0 "+(18+12*Math.sin(t*4))+"px #e7c27a"});
  return S}

// ---------- scene 2: chatbot to agent ----------
function s2(d){const S=SC(),x=ctx(d);
  // left: the chatbot loop
  const L0=x.a(0);
  const lt=S.reg(box(100,200,820,80,"c h2","The chatbot era"),L0,x.a(2)-.3);lt.style.right="auto";
  const A=S.reg(box(150,380,230,230,"card",'<div class="lbl rel" style="margin-top:92px">Chatbot</div>'),L0,x.a(2)-.3);
  const B=S.reg(box(640,380,230,230,"card",'<div class="lbl rel" style="margin-top:92px">Document</div>'),L0,x.a(2)-.3);
  const tk=S.reg(box(0,0,70,92,"",""),L0,x.a(2)-.3);tk.style.background="#f5f1e8";tk.style.borderRadius="8px";
  const you=S.reg(box(0,0,100,100,"","YOU"),L0,x.a(2)-.3);you.style.cssText+=";border:4px solid #e7c27a;border-radius:50%;font-size:30px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#e7c27a;background:#16241b";
  const k=[[L0,640-20],[x.w(0,"you pasted"),640-20],[x.w(0,"the box answered"),380-30],[x.w(0,"you copied"),380-30],[x.w(0,"the human did"),640-20],[x.b(0),640-20]];
  S.fx.push(t=>{let px=k[0][1];for(let i=0;i<k.length-1;i++){if(t>=k[i][0]&&t<k[i+1][0]){px=lerp(k[i][1],k[i+1][1],ease((t-k[i][0])/Math.min(1.3,k[i+1][0]-k[i][0])))}else if(t>=k[i+1][0])px=k[i+1][1]}
    tk.style.left=px+"px";tk.style.top="470px";tk.style.background=(t>x.w(0,"the box answered")&&t<x.w(0,"you copied")+.2)||t>x.w(0,"you copied")?"#9cc29f":"#f5f1e8";
    you.style.left=(px-15)+"px";you.style.top="340px";const pulse=t>x.w(0,"the human did")?1+.12*Math.sin(t*9):1;you.style.transform="scale("+pulse+")"});
  // right: the agent flow
  const R0=x.a(1);
  const rt=S.reg(box(1000,200,820,80,"c h2 green","The agent era"),R0,x.a(2)-.3);rt.style.left="1000px";rt.style.right="auto";
  const names=["Skill","Connection","Agent","Result"];
  names.forEach((n,i)=>S.reg(box(1020+i*205,400,160,190,"card",'<div class="lbl rel" style="margin-top:70px;font-size:26px">'+n+'</div>'),R0,x.a(2)-.3));
  const tk2=S.reg(box(0,0,70,92,"",""),R0,x.a(2)-.3);tk2.style.background="#9cc29f";tk2.style.borderRadius="8px";
  const y2=S.reg(box(1380,700,100,100,"","YOU"),R0,x.a(2)-.3);y2.style.cssText+=";border:4px solid #3a5a42;border-radius:50%;font-size:30px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#8a9a8c;background:#16241b";
  S.fx.push(t=>{const m=((t-R0)%8)/8;const px=m<.9?lerp(1020+45,1020+3*205+45,m/.9):1020+3*205+45;tk2.style.left=px+"px";tk2.style.top="451px"});
  kin(S,"AN AGENT CHANGES WHO MOVES.",x.ws(1,"an agent changes who moves"),0,820,W,{size:76,hi:[3,4],out:x.a(2)-.3});
  // the four blocks and the control plane
  const layers=[["SKILLS","instructions and context","skills"],["CONNECTIONS","inherit existing permissions","connections"],["AGENTS","carry the work through","agents"],["OPEN PARTNER ECOSYSTEM","integrators and legal tech","open partner"]];
  layers.forEach((l,i)=>S.reg(box(120,170+i*130,1100,110,"card",'<div class="rel h2" style="margin:12px 0 0 40px;font-size:46px">'+l[0]+'</div><div class="rel dim" style="margin:2px 0 0 40px;font-size:26px">'+l[1]+'</div>'),x.w(2,l[2]),x.a(4)-.2));
  const base=box(120,170+4*130+6,1100,110,"card am",'<div class="rel h2 amber" style="margin:12px 0 0 40px;font-size:46px">GOVERNED CONTROL PLANE</div><div class="rel dim" style="margin:2px 0 0 40px;font-size:26px">VPC, CMEK, isolation, traceable citations</div>');
  S.reg(base,x.w(2,"underneath all four"),x.a(4)-.2);
  S.fx.push(t=>{base.style.boxShadow="0 0 "+(10+16*Math.max(0,Math.sin(t*3)))+"px rgba(231,194,122,.5)"});
  S.reg(tag("Per Google's description, 25.8.2026"),x.w(2,"skills"),x.a(4)-.2);
  kin(S,"NOT SMARTER.",[x.w(3,"not just"),x.w(3,"smarter")],1250,300,620,{size:64,color:"#8a9a8c",out:x.a(4)-.3,h:100});
  kin(S,"GOVERNED.",[x.w(3,"governed")],1250,430,620,{size:84,color:"#e7c27a",out:x.a(4)-.3,h:120});
  // mockup: an agent run
  const mw=win(460,170,1000,600,"agent run  /  illustrative mockup");S.reg(mw,x.w(4,"reviewing"),x.a(5)-.2);
  const steps=[["Review contract against playbook","reviewing a contract"],["Respond to access request","responding"],["Redact sensitive details in a filing","redacting"]];
  steps.forEach((s,i)=>{const r=box(40,100+i*120,920,90,"chip",'<span style="font-size:34px;font-weight:700">'+s[0]+'</span>',mw);const st=box(700,22,190,40,"mono","",r);st.style.fontSize="24px";st.style.textAlign="right";
    const ta=x.w(4,s[1]);S.fx.push(t=>{const k=ease((t-ta)/.4);r.style.opacity=k;r.style.transform="translateX("+((1-k)*40)+"px)";const done=t>ta+1.2;st.textContent=done?"DONE":"RUNNING";st.style.color=done?"#9cc29f":"#e7c27a"})});
  const pill=box(40,470,920,90,"chip",'<span class="amber" style="font-size:32px;font-weight:700">Practitioner confirmation required</span>',mw);pill.style.borderColor="#e7c27a";
  S.fx.push(t=>{pill.style.opacity=ease((t-x.w(4,"those are not demos"))/.5)});
  S.reg(tag("Illustrative mockup, not a Google screen"),x.w(4,"reviewing"),x.a(5)-.2);
  // the question
  kin(S,"The chatbot era asked: can AI help me write?",x.ws(5,"the chatbot era asked can ai help me write"),160,230,1600,{size:54,color:"#8a9a8c",out:1e9});
  kin(S,"WHICH PARTS OF THE WORK CAN I STOP TOUCHING?",x.ws(5,"which parts of the work can i stop touching"),160,420,1600,{size:92,color:"#e7c27a",h:300});
  return S}

// ---------- scene 3: the integration layer ----------
function s3(d){const S=SC(),x=ctx(d);
  kin(S,"WHAT MOST COVERAGE SKIPS",[x.w(0,"part")].concat(x.ws(0,"most coverage skips")),160,360,1600,{size:96,hi:[3],out:x.b(0)+.6});
  // part A: the firm's systems and the agent
  const sys=[["Document management","document management"],["E-discovery","ediscovery"],["Research","research"],["E-signature","esignature"]];
  const gA=x.b(1)+.8;
  sys.forEach((s,i)=>S.reg(box(150,190+i*150,520,116,"card",'<div class="rel h3" style="margin:34px 0 0 34px">'+s[0]+'</div>'),x.w(1,s[1]),gA));
  S.reg(box(1250,300,520,330,"card am",'<div class="rel h2 amber" style="margin-top:130px;text-align:center">Agent</div>'),x.w(1,"an agent"),gA);
  const lines=sys.map((s,i)=>{const l=box(670,248+i*150,580,4,"","");l.style.background="#3a5a42";return l});
  S.fx.push(t=>{const a=x.w(1,"googles design");lines.forEach((l,i)=>{const k=ease((t-a-i*.2)/.8);l.style.opacity=t<gA?k:0;l.style.width=(580*k)+"px"})});
  kin(S,"Connections inherit existing permissions",[x.w(1,"the connections"),x.w(1,"inherit"),x.w(1,"the permissions"),x.w(1,"a firm has")],160,700,1600,{size:56,out:gA,h:100});
  S.reg(tag("Google Cloud blog, 25.8.2026"),x.w(1,"googles design"),gA);
  // part B: the wall
  const grp=[["DOCUMENT MANAGEMENT",110,170,[["iManage","imanage"],["NetDocuments","netdocuments"]],2],["E-DISCOVERY",700,170,[["Everlaw","everlaw"],["RelativityOne","relativityone"]],2],["RESEARCH",1290,170,[["Thomson Reuters HighQ","thomson"],["CourtListener","courtlistener"],["Courtroom5","courtroom5"]],2],["CONTRACTS",110,480,[["Docusign","docusign"]],2],["LEGAL AI",700,480,[["Harvey","harvey"],["Legora","legora"]],2],["PRODUCTIVITY",1290,480,[["Microsoft 365","microsoft 365"],["Google Workspace","google workspace"]],2]];
  const gB=x.a(3)-.1;
  grp.forEach(g=>{const first=x.w(2,g[3][0][1]);const h=box(g[1],g[2],500,50,"lbl green",g[0]);h.style.textAlign="left";h.style.letterSpacing="3px";S.reg(h,first-.5,gB);
    g[3].forEach((n,i)=>{const c=box(g[1],g[2]+56+i*68,500,58,"chip",n[0]);c.style.fontSize="32px";S.reg(c,x.w(2,n[1]),gB)})});
  S.reg(tag("Connectors as listed by Google, 25.8.2026, preview"),x.w(2,"document management"),gB);
  // part C: the front door
  kin(S,"NOTHING TO RIP OUT.",[x.w(3,"nobody"),x.w(3,"has to"),x.w(3,"rip"),x.w(3,"anything out")],160,230,1600,{size:92,out:x.a(4)-.2});
  kin(S,"THE FRONT DOOR.",x.ws(3,"the front door"),160,400,1600,{size:92,color:"#e7c27a",out:x.a(4)-.2});
  kin(S,"THE KEYS THE FIRM ALREADY ISSUED.",x.ws(3,"the keys the firm already issued"),160,570,1600,{size:70,color:"#cfd9cb",out:x.a(4)-.2});
  // part D: the layer
  const srcs=["Documents","E-discovery","Contracts","Research","Legal AI"];
  const gD=x.a(5)-.2;
  const sb=srcs.map((s,i)=>S.reg(box(120,190+i*120,380,88,"chip",s),x.w(4,"once the work"),gD));
  const node=box(800,300,360,360,"card am",'<div class="rel h2 amber" style="margin-top:150px;text-align:center;font-size:46px">THE LAYER</div>');node.style.borderRadius="50%";
  S.reg(node,x.w(4,"once the work"),gD);
  const sl=srcs.map((s,i)=>{const l=box(500,234+i*120,0,4,"","");l.style.background="#3a5a42";return l});
  S.fx.push(t=>{const a=x.w(4,"once the work");sl.forEach((l,i)=>{const k=ease((t-a-.5-i*.25)/.8);l.style.opacity=t<gD?1:0;l.style.width=(300*k)+"px"});node.style.boxShadow="0 0 "+(16+24*Math.max(0,Math.sin(t*2.6)))*(t>x.w(4,"but whoever")?1:.4)+"px rgba(231,194,122,.55)"});
  [["the matter","the matter"],["the documents","the documents"],["the clauses","the clauses"],["the outcomes","the outcomes"]].forEach((c,i)=>{const e=box(1260,200+i*100,540,76,"chip",c[0]);e.style.fontSize="38px";S.reg(e,x.w(4,c[1]),gD)});
  S.reg(tag("Our analysis, not a claim of fact"),x.w(4,"once the work"),gD);
  // part E: the race
  const q=kin(S,"\\u201Caccelerating a race among technology companies\\u201D",[x.w(5,"reuters"),x.w(5,"reuters")+.35,x.w(5,"a race"),x.w(5,"race")+.2,x.w(5,"among"),x.w(5,"technology"),x.w(5,"companies")],160,200,1600,{size:78,out:x.w(5,"the race is not")-.2,h:260});
  S.reg(tag("Reuters, 25.8.2026"),x.w(5,"reuters"),x.w(5,"the race is not")-.2);
  kin(S,"NOT WHO DRAFTS FASTEST.",[x.w(5,"not about"),x.w(5,"who"),x.w(5,"drafts"),x.w(5,"fastest")],160,420,1600,{size:84,color:"#8a9a8c",out:x.a(6)-.2});
  strike(S,430,478,1060,x.e(5,"drafts fastest")+.2,x.a(6)-.2);
  kin(S,"THE LAYER.",[x.w(5,"the layer through"),x.w(5,"layer")],160,600,1600,{size:130,color:"#e7c27a",out:x.a(6)-.2});
  // part F: the audit question
  kin(S,"\\u201Cwhich model is smartest\\u201D",x.ws(6,"which model is smartest"),160,230,1600,{size:64,color:"#8a9a8c",out:1e9,h:120});
  strike(S,480,262,960,x.e(6,"smartest")+.6);
  kin(S,"\\u201Cwho controls the layer, and what can I audit about it?\\u201D",x.ws(6,"who controls the layer and what can i audit about it"),160,420,1600,{size:72,color:"#e7c27a",h:300});
  return S}

// ---------- scene 4: the billable hour ----------
function s4(d){const S=SC(),x=ctx(d);
  const clock=box(510,90,900,900,"",'<svg width="900" height="900" viewBox="-450 -450 900 900" fill="none" stroke-linecap="round"><circle r="420" stroke="#e7c27a" stroke-width="6"/><circle r="400" stroke="#e7c27a" stroke-width="2"/><g id="ck_m"><path d="M0 0V-330" stroke="#f5f1e8" stroke-width="12"/></g><g id="ck_h"><path d="M0 0V-210" stroke="#e7c27a" stroke-width="20"/></g><circle r="22" fill="#f5f1e8"/></svg>');
  clock.style.opacity=.085;
  S.fx.push(t=>{document.getElementById("ck_m").setAttribute("transform","rotate("+(t*6)+")");document.getElementById("ck_h").setAttribute("transform","rotate("+(t*.5)+")")});
  const kh=S.reg(box(130,170,800,60,"lbl green","KNOWN"),x.w(0,"what we know"),x.a(3)-.2);kh.style.textAlign="left";kh.style.letterSpacing="6px";
  const ih=S.reg(box(990,170,800,60,"lbl amber","INFERRED"),x.w(0,"what we are inferring"),x.a(3)-.2);ih.style.textAlign="left";ih.style.letterSpacing="6px";
  [["Legal work is priced by time.","prices legal work"],["More hours, more revenue.","more hours"],["Faster work earns less, unless the price changes.","whoever does"]].forEach((c,i)=>{const e=box(130,250+i*190,800,160,"card",'<div class="rel p" style="padding:30px 34px;color:#f5f1e8">'+c[0]+'</div>');S.reg(e,x.w(1,c[1]),x.a(3)-.2);
    S.fx.push(t=>{if(t>x.a(2))e.style.opacity=Math.min(parseFloat(e.style.opacity||1),.45+.55*ease((x.a(3)-.2-t)/.5))})});
  [["First-pass review takes minutes.","firstpass"],["The hour stops measuring value.","the hour stops"],["A client asks what they are paying for.","a client can ask"]].forEach((c,i)=>{const e=box(990,250+i*190,800,160,"card am",'<div class="rel p amber" style="padding:30px 34px">'+c[0]+'</div>');S.reg(e,x.w(2,c[1]),x.a(3)-.2)});
  S.reg(tag("Analysis"),x.w(0,"what we know"),x.a(3)-.2);
  kin(S,"NO FIGURE.",[x.w(3,"giving you a"),x.w(3,"figure")],160,260,1600,{size:150,out:x.a(4)-.2,h:230});
  kin(S,"THE DIRECTION OF PRESSURE IS CLEAR.",x.ws(3,"the direction of pressure is clear"),160,500,1600,{size:70,color:"#9cc29f",out:x.a(4)-.2,h:120});
  kin(S,"THE SIZE IS NOT.",x.ws(3,"and the size is not").slice(1),160,640,1600,{size:84,color:"#e7c27a",out:x.a(4)-.2,h:130});
  kin(S,"WHAT REPLACES THE HOUR?",x.ws(4,"so what replaces the hour").slice(1),160,380,1600,{size:92,hi:[3],out:x.w(4,"fixed fees")-.3,h:260});
  [["Fixed fees","for defined outputs","fixed fees"],["Pricing for the decision","not the draft","pricing for the decision"],["A premium for judgment and accountability","someone whose licence is on the line","a premium"]].forEach((r,i)=>{
    const e=box(220,190+i*210,1480,170,"card"+(i==2?" am":""),'<div class="rel h2" style="margin:24px 0 0 50px;font-size:54px">'+r[0]+'</div><div class="rel p dim" style="margin:4px 0 0 50px">'+r[1]+'</div>');S.reg(e,x.w(4,r[2]),x.a(5)-.2)});
  S.reg(tag("Our analysis"),x.w(4,"so what replaces"),x.a(5)-.2);
  kin(S,"NOT THE HOUR.",[x.w(5,"the billable"),x.w(5,"billable"),x.w(5,"hour is")],160,260,1600,{size:140,color:"#8a9a8c",h:200});
  strike(S,500,370,920,x.w(5,"clever"));
  kin(S,"THE DECISION.",[x.w(5,"a worse"),x.w(5,"proxy")],160,520,1600,{size:150,color:"#e7c27a",h:220});
  return S}

// ---------- scene 5: who answers ----------
function s5(d){const S=SC(),x=ctx(d);
  kin(S,"WHAT NO LAUNCH ANSWERS",[x.w(0,"the part"),x.w(0,"that no"),x.w(0,"product launch"),x.w(0,"answers")],160,400,1600,{size:92,hi:[4],out:x.b(0)+.6}).style.fontSize="92px";
  kin(S,"\\u201Ca duty of confidentiality that does not bend for convenience\\u201D",x.ws(1,"a duty of confidentiality that does not bend for convenience"),160,330,1600,{size:70,out:x.w(1,"good")+.6,h:300});
  S.reg(tag("Google Cloud blog, 25.8.2026"),x.w(1,"google writes"),x.w(1,"good")+.6);
  kin(S,"WHO ANSWERS?",x.ws(1,"who answers"),160,340,1600,{size:170,color:"#e7c27a",h:260});
  const he=box(260,210,1400,400,"card am",'<div class="rel rtl h2" style="padding:54px 64px;line-height:1.35;font-size:56px">&quot;שימוש שעושים עורכי דין בכלי בינה מלאכותית, אין משמעו כי הם יכולים להתפרק מאחריותם ומשיקול דעתם המקצועי&quot;</div>');
  const tEnd=x.w(2,"and it set out")-.1;
  S.reg(he,x.w(2,"israels supreme court"),tEnd);
  S.reg(box(260,650,1400,150,"c p dim","Unofficial translation: using AI tools does not mean lawyers can shed their responsibility and professional judgment."),x.w(2,"wrote that"),tEnd);
  S.reg(tag("Supreme Court of Israel, HCJ 38379-12-24, 23.2.2025, para 26 (official text)"),x.w(2,"israels supreme court"),tEnd);
  S.reg(box(160,170,1600,100,"c h2","A fabricated filing breaches duties to"),x.w(2,"duties to"),x.a(3)-.2);
  [["The client","the client"],["The court","the court"],["The opposing party","the opposing party"],["The profession","the profession"]].forEach((c,i)=>S.reg(box(150+i*430,380,390,260,"card",'<div class="rel h2" style="margin-top:92px;text-align:center;font-size:46px">'+c[0]+'</div>'),x.w(2,c[1]),x.a(3)-.2));
  S.reg(tag("HCJ 38379-12-24, para 15 (summary)"),x.w(2,"duties to"),x.a(3)-.2);
  kin(S,"NOT TO THE TOOL VENDOR.",x.ws(3,"not to the tool vendor"),160,230,1600,{size:84,color:"#8a9a8c",out:x.a(4)-.3,h:130});
  strike(S,430,300,1060,x.e(3,"tool vendor")+.1,x.a(4)-.3);
  kin(S,"NOT TO THE MODEL.",x.ws(3,"not to the model").slice(0,4),160,400,1600,{size:84,color:"#8a9a8c",out:x.a(4)-.3,h:130});
  strike(S,560,470,800,x.e(3,"the model")+.1,x.a(4)-.3);
  kin(S,"THE DUTY STAYS WITH THE PERSON.",x.ws(3,"the duty stays with the person"),160,570,1600,{size:92,color:"#e7c27a",out:x.a(4)-.3,h:220});
  kin(S,"SAME ACCOUNTABILITY.",[x.w(4,"changes nothing"),x.w(4,"about who")],160,320,1600,{size:100,out:x.a(5)-.3,h:170});
  kin(S,"EASIER TO STOP LOOKING.",[x.w(4,"how easy"),x.w(4,"it is to"),x.w(4,"to stop"),x.w(4,"looking")],160,500,1600,{size:100,color:"#e7c27a",out:x.a(5)-.3,h:170});
  // mockup: the review screen
  const mw=win(200,170,1520,610,"review  /  illustrative mockup");S.reg(mw,x.w(5,"a machine produces"),1e9);
  const L=box(40,100,700,470,"card","",mw);L.style.background="#101a14";
  [640,520,600,420,580,360].forEach((w,i)=>{const b=box(30,34+i*62,w,16,"","",L);b.style.cssText+=";border-radius:8px;background:"+(i==3?"#e7c27a":"#35503b")});
  const flag=box(30,286,300,42,"mono","AI flag: liability cap",L);flag.style.cssText+=";font-size:22px;color:#101712;background:#e7c27a;border-radius:8px;padding:8px 14px;top:310px";
  const Rr=box(780,100,700,470,"card am","",mw);
  box(30,24,640,40,"mono","REVIEW RECORD",Rr).style.cssText+=";font-size:24px;color:#9aaa9c;letter-spacing:4px";
  const f=[["Checked against","what exactly did the human check"],["Reviewed by","a human signs it"],["Evidence kept","could they prove it"]];
  const fe=f.map((r,i)=>{const e=box(30,90+i*100,640,76,"chip",'<span class="dim" style="font-size:28px">'+r[0]+'</span>',Rr);const ln=box(300,40,300,3,"","",e);ln.style.borderBottom="4px dashed #e7c27a";return e});
  const btn=[["Approve",30],["Reject",350]].map(b=>{const e=box(b[1],390,290,60,"chip",b[0],Rr);e.style.cssText+=";text-align:center;font-size:30px;opacity:.35;padding:10px";return e});
  S.fx.push(t=>{fe.forEach((e,i)=>{const ta=x.w(5,f[i][1]);const k=ease((t-ta)/.5);e.style.opacity=.25+.75*k;e.style.borderColor=k>0&&t<ta+2?"#e7c27a":"#3a5a42"})});
  S.reg(L,x.w(5,"a machine produces"),1e9);S.reg(Rr,x.w(5,"a human signs"),1e9);
  S.reg(tag("Illustrative mockup"),x.w(5,"a machine produces"),1e9);
  return S}

// ---------- scene 6: outro ----------
function s6(d){const S=SC(),x=ctx(d);
  kin(S,"SO WHERE DOES THAT LEAVE US?",x.ws(0,"so where does that leave us"),160,380,1600,{size:92,out:x.b(0)+.6,h:260});
  kin(S,"THE LAYER IS COMING.",[x.w(1,"google and"),x.w(1,"building"),x.w(1,"the layer"),x.w(1,"that part is coming")],160,300,1600,{size:100,color:"#e7c27a",out:x.a(2)-.3,h:170});
  kin(S,"Pretending otherwise is a strategy for losing.",x.ws(1,"pretending otherwise is a strategy for losing"),160,500,1600,{size:56,color:"#8a9a8c",out:x.a(2)-.3,h:120});
  [["WHO APPROVES?","who approves"],["ON WHAT BASIS?","on what basis"],["WHO SIGNS?","and who signs"]].forEach((c,i)=>{const e=box(130+i*560,300,500,260,"card"+(i==2?" am":""),'<div class="rel h2'+(i==2?" amber":"")+'" style="margin-top:92px;text-align:center;font-size:46px">'+c[0]+'</div>');S.reg(e,x.w(2,c[1]),x.a(4)-.3)});
  kin(S,"IN WRITING.",[x.w(3,"in writing")],160,640,1600,{size:100,out:x.a(4)-.3,h:150});
  kin(S,"NOT READY FOR AGENTS.",x.ws(3,"not ready for agents"),160,780,1600,{size:70,color:"#e7c27a",out:x.a(4)-.3,h:110});
  const e0=x.w(4,"at lalum");
  const el=box(660,230,600,200,"","");el.innerHTML=document.querySelector(".wm").outerHTML.replace('class="wm"','style="width:600px;opacity:1"');S.reg(el,e0,1e9,1);
  S.reg(box(0,470,W,70,"c h2","lalum.co"),e0+.8,1e9);
  S.reg(box(0,560,W,60,"c p dim","The governance around the work, not another tool."),x.w(4,"the governance"),1e9);
  const ft=box(120,700,1680,110,"c dim","Sources: Google Cloud press release and blog, 25.8.2026; Reuters, 25.8.2026; HCJ 38379-12-24.<br>Narration is synthetic (AI). LALUM is not affiliated with Google. This video is not legal advice.");ft.style.fontSize="24px";ft.style.lineHeight="1.55";
  S.reg(ft,e0+3,1e9);
  return S}

const SCENES={1:s1,2:s2,3:s3,4:s4,5:s5,6:s6};

// ---------- overlay: HUD, captions, orb, grain, titles ----------
let CUR=null,CAPS=[],ORB=null;
const orb=document.getElementById("orb");
orb.innerHTML='<svg width="110" height="110" viewBox="-55 -55 110 110" fill="none"><circle id="o1" r="46" stroke="#3a5a42" stroke-width="2"/><circle id="o2" r="34" stroke="#769d79" stroke-width="2"/><circle id="o3" r="20" fill="#e7c27a" opacity=".9"/></svg>';
const gr=document.createElement("canvas");gr.width=gr.height=200;{const g=gr.getContext("2d"),im=g.createImageData(200,200);let s=7;for(let i=0;i<im.data.length;i+=4){s=(s*16807)%2147483647;const v=(s%255);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}g.putImageData(im,0,0)}
document.getElementById("grain").style.backgroundImage="url("+gr.toDataURL()+")";
function buildCaps(d){const box0=document.getElementById("caps");box0.innerHTML="";CAPS=[];
  d.paras.forEach(p=>{let cur=[];const flush=()=>{if(cur.length){CAPS.push(cur);cur=[]}};
    p.words.forEach(w=>{cur.push(w);const txt=cur.map(z=>z.t).join(" ");const end=/[.?!:]$/.test(w.t),comma=/[,;]$/.test(w.t);
      if(end||cur.length>=7||(comma&&cur.length>=3)||txt.length>34)flush()});flush()});
  CAPS=CAPS.map(ws=>{const e=document.createElement("div");e.className="cap";e.style.opacity=0;
    e.innerHTML=ws.map(w=>"<span>"+w.t+"</span>").join("");box0.appendChild(e);return{ws,e,sp:[...e.children],a:ws[0].a-.08,b:ws[ws.length-1].b+.35}});
  CAPS.forEach((c,i)=>{const nx=CAPS[i+1];if(nx&&nx.a<c.b)c.b=nx.a})}
function overlay(n,t,d){
  const g=OFF[n]+t;
  document.getElementById("hudL").innerHTML='<span style="color:#e7c27a">0'+n+'</span> / 06 &nbsp; '+NAMES[n];
  const mm=s=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0");
  document.getElementById("hudR").textContent=mm(g)+" / "+mm(TOTAL);
  document.getElementById("progF").style.width=(1740*clamp(g/TOTAL))+"px";
  CAPS.forEach(c=>{const on=t>=c.a&&t<c.b;c.e.style.opacity=on?Math.min(1,(t-c.a)/.12):0;
    if(on)c.sp.forEach((s,i)=>s.className=(t>=c.ws[i].a&&t<c.ws[i].b+.06)?"on":"")});
  const env=d.env[Math.min(d.env.length-1,Math.floor(t*FPS))]||0;
  document.getElementById("o1").setAttribute("r",46+env*8);document.getElementById("o2").setAttribute("r",34+env*14);document.getElementById("o3").setAttribute("r",18+env*10);
  const fr=Math.floor(t*FPS);document.getElementById("grain").style.transform="translate("+(-(fr*37%200))+"px,"+(-(fr*91%200))+"px)";
  document.getElementById("stage").style.transform="scale("+(1+.035*t/d.dur)+")";
  // title card over the first seconds of a scene
  const lead=d.paras[0].a,ti=document.getElementById("title");
  if(t<lead-.1&&n!="1"){
    const k=Math.min(ease((t-.1)/.5),ease((lead-.2-t)/.5));
    let h="";
    if(n=="2"){const L=["GOOGLE JUST BUILT AN","AI LAWYER'S ASSISTANT.","WHO SIGNS?"];
      h=L.map((s,i)=>'<div class="c h1" style="top:'+(300+i*130)+'px;font-size:96px;opacity:'+ease((t-.2-i*.6)/.4)+';color:'+(i==2?"#e7c27a":"#f5f1e8")+'">'+s+'</div>').join("")}
    else h='<div class="c mono" style="top:340px;font-size:34px;letter-spacing:10px;color:#e7c27a">0'+n+' / 06</div><div class="c big" style="top:410px;font-size:130px;opacity:'+ease((t-.3)/.5)+'">'+NAMES[n]+'</div><div style="left:760px;top:600px;width:'+(400*ease((t-.4)/.8))+'px;height:4px;background:#e7c27a"></div>';
    ti.innerHTML=h;ti.style.opacity=k}else{ti.innerHTML="";ti.style.opacity=0}
  // fade through black at both ends of a scene
  document.getElementById("world").style.opacity=Math.min(1,t/.3,(d.dur-t)/.5);
}
window.build=(n,d)=>{S0.innerHTML="";WM.style.opacity=.5;CUR=SCENES[n](d);buildCaps(d);
  window.render=t=>{CUR.run(t);overlay(n,t,d)}};
</script></body></html>`;

const want = (process.env.SCENES || "1,2,3,4,5,6").split(",");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => { console.error("PAGE ERROR", e.message); process.exit(1); });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const build = (n) => page.evaluate(([s, d]) => window.build(s, d), [n, narr[n]]);

if (process.env.PREVIEW) {
  for (const spec of process.env.PREVIEW.split(";")) {
    const [n, ts] = spec.split(":");
    await build(n);
    for (const t of ts.split(",")) {
      await page.evaluate((x) => window.render(x), Number(t));
      await page.screenshot({ path: path.join(out, "preview", `s${n}-t${t}.png`) });
    }
  }
  await browser.close();
  console.log("previews in", path.join(out, "preview"));
  process.exit(0);
}

for (const n of want) {
  const frames = path.join(process.env.TMPDIR || "/tmp", `lalum-yt-frames-${n}`);
  if (existsSync(frames)) rmSync(frames, { recursive: true });
  mkdirSync(frames, { recursive: true });
  await build(n);
  const total = Math.floor(narr[n].dur * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 88 });
  }
  const file = path.join(out, `scene-${n}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%05d.jpg"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", "-an", file], { stdio: "inherit" });
  rmSync(frames, { recursive: true });
  console.log("wrote", file);
}
await browser.close();
