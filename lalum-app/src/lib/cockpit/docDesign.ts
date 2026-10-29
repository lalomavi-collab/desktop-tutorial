// Document design: how an invoice, receipt or pro forma looks. Pure (no Supabase import), so scripts/doc-design-check.mjs runs it under node.
//
// What a design may change and what it may not. A design picks the layout, the colours, the type, the logo treatment and the density.
// It never decides which details appear: every field in REQUIRED_FIELDS is rendered by docDesignRender.ts whatever the design says, and
// no option here hides one. The check script renders every layout for every document type and fails if a required field is missing.
//
// Where a design applies today (owner decision pending, see docs/finance-doc-design.md): the legal document of every issued tax
// document is the PDF Invoice4U produces and signs. Its look is set once in Invoice4U's own settings (template, colour, logo), and
// invoice4uHints() below says what to set there. A design made here shapes the preview, the sample and, once the own engine seals
// documents itself, the document. It is never sent to a customer as a second rendering of a document Invoice4U numbered.

export type Layout = "classic" | "band" | "minimal" | "sidebar" | "letterhead" | "ledger";
export type FontKey = "heebo" | "assistant" | "rubik" | "alef" | "frank" | "david" | "notoSerif" | "lalumSerif" | "secular" | "amatic";
export type TableStyle = "lines" | "zebra" | "boxed";
export type Density = "airy" | "regular" | "compact";
export type LogoTreatment = "original" | "mono" | "inverse";
export type LogoSize = "s" | "m" | "l";
export type LogoPlacement = "start" | "center" | "end";

export interface Palette { primary: string; accent: string; ink: string; muted: string; paper: string; tint: string }
export interface DesignSpec {
  v: 1;
  layout: Layout;
  palette: Palette;
  fonts: { heading: FontKey; body: FontKey };
  logo: { placement: LogoPlacement; size: LogoSize; treatment: LogoTreatment };
  table: TableStyle;
  density: Density;
  corners: 0 | 4 | 10;
  /** Bank details from the brand profile, printed under the totals (pro formas mostly). */
  showBank: boolean;
}
/** `why` is the reason in Hebrew; `fonts` the font names, kept apart so the screen can isolate the Latin names in Hebrew text. */
export interface Suggestion { key: string; name: string; why: string; fonts: string[]; spec: DesignSpec }

export const LAYOUTS: Record<Layout, string> = {
  classic: "קלאסי", band: "פס עליון", minimal: "מינימלי", sidebar: "פס צד", letterhead: "נייר מכתבים", ledger: "ספר חשבונות",
};
/** Fonts that carry Hebrew. `css` is the family stack; `google` the Google Fonts family to load, or null for a face the app serves itself. */
export const FONTS: Record<FontKey, { label: string; css: string; google: string | null; serif: boolean; headingOnly?: boolean }> = {
  heebo: { label: "Heebo", css: "'Heebo', 'Assistant', Arial, sans-serif", google: "Heebo:wght@400;500;700", serif: false },
  assistant: { label: "Assistant", css: "'Assistant', 'Heebo', Arial, sans-serif", google: "Assistant:wght@400;600;700", serif: false },
  rubik: { label: "Rubik", css: "'Rubik', 'Heebo', Arial, sans-serif", google: "Rubik:wght@400;500;700", serif: false },
  alef: { label: "Alef", css: "'Alef', 'Heebo', Arial, sans-serif", google: "Alef:wght@400;700", serif: false },
  frank: { label: "Frank Ruhl Libre", css: "'Frank Ruhl Libre', 'David Libre', Georgia, serif", google: "Frank+Ruhl+Libre:wght@400;500;700", serif: true },
  david: { label: "David Libre", css: "'David Libre', 'Frank Ruhl Libre', Georgia, serif", google: "David+Libre:wght@400;500;700", serif: true },
  notoSerif: { label: "Noto Serif Hebrew", css: "'Noto Serif Hebrew', 'Frank Ruhl Libre', Georgia, serif", google: "Noto+Serif+Hebrew:wght@400;600;700", serif: true },
  lalumSerif: { label: "Lalum Serif", css: "'Lalum Serif', 'Frank Ruhl Libre', Georgia, serif", google: null, serif: true, headingOnly: true },
  secular: { label: "Secular One", css: "'Secular One', 'Heebo', Arial, sans-serif", google: "Secular+One", serif: false, headingOnly: true },
  amatic: { label: "Amatic SC", css: "'Amatic SC', 'Lalum Serif', Georgia, serif", google: "Amatic+SC:wght@400;700", serif: false, headingOnly: true },
};

