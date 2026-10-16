#!/usr/bin/env node
// One cover per article, no two alike, no text baked in.
//
// The articles index used to show 130 photographs across 246 articles: one
// infographic sat on 19 pieces, another on 18, and several carried a typed
// LALUM wordmark (retired) or Hebrew copy that belonged to a different piece.
// A cover is now drawn from the article itself: its slug seeds the geometry, its
// title picks the motif (city, abroad, AI network, data and privacy, contract,
// mediation, court, civic), and the palette is the site's own. Same slug, same
// picture, so reruns are stable; a new article gets a new picture without anyone
// choosing one.
//
//   npm run covers
//
// Writes public/images/articles/<slug>.webp (1200x630, also the social card) and
// src/data/articleCovers.json. Fails if two covers are visually near-identical.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "public", "images", "articles");
const TMP = join(ROOT, "node_modules", ".cache", "covers");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// ---- the corpus -----------------------------------------------------------
const src = readFileSync(join(ROOT, "src/lib/blogMeta.ts"), "utf8");
const from = src.indexOf("blogMeta: BlogMeta[] = [") + "blogMeta: BlogMeta[] = ".length;
const blog = JSON.parse(src.slice(from, src.lastIndexOf("];") + 1).replace(/,\s*\]\s*$/, "]"));
const items = blog.map((b) => ({ slug: b.slug, text: `${b.title} ${b.excerpt}` }));
const strs = readFileSync(join(ROOT, "src/lib/strings.ts"), "utf8");
const heBlock = strs.slice(strs.indexOf("slug: \"eu-ai-act-2026\", icon: \"shield\", category: \"רגולציית AI\""));
for (const m of heBlock.matchAll(/slug: "([a-z0-9-]+)", icon: "[a-z]+", category: "[^"]*",\s*title: "([^"]*)"/g)) {
  if (!items.some((i) => i.slug === m[1])) items.push({ slug: m[1], text: m[2] });
}

// ---- seeded randomness ----------------------------------------------------
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- motif choice ---------------------------------------------------------
const MOTIFS = [
  ["abroad", ["חו״ל", "חו\"ל", "מעבר לים", "פורטוגל", "יוון", "קפריסין", "דובאי", "גאורגיה", "בינלאומ", "זר ", "זרים", "תושב זר", "רכישת נכס", "אירופ", "אמריקה", "ארה״ב", "cross-border"]],
  ["civic", ["רשות", "מועצה", "עירי", "עיריי", "תושבים", "ציבורי", "מכרז", "מינהל", "ממשל", "ממשלה", "מדינה"]],
  ["court", ["פסק דין", "פסיקה", "בית משפט", "ערעור", "תביעה", "אחריות", "נזיקי", "רשלנות", "בג״ץ", "שופט", "ייצוגית", "הליך"]],
  ["mediation", ["גישור", "מגשר", "בוררות", "סכסוך", "מחלוקת", "הסדר", "משא ומתן"]],
  ["privacy", ["פרטיות", "אנונימ", "gdpr", "תיקון 13", "מאגר מידע", "אבטחת", "סייבר", "הגנת מידע", "הצפנ", "זיהוי"]],
  ["city", ["תמ״א", "פינוי", "התחדשות", "בינוי", "דירה", "דירות", "נדל", "מקרקעין", "יזם", "קבלן", "דייר", "מגדל", "בנייה", "שכירות", "משכנת"]],
  ["contract", ["חוזה", "חוזים", "הסכם", "סעיף", "מייסדים", "סטארטאפ", "גיוס", "קניין רוחני", "פטנט", "נאותות", "מיזוג", "שותפות"]],
  ["network", ["בינה מלאכותית", " ai", "ai ", "אלגורית", "מודל", "llm", "אוטומט", "רגולצי", "eu ai", "נתונים", "דירקטוריון"]],
];
function motifFor(text, r) {
  const t = text.toLowerCase();
  const score = MOTIFS.map(([name, kws]) => [name, kws.reduce((n, k) => n + (t.split(k).length - 1), 0)]);
  score.sort((a, b) => b[1] - a[1]);
  return score[0][1] > 0 ? score[0][0] : ["network", "contract", "court"][Math.floor(r() * 3)];
}

// ---- palettes: the site's own ---------------------------------------------
const P = {
  clay: ["#a8482a", "#f6e6de"], ochre: ["#916c26", "#f3ecd6"], wine: ["#8a3f45", "#f3e3e4"], teal: ["#3f6f68", "#e1ede9"],
  indigo: ["#5a4f9a", "#e8e5f3"], forest: ["#41663f", "#e5eede"], slate: ["#3a5a7a", "#e2e9f1"],
};
const BY_MOTIF = {
  city: ["clay", "ochre", "forest"], abroad: ["teal", "slate", "ochre"], civic: ["slate", "teal", "forest"], court: ["wine", "slate", "ochre"],
  mediation: ["teal", "forest", "wine"], privacy: ["indigo", "slate", "teal"], contract: ["wine", "ochre", "clay"], network: ["indigo", "teal", "slate"],
};
const INK = "#1a1815";
const W = 1200, H = 630;
const f = (n) => Math.round(n * 10) / 10;

// ---- motifs (all drawn around the centre band so any crop still reads) -----
const M = {
  city(r, a, tint) {
    let s = "", x = 90; const base = 520;
    const renewal = r() > 0.4;
    while (x < 1110) {
      const w = 56 + r() * 70, h = 120 + r() * 250, lit = r() > 0.78;
      s += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h)}" fill="${lit ? a : "#fff"}" fill-opacity="${lit ? 0.92 : 0.82}" stroke="${INK}" stroke-opacity=".7" stroke-width="2.5"/>`;
      for (let wy = base - h + 18; wy < base - 16; wy += 24) for (let wx = x + 12; wx < x + w - 14; wx += 18) if (r() > 0.35) s += `<rect x="${f(wx)}" y="${f(wy)}" width="9" height="12" fill="${lit ? "#fff" : INK}" fill-opacity="${lit ? 0.9 : 0.28}"/>`;
      x += w + 6 + r() * 14;
    }
    if (renewal) { const cx = 180 + r() * 760; s += `<g stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"><path d="M${f(cx)} ${base} V150 H${f(cx + 330)} M${f(cx - 90)} 150 H${f(cx)} M${f(cx + 230)} 150 V245"/><path d="M${f(cx)} 150 l-26 -34 M${f(cx)} 150 l26 -34" stroke-width="4"/></g><rect x="${f(cx + 214)}" y="245" width="32" height="26" fill="${a}"/>`; }
    return `<rect x="0" y="${base}" width="${W}" height="14" fill="${INK}" fill-opacity=".85"/>` + s;
  },
  abroad(r, a, tint) {
    const cx = 430 + r() * 340, cy = 330, R = 215;
    let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" fill-opacity=".85" stroke="${INK}" stroke-width="3"/>`;
    for (let i = -2; i <= 2; i++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${f(R * Math.abs(Math.cos(i * 0.45 + r() * 0.2)))}" ry="${R}" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2"/>`;
    for (let i = -2; i <= 2; i++) s += `<path d="M${cx - R} ${cy + i * 62} Q${cx} ${cy + i * 62 + (i * 18)} ${cx + R} ${cy + i * 62}" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2"/>`;
    const pins = [];
    for (let i = 0; i < 4; i++) { const ang = r() * Math.PI * 2, d = 40 + r() * 140; pins.push([cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.9]); }
    pins.forEach((p, i) => { if (i) s += `<path d="M${f(pins[i - 1][0])} ${f(pins[i - 1][1])} Q${f((pins[i - 1][0] + p[0]) / 2)} ${f(Math.min(p[1], pins[i - 1][1]) - 90)} ${f(p[0])} ${f(p[1])}" fill="none" stroke="${a}" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>`; });
    pins.forEach((p, i) => { s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${i === 0 ? 17 : 11}" fill="${i === 0 ? a : INK}" stroke="#fff" stroke-width="4"/>`; });
    let x = 70; const base = 560; for (let k = 0; k < 4; k++) { const w = 40 + r() * 44, h = 70 + r() * 120; s += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${INK}" fill-opacity=".8"/>`; x += w + 8; }
    x = 960; for (let k = 0; k < 4; k++) { const w = 40 + r() * 44, h = 70 + r() * 120; s += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${INK}" fill-opacity=".8"/>`; x += w + 8; }
    return s;
  },
  civic(r, a, tint) {
    const cx = 420 + r() * 360, base = 500, w = 420 + r() * 120, n = 4 + Math.floor(r() * 3);
    let s = `<polygon points="${cx - w / 2 - 20},230 ${cx},130 ${cx + w / 2 + 20},230" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${cx}" cy="200" r="18" fill="${a}"/>`;
    s += `<rect x="${cx - w / 2 - 20}" y="230" width="${w + 40}" height="24" fill="${INK}" fill-opacity=".85"/>`;
    for (let i = 0; i < n; i++) { const px = cx - w / 2 + (i * w) / (n - 1) - 15; s += `<rect x="${f(px)}" y="262" width="30" height="206" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M${f(px + 8)} 270 V460 M${f(px + 22)} 270 V460" stroke="${INK}" stroke-opacity=".25" stroke-width="2"/>`; }
    s += `<rect x="${cx - w / 2 - 50}" y="468" width="${w + 100}" height="20" fill="${INK}" fill-opacity=".85"/><rect x="${cx - w / 2 - 80}" y="488" width="${w + 160}" height="20" fill="${INK}" fill-opacity=".7"/>`;
    for (let i = 0; i < 9; i++) { const dx = r() < 0.5 ? 60 + r() * 150 : 960 + r() * 140; s += `<circle cx="${f(dx)}" cy="${f(130 + r() * 330)}" r="${f(6 + r() * 7)}" fill="${a}" fill-opacity=".85"/>`; }
    return s;
  },
  court(r, a, tint) {
    const cx = 450 + r() * 300, tilt = (r() - 0.5) * 0.22, beamY = 215;
    const dx = Math.cos(tilt) * 270, dy = Math.sin(tilt) * 270;
    let s = `<rect x="${cx - 14}" y="${beamY}" width="28" height="280" fill="${INK}" fill-opacity=".88"/><rect x="${cx - 120}" y="490" width="240" height="26" fill="${INK}" fill-opacity=".88"/>`;
    s += `<path d="M${f(cx - dx)} ${f(beamY - dy)} L${f(cx + dx)} ${f(beamY + dy)}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><circle cx="${cx}" cy="${beamY}" r="22" fill="${a}" stroke="#fff" stroke-width="4"/>`;
    for (const sgn of [-1, 1]) { const px = cx + sgn * dx, py = beamY + sgn * dy; s += `<path d="M${f(px)} ${f(py)} L${f(px - 82)} ${f(py + 175)} M${f(px)} ${f(py)} L${f(px + 82)} ${f(py + 175)}" stroke="${INK}" stroke-opacity=".6" stroke-width="3"/><path d="M${f(px - 100)} ${f(py + 175)} h200 a100 56 0 0 1 -200 0z" fill="${sgn * tilt > 0 ? a : "#fff"}" stroke="${INK}" stroke-width="3.5"/>`; }
    for (let i = 0; i < 3; i++) s += `<rect x="${60 + i * 54}" y="${380 - i * 26}" width="38" height="${130 + i * 26}" fill="#fff" fill-opacity=".8" stroke="${INK}" stroke-opacity=".5" stroke-width="2"/><rect x="${f(1040 - i * 54)}" y="${380 - i * 26}" width="38" height="${130 + i * 26}" fill="#fff" fill-opacity=".8" stroke="${INK}" stroke-opacity=".5" stroke-width="2"/>`;
    return s;
  },
  mediation(r, a, tint) {
    const v = Math.floor(r() * 3);
    if (v === 1) { // three parties converging on one agreed point
      let t = ""; const cx = 600, cy = 315, R = 120 + r() * 40;
      for (let i = 0; i < 3; i++) { const an = (i / 3) * Math.PI * 2 + r() * 0.5 - Math.PI / 2, d = 105 + r() * 60; t += `<circle cx="${f(cx + Math.cos(an) * d)}" cy="${f(cy + Math.sin(an) * d)}" r="${f(R)}" fill="${i === 0 ? a : INK}" fill-opacity="${i === 0 ? 0.35 : 0.1}" stroke="${INK}" stroke-width="3.5"/>`; }
      return t + `<circle cx="${cx}" cy="${cy}" r="${f(20 + r() * 10)}" fill="${a}" stroke="#fff" stroke-width="5"/>`;
    }
    if (v === 2) { // rising steps toward settlement
      let t = ""; const n = 4 + Math.floor(r() * 4), x0 = 120 + r() * 80;
      for (let i = 0; i < n; i++) { const w = 880 / n - 10, h = 90 + i * (300 / n) + r() * 24; t += `<rect x="${f(x0 + i * (w + 10) * 0.98)}" y="${f(520 - h)}" width="${f(w)}" height="${f(h)}" fill="${i === n - 1 ? a : "#fff"}" fill-opacity="${i === n - 1 ? 0.9 : 0.85}" stroke="${INK}" stroke-width="3"/>`; }
      return t + `<path d="M${x0} 470 Q600 ${f(120 + r() * 120)} ${f(x0 + 880)} 140" fill="none" stroke="${a}" stroke-width="6" stroke-dasharray="3 14" stroke-linecap="round"/>`;
    }
    const gap = 70 + r() * 110, cy = 315, rad = 160 + r() * 50, cx = 600;
    let s = `<circle cx="${cx - gap}" cy="${cy}" r="${f(rad)}" fill="${a}" fill-opacity=".28" stroke="${INK}" stroke-width="3.5"/><circle cx="${cx + gap}" cy="${cy}" r="${f(rad)}" fill="${INK}" fill-opacity=".12" stroke="${INK}" stroke-width="3.5"/>`;
    s += `<path d="M${cx} ${f(cy - Math.sqrt(rad * rad - gap * gap))} A${f(rad)} ${f(rad)} 0 0 1 ${cx} ${f(cy + Math.sqrt(rad * rad - gap * gap))} A${f(rad)} ${f(rad)} 0 0 1 ${cx} ${f(cy - Math.sqrt(rad * rad - gap * gap))}z" fill="${a}" fill-opacity=".85"/>`;
    for (let i = 0; i < 6; i++) { const y = 70 + i * 100 + r() * 20; s += `<path d="M60 ${f(y)} Q${f(300 + r() * 120)} ${f(y + (r() - 0.5) * 120)} ${cx - 20} ${cy}" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="2.5"/><path d="M1140 ${f(y)} Q${f(900 - r() * 120)} ${f(y + (r() - 0.5) * 120)} ${cx + 20} ${cy}" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="2.5"/>`; }
    return s + `<circle cx="${cx}" cy="${cy}" r="12" fill="#fff" stroke="${INK}" stroke-width="3.5"/>`;
  },
  privacy(r, a, tint) {
    const cx = 380 + r() * 440, cy = 310, sc = 0.85 + r() * 0.3;
    let s = "";
    for (let gx = 0; gx < 22; gx++) for (let gy = 0; gy < 10; gy++) if (r() > 0.45) s += `<rect x="${60 + gx * 50}" y="${70 + gy * 52}" width="${r() > 0.85 ? 26 : 14}" height="8" rx="4" fill="${INK}" fill-opacity="${f(0.07 + r() * 0.16)}"/>`;
    s += `<g transform="translate(${cx} ${cy}) scale(${f(sc)})"><path d="M0 -205 L165 -140 V10 C165 120 85 195 0 235 C-85 195 -165 120 -165 10 V-140Z" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M0 -165 L128 -114 V8 C128 98 66 158 0 192Z" fill="${a}" fill-opacity=".9"/><rect x="-52" y="-10" width="104" height="82" rx="14" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M-30 -10 V-45 a30 30 0 0 1 60 0 V-10" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><circle cx="0" cy="30" r="10" fill="${INK}"/></g>`;
    return s;
  },
  contract(r, a, tint) {
    if (r() > 0.5) { // clause checklist
      let t = `<rect x="${f(300 + r() * 80)}" y="70" width="${f(460 + r() * 100)}" height="490" rx="14" fill="#fff" stroke="${INK}" stroke-width="3.5"/>`;
      const rows = 4 + Math.floor(r() * 3), flag = Math.floor(r() * rows);
      for (let i = 0; i < rows; i++) { const y = 120 + i * (400 / rows), cx0 = 360 + (t.length % 7); t += `<rect x="${cx0 + 20}" y="${f(y)}" width="34" height="34" rx="8" fill="${i === flag ? a : "#fff"}" stroke="${INK}" stroke-width="3"/>${i === flag ? "" : `<path d="M${cx0 + 28} ${f(y + 17)} l8 8 12 -15" stroke="${INK}" stroke-opacity=".5" stroke-width="4" fill="none"/>`}<rect x="${cx0 + 80}" y="${f(y + 4)}" width="${f(240 + r() * 150)}" height="12" rx="6" fill="${INK}" fill-opacity=".3"/><rect x="${cx0 + 80}" y="${f(y + 22)}" width="${f(120 + r() * 120)}" height="9" rx="4" fill="${INK}" fill-opacity=".14"/>`; }
      return t;
    }
    const cx = 520 + r() * 160, cy = 330; let s = "";
    for (let i = 3; i >= 0; i--) { const rot = (i - 1.5) * (4 + r() * 4), dx = i * (34 + r() * 14); s += `<g transform="translate(${f(cx - 150 + dx)} ${cy - 215 + i * 10}) rotate(${f(rot)} 150 215)"><rect width="300" height="430" rx="10" fill="#fff" stroke="${INK}" stroke-width="3.5" fill-opacity="${f(0.96 - i * 0.05)}"/>`; if (i === 0) { s += `<rect x="30" y="34" width="150" height="18" rx="4" fill="${INK}" fill-opacity=".85"/>`; for (let l = 0; l < 9; l++) s += `<rect x="30" y="${84 + l * 30}" width="${f(150 + r() * 110)}" height="9" rx="4" fill="${INK}" fill-opacity=".22"/>`; const hl = 2 + Math.floor(r() * 5); s += `<rect x="22" y="${78 + hl * 30}" width="256" height="22" rx="5" fill="${a}" fill-opacity=".3" stroke="${a}" stroke-width="2.5"/><circle cx="232" cy="378" r="34" fill="${a}"/><circle cx="232" cy="378" r="24" fill="none" stroke="#fff" stroke-width="3"/><path d="M222 378 l8 8 14 -17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; } s += `</g>`; }
    return s;
  },
  network(r, a, tint) {
    if (r() > 0.5) { // hub and spokes with orbit rings
      let t = ""; const cx = 380 + r() * 440, cy = 315, n = 7 + Math.floor(r() * 7);
      for (const rr of [90, 170, 250]) t += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="2.5" stroke-dasharray="${r() > 0.5 ? "4 10" : "0"}"/>`;
      const pts = []; for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + r(), rr = [90, 170, 250][Math.floor(r() * 3)]; pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.9]); }
      pts.forEach((p) => { t += `<path d="M${cx} ${cy} L${f(p[0])} ${f(p[1])}" stroke="${INK}" stroke-opacity=".3" stroke-width="2.2"/>`; });
      pts.forEach((p) => { t += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(10 + r() * 14)}" fill="#fff" stroke="${INK}" stroke-width="3"/>`; });
      return t + `<circle cx="${cx}" cy="${cy}" r="38" fill="${a}" stroke="${INK}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="14" fill="#fff"/>`;
    }
    const layers = 3 + Math.floor(r() * 2), cols = []; let s = "";
    for (let l = 0; l < layers; l++) { const n = 3 + Math.floor(r() * 4), x = 170 + (l * 860) / (layers - 1); const col = []; for (let k = 0; k < n; k++) col.push([x + (r() - 0.5) * 36, 100 + ((k + 0.5) * 430) / n + (r() - 0.5) * 24]); cols.push(col); }
    for (let l = 0; l < layers - 1; l++) for (const p of cols[l]) for (const q of cols[l + 1]) if (r() > 0.3) s += `<path d="M${f(p[0])} ${f(p[1])} L${f(q[0])} ${f(q[1])}" stroke="${INK}" stroke-opacity="${f(0.14 + r() * 0.2)}" stroke-width="2.2"/>`;
    const hot = [Math.floor(r() * layers), 0]; hot[1] = Math.floor(r() * cols[hot[0]].length);
    cols.forEach((col, l) => col.forEach((p, k) => { const isHot = l === hot[0] && k === hot[1]; s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${isHot ? 30 : f(11 + r() * 11)}" fill="${isHot ? a : "#fff"}" stroke="${INK}" stroke-width="${isHot ? 4 : 3}"/>`; if (isHot) s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="52" fill="none" stroke="${a}" stroke-opacity=".5" stroke-width="3"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="78" fill="none" stroke="${a}" stroke-opacity=".25" stroke-width="3"/>`; }));
    return s;
  },
};

// ---- compose --------------------------------------------------------------
function cover(slug, text) {
  const r = rng(hash(slug));
  const motif = motifFor(text, r);
  const set = BY_MOTIF[motif], [accent, tint] = P[set[Math.floor(r() * set.length)]];
  const ang = Math.floor(r() * 360);
  let deco = "";
  const kind = Math.floor(r() * 3);
  if (kind === 0) for (let i = 0; i < 5; i++) deco += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(80 + r() * 260)}" fill="${accent}" fill-opacity="${f(0.05 + r() * 0.07)}"/>`;
  if (kind === 1) for (let i = 0; i < 6; i++) deco += `<rect x="${f(-200 + r() * 1200)}" y="-100" width="${f(30 + r() * 120)}" height="900" fill="${accent}" fill-opacity="${f(0.05 + r() * 0.06)}" transform="rotate(${f(12 + r() * 20)} 600 315)"/>`;
  if (kind === 2) for (let gx = 0; gx < 30; gx++) for (let gy = 0; gy < 16; gy++) deco += `<circle cx="${gx * 42 + 10}" cy="${gy * 42 + 10}" r="2.6" fill="${accent}" fill-opacity=".22"/>`;
  let body = M[motif](r, accent, tint);
  // Every article moves its motif: scale, shift and mirror, so two pieces on the
  // same subject never share a composition even when they share a motif.
  const sc = 0.82 + r() * 0.3, tx = (r() - 0.5) * 150, ty = (r() - 0.5) * 40, mir = r() > 0.5 ? -1 : 1;
  body = `<g transform="translate(${f(600 + tx)} ${f(315 + ty)}) scale(${f(sc * mir)} ${f(sc)}) translate(-600 -315)">${body}</g>`;
  let ribbon = "";
  const rn = 3 + Math.floor(r() * 4);
  for (let i = 0; i < rn; i++) ribbon += `<rect x="${f(r() * 1100)}" y="${H - 10 - Math.floor(r() * 3) * 0}" width="${f(24 + r() * 120)}" height="10" fill="${INK}" fill-opacity="${f(0.35 + r() * 0.5)}"/>`;
  body += ribbon;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#fbf9f3"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${deco}<g>${body}</g><rect x="0" y="${H - 10}" width="${W}" height="10" fill="${accent}"/></svg>`;
  return { svg, motif };
}

// ---- render ---------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const map = {}, motifs = {};
for (const it of items) {
  const { svg, motif } = cover(it.slug, it.text);
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: join(TMP, `${it.slug}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  map[it.slug] = `/images/articles/${it.slug}.webp`; motifs[it.slug] = motif;
}
await browser.close();

// webp + near-duplicate guard (PIL: 16x9 grayscale thumbprint, hamming distance)
const py = `
import sys, json, os
from PIL import Image
tmp, out = sys.argv[1], sys.argv[2]
slugs = json.loads(sys.argv[3])
hashes = {}
for s in slugs:
    im = Image.open(os.path.join(tmp, s + ".png")).convert("RGB")
    im.save(os.path.join(out, s + ".webp"), "WEBP", quality=80, method=6)
    g = im.convert("L").resize((24, 14))
    px = list(g.getdata()); avg = sum(px) / len(px)
    hashes[s] = [1 if p > avg else 0 for p in px]
keys = list(hashes); worst = []
for i in range(len(keys)):
    for j in range(i + 1, len(keys)):
        d = sum(a != b for a, b in zip(hashes[keys[i]], hashes[keys[j]]))
        if d < 30: worst.append((d, keys[i], keys[j]))
print(json.dumps(sorted(worst)[:20]))
`;
for (const f2 of readdirSync(OUT)) if (f2.endsWith(".webp") && !map[`${f2.slice(0, -5)}`]) rmSync(join(OUT, f2));
const res = execFileSync("python3", ["-c", py, TMP, OUT, JSON.stringify(Object.keys(map))], { encoding: "utf8" });
const near = JSON.parse(res);
writeFileSync(join(ROOT, "src/data/articleCovers.json"), JSON.stringify(map, null, 1) + "\n");
const counts = {}; Object.values(motifs).forEach((m) => (counts[m] = (counts[m] || 0) + 1));
console.log(`covers: ${Object.keys(map).length}`, counts);
console.log('closest pair distance:', near.length ? near[0][0] : '>=30');
if (near.length && near[0][0] < 10) { console.error("near-identical covers (hamming < 30):", near); process.exit(1); }
