import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { blogMeta } from "./src/lib/blogMeta";
import { alternatesFor } from "./src/lib/hreflang";

const SITE = "https://lalumapp.com";

// Marketing routes, with the same Hebrew SEO copy PageMeta applies at runtime.
// Kept here so the static HTML a non-JS crawler or a social scraper (WhatsApp,
// Facebook, Telegram, LinkedIn) sees already carries the right title and
// description, instead of the app-shell default.
const STATIC_ROUTES: { path: string; title: string; desc: string }[] = [
  { path: "advisory", title: "ייעוץ AI וגישור, ממשל בינה מלאכותית ו-EU AI Act | LALUM", desc: "ייעוץ משפטי לממשל בינה מלאכותית: התאמה ל-EU AI Act, אחריות אלגוריתמית, הגנת קניין רוחני ומידע, וגישור מכוון הכרעה לסכסוכים מורכבים." },
  { path: "training", title: "קורסים והכשרות AI למשפטנים ולעסקים | LALUM", desc: "הכשרות בממשל בינה מלאכותית, EU AI Act וניהול סיכונים אלגוריתמי, לעורכי דין, דירקטוריונים וצוותי מוצר. תוכנית מעשית מבית LALUM." },
  { path: "knowledge", title: "מרכז הידע של LALUM, קורסים, מאמרים ושאלות ותשובות על AI", desc: "כל הידע על ממשל בינה מלאכותית ורגולציית AI במקום אחד: קורסים, מאמרים מקצועיים ושאלות ותשובות על EU AI Act וניהול סיכונים אלגוריתמי." },
  { path: "insights", title: "מאמרים על ממשל AI ורגולציית בינה מלאכותית | LALUM", desc: "מאמרים מקצועיים על EU AI Act, ניהול סיכונים אלגוריתמי, אחריות דירקטוריון וגישור, מאת ד\"ר אברהם ללום ומשרד LALUM." },
  { path: "faq", title: "שאלות ותשובות על ממשל AI ורגולציה | LALUM", desc: "תשובות לשאלות נפוצות על ממשל בינה מלאכותית, EU AI Act, ניהול סיכונים אלגוריתמי, גישור ועסקאות, מבית LALUM." },
  { path: "book", title: "בקשת הערכת סיכון AI וייעוץ | LALUM", desc: "לתיאום ייעוץ או הערכת סיכון בממשל בינה מלאכותית, EU AI Act וניהול סיכונים אלגוריתמי עם ד\"ר אברהם ללום, LALUM." },
  { path: "legal", title: "מדיניות פרטיות ותנאי שימוש | LALUM", desc: "מדיניות הפרטיות ותנאי השימוש של אפליקציית LALUM." },
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Replace one tag's content by a precise pattern. `re` must capture the prefix
// up to the opening content quote in group 1 and the closing quote (+ tag end)
// in group 2, tolerating the multiline attribute layout Vite emits.
function replaceTag(html: string, re: RegExp, prefix: string, value: string, suffix: string): string {
  return re.test(html) ? html.replace(re, `${prefix}${esc(value)}${suffix}`) : html;
}

function applyMeta(template: string, r: { title: string; desc: string; url: string; path: string; image?: string }): string {
  let h = template;
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`);
  // description and og:description are emitted multiline; collapse to one line.
  h = h.replace(/<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${esc(r.desc)}" />`);
  h = h.replace(/<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/, `<meta property="og:description" content="${esc(r.desc)}" />`);
  h = replaceTag(h, /(<meta property="og:title" content=")[^"]*("\s*\/>)/, "$1", r.title, "$2");
  h = replaceTag(h, /(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, "$1", r.title, "$2");
  h = replaceTag(h, /(<meta property="og:url" content=")[^"]*("\s*\/>)/, "$1", r.url, "$2");
  h = replaceTag(h, /(<link rel="canonical" href=")[^"]*("\s*\/>)/, "$1", r.url, "$2");
  // Point each hreflang alternate at this route (the template carries the home
  // route's set). Each variant is matched by its hreflang and its href swapped.
  for (const a of alternatesFor(`/${r.path}`)) {
    const re = new RegExp(`(<link rel="alternate" hreflang="${a.hreflang}" href=")[^"]*("\\s*/>)`);
    h = replaceTag(h, re, "$1", a.href, "$2");
  }
  if (r.image) {
    h = replaceTag(h, /(<meta property="og:image" content=")[^"]*("\s*\/>)/, "$1", r.image, "$2");
    h = replaceTag(h, /(<meta name="twitter:image" content=")[^"]*("\s*\/>)/, "$1", r.image, "$2");
  }
  return h;
}

// After the SPA build, write a static index.html per route with baked-in SEO
// meta. Cloudflare serves the exact file for a direct hit or a crawler; the
// app still hydrates and takes over client-side routing as before. Routes with
// no generated file keep working through the existing SPA fallback in
// _redirects, so this only ever adds coverage.
function seoPrerender(): Plugin {
  let outDir = join(process.cwd(), "dist");
  return {
    name: "lalum-seo-prerender",
    apply: "build",
    configResolved(config) {
      // Resolve the real output dir from Vite instead of assuming cwd, so this
      // works regardless of where the CI build is invoked from.
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const template = readFileSync(join(outDir, "index.html"), "utf8");
      const routes = [
        ...STATIC_ROUTES.map((s) => ({ path: s.path, title: s.title, desc: s.desc, image: undefined as string | undefined })),
        ...blogMeta.map((m) => ({
          path: `insights/${m.slug}`,
          title: `${m.title} · LALUM`,
          desc: m.excerpt,
          image: m.cover ? `${SITE}${m.cover.startsWith("/") ? "" : "/"}${m.cover}` : undefined,
        })),
      ];
      let written = 0;
      for (const r of routes) {
        const html = applyMeta(template, { title: r.title, desc: r.desc, url: `${SITE}/${r.path}`, path: r.path, image: r.image });
        const file = join(outDir, r.path, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html, "utf8");
        written++;
      }
      // eslint-disable-next-line no-console
      console.log(`[seo-prerender] wrote ${written} route HTML files (${STATIC_ROUTES.length} pages + ${blogMeta.length} articles)`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPrerender()],
});