/** The details a document must carry, per type. The renderer prints each one with data-req="<key>"; the check script proves it. */
export type RequiredField =
  | "issuer_name" | "issuer_tax_id" | "issuer_address" | "doc_title" | "doc_number" | "copy_label" | "issue_date"
  | "customer_name" | "customer_tax_id" | "lines" | "subtotal" | "vat" | "total" | "allocation_number" | "payments" | "related_doc";
const BASE: RequiredField[] = ["issuer_name", "issuer_tax_id", "issuer_address", "doc_title", "doc_number", "copy_label", "issue_date", "customer_name", "customer_tax_id"];
export const REQUIRED_FIELDS: Record<"PROFORMA" | "INVOICE" | "RECEIPT" | "INVOICE_RECEIPT" | "CREDIT", RequiredField[]> = {
  PROFORMA: [...BASE, "lines", "subtotal", "vat", "total"],
  INVOICE: [...BASE, "lines", "subtotal", "vat", "total", "allocation_number"],
  INVOICE_RECEIPT: [...BASE, "lines", "subtotal", "vat", "total", "allocation_number", "payments"],
  CREDIT: [...BASE, "lines", "subtotal", "vat", "total", "related_doc"],
  RECEIPT: [...BASE, "total", "payments", "related_doc"],
};

// ---- colour ----------------------------------------------------------------------------------------------------------------

export const HEX = /^#[0-9a-f]{6}$/i;
export type RGB = [number, number, number];
export const hexToRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
export const rgbToHex = (c: RGB): string => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const hsl = (hex: string) => rgbToHsl(hexToRgb(hex));
export const fromHsl = (h: number, s: number, l: number) => rgbToHex(hslToRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))));
export function luminance(hex: string): number {
  return hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Moves a colour's lightness toward dark until it reaches `min` contrast on `bg`. Keeps the hue, so a brand colour stays recognisable. */
export function darkenUntil(hex: string, bg: string, min: number): string {
  const [h, s, l0] = hsl(hex);
  for (let l = l0; l >= 0; l -= 0.02) { const c = fromHsl(h, s, l); if (contrast(c, bg) >= min) return c; }
  return "#000000";
}
/** White or ink, whichever reads on a coloured band. */
export const onColour = (band: string, ink: string) => (contrast("#ffffff", band) >= contrast(ink, band) ? "#ffffff" : ink);

/**
 * The colours of a logo, most used first. Takes RGBA bytes (a canvas ImageData's data). Transparent and near-white pixels are the
 * background, not the logo, and are skipped; near-black and grey pixels count as `neutral`. Buckets of 5 bits per channel, then the
 * average of each bucket, so anti-aliased edges do not become colours of their own.
 */
export function logoColours(rgba: ArrayLike<number>, max = 4): { colours: string[]; neutral: boolean } {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let neutral = 0, coloured = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 128) continue;
    const [, s, l] = rgbToHsl([r, g, b]);
    if (l > 0.93) continue;
    if (s < 0.18 || l < 0.08) { neutral++; continue; }
    coloured++;
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(k, e);
  }
  const ranked = [...buckets.values()].sort((x, y) => y.n - x.n).map((e) => rgbToHex([e.r / e.n, e.g / e.n, e.b / e.n]));
  // Keep colours that differ in hue or lightness from those already kept; two shades of the same blue are one colour.
  const out: string[] = [];
  for (const c of ranked) {
    const [h, , l] = hsl(c);
    if (out.every((o) => { const [h2, , l2] = hsl(o); const dh = Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)); return dh > 18 || Math.abs(l - l2) > 0.22; })) out.push(c);
    if (out.length >= max) break;
  }
  return { colours: out, neutral: coloured < neutral * 0.05 || out.length === 0 };
}

