// Renders the motion graphics for the English YouTube essay
// "Google Just Built an AI Lawyer's Assistant. Who Signs?"
// (script and verification ledger: docs/legal-ai-layer/youtube-essay-script.en.md).
//
// What this is: the on-screen text, diagrams and kinetic graphics of the six scenes,
// drawn in code, 1920x1080, silent. What it is not: the photographic B-roll (that stays
// as GenAI prompts in the script) and the voice over (the editor lays it on top; the
// beats follow the script's timestamps, so expect small nudges once the VO exists).
//
// Every sentence on screen is either a verbatim quote with its source tag, a wording
// Google uses itself (tagged "as listed by Google"), or labelled "Our analysis". No
// figures that were not traced to a primary source. The wordmark is the supplied
// artwork (public/lalum-logo-inverse.svg), never a typeface. No dashes as punctuation.
//
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs \
//   SCENES=1,2,3 node scripts/youtube-essay-visuals.mjs
//
// SCENES   comma list of 1..6 (default all)
// PREVIEW  "3:10,50;5:20" renders PNG stills of those moments to OUT/preview and exits
// OUT      output folder (default /tmp/lalum-youtube-essay); clips are not committed
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
// seconds per scene, from the script's timestamps (0:00 to 9:00)
const DUR = { 1: 50, 2: 100, 3: 120, 4: 120, 5: 90, 6: 60 };
const out = process.env.OUT || "/tmp/lalum-youtube-essay";
mkdirSync(path.join(out, "preview"), { recursive: true });

