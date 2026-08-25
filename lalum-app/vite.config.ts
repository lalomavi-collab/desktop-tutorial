import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { blogMeta } from "./src/lib/blogMeta";
import { strings } from "./src/lib/strings";
import { alternatesFor, langUrl } from "./src/lib/hreflang";
import { faqsForPath } from "./src/lib/pageFaqs";
import { faqPageNode, pageJsonLd } from "./src/lib/schema";

const SITE = "https://lalumapp.com";

// Marketing routes, with the same Hebrew SEO copy PageMeta applies at runtime.
// Kept here so the static HTML a non-JS crawler or a social scraper (WhatsApp,
// Facebook, Telegram, LinkedIn) sees already carries the right title and
// description, instead of the app-shell default.
const STATIC_ROUTES: { path: string; title: string; desc: string }[] = [
  { path: "advisory", title: "ייעוץ AI וגישור, ממשל בינה מלאכותית ו-EU AI Act | LALUM", desc: "ייעוץ משפטי לממשל בינה מלאכותית: התאמה ל-EU AI Act, אחריות אלגוריתמית, הגנת קניין רוחני ומידע, וגישור מכוון הכרעה לסכסוכים מורכבים." },
  { path: "ai-legal-advisory", title: "ייעוץ משפטי וחוות דעת שנייה בנושא AI לחברות | LALUM", desc: "ייעוץ משפטי עצמאי וחוות דעת שנייה לחברות וארגונים בנושא בינה מלאכותית: ממשל AI, EU AI Act, אחריות אלגוריתמית, קניין רוחני וניהול סיכונים." },
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

// Meta descriptions should stay within ~160 chars so a search snippet is not
// truncated mid-sentence. Hand-tuned copy is already short; imported article
// excerpts can run long, so clip those at a word boundary and add an ellipsis.
function clip(s: string, max = 160): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…";
}

// Parse the human date strings the articles carry ("Aug 2026", "יולי 2026") into
// an ISO date for schema.org datePublished. Returns "" when it cannot parse, so
// the field is simply omitted rather than emitting an invalid value.
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07",
  aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  ינואר: "01", פברואר: "02", מרץ: "03", אפריל: "04", מאי: "05", יוני: "06",
  יולי: "07", אוגוסט: "08", ספטמבר: "09", אוקטובר: "10", נובמבר: "11", דצמבר: "12",
};
function toIsoDate(s: string): string {
  const raw = (s ?? "").trim();
  const year = (raw.match(/\b(20\d{2})\b/) || [])[1];
  if (!year) return "";
  let mm = "";
  for (const key of Object.keys(MONTHS)) {
    if (raw.toLowerCase().includes(key)) { mm = MONTHS[key]; break; }
  }
  return mm ? `${year}-${mm}-01` : `${year}-01-01`;
}

