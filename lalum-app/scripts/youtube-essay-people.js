// People for the YouTube essay: flat characters built as SVG and posed every frame, plus the
// narrator avatar whose mouth follows the real level of the narration.
// Inlined into the page by youtube-essay-visuals.mjs (it relies on box(), clamp(), mk() from there).
// No template literals in this file on purpose: it is embedded in one.
const SVGNS = "http://www.w3.org/2000/svg";
function sv(n, a, p) { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e }

// two bone arm: shoulder S to target T, sg picks the side the elbow bends to
function ik(S, T, L1, L2, sg) {
  const dx = T.x - S.x, dy = T.y - S.y, d = Math.max(1, Math.hypot(dx, dy)), dd = Math.min(d, L1 + L2 - 1);
  const a = Math.atan2(dy, dx), c = clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1), A = Math.acos(c) * sg;
  return { E: { x: S.x + L1 * Math.cos(a + A), y: S.y + L1 * Math.sin(a + A) }, H: { x: S.x + dx / d * dd, y: S.y + dy / d * dd } };
}
const SKIN = { a: "#efc3a2", b: "#d39b73", c: "#a56a45", d: "#f3d2b8" };

// o: x,y (neck base on the stage), s scale, skin, hair, style (short|bun|long|bald), top, shirt, tie,
//    glasses, back (seen from behind), flip, clip (cut the body at this local y), ph (phase), propR, propL
function person(parent, o) {
  const s = o.s || 1, ph = o.ph || 0;
  const wrap = box(o.x - 300 * s, o.y - 260 * s, 600 * s, 700 * s, "", "", parent);
  const svg = sv("svg", { width: 600 * s, height: 700 * s, viewBox: "-300 -260 600 700", style: "overflow:visible" }, wrap);
  const cid = "clip" + Math.floor(Math.random() * 1e9);
  if (o.clip) { const cp = sv("clipPath", { id: cid }, svg); sv("rect", { x: -300, y: -260, width: 600, height: 260 + o.clip }, cp); }
  const root = sv("g", { transform: o.flip ? "scale(-1,1)" : "" }, svg);
  const body = sv("g", o.clip ? { "clip-path": "url(#" + cid + ")" } : {}, root);
  const skin = o.skin || SKIN.a, hair = o.hair || "#2a2a2a", top = o.top || "#2f4a38", shirt = o.shirt || "#f5f1e8";
  const tie = o.tie === undefined ? "#e7c27a" : o.tie;
  // torso, neck, collar
  const torso = sv("g", {}, body);
  sv("path", { d: "M -98 60 C -98 15 -70 -2 -30 -6 L 30 -6 C 70 -2 98 15 98 60 L 112 420 L -112 420 Z", fill: top }, torso);
  sv("rect", { x: -17, y: -34, width: 34, height: 44, rx: 8, fill: skin }, torso);
  if (!o.back) {
    sv("path", { d: "M -30 -8 L 0 46 L 30 -8 L 18 -14 L 0 14 L -18 -14 Z", fill: shirt }, torso);
    if (tie) sv("path", { d: "M -8 14 L 8 14 L 13 96 L 0 110 L -13 96 Z", fill: tie }, torso);
  }
  // head
  const head = sv("g", {}, body);
  if (o.style === "long") sv("path", { d: "M -62 -80 C -70 -170 70 -170 62 -80 L 68 -10 L -68 -10 Z", fill: hair }, head);
  sv("ellipse", { cx: -52, cy: -76, rx: 9, ry: 13, fill: skin }, head);
  sv("ellipse", { cx: 52, cy: -76, rx: 9, ry: 13, fill: skin }, head);
  sv("ellipse", { cx: 0, cy: -78, rx: 52, ry: 60, fill: o.back ? hair : skin }, head);
  let eyes = null, pupils = [], brows = [], mouthLine = null, mouthOpen = null;
  if (!o.back) {
    const st = o.style || "short";
    if (st !== "bald") sv("path", { d: st === "long" ? "M -57 -88 C -64 -154 64 -154 57 -88 C 40 -124 -8 -122 -57 -88 Z" : "M -56 -90 C -60 -158 60 -158 56 -90 C 50 -118 20 -124 -4 -112 C -22 -122 -46 -118 -56 -90 Z", fill: hair }, head);
    if (st === "bun") sv("circle", { cx: 0, cy: -152, r: 24, fill: hair }, head);
    eyes = sv("g", {}, head);
    [-20, 20].forEach(x => { sv("ellipse", { cx: x, cy: -80, rx: 10, ry: 8, fill: "#fbf7ee" }, eyes); pupils.push(sv("circle", { cx: x, cy: -80, r: 5.2, fill: "#1b1b1b" }, eyes)); });
    [-20, 20].forEach(x => brows.push(sv("line", { x1: x - 11, y1: -98, x2: x + 11, y2: -98, stroke: hair === "#d9d3c3" ? "#8a8a8a" : hair, "stroke-width": 4.5, "stroke-linecap": "round" }, head)));
    if (o.glasses) { [-20, 20].forEach(x => sv("circle", { cx: x, cy: -80, r: 17, fill: "none", stroke: "#1b1b1b", "stroke-width": 3 }, head)); sv("line", { x1: -3, y1: -82, x2: 3, y2: -82, stroke: "#1b1b1b", "stroke-width": 3 }, head); }
    mouthOpen = sv("ellipse", { cx: 0, cy: -50, rx: 11, ry: 0, fill: "#4a2222" }, head);
    mouthLine = sv("path", { d: "M -13 -50 Q 0 -46 13 -50", fill: "none", stroke: "#7a3b30", "stroke-width": 4.5, "stroke-linecap": "round" }, head);
  } else {
    sv("path", { d: "M -56 -86 C -60 -150 60 -150 56 -86 C 56 -60 40 -34 0 -30 C -40 -34 -56 -60 -56 -86 Z", fill: hair }, head);
  }
  // arms (over the body)
  const armG = sv("g", {}, root), arms = {};
  [["L", -88, 1], ["R", 88, -1]].forEach(a => {
    const g = sv("g", {}, armG);
    arms[a[0]] = { S: { x: a[1], y: 38 }, sg: a[2], path: sv("path", { fill: "none", stroke: top, "stroke-width": 34, "stroke-linecap": "round", "stroke-linejoin": "round" }, g), hand: sv("circle", { r: 19, fill: skin }, g), prop: sv("g", {}, g), last: { x: a[1] * 1.3, y: 250 } };
  });
  function propArt(g, kind) {
    if (kind === "pen") { sv("line", { x1: 0, y1: -16, x2: 0, y2: 64, stroke: "#f5f1e8", "stroke-width": 9, "stroke-linecap": "round" }, g); sv("line", { x1: 0, y1: 64, x2: 0, y2: 76, stroke: "#e7c27a", "stroke-width": 5, "stroke-linecap": "round" }, g); }
    if (kind === "key") { sv("circle", { cx: 0, cy: -16, r: 16, fill: "none", stroke: "#e7c27a", "stroke-width": 8 }, g); sv("line", { x1: 0, y1: 0, x2: 0, y2: 70, stroke: "#e7c27a", "stroke-width": 8, "stroke-linecap": "round" }, g); sv("line", { x1: 0, y1: 50, x2: 20, y2: 50, stroke: "#e7c27a", "stroke-width": 7 }, g); sv("line", { x1: 0, y1: 64, x2: 15, y2: 64, stroke: "#e7c27a", "stroke-width": 7 }, g); }
    if (kind === "paper") { sv("rect", { x: -34, y: -54, width: 68, height: 90, rx: 4, fill: "#f5f1e8", transform: "rotate(-8)" }, g); [-34, -20, -6, 8].forEach(y => sv("line", { x1: -22, y1: y, x2: 20, y2: y, stroke: "#9aa597", "stroke-width": 4, transform: "rotate(-8)" }, g)); }
  }
  if (o.propR) propArt(arms.R.prop, o.propR);
  if (o.propL) propArt(arms.L.prop, o.propL);
  const out = { wrap, el: wrap, props: { L: arms.L.prop, R: arms.R.prop } };
  // pose: lean, tilt (deg), look {x,y} -1..1, talk 0..1, smile 0..1, hl/hr {x,y} local targets, ra/la prop angle (deg)
  out.update = function (t, p) {
    p = p || {};
    const br = Math.sin(t * 1.7 + ph), sway = Math.sin(t * .6 + ph);
    body.setAttribute("transform", "translate(" + (sway * 1.5 + (p.dx || 0)) + "," + (br * 1.4) + ") rotate(" + ((p.lean || 0) + sway * .5) + " 0 300)");
    const lk = p.look || { x: 0, y: 0 };
    head.setAttribute("transform", "translate(" + (lk.x * 5) + "," + (br * 1.4 + lk.y * 2) + ") rotate(" + ((p.tilt || 0) + Math.sin(t * .8 + ph) * 1.1 + lk.x * 2) + " 0 -10)");
    if (!o.back) {
      const bl = ((t + ph * 2) % 3.6) < .13 ? .08 : 1;
      eyes.setAttribute("transform", "translate(0,-80) scale(1," + bl + ") translate(0,80)");
      pupils.forEach(c => c.setAttribute("transform", "translate(" + (lk.x * 5) + "," + (lk.y * 3) + ")"));
      const raise = p.brow || 0;
      brows.forEach(b => b.setAttribute("transform", "translate(0," + (-raise * 7) + ")"));
      const tk = clamp(p.talk || 0), sm = p.smile == null ? .3 : p.smile;
      mouthOpen.setAttribute("ry", tk * 9);
      mouthLine.setAttribute("d", "M -13 -50 Q 0 " + (-50 + sm * 12 - tk * 6) + " 13 -50");
    }
    const res = {};
    ["L", "R"].forEach(k => {
      const A = arms[k], tgt = p["h" + k.toLowerCase()] || null;
      const T = tgt || { x: A.S.x * 1.35, y: 232 + Math.sin(t * 1.7 + ph) * 3 };
      A.last = { x: lerp(A.last.x, T.x, .35), y: lerp(A.last.y, T.y, .35) };
      const r = ik(A.S, A.last, 135, 125, A.sg);
      A.path.setAttribute("d", "M " + A.S.x + " " + A.S.y + " L " + r.E.x + " " + r.E.y + " L " + r.H.x + " " + r.H.y);
      A.hand.setAttribute("cx", r.H.x); A.hand.setAttribute("cy", r.H.y);
      A.prop.setAttribute("transform", "translate(" + r.H.x + "," + r.H.y + ") rotate(" + (p[k === "R" ? "ra" : "la"] || 0) + ")");
      res["h" + k.toLowerCase()] = r.H;
    });
    return res;
  };
  return out;
}