// ---- palettes --------------------------------------------------------------------------------------------------------------

/** Palettes for a logo with no colour of its own (the LALUM wordmark is one). The first is the practice's document palette (CLAUDE.md). */
export const CURATED: Array<{ name: string; primary: string; accent: string; tone: Tone[] }> = [
  { name: "Prestige", primary: "#1b1b1b", accent: "#d4af37", tone: ["classic", "bold"] },
  { name: "בורדו", primary: "#800020", accent: "#d4af37", tone: ["classic", "bold"] },
  { name: "מרווה", primary: "#3f5e4f", accent: "#b08d57", tone: ["modern", "minimal", "classic"] },
  { name: "כחול לילה", primary: "#1f3352", accent: "#c9a227", tone: ["classic", "modern"] },
  { name: "פחם", primary: "#2b2b2b", accent: "#8a8a8a", tone: ["minimal", "modern"] },
  { name: "טרקוטה", primary: "#9c4a2f", accent: "#2f4858", tone: ["bold", "modern"] },
  { name: "צפחה", primary: "#36454f", accent: "#4f9d8f", tone: ["modern", "minimal"] },
];

/** A full palette from a primary and an accent. Ink, muted and paper are derived so text always clears AA (4.5:1), body text 7:1. */
export function buildPalette(primary: string, accent: string, opts: { warmPaper?: boolean } = {}): Palette {
  const paper = opts.warmPaper ? "#fffdf6" : "#ffffff";
  const [h, s] = hsl(primary);
  const ink = darkenUntil(fromHsl(h, Math.min(s, 0.25), 0.16), paper, 12);
  const muted = darkenUntil(fromHsl(h, Math.min(s, 0.12), 0.45), paper, 4.6);
  const tint = fromHsl(h, Math.min(s, 0.45), 0.955);
  // The primary prints headings and rules on paper, so it must read on paper too.
  return { primary: darkenUntil(primary, paper, 4.6), accent: darkenUntil(accent, paper, 3), ink, muted, paper, tint };
}

// ---- questionnaire and suggestions -----------------------------------------------------------------------------------------

export type Tone = "classic" | "modern" | "minimal" | "bold";
export interface Answers { tone: Tone; colour: "restrained" | "balanced" | "strong"; type: "serif" | "sans" | "mix"; logo: LogoSize; lines: "few" | "many" }
export const QUESTIONS: Array<{ key: keyof Answers; q: string; options: Array<[string, string]> }> = [
  { key: "tone", q: "איזה רושם המסמך צריך להשאיר?", options: [["classic", "מסורתי ומכובד"], ["modern", "מודרני ונקי"], ["minimal", "מינימלי ושקט"], ["bold", "נועז ובולט"]] },
  { key: "colour", q: "כמה צבע במסמך?", options: [["restrained", "מעט, קווים דקים בלבד"], ["balanced", "מאוזן"], ["strong", "הרבה, פס צבע וכותרות צבעוניות"]] },
  { key: "type", q: "איזה סוג אות?", options: [["serif", "עם תגיות (ספרותי, משפטי)"], ["sans", "בלי תגיות (נקי, עכשווי)"], ["mix", "שילוב: כותרות עם תגיות, טקסט בלי"]] },
  { key: "logo", q: "כמה בולט הלוגו?", options: [["s", "קטן ועדין"], ["m", "בינוני"], ["l", "גדול, מוביל את הדף"]] },
  { key: "lines", q: "כמה שורות יש בדרך כלל במסמך?", options: [["few", "אחת עד שלוש"], ["many", "הרבה שורות"]] },
];
export const DEFAULT_ANSWERS: Answers = { tone: "classic", colour: "balanced", type: "mix", logo: "m", lines: "few" };