// The per-article structured data (BlogPosting + BreadcrumbList) that the Article
// component sets client-side. Baking the same graph into the static HTML means a
// non-JS crawler or an AI answer engine sees the author, publisher, and date up
// front, instead of the app-shell's Organization graph. Matches the runtime
// shape (author linked by @id to the verified founder node).
function articleJsonLd(a: { slug: string; headline: string; desc: string; image?: string; date: string }): string {
  const iso = toIsoDate(a.date);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: a.headline,
        description: a.desc,
        inLanguage: "he",
        ...(iso ? { datePublished: iso } : {}),
        author: { "@type": "Person", "@id": `${SITE}/#founder`, name: "Dr. Avraham Lalum", url: `${SITE}/`, sameAs: ["https://www.linkedin.com/in/dr-avraham-lalum-ab833929/"] },
        publisher: { "@type": "Organization", name: "LALUM", logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
        mainEntityOfPage: `${SITE}/insights/${a.slug}/`,
        image: a.image || `${SITE}/og-card-v2.png`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE}/insights/` },
          { "@type": "ListItem", position: 3, name: a.headline, item: `${SITE}/insights/${a.slug}/` },
        ],
      },
    ],
  };
  return `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(graph)}</script>`;
}

// Replace one tag's content by a precise pattern. `re` must capture the prefix
// up to the opening content quote in group 1 and the closing quote (+ tag end)
// in group 2, tolerating the multiline attribute layout Vite emits.
function replaceTag(html: string, re: RegExp, prefix: string, value: string, suffix: string): string {
  return re.test(html) ? html.replace(re, `${prefix}${esc(value)}${suffix}`) : html;
}

// Search engines truncate the <title> around 60 characters, so a 100+ char
// editorial headline shows up chopped mid-word in results. Produce a concise
// <title> (prefer the pre-colon headline, else a clean word-boundary cut),
// while og:title and twitter:title keep the FULL headline for social cards.
function shortTitle(full: string): string {
  if (full.length <= 60) return full;
  const m = full.match(/^([\s\S]*?)(\s*[·|]\s*LALUM)\s*$/);
  const head = m ? m[1] : full;
  const suffix = m ? m[2] : "";
  const budget = 60 - suffix.length;
  let t = head;
  if (t.length > budget) {
    const colon = head.indexOf(":");
    if (colon >= 15 && colon <= budget) {
      t = head.slice(0, colon);
    } else {
      t = head.slice(0, budget);
      const sp = t.lastIndexOf(" ");
      if (sp > 20) t = t.slice(0, sp);
    }
    t = t.replace(/[\s,;:·|(–\-]+$/, "");
  }
  return t + suffix;
}

function applyMeta(template: string, r: { title: string; desc: string; url: string; path: string; image?: string }): string {
  let h = template;
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(shortTitle(r.title))}</title>`);
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
      // Curated articles live in the app's own copy (strings.data.articles),
      // not in blogMeta. They are linked from the site and listed in the sitemap,
      // so they must be prerendered too, otherwise a crawler or a direct hit gets
      // only the empty SPA shell for them. Use the Hebrew copy to match the
      // prerendered document's lang, and skip any slug blogMeta already covers.
      const blogSlugs = new Set(blogMeta.map((m) => m.slug));
      const curated = strings.he.data.articles
        .filter((a) => !blogSlugs.has(a.slug))
        .map((a) => ({
          path: `insights/${a.slug}`,
          title: `${a.title} · LALUM`,
          desc: a.dek,
          image: undefined as string | undefined,
          article: { slug: a.slug, headline: a.title, date: a.date },
        }));
      const routes = [
        ...STATIC_ROUTES.map((s) => ({ path: s.path, title: s.title, desc: s.desc, image: undefined as string | undefined, article: undefined as undefined | { slug: string; headline: string; date: string } })),
        ...blogMeta.map((m) => ({
          path: `insights/${m.slug}`,
          title: `${m.title} · LALUM`,
          desc: m.excerpt,
          // m.cover is already absolute for wixstatic-hosted covers; only
          // site-relative covers (e.g. /images/foo.svg) need SITE prefixed.
          image: m.cover ? (m.cover.startsWith("http") ? m.cover : `${SITE}${m.cover.startsWith("/") ? "" : "/"}${m.cover}`) : undefined,
          article: { slug: m.slug, headline: m.title, date: m.date },
        })),
        ...curated,
      ];
      let written = 0;
      for (const r of routes) {
        let html = applyMeta(template, { title: r.title, desc: clip(r.desc), url: langUrl(`/${r.path}`, "he"), path: r.path, image: r.image });
        // Bake per-article structured data into the static HTML for crawlers and
        // AI answer engines; the runtime PageMeta finds this same #page-jsonld
        // script on hydration and updates it in place, so nothing duplicates.
        if (r.article) {
          const script = articleJsonLd({ ...r.article, desc: clip(r.desc), image: r.image });
          html = html.replace("</head>", `    ${script}\n  </head>`);
        } else {
          // Bake the FAQPage structured data for FAQ-bearing pages (/faq, /advisory)
          // so the Q&A is visible to crawlers and AI answer engines without running
          // JS. Uses the same faqsForPath/faqPageNode helpers the runtime PageMeta
          // uses, so hydration finds a matching #page-jsonld and nothing duplicates.
          const faqNode = pageJsonLd([faqPageNode(faqsForPath(strings.he, `/${r.path}`))]);
          if (faqNode) {
            const script = `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(faqNode)}</script>`;
            html = html.replace("</head>", `    ${script}\n  </head>`);
          }
        }
        const file = join(outDir, r.path, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html, "utf8");
        written++;
      }
      // Stamp a dynamic lastmod on every sitemap URL at build time, so crawlers
      // see a fresh, self-updating date on each deploy instead of a hand-edited
      // one that drifts. Only URLs that do not already carry a <lastmod> are
      // stamped, so any hand-set date is preserved.
      const sitemapPath = join(outDir, "sitemap.xml");
      try {
        const today = new Date().toISOString().slice(0, 10);
        const xml = readFileSync(sitemapPath, "utf8");
        const stamped = xml.replace(/(<loc>[^<]*<\/loc>)(?!\s*<lastmod>)/g, `$1<lastmod>${today}</lastmod>`);
        writeFileSync(sitemapPath, stamped, "utf8");
      } catch {
        // No sitemap in the build output; nothing to stamp.
      }
      // eslint-disable-next-line no-console
      console.log(`[seo-prerender] wrote ${written} route HTML files (${STATIC_ROUTES.length} pages + ${blogMeta.length} articles + ${curated.length} curated)`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPrerender()],
});