// the narrator: a round badge in the bar, mouth driven by the narration level
function avatar(host) {
  const svg = sv("svg", { width: 78, height: 78, viewBox: "-39 -39 78 78" }, host);
  const cp = sv("clipPath", { id: "avclip" }, svg); sv("circle", { r: 36 }, cp);
  const ringA = sv("circle", { r: 37, fill: "none", stroke: "#3a5a42", "stroke-width": 2 }, svg);
  const ringB = sv("circle", { r: 37, fill: "none", stroke: "#e7c27a", "stroke-width": 2, opacity: .0 }, svg);
  const g = sv("g", { "clip-path": "url(#avclip)" }, svg);
  sv("rect", { x: -40, y: -40, width: 80, height: 80, fill: "#16241b" }, g);
  const rig = sv("g", {}, g);
  sv("path", { d: "M -34 40 C -34 22 -18 17 0 17 C 18 17 34 22 34 40 Z", fill: "#2f4a38" }, rig);
  sv("rect", { x: -6, y: 8, width: 12, height: 14, rx: 4, fill: "#d39b73" }, rig);
  sv("ellipse", { cx: 0, cy: -2, rx: 19, ry: 22, fill: "#d39b73" }, rig);
  sv("path", { d: "M -21 -4 C -24 -30 24 -30 21 -4 C 18 -16 8 -18 0 -14 C -8 -20 -18 -16 -21 -4 Z", fill: "#2a2a2a" }, rig);
  const eyes = sv("g", {}, rig);
  [-7, 7].forEach(x => { sv("ellipse", { cx: x, cy: -3, rx: 3.6, ry: 3, fill: "#fbf7ee" }, eyes); sv("circle", { cx: x, cy: -3, r: 1.9, fill: "#1b1b1b" }, eyes); });
  const mouthOpen = sv("ellipse", { cx: 0, cy: 10, rx: 4.4, ry: 0, fill: "#4a2222" }, rig);
  const mouthLine = sv("path", { d: "M -5 10 Q 0 12 5 10", fill: "none", stroke: "#7a3b30", "stroke-width": 1.8, "stroke-linecap": "round" }, rig);
  return function (t, env) {
    rig.setAttribute("transform", "translate(0," + (Math.sin(t * 1.5) * .6 + env * 1.4) + ") rotate(" + (Math.sin(t * .8) * 1.2 + env * 1.5) + ")");
    eyes.setAttribute("transform", "translate(0,-3) scale(1," + (((t + 1.3) % 3.8) < .12 ? .1 : 1) + ") translate(0,3)");
    mouthOpen.setAttribute("ry", env * 4.6);
    mouthLine.setAttribute("d", "M -5 10 Q 0 " + (12 - env * 3) + " 5 10");
    ringB.setAttribute("opacity", .15 + env * .7); ringB.setAttribute("r", 37 + env * 2.5);
  };
}