const LAYOUTS_BY_TONE: Record<Tone, Layout[]> = {
  classic: ["letterhead", "classic", "ledger", "sidebar", "band", "minimal"],
  modern: ["band", "sidebar", "minimal", "classic", "letterhead", "ledger"],
  minimal: ["minimal", "classic", "letterhead", "sidebar", "band", "ledger"],
  bold: ["band", "sidebar", "letterhead", "classic", "ledger", "minimal"],
};
const FONT_PAIRS: Record<Answers["type"], Array<[FontKey, FontKey]>> = {
  serif: [["frank", "frank"], ["david", "david"], ["notoSerif", "notoSerif"], ["lalumSerif", "frank"]],
  sans: [["heebo", "heebo"], ["assistant", "assistant"], ["rubik", "rubik"], ["secular", "heebo"], ["alef", "alef"]],
  mix: [["lalumSerif", "heebo"], ["frank", "assistant"], ["david", "heebo"], ["notoSerif", "rubik"], ["amatic", "heebo"]],
};

/** A small seeded PRNG (mulberry32), so page N of suggestions is the same every time it is asked for. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const specKey = (s: DesignSpec) => [s.layout, s.palette.primary, s.palette.accent, s.fonts.heading, s.fonts.body, s.table, s.logo.treatment].join("|");

/**
 * Designs that fit the answers and the logo. Page 0 is the best match, in a fixed order; each further page is a seeded variation
 * (another layout, a hue step, another font pair), so there is no last page. Every result passes checkDesign().
 */
export function suggestDesigns(answers: Answers, logo: { colours: string[]; neutral: boolean }, page = 0, count = 6): Suggestion[] {
  const r = rng(page * 7919 + 17);
  const pick = <T,>(xs: T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length];
  const sources: Array<{ name: string; primary: string; accent: string; fromLogo: boolean }> = [];
  if (!logo.neutral) {
    const cs = logo.colours;
    cs.forEach((c, i) => sources.push({ name: "מצבעי הלוגו", primary: c, accent: cs[(i + 1) % cs.length] !== c ? cs[(i + 1) % cs.length] : fromHsl(hsl(c)[0] + 150, 0.45, 0.45), fromLogo: true }));
  }
  for (const c of CURATED.filter((p) => p.tone.includes(answers.tone)).concat(CURATED.filter((p) => !p.tone.includes(answers.tone)))) {
    sources.push({ name: c.name, primary: c.primary, accent: c.accent, fromLogo: false });
  }
  const layouts = LAYOUTS_BY_TONE[answers.tone];
  const fonts = FONT_PAIRS[answers.type];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < count && i < count * 12; i++) {
    const j = page * count + i;
    const src = pick(sources, page === 0 ? i : Math.floor(r() * sources.length));
    // Later pages step the hue a little, so a logo with one colour still gives new palettes.
    const shift = page === 0 ? 0 : Math.round((r() - 0.5) * 30);
    const [h, s, l] = hsl(src.primary);
    const primary = shift ? fromHsl(h + shift, s, l) : src.primary;
    const layout = pick(layouts, page === 0 ? Math.floor(i / 2) + (i % 2) : Math.floor(r() * layouts.length));
    const [heading, body] = pick(fonts, page === 0 ? i : Math.floor(r() * fonts.length));
    const strong = answers.colour === "strong", restrained = answers.colour === "restrained";
    const spec: DesignSpec = {
      v: 1,
      layout: restrained && (layout === "band" || layout === "sidebar") ? "classic" : layout,
      palette: buildPalette(primary, src.accent, { warmPaper: answers.tone === "classic" && j % 2 === 1 }),
      fonts: { heading, body },
      logo: { placement: answers.tone === "minimal" || answers.logo === "l" ? (j % 3 === 2 ? "center" : "start") : "start", size: answers.logo, treatment: strong && layout === "band" ? "inverse" : "original" },
      table: answers.lines === "many" ? (strong ? "zebra" : "lines") : restrained ? "lines" : pick(["lines", "boxed", "zebra"] as TableStyle[], j),
      density: answers.lines === "many" ? "compact" : answers.tone === "minimal" ? "airy" : "regular",
      corners: answers.tone === "modern" || answers.tone === "bold" ? 10 : answers.tone === "minimal" ? 4 : 0,
      showBank: false,
    };
    const key = specKey(spec);
    if (seen.has(key) || checkDesign(spec).length) continue;
    seen.add(key);
    out.push({
      key, spec,
      name: `${LAYOUTS[spec.layout]} · ${src.name}`,
      why: src.fromLogo ? "צבעים שנלקחו מהלוגו" : logo.neutral ? "הלוגו בלי צבע, לכן פלטה תואמת" : "פלטה משלימה",
      fonts: heading === body ? [FONTS[heading].label] : [FONTS[heading].label, FONTS[body].label],
    });
  }
  return out;
}