const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg class="wm" ');

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0d130f}
body{font-family:"Liberation Sans",Arial,sans-serif;position:relative;color:#f5f1e8}
.bg{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 25%,#1f3626 0%,#142019 55%,#0b100c 100%)}
.grid{position:absolute;inset:0;opacity:.05;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:80px 80px}
#stage{position:absolute;inset:0}
#stage div{position:absolute}
.wm{position:absolute;right:70px;bottom:52px;width:170px;opacity:.55}
.c{left:0;right:0;text-align:center}
.big{font-size:170px;font-weight:700;letter-spacing:-3px}
.h1{font-size:92px;font-weight:700;letter-spacing:-1.5px;line-height:1.1}
.h2{font-size:60px;font-weight:700;letter-spacing:-.5px;line-height:1.15}
.h3{font-size:42px;font-weight:700}
.p{font-size:38px;line-height:1.3;color:#cfd9cb}
.dim{color:#8a9a8c}
.amber{color:#e7c27a}
.green{color:#9cc29f}
.tag{left:90px;bottom:60px;font-size:27px;color:#8a9a8c;padding-left:18px;border-left:4px solid #769d79;letter-spacing:.3px}
.card{background:#16241b;border:2.5px solid #3a5a42;border-radius:26px}
.card.am{border-color:#e7c27a}
.bar{height:16px;border-radius:8px;background:#35503b;width:0}
.cursor{width:14px;height:30px;background:#e7c27a}
.chip{background:#16241b;border:2px solid #3a5a42;border-radius:14px;font-size:34px;padding:12px 26px;white-space:nowrap}
.lbl{font-size:30px;font-weight:700;text-align:center}
.rtl{direction:rtl;text-align:right}
#stage div.rel{position:relative}
</style><body>
<div class="bg"></div><div class="grid"></div>
<div id="stage"></div>
${logo}
<script>
const S=document.getElementById("stage"),WM=document.querySelector(".wm");
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
function mk(cls,html,parent){const e=document.createElement("div");e.className=cls||"";if(html!=null)e.innerHTML=html;(parent||S).appendChild(e);return e}
function box(x,y,w,h,cls,html){const e=mk(cls,html);Object.assign(e.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});return e}
function at(e,x,y){e.style.left=x+"px";e.style.top=y+"px";return e}
// fade and rise between a and b (b optional)
function vis(e,t,a,b,d){d=d||.6;b=b==null?1e9:b;const k=Math.min(ease((t-a)/d),ease((b-t)/(d*.8)));e.style.opacity=k;e.style.transform="translateY("+((1-k)*18)+"px)";return k}
function tag(text){const e=mk("tag",text);return e}
const W=${W},H=${H};

// ---------- SCENE 1: the hook (50 s) ----------
function s1(){
  const date=mk("c big","25.8.2026");date.style.top="360px";
  const dt=tag("Google Cloud announcement, preview");
  const page=box(560,230,800,620,"card");
  const widths=[620,700,540,690,300,0,660,610,700,480,650,260];
  const bars=widths.map((w,i)=>{const b=mk("bar","",page);b.style.top=(54+i*44)+"px";b.style.left="56px";return b});
  const cur=mk("cursor","",page);
  const words="complete work rather than return suggestions".split(" ");
  const q=box(160,380,1600,400,"c h1");q.style.textAlign="center";
  q.innerHTML=words.map(w=>'<span style="opacity:0;display:inline-block;margin:0 14px">'+w+'</span>').join("");
  const qs=[...q.children];
  const qt=tag("Google Cloud blog, 25.8.2026");
  const items=["Contract review and negotiation","Regulatory horizon scanning","Data subject access requests","Redacting documents for motions to seal","Drafting NDA documents"];
  const rows=items.map((s,i)=>{const r=box(420,230+i*112,1080,86,"chip",'<span class="h3">'+s+'</span>');r.style.fontSize="42px";return r});
  const wt=tag("Workflows listed by Google");
  const sig=box(520,560,880,4,"",""),sigBg=sig;sig.style.background="#e7c27a";
  const x=box(500,500,60,60,"h1 amber","&times;");
  const who=box(0,640,W,120,"c h1 amber","WHO SIGNS?");who.style.letterSpacing="14px";
  return t=>{
    vis(date,t,.4,5.6);vis(dt,t,1,5.6);
    vis(page,t,6,17.5);
    let active=-1;
    bars.forEach((b,i)=>{const a=7+i*.85,k=clamp((t-a)/.75);b.style.width=(widths[i]*ease(k))+"px";if(k>0&&k<1)active=i});
    if(active<0&&t>7)active=-1;
    if(active>=0){cur.style.opacity=1;cur.style.left=(56+parseFloat(bars[active].style.width)+10)+"px";cur.style.top=(46+active*44)+"px"}else cur.style.opacity=(t>7&&t<17&&Math.floor(t*2)%2==0)?1:0;
    qs.forEach((s,i)=>{const k=ease((t-(19+i*.7))/.4);s.style.opacity=k*(t<30?1:ease((30.6-t)/.6))});
    vis(qt,t,19,29.5);
    vis(wt,t,31,41.5);rows.forEach((r,i)=>vis(r,t,31+i*1.4,41.5));
    const sk=ease((t-43)/1.2);sig.style.opacity=sk;sig.style.width=(880*sk)+"px";
    x.style.opacity=ease((t-44)/.8);
    who.style.opacity=ease((t-46)/1)*(t>49.4?clamp((50-t)/.6):1);
    sig.style.boxShadow="0 0 "+(18+12*Math.sin(t*4))+"px #e7c27a";
  };
}

// ---------- SCENE 2: chatbot to agent (100 s) ----------
function s2(){
  // part A, 0 to 30
  const capL=box(80,120,860,70,"c h2","The chatbot era: you move the text");capL.style.left="80px";capL.style.right="auto";capL.style.width="860px";
  const capR=box(980,120,860,70,"c h2 green","The agent era: the task moves");capR.style.left="980px";capR.style.right="auto";capR.style.width="860px";
  const divider=box(958,200,3,640,"","");divider.style.background="#2e4a35";
  const A=box(150,380,230,230,"card",'<div class="lbl" style="left:0;right:0;text-align:center;margin-top:92px">Chatbot</div>');
  const B=box(640,380,230,230,"card",'<div class="lbl" style="left:0;right:0;text-align:center;margin-top:92px">Document</div>');
  const tk=box(0,0,70,92,"","");tk.style.background="#f5f1e8";tk.style.borderRadius="8px";
  const you=box(0,0,100,100,"","");you.style.cssText+=";border:4px solid #e7c27a;border-radius:50%;font-size:30px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#e7c27a;background:#16241b";you.textContent="YOU";
  const act=box(0,0,260,40,"lbl dim","");
  const names=["Skill","Connection","Agent","Result"];
  const st=names.map((n,i)=>box(1020+i*205,400,160,190,"card",'<div class="lbl" style="left:0;right:0;text-align:center;margin-top:70px;font-size:26px">'+n+'</div>'));
  const tk2=box(0,0,70,92,"","");tk2.style.background="#9cc29f";tk2.style.borderRadius="8px";
  const you2=box(1380,740,100,100,"","");you2.style.cssText+=";border:4px solid #3a5a42;border-radius:50%;font-size:30px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#8a9a8c;background:#16241b";you2.textContent="YOU";
  // part B, 30 to 70: the stack
  const names2=[["SKILLS","reusable packages of instructions and context"],["CONNECTIONS","inherit each platform's existing user permissions"],["AGENTS","carry the work through"],["OPEN PARTNER ECOSYSTEM","integrators and legal tech specialists"]];
  const layers=names2.map((n,i)=>box(240,170+i*140,1440,110,"card",'<div style="position:absolute;left:44px;top:34px;font-size:46px" class="h2">'+n[0]+'</div><div style="position:absolute;right:44px;top:38px;font-size:30px;color:#8a9a8c">'+n[1]+'</div>'));
  const base=box(240,170+4*140+10,1440,120,"card am",'<div style="position:absolute;left:44px;top:36px;font-size:46px" class="h2 amber">GOVERNED CONTROL PLANE</div><div style="position:absolute;right:44px;top:44px;font-size:30px;color:#8a9a8c">VPC, CMEK, data isolation, traceable citations</div>');
  const st2=tag("Per Google's description, 25.8.2026");
  // part C, 70 to 100
  const wf=["Contract review and negotiation","Regulatory horizon scanning","Data subject access requests","Redacting documents for motions to seal","Drafting NDA documents"];
  const rows=wf.map((s,i)=>box(380,190+i*108,1160,84,"chip",'<span class="h3">'+s+'</span>'));
  const wt=tag("Workflows listed by Google");
  const q=box(120,860,1680,110,"c h2 amber","Which parts of the work can I stop touching?");
  const qq=box(120,740,1680,90,"c p dim","The chatbot era asked: can AI help me write? The agent era asks:");
  return t=>{
    const a=t<30;
    [capL,capR,divider,A,B,tk,you,st[0],st[1],st[2],st[3],tk2,you2].forEach(e=>{const k=a?Math.min(ease((t-.3)/.8),ease((29.4-t)/.6)):0;e.style.opacity=k});
    if(a){
      const L=(t%7)/7; // loop: A to B and back, with pauses
      const p=L<.5?ease(L/.42):1-ease((L-.5)/.42);
      const x=lerp(380,640-60,p),y=470;
      tk.style.left=x+"px";tk.style.top=y+"px";
      you.style.left=(x-15)+"px";you.style.top=(y-130)+"px";
      act.style.opacity=0;
      const M=(t%8)/8;const px=M<.9?lerp(1020+80-35,1020+3*205+80-35,M/.9):1020+3*205+45;
      tk2.style.left=px+"px";tk2.style.top="451px";
    }
    layers.forEach((l,i)=>vis(l,t,31+i*6,69));
    vis(base,t,56,69);
    base.style.boxShadow="0 0 "+(10+16*Math.max(0,Math.sin(t*3)))+"px rgba(231,194,122,.55)";
    vis(st2,t,31,69);
    rows.forEach((r,i)=>vis(r,t,71+i*2.2,98));vis(wt,t,71,98);
    vis(qq,t,86,99);vis(q,t,89,99.6);
  };
}

// ---------- SCENE 3: the integration layer (120 s) ----------
function s3(){
  // part A: existing permissions, 0 to 24
  const sys=["Document management","E-discovery","Research","E-signature"];
  const boxes=sys.map((s,i)=>box(150,180+i*170,520,130,"card",'<div class="h3" style="margin:38px 0 0 34px">'+s+'</div>'));
  const agent=box(1250,330,520,330,"card am",'<div class="h2 amber" style="left:0;right:0;text-align:center;margin-top:100px">Agent</div>');
  const lines=sys.map((s,i)=>{const l=box(670,245+i*170,580,4,"","");l.style.background="#3a5a42";l.style.transformOrigin="0 50%";return l});
  const keyT=box(0,860,W,100,"c h2","Connections inherit existing permissions");
  const keyTag=tag("Google Cloud blog, 25.8.2026");
  // part B: connector wall, 24 to 74
  const groups=[["DOCUMENT MANAGEMENT",["iManage","NetDocuments"]],["CONTRACTS",["Docusign"]],["E-DISCOVERY",["Everlaw","RelativityOne"]],["RESEARCH",["Thomson Reuters HighQ","CourtListener","Courtroom5"]],["LEGAL AI",["Harvey","Solve Intelligence","Legora"]],["PRODUCTIVITY",["Google Workspace","Microsoft 365"]]];
  const cols=[[130,120],[130,430],[130,640],[1000,120],[1000,470],[1000,800]];
  const wallEls=[];
  groups.forEach((g,gi)=>{
    const [x,y]=cols[gi];
    const h=box(x,y,800,50,"lbl green",g[0]);h.style.textAlign="left";h.style.letterSpacing="3px";
    const names=g[1].map((n,ni)=>{const c=box(x+ni*0,y+60+ni*70,560,60,"chip",n);c.style.fontSize="34px";return c});
    wallEls.push({h,names,start:25+gi*7});
  });
  const wt=tag("Connectors as listed by Google, 25.8.2026, preview");
  // part C: the layer, 74 to 100
  const srcs=["Documents","E-discovery","Contracts","Research","Legal AI"];
  const sb=srcs.map((s,i)=>box(120,190+i*130,380,92,"chip",s));
  const node=box(800,320,360,360,"card am",'<div class="h2 amber" style="left:0;right:0;text-align:center;margin-top:130px">THE LAYER</div>');
  node.style.borderRadius="50%";
  const sl=srcs.map((s,i)=>{const l=box(500,236+i*130,0,4,"","");l.style.background="#3a5a42";return l});
  const out=box(1300,330,500,340,"card",'<div class="p" style="left:0;right:0;padding:48px 40px;text-align:center;margin-top:30px">Sees the matter, the documents, the clauses, the outcomes.</div>');
  const cT=tag("Our analysis, not a claim of fact");
  // part D: Reuters and closing, 100 to 120
  const rq=box(260,230,1400,280,"c h1","&ldquo;accelerating a race among technology companies&rdquo;");
  const rt=tag("Reuters, 25.8.2026");
  const close=box(160,640,1600,260,"c h1 amber","The race is not who drafts fastest. It is who owns the layer.");close.style.fontSize="76px";
  return t=>{
    boxes.forEach((b,i)=>vis(b,t,.6+i*.5,23));
    vis(agent,t,3,23);
    lines.forEach((l,i)=>{const k=ease((t-(4+i*.6))/1);l.style.opacity=t<23?k:0;l.style.width=(580*k)+"px"});
    vis(keyT,t,8,23);vis(keyTag,t,8,23);
    wallEls.forEach(w=>{vis(w.h,t,w.start,73);w.names.forEach((c,i)=>vis(c,t,w.start+.6+i*.7,73))});
    vis(wt,t,25,73);
    sb.forEach((b,i)=>vis(b,t,75+i*.5,99));
    vis(node,t,77,99);
    sl.forEach((l,i)=>{const k=ease((t-(78+i*.4))/.8);l.style.opacity=t<99?1:0;l.style.width=(300*k)+"px"});
    node.style.boxShadow="0 0 "+(16+20*Math.max(0,Math.sin(t*2.6)))+"px rgba(231,194,122,.5)";
    vis(out,t,86,99);vis(cT,t,76,99);
    vis(rq,t,100.5,119);vis(rt,t,101,119);vis(close,t,108,119.6);
  };
}

// ---------- SCENE 4: the billable hour (120 s) ----------
function s4(){
  const clock=box(760,210,400,400,"",'<svg width="400" height="400" viewBox="-200 -200 400 400" fill="none" stroke-linecap="round"><circle r="170" stroke="#3a5a42" stroke-width="8"/><g id="mh"><path d="M0 0V-130" stroke="#f5f1e8" stroke-width="10"/></g><g id="hh"><path d="M0 0V-85" stroke="#e7c27a" stroke-width="14"/></g><circle r="12" fill="#f5f1e8"/></svg>');
  const track=box(460,520,1000,34,"","");track.style.cssText+=";border-radius:17px;background:#16241b;border:2px solid #3a5a42";
  const fill=box(462,522,0,30,"","");fill.style.cssText+=";border-radius:15px;background:#769d79";
  const ct=box(0,860,W,80,"c h2","Time is the unit of price");
  const ct2=box(0,640,W,80,"c h2 amber","The work is finished. The hour keeps counting.");
  const done=box(0,360,W,100,"c h1 green","Done");
  // part B: known vs inferred
  const kh=box(160,170,760,60,"lbl green","KNOWN");kh.style.textAlign="left";kh.style.letterSpacing="6px";
  const ih=box(1000,170,760,60,"lbl amber","INFERRED");ih.style.textAlign="left";ih.style.letterSpacing="6px";
  const kn=["Hourly pricing rewards time spent.","Whoever works faster earns less, unless the price changes."].map((s,i)=>box(160,260+i*230,740,200,"p",s));
  const inf=["When first-pass review takes minutes, the hour stops measuring value.","A client can ask what they are paying for."].map((s,i)=>box(1000,260+i*230,760,200,"p amber",s));
  const at4=tag("Analysis");
  const nofig=box(120,740,1680,200,"c h2","No figure for how much time AI saves. The direction of pressure is clear. The size is not.");
  // part C: what replaces the hour
  const rep=[["Fixed fees","for defined outputs"],["Pricing for the decision","not the draft"],["A premium for judgment, accountability","and a licence on the line"]];
  const repE=rep.map((r,i)=>box(220,230+i*220,1480,170,"card"+(i==2?" am":""),'<div class="h2 rel" style="margin:24px 0 0 50px">'+r[0]+'</div><div class="p dim rel" style="margin:6px 0 0 50px">'+r[1]+'</div>'));
  const ot=tag("Our analysis");
  const final1=box(0,330,W,160,"c big dim","Not the hour.");final1.style.fontSize="140px";
  const strike=box(560,410,0,8,"","");strike.style.background="#e7c27a";
  const final2=box(0,560,W,170,"c big amber","The decision.");final2.style.fontSize="140px";
  return t=>{
    const A=t<24;
    clock.style.opacity=A?Math.min(ease((t-.4)/.8),ease((12-t)/.8)):0;
    track.style.opacity=A?Math.min(ease((t-11)/.8),ease((23.4-t)/.6)):0;
    const mh=document.getElementById("mh"),hh=document.getElementById("hh");
    const sp=t<12?(t*60):720+(t-12)*0;mh.setAttribute("transform","rotate("+sp+")");hh.setAttribute("transform","rotate("+(sp/12)+")");
    const f=clamp((t-12)/9);fill.style.width=(996*ease(f))+"px";fill.style.opacity=track.style.opacity;
    vis(ct,t,2,11.5);vis(ct2,t,17,23.4);done.style.opacity=A?ease((t-21.2)/.5)*ease((23.6-t)/.5):0;
    
    vis(kh,t,25,58);vis(ih,t,25,58);vis(at4,t,25,70);
    kn.forEach((e,i)=>vis(e,t,27+i*4,58));inf.forEach((e,i)=>vis(e,t,32+i*4,58));
    vis(nofig,t,61,69);
    repE.forEach((e,i)=>vis(e,t,72+i*9,103));vis(ot,t,72,103);
    vis(final1,t,105,119.6);
    const sk=ease((t-109)/.8);strike.style.width=(840*sk)+"px";strike.style.left="540px";strike.style.opacity=t<119.2?1:clamp((120-t)/.8);
    vis(final2,t,112,119.8);
  };
}

// ---------- SCENE 5: who answers (90 s) ----------
function s5(){
  const gq=box(160,260,1600,300,"c h1","&ldquo;a duty of confidentiality that does not bend for convenience&rdquo;");gq.style.fontSize="76px";
  const gt=tag("Google Cloud blog, 25.8.2026");
  const who=box(160,300,1600,260,"c h1 amber","When the agent is wrong, who answers?");
  const he=box(260,210,1400,420,"card am",'<div class="rtl h2" style="padding:56px 64px;line-height:1.35;font-size:58px">&quot;שימוש שעושים עורכי דין בכלי בינה מלאכותית, אין משמעו כי הם יכולים להתפרק מאחריותם ומשיקול דעתם המקצועי&quot;</div>');
  const en=box(260,670,1400,200,"c p dim","Unofficial translation: using AI tools does not mean lawyers can shed their responsibility and professional judgment.");
  const hT=tag("Supreme Court of Israel, HCJ 38379-12-24, 23.2.2025, para 26 (official text)");
  const duties=["The client","The court","The opposing party","The profession"];
  const dh=box(160,170,1600,100,"c h2","A fabricated filing breaches duties to");
  const dE=duties.map((d,i)=>box(150+i*430,380,390,260,"card",'<div class="h2" style="left:0;right:0;text-align:center;margin-top:92px;font-size:46px">'+d+'</div>'));
  const dt=tag("HCJ 38379-12-24, para 15 (summary)");
  const not=box(160,720,1600,120,"c h2 amber","Not to the tool vendor. Not to the model.");
  const L=box(150,200,820,560,"card",'<div class="lbl dim" style="left:0;right:0;text-align:center;margin-top:34px">AGENT OUTPUT</div>');
  const lb=[0,1,2,3,4,5].map(i=>{const b=box(200,300+i*68,[640,700,560,680,600,420][i],18,"","");b.style.cssText+=";border-radius:9px;background:"+(i==3?"#e7c27a":"#35503b");return b});
  const R=box(1000,200,770,560,"card am",'<div class="lbl dim" style="left:0;right:0;text-align:center;margin-top:34px">REVIEWED BY</div><div style="position:absolute;left:90px;right:90px;top:360px;border-bottom:4px dashed #e7c27a"></div>');
  const q1=box(120,800,1680,160,"c h2","What exactly did the human check, and could they prove it?");
  const fin=box(120,380,1680,260,"c big amber","The machine drafts.<br>The human signs.");fin.style.fontSize="120px";
  return t=>{
    vis(gq,t,.5,7.5);vis(gt,t,.8,7.5);vis(who,t,8,13.6);
    vis(he,t,15,40);vis(en,t,19,40);vis(hT,t,15,40);
    vis(dh,t,41,65);dE.forEach((e,i)=>vis(e,t,43+i*3,65));vis(dt,t,43,65);vis(not,t,57,65);
    vis(L,t,66,79);lb.forEach(b=>vis(b,t,66.5,79));vis(R,t,68,79);vis(q1,t,71,79.5);
    vis(fin,t,80.5,89.7);
  };
}

// ---------- SCENE 6: outro (60 s) ----------
function s6(){
  const qs=["WHO APPROVES?","ON WHAT BASIS?","WHO SIGNS?"];
  const cards=qs.map((q,i)=>box(150+i*560,330,500,260,"card"+(i==2?" am":""),'<div class="h2'+(i==2?" amber":"")+'" style="left:0;right:0;text-align:center;margin-top:92px;font-size:46px">'+q+'</div>'));
  const need=box(160,700,1600,200,"c h2","If your organisation cannot answer all three in writing, it is not ready for agents.");
  const tg=box(120,300,1680,200,"c big amber","The machine flags.<br>The human decides.");tg.style.fontSize="110px";
  const sub=box(160,700,1600,150,"c p dim","We build the governance around the work, not another tool.");
  const lg=document.createElement("div");
  const endlogo=box(660,300,600,200,"","");endlogo.innerHTML=document.querySelector(".wm").outerHTML.replace('class="wm"','style="width:600px;opacity:1"');
  const url=box(0,560,W,70,"c h2","lalum.co");
  const cta=box(0,660,W,60,"c p dim","Subscribe, and tell us which of the three questions your organisation cannot answer yet.");
  const foot=box(120,900,1680,110,"c dim","Sources: Google Cloud press release and blog, 25.8.2026; Reuters, 25.8.2026; HCJ 38379-12-24.<br>LALUM is not affiliated with Google. This video is not legal advice.");foot.style.fontSize="26px";foot.style.lineHeight="1.5";
  return t=>{
    WM.style.opacity=t<41?.55:0;
    cards.forEach((c,i)=>vis(c,t,1+i*4.5,17.5));
    vis(need,t,15,29);
    vis(tg,t,30.5,41);vis(sub,t,34,41);
    vis(endlogo,t,43,60);vis(url,t,46,60);vis(cta,t,48,60);vis(foot,t,49,60);
    cards.forEach(c=>{if(t>=17.5)c.style.opacity=0});
  };
}

const SCENES={1:s1,2:s2,3:s3,4:s4,5:s5,6:s6};
window.build=n=>{S.innerHTML="";WM.style.opacity=.55;window.render=SCENES[n]()};
</script></body></html>`;

const want = (process.env.SCENES || "1,2,3,4,5,6").split(",").map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

if (process.env.PREVIEW) {
  for (const spec of process.env.PREVIEW.split(";")) {
    const [n, ts] = spec.split(":");
    await page.evaluate((s) => window.build(s), Number(n));
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
  await page.evaluate((s) => window.build(s), n);
  const total = DUR[n] * FPS;
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