// ---- validation ------------------------------------------------------------------------------------------------------------

/** What is wrong with a design, in Hebrew, or an empty list. The database refuses only malformed specs; these rules are the app's. */
export function checkDesign(s: DesignSpec): string[] {
  const p: string[] = [];
  if (!s || s.v !== 1) return ["גרסת עיצוב לא מוכרת"];
  if (!(s.layout in LAYOUTS)) p.push("פריסה לא מוכרת");
  for (const k of ["primary", "accent", "ink", "muted", "paper", "tint"] as const) if (!HEX.test(s.palette?.[k] ?? "")) p.push(`צבע לא תקין: ${k}`);
  if (p.length) return p;
  if (!(s.fonts.heading in FONTS) || !(s.fonts.body in FONTS)) p.push("גופן לא מוכר");
  else if (FONTS[s.fonts.body].headingOnly) p.push(`${FONTS[s.fonts.body].label} מיועד לכותרות בלבד`);
  const { ink, muted, paper, primary, tint } = s.palette;
  if (contrast(ink, paper) < 7) p.push("הטקסט חלש מדי על רקע הדף");
  if (contrast(muted, paper) < 4.5) p.push("טקסט המשנה חלש מדי על רקע הדף");
  if (contrast(primary, paper) < 4.5) p.push("צבע הכותרות חלש מדי על רקע הדף");
  if (contrast(ink, tint) < 7) p.push("הטקסט חלש מדי על רקע הטבלה");
  if ((s.layout === "band" || s.layout === "sidebar") && contrast(onColour(primary, ink), primary) < 4.5) p.push("הטקסט על פס הצבע לא קריא");
  return p;
}

/** Parses a stored spec. Anything malformed falls back to the default, so an old or damaged row can never break a screen. */
export function parseSpec(x: unknown): DesignSpec {
  const s = x as DesignSpec;
  return s && s.v === 1 && checkDesign(s).length === 0 ? s : DEFAULT_SPEC;
}
export const DEFAULT_SPEC: DesignSpec = {
  v: 1, layout: "letterhead", palette: buildPalette(CURATED[0].primary, CURATED[0].accent), fonts: { heading: "lalumSerif", body: "heebo" },
  logo: { placement: "start", size: "m", treatment: "original" }, table: "lines", density: "regular", corners: 0, showBank: false,
};

// ---- the Invoice4U side ----------------------------------------------------------------------------------------------------

/** Invoice4U takes a logo of jpg or gif up to 250 by 250 (its help centre, "הגדרות החשבון > הגדרות המסמך"). */
export const I4U_LOGO_MAX = 250;
/** The size to draw a logo of w by h into Invoice4U's box: the long side becomes 250, the ratio is kept. */
export function i4uLogoSize(w: number, h: number): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: I4U_LOGO_MAX, h: I4U_LOGO_MAX };
  const k = I4U_LOGO_MAX / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/** What to set by hand in Invoice4U so the document it signs matches the chosen design as closely as its own options allow. */
export function invoice4uHints(s: DesignSpec): string[] {
  return [
    "בהגדרות החשבון, הגדרות המסמך: טעינת לוגו, הקובץ שהורד מכאן (JPG עד 250 פיקסלים).",
    `בהגדרות החשבון, עיצוב והגדרות המסמך: לבחור את הצבע הקרוב ביותר ל-${s.palette.primary} ואת התבנית ${s.layout === "minimal" || s.layout === "classic" ? "הפשוטה ביותר" : "עם כותרת צבעונית"}, ולשמור.`,
    "את הבחירה בודקים על חשבון עסקה אחד לפני שמפיקים חשבונית מס.",
  ];
}
