import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { blogMeta } from "./src/lib/blogMeta";
import { blogPosts } from "./src/lib/blogPosts";
import { strings } from "./src/lib/strings";
import { alternatesFor, cvPath, langUrl, LANGS, type Lang } from "./src/lib/hreflang";
import { faqsForPath } from "./src/lib/pageFaqs";
import { faqCategories } from "./src/lib/faq";
import { pillarPagesFor, type PillarPage } from "./src/lib/pillars";
import { SECTORS, sectorCases, type Sector } from "./src/lib/sectors";
import { LEGAL_TOOLS, TOOLS_PAGE } from "./src/lib/legalTools";
import { TRACKS, BANDS, resultFor, resultPath, MAX_SCORE } from "./src/lib/riskScore";
import { faqPageNode, pageJsonLd, pageNode } from "./src/lib/schema";
import { toBlocks, blocksToText } from "./src/lib/articleBlocks";
import { articleCorpus, relatedTo } from "./src/lib/related";
import { TOPICS_IN_ORDER, articlesByTopic, topicOfArticle, topicPath, type Topic } from "./src/lib/topics";
import { rulings, areaLabel, rulingTitle } from "./src/lib/rulings";
import type { ArticleBlock } from "./src/lib/content";
import { courses, courseFramework, courseSlug } from "./src/lib/courses";
import { academyPro } from "./src/lib/academyPro";

const SITE = "https://lalumapp.com";

// Marketing routes, with the same Hebrew SEO copy PageMeta applies at runtime.
// Kept here so the static HTML a non-JS crawler or a social scraper (WhatsApp,
// Facebook, Telegram, LinkedIn) sees already carries the right title and
// description, instead of the app-shell default.
const STATIC_ROUTES: { path: string; title: string; desc: string; noindex?: boolean; image?: string }[] = [
  { path: "advisory", title: "ייעוץ בנדל״ן, מיזוגים ורכישות וממשל AI | LALUM", desc: "ייעוץ משפטי בעסקאות נדל״ן, מיזוגים ורכישות ועסקאות בינלאומיות, התחדשות עירונית, גישור ובוררות, וממשל בינה מלאכותית כולל התאמה ל-EU AI Act." },
  { path: "ai-legal-advisory", title: "ייעוץ, ליווי מלא והדרכות AI לחברות ולארגונים | LALUM", desc: "ייעוץ וליווי משפטי מלא לחברות ולארגונים בנושא בינה מלאכותית: ממשל AI, EU AI Act, אחריות אלגוריתמית, קניין רוחני וניהול סיכונים, לצד הדרכות להנהלה ולצוותים.", image: `${SITE}/og/pillar-ai.png` },
  { path: "real-estate-legal-advisory", title: "נדל״ן והתחדשות עירונית בארץ ובחו״ל: ייעוץ וחוות דעת שנייה | LALUM", desc: "ייעוץ משפטי עצמאי וחוות דעת שנייה בעסקאות נדל״ן בארץ ובחו״ל ובהתחדשות עירונית (תמ״א 38 ופינוי-בינוי), בשילוב Legal AI לבדיקת נאותות וניהול סיכונים.", image: `${SITE}/og/pillar-real-estate.png` },
  { path: "mediation-dispute-resolution", title: "גישור מסחרי ויישוב סכסוכים עסקיים מכוון הכרעה | LALUM", desc: "גישור מסחרי ויישוב סכסוכים עסקיים בשיטת גישור מכוון הכרעה (DOM): סכסוכי שותפים, ספקים, נדל״ן והתחדשות עירונית, עם הערכה משפטית מנומקת והסכם בר-הגנה." },
  { path: "training", title: "קורס AI לעורכי דין והכשרות בינה מלאכותית לארגונים | LALUM", desc: "קורס AI לעורכי דין ולמשרדי עורכי דין, והכשרות בממשל בינה מלאכותית, EU AI Act וניהול סיכונים אלגוריתמי לדירקטוריונים ולצוותי מוצר." },
  { path: "knowledge", title: "מרכז הידע של LALUM: נדל״ן, מיזוגים ורכישות ו-AI", desc: "קורסים, מאמרים ושאלות ותשובות על נדל״ן, מיזוגים ורכישות, התחדשות עירונית, גישור, וממשל בינה מלאכותית, במקום אחד." },
  { path: "rulings", title: "חיפוש פסקי דין: בינה מלאכותית, נדל״ן והתחדשות עירונית | LALUM", desc: "מאגר פסיקה בר חיפוש עם תמצית לכל פסק דין שהמשרד כתב עליו, בבינה מלאכותית ובחובות המקצוע, לצד שאילתות מוכנות למאגרים הרשמיים." },
  { path: "insights", title: "מאמרים על נדל״ן, מיזוגים ורכישות וממשל AI | LALUM", desc: "מאמרים מקצועיים על נדל״ן, מיזוגים ורכישות, התחדשות עירונית, גישור, וממשל בינה מלאכותית, מאת ד״ר עו״ד אברהם ללום ומשרד LALUM." },
  { path: "faq", title: "שאלות ותשובות על נדל״ן, מיזוגים ורכישות ו-AI | LALUM", desc: "תשובות לשאלות נפוצות על נדל״ן, מיזוגים ורכישות, התחדשות עירונית, גישור ויישוב סכסוכים, וממשל בינה מלאכותית, מבית LALUM." },
  { path: "book", title: "קביעת פגישת ייעוץ: נדל״ן, מיזוגים ורכישות ו-AI | LALUM", desc: "לתיאום ייעוץ בעסקאות נדל״ן, מיזוגים ורכישות, התחדשות עירונית, גישור, או ממשל בינה מלאכותית עם ד״ר עו״ד אברהם ללום, LALUM." },
  { path: "legal", title: "מדיניות פרטיות ותנאי שימוש | LALUM", desc: "מדיניות הפרטיות ותנאי השימוש של אפליקציית LALUM." },
  // Prerendered so they resolve to a real file rather than falling through to
  // the SPA catch-all, but kept out of the index: a sign-in form and a private
  // client area are not search results anyone wants.
  { path: "login", title: "כניסת לקוחות | LALUM", desc: "כניסה לאזור הלקוחות של LALUM.", noindex: true },
  { path: "portal", title: "אזור הלקוחות | LALUM", desc: "האזור האישי ללקוחות LALUM.", noindex: true },
  // One prerendered page per sector rubric under the AI pillar. These are the
  // pages outreach points a body at instead of a PDF, so they have to resolve
  // to a real document with their own title and description, not to the SPA
  // shell. Hebrew only, and so carrying no language alternates.
  ...SECTORS.map((s) => ({ path: s.path, title: `${s.title} | LALUM`, desc: s.desc })),
  // The diagnostic tools. Prerendered so the page resolves to a real document
  // with its own title and description, and so a crawler that runs no
  // JavaScript still reads what each tool asks: the questions are the subject
  // matter, and they are what someone searching for this arrives on.
  { path: TOOLS_PAGE.path, title: `${TOOLS_PAGE.title} | LALUM`, desc: TOOLS_PAGE.desc },
  // One prerendered page per LALUM Academy program, In-House and Pro alike, so
  // each program resolves to a real file with its own title and description
  // instead of living only inside an accordion on the training page.
  ...[...courses, ...academyPro].map((c) => {
    const frame = c.frame ?? courseFramework;
    return {
      path: `training/${courseSlug(c)}`,
      title: `${c.title} | LALUM`,
      desc: `${c.audience} ${frame.sessions}, ${frame.hours}, ${frame.place}.`,
    };
  }),
];

// String.replace treats $1, $&, $` and $' in a REPLACEMENT STRING as pattern
// references. Article and metadata text is content, not a pattern: an article
// priced "Pro ($19/mo)" expanded $1 into the captured markup and duplicated the
// page container. Every replacement below therefore passes a function, whose
// return value is used verbatim.
function sub(haystack: string, re: RegExp | string, build: (...m: string[]) => string): string {
  return haystack.replace(re as RegExp, ((...args: unknown[]) => build(...(args.slice(0, -2) as string[]))) as never);
}

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
function articleJsonLd(a: { slug: string; headline: string; desc: string; image?: string; date: string; body?: string; topic?: Topic }): string {
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
        // The reading text, so an AI answer engine that consumes only the
        // structured data still gets the article rather than the headline. It
        // mirrors the prose rendered into the static body below, so this is a
        // machine-readable copy of visible content, never hidden text.
        ...(a.body ? { articleBody: a.body, wordCount: a.body.split(/\s+/).filter(Boolean).length } : {}),
        author: { "@type": "Person", "@id": `${SITE}/#founder`, name: "Dr. Avraham Lalum", url: `${SITE}/`, sameAs: ["https://www.linkedin.com/in/dr-avraham-lalum-ab833929/"] },
        publisher: { "@type": "Organization", name: "LALUM", logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
        mainEntityOfPage: `${SITE}/insights/${a.slug}/`,
        image: a.image || `${SITE}/og-card-v2.png`,
      },
      {
        "@type": "BreadcrumbList",
        // The topic sits between the index and the piece, so the trail a search
        // result shows matches the path a reader actually has through the site.
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE}/insights/` },
          ...(a.topic ? [{ "@type": "ListItem", position: 3, name: a.topic.name, item: `${SITE}${topicPath(a.topic.slug)}/` }] : []),
          { "@type": "ListItem", position: a.topic ? 4 : 3, name: a.headline, item: `${SITE}/insights/${a.slug}/` },
        ],
      },
    ],
  };
  return `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(graph)}</script>`;
}

// Render article blocks as the static HTML a non-JS crawler reads. Mirrors the
// Block component in the Article route: "## " sections become <h2>, prose
// becomes <p>. React discards this the moment it mounts, so a visitor never
// sees it; only crawlers and AI answer engines that skip JS do.
function blocksToHtml(blocks: ArticleBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h2":
        out.push(`<h2>${esc(b.text)}</h2>`);
        break;
      case "p":
        out.push(`<p>${esc(b.text)}</p>`);
        break;
      case "quote":
        out.push(`<blockquote>${esc(b.text)}</blockquote>`);
        break;
      case "list":
        out.push(`<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`);
        break;
      case "cta":
        out.push(`<p><a href="${esc(b.to)}">${esc(b.text)}</a></p>`);
        break;
    }
  }
  return out.join("\n        ");
}

// Swap the generic app-shell fallback inside #root for this route's own
// content. The fallback is not merely thin, it is wrong: it announces an
// English H1 about the firm on every Hebrew page, so a crawler that skips JS
// reads the same off-topic heading for all 161 routes. Everything else about
// the document is untouched, and the swap is skipped if the template's
// fallback markup ever changes shape, so a template edit degrades to today's
// behaviour instead of producing a broken page.
// The build emits the module script into <head>, so #root is closed by
// "</div></body>"; the source template closes it before a <script>. Accept
// either so the swap works against both shapes.
const FALLBACK_RE = /(<div id="root">)([\s\S]*?)(\n\s*<\/div>\s*(?:<script|<\/body>))/;
// The two areas the practice leads with come first, matching the rendered
// navigation. A crawler that does not run JavaScript reads this list on every
// document, so the order is the site saying what it is about.
const SITE_NAV = `<p><a href="/real-estate-legal-advisory/">ייעוץ נדל״ן והתחדשות עירונית</a> · <a href="/ai-legal-advisory/">ייעוץ AI</a> · <a href="/advisory/">ייעוץ משפטי</a> · <a href="/mediation-dispute-resolution/">גישור ויישוב סכסוכים</a> · <a href="/insights/">מאמרים</a> · <a href="/faq/">שאלות ותשובות</a> · <a href="/risk/">מבדק מוכנות</a> · <a href="/book/">תיאום פגישה</a></p>`;

function withStaticBody(html: string, inner: string, dir: "rtl" | "ltr" = "rtl", lang: string = "he"): string {
  if (!FALLBACK_RE.test(html)) return html;
  const body = `
      <!-- Static content for crawlers and AI engines that do not run
           JavaScript. React replaces this the moment the app mounts. -->
      <div style="max-width:820px;margin:0 auto;padding:48px 24px;font-family:system-ui,sans-serif;line-height:1.6;color:#1a1815" dir="${dir}" lang="${lang}">
${inner}
        ${SITE_NAV}
      </div>`;
  return sub(html, FALLBACK_RE, (_m, open, _old, close) => `${open}${body}${close}`);
}

// An article: its own headline, standfirst, prose, and the same three related
// pieces the rendered page ends with. Without those links the static document
// left every article a dead end: a crawler that does not run JavaScript could
// reach an article, read it, and then had nowhere to go but the site nav, so
// the corpus had no paths through it at all.
function articleBodyHtml(headline: string, dek: string, blocks: ArticleBlock[], related: { slug: string; title: string }[] = [], topic?: Topic): string {
  const out = [`        <h1>${esc(headline)}</h1>`, `        <p>${esc(dek)}</p>`, `        ${blocksToHtml(blocks)}`];
  if (topic) {
    out.push(`        <p>${esc("נושא")}: <a href="${topicPath(topic.slug)}/">${esc(topic.name)}</a></p>`);
  }
  if (related.length) {
    out.push(`        <h2>${esc(strings.he.ui.article.moreArticles)}</h2>`);
    out.push(`        <ul>${related.map((r) => `<li><a href="/insights/${esc(encodeURI(r.slug))}/">${esc(r.title)}</a></li>`).join("")}</ul>`);
  }
  return out.join("\n");
}

// The FAQ page: its heading and the full chapter and question structure. The
// answers are deliberately left out. This same document already carries all
// 423 answers in its FAQPage JSON-LD, so emitting them here too would ship the
// same 134KB of text twice and roughly double the page for every visitor, for
// no gain to a crawler that reads either form. The questions are the part
// worth repeating: they are the actual search queries, and they give the
// static copy the same shape as the rendered page.
function faqBodyHtml(): string {
  const f = strings.he.faqPage;
  const out = [`        <h1>${esc(f.title)}</h1>`, `        <p>${esc(f.lede)}</p>`];
  for (const cat of faqCategories) {
    out.push(`        <h2>${esc(cat.title)}</h2>`);
    for (const it of cat.items) out.push(`        <h3>${esc(it.q)}</h3>`);
  }
  return out.join("\n");
}

// A pillar landing page, rendered from the same data module the page component
// renders from, so the static copy matches the page exactly.
function pillarBodyHtml(p: PillarPage): string {
  const out = [`        <h1>${esc(p.title)}</h1>`, `        <p>${esc(p.lede)}</p>`];
  out.push(`        <p><a href="/${esc(p.secondary)}/">${esc(p.secondary === "training" ? p.ui.training : p.ui.fullAdvisory)}</a></p>`);
  out.push(`        <h2>${esc(p.coversH2)}</h2>`);
  for (const c of p.cards) out.push(`        <h3>${esc(c.title)}</h3>\n        <p>${esc(c.body)}</p>`);
  out.push(`        <h2>${esc(p.whenH2)}</h2>`, `        <p>${esc(p.whenLede)}</p>`);
  out.push(`        <ul>${p.when.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`);
  out.push(`        <h2>${esc(p.stepsH2)}</h2>`);
  for (const s of p.steps) out.push(`        <h3>${esc(s.title)}</h3>\n        <p>${esc(s.body)}</p>`);
  if (p.sectors?.length && p.sectorsUi) {
    out.push(`        <h2>${esc(p.sectorsUi.h2)}</h2>`, `        <p>${esc(p.sectorsUi.lede)}</p>`);
    out.push(`        <ul>${p.sectors.map((s) => `<li><a href="/${esc(s.path)}/">${esc(s.title)}</a>: ${esc(s.body)}</li>`).join("")}</ul>`);
    out.push(`        <p><a href="${esc(p.sectorsUi.toolsHref)}/">${esc(p.sectorsUi.toolsLabel)}</a></p>`);
  }
  out.push(`        <h2>${esc(p.relatedH2)}</h2>`);
  out.push(`        <ul>${p.related.map((r) => `<li><a href="/insights/${esc(encodeURI(r.slug))}/">${esc(r.title)}</a></li>`).join("")}</ul>`);
  out.push(`        <h2>${esc(p.faqH2)}</h2>`);
  for (const f of faqsForPath(strings.he, `/${p.path}`)) {
    out.push(`        <h3>${esc(f.q)}</h3>\n        <p>${esc(f.a)}</p>`);
  }
  out.push(`        <h2>${esc(p.ctaH2)}</h2>`, `        <p>${esc(p.ctaBody)}</p>`, `        <p>${esc(p.disclaimer)}</p>`);
  return out.join("\n");
}

// A sector rubric. The static copy carries the same three rubrics the rendered
// page carries, because those are the reason the page exists: the case law
// with its citations, the regulator's instructions with their sources, and the
// protocol and checklist. Emitting only a heading here would leave a crawler
// with a page that says it has all of this and shows none of it.
function sectorBodyHtml(S: Sector): string {
  const out = [`        <h1>${esc(S.h1)}</h1>`, `        <p>${esc(S.lede)}</p>`];

  out.push(`        <h2>${esc(S.realityH2)}</h2>`, `        <p>${esc(S.realityLede)}</p>`);
  out.push(`        <ul>${S.reality.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`);

  out.push(`        <h2>${esc(S.casesH2)}</h2>`, `        <p>${esc(S.casesLede)}</p>`);
  for (const { ruling, why } of sectorCases(S)) {
    out.push(`        <h3>${esc(ruling.citation)}${ruling.caption ? ` ${esc(ruling.caption)}` : ""}</h3>`);
    out.push(`        <p>${esc(ruling.court)}, ${esc(ruling.dateLabel)}${ruling.bench ? `, ${esc(ruling.bench)}` : ""}</p>`);
    if (ruling.facts) out.push(`        <p>${esc(ruling.facts)}</p>`);
    out.push(`        <p>${esc(ruling.holding)}</p>`);
    if (ruling.quote) out.push(`        <blockquote><p>${esc(ruling.quote)}</p></blockquote>`);
    out.push(`        <p>${esc(why)}</p>`);
    // The sources belong in the static copy too. This page asks authorities to
    // open an authority before relying on it; a crawlable version that shows
    // the citation and hides where to read it asks for exactly the trust the
    // page says not to extend.
    out.push(`        <p>${ruling.sources.map((src) => `<a href="${esc(src.href)}" rel="nofollow noopener">${esc(src.label)}</a>`).join(" · ")}</p>`);
    out.push(`        <p><a href="/rulings/">${esc(strings.he.rulings.title)}</a></p>`);
  }

  out.push(`        <h2>${esc(S.directivesH2)}</h2>`, `        <p>${esc(S.directivesLede)}</p>`);
  for (const d of S.directives) {
    out.push(`        <h3>${esc(d.title)}</h3>`, `        <p>${esc(d.body)}</p>`);
    out.push(`        <ul>${d.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
    out.push(`        <p><a href="${esc(d.sourceHref)}" rel="nofollow noopener">${esc(d.sourceLabel)}</a></p>`);
  }

  out.push(`        <h2>${esc(S.toolsH2)}</h2>`, `        <p>${esc(S.toolsLede)}</p>`);
  for (const tool of S.tools) {
    out.push(`        <h3>${esc(tool.title)}</h3>`, `        <p>${esc(tool.intro)}</p>`);
    out.push(`        <ul>${tool.items.map((it) => `<li>${esc(it.title)}: ${esc(it.body)}</li>`).join("")}</ul>`);
    if (tool.note) out.push(`        <p>${esc(tool.note)}</p>`);
  }

  out.push(`        <h2>${esc(S.servicesH2)}</h2>`, `        <p>${esc(S.servicesLede)}</p>`);
  for (const c of S.services) out.push(`        <h3>${esc(c.title)}</h3>\n        <p>${esc(c.body)}</p>`);

  out.push(`        <h2>${esc(S.stepsH2)}</h2>`);
  for (const st of S.steps) out.push(`        <h3>${esc(st.title)}</h3>\n        <p>${esc(st.body)}</p>`);

  out.push(`        <h2>${esc(S.downloadsH2)}</h2>`, `        <p>${esc(S.downloadsLede)}</p>`);
  out.push(`        <ul>${S.downloads.map((d) => `<li><a href="${esc(d.file)}">${esc(d.title)}</a>: ${esc(d.note)}</li>`).join("")}</ul>`);

  out.push(`        <h2>${esc(S.auditH2)}</h2>`, `        <p>${esc(S.auditLede)}</p>`);
  out.push(`        <ul>${S.auditQuestions.map((q) => `<li>${esc(q.q)}</li>`).join("")}</ul>`);

  out.push(`        <h2>${esc(S.materialsH2)}</h2>`, `        <p>${esc(S.materialsLede)}</p>`);
  out.push(`        <ul>${S.materials.map((m) => `<li><a href="${esc(encodeURI(m.href))}/">${esc(m.title)}</a>: ${esc(m.note)}</li>`).join("")}</ul>`);

  out.push(`        <h2>${esc(S.faqH2)}</h2>`);
  for (const f of S.faqs) out.push(`        <h3>${esc(f.q)}</h3>\n        <p>${esc(f.a)}</p>`);

  out.push(`        <h2>${esc(S.ctaH2)}</h2>`, `        <p>${esc(S.ctaBody)}</p>`, `        <p>${esc(S.disclaimer)}</p>`);
  return out.join("\n");
}

// The take-away booklet. A municipality that is approached wants something it
// can forward and print, and until now that was a PDF produced by hand in a
// design tool, which is how a brochure ends up carrying a quotation nobody
// checked and a Latin phrase reversed by the bidi algorithm.
//
// So the booklet is generated here, from the same Sector the page renders
// from: the citations, the holdings, the regulator's instructions, the
// protocol and the checklist all have one source. It is emitted as a
// self-contained, print-ready HTML document (A4, RTL, brand palette, the
// wordmark artwork inlined), which scripts/build-booklet-pdf.mjs prints to the
// PDF that ships in public/downloads.
function sectorBookletHtml(S: Sector, wordmark: string): string {
  const cases = sectorCases(S);
  const rule = (t: string) => `<h2>${esc(t)}</h2>`;
  const p = (t: string) => `<p>${esc(t)}</p>`;

  const casesHtml = cases.map(({ ruling, why }) => `
      <article class="case">
        <p class="cite">${esc(ruling.citation)}</p>
        <h3>${esc(ruling.caption ?? ruling.citation)}</h3>
        <p class="meta">${esc(ruling.court)} · ${esc(ruling.dateLabel)}${ruling.bench ? `<br>${esc(ruling.bench)}` : ""}</p>
        ${ruling.facts ? p(ruling.facts) : ""}
        <h4>מה נפסק</h4>
        ${p(ruling.holding)}
        ${ruling.quote ? `<blockquote>${esc(ruling.quote)}</blockquote>` : ""}
        <h4>למה זה נוגע לרשות</h4>
        ${p(why)}
        <p class="src">מקורות: ${ruling.sources.map((x) => esc(x.label)).join(" · ")}</p>
      </article>`).join("");

  const directivesHtml = S.directives.map((d) => `
      <article class="block">
        <h3>${esc(d.title)}</h3>
        ${p(d.body)}
        <ul>${d.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="src">מקור: ${esc(d.sourceLabel)}</p>
      </article>`).join("");

  const toolsHtml = S.tools.map((tool) => `
      <article class="block tool">
        <h3>${esc(tool.title)}</h3>
        ${p(tool.intro)}
        <ol class="${tool.kind}">
          ${tool.items.map((it, i) => `<li><span class="marker">${tool.kind === "protocol" ? String(i + 1).padStart(2, "0") : "&#9744;"}</span><div><strong>${esc(it.title)}</strong><br>${esc(it.body)}</div></li>`).join("")}
        </ol>
        ${tool.note ? `<p class="note">${esc(tool.note)}</p>` : ""}
      </article>`).join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(S.h1)} | LALUM</title>
<!-- The print source for the PDF, not a page. It ships in the build output
     because that is where the PDF script reads it from, so it is kept out of
     the index: an unstyled second copy of the sector page at its own URL would
     compete with the page it was made from. -->
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Suez+One&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  :root { --ivory:#f5f1e8; --ink:#1a1815; --slate:#55514a; --clay:#a8482a; --line:#e3dccd; }
  /* Hebrew prose here carries Latin and numeric tokens (LPR, EU AI Act, case
     numbers, URLs). Without isolation the bidi algorithm reorders the run and
     a reader gets a reversed brand name or a mangled address, which is the
     exact defect this document exists to avoid repeating. */
  span[dir="ltr"] { unicode-bidi: isolate; direction: ltr; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:Heebo,Arial,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.65; background:#fff; }
  .cover { background:var(--ink); color:var(--ivory); padding:34mm 16mm; break-after:page; }
  .cover .mark { width:52mm; display:block; margin:0 0 26mm; }
  .cover .mark svg { width:100%; height:auto; }
  .cover h1 { font-family:"Suez One",Georgia,serif; font-size:28pt; line-height:1.2; margin:0 0 8mm; font-weight:400; }
  .cover .sub { font-size:12pt; line-height:1.6; color:#d8d2c4; margin:0 0 16mm; max-width:118mm; }
  .cover .rule { height:2px; background:var(--clay); width:34mm; margin:0 0 10mm; }
  .cover .foot { font-size:9.5pt; color:#b9b3a5; line-height:1.8; }
  main { padding:0; }
  h2 { font-family:"Suez One",Georgia,serif; font-weight:400; font-size:16pt; color:var(--ink); margin:12mm 0 4mm; padding-bottom:2mm; border-bottom:1px solid var(--line); break-after:avoid; }
  h3 { font-size:12pt; margin:6mm 0 2mm; break-after:avoid; }
  h4 { font-size:10pt; margin:4mm 0 1mm; color:var(--clay); break-after:avoid; }
  p { margin:0 0 3mm; }
  ul, ol { margin:0 0 4mm; padding-inline-start:6mm; }
  li { margin:0 0 2mm; }
  .lede { font-size:11.5pt; color:var(--slate); }
  .case, .block { break-inside:avoid; border:1px solid var(--line); border-radius:3mm; padding:6mm; margin:0 0 5mm; background:var(--ivory); }
  .cite { font-size:9pt; font-weight:700; letter-spacing:.04em; color:var(--clay); margin:0 0 1mm; }
  .meta { font-size:9pt; color:var(--slate); margin:0 0 3mm; }
  blockquote { margin:3mm 0; padding-inline-start:4mm; border-inline-start:2px solid var(--clay); font-size:10pt; }
  .src { font-size:8.5pt; color:var(--slate); margin:3mm 0 0; }
  .tool ol { list-style:none; padding:0; }
  .tool li { display:flex; gap:3mm; align-items:flex-start; break-inside:avoid; }
  .tool .marker { flex:0 0 8mm; font-weight:700; color:var(--clay); font-size:11pt; }
  .note { background:#fff; border:1px dashed var(--line); border-radius:2mm; padding:3mm 4mm; font-size:9.5pt; margin:4mm 0 0; }
  .end { margin-top:12mm; padding-top:4mm; border-top:2px solid var(--clay); }
  .disclaimer { font-size:8.5pt; color:var(--slate); margin-top:6mm; }
  .contact { font-size:9.5pt; color:var(--slate); margin-top:3mm; }
</style>
</head>
<body>
  <section class="cover">
    <span class="mark">${wordmark}</span>
    <div class="rule"></div>
    <h1>${esc(S.h1)}</h1>
    <p class="sub">${esc(S.desc)}</p>
    <p class="foot">${esc(S.downloads[0]?.updated ?? "")}<br><span dir="ltr">lalumapp.com/${esc(S.path)}/</span><br>ד״ר עו״ד אברהם ללום</p>
  </section>
  <main>
    ${rule(S.realityH2)}
    <p class="lede">${esc(S.realityLede)}</p>
    <ul>${S.reality.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>

    ${rule(S.casesH2)}
    <p class="lede">${esc(S.casesLede)}</p>
    ${casesHtml}

    ${rule(S.directivesH2)}
    <p class="lede">${esc(S.directivesLede)}</p>
    ${directivesHtml}

    ${rule(S.toolsH2)}
    <p class="lede">${esc(S.toolsLede)}</p>
    ${toolsHtml}

    <div class="end">
      ${rule(S.ctaH2)}
      ${p(S.ctaBody)}
      <p class="contact"><span dir="ltr">lalum.co</span> · <span dir="ltr">avraham@lalum.co</span> · <span dir="ltr">lalumapp.com/${esc(S.path)}/</span></p>
      <p class="disclaimer">${esc(S.disclaimer)}</p>
    </div>
  </main>
</body>
</html>`;
}

// The diagnostic tools page. The static copy carries each tool's questions,
// because the questions are the content: they are what the page is about, and
// a crawler that sees only a heading learns nothing about it.
function toolsBodyHtml(): string {
  const out = [`        <h1>${esc(TOOLS_PAGE.h1)}</h1>`, `        <p>${esc(TOOLS_PAGE.lede)}</p>`];
  for (const tool of LEGAL_TOOLS) {
    out.push(`        <h2>${esc(tool.title)}</h2>`, `        <p>${esc(tool.lede)}</p>`);
    out.push(`        <ul>${tool.questions.map((q) => `<li>${esc(q.q)}</li>`).join("")}</ul>`);
  }
  out.push(`        <p>${esc(TOOLS_PAGE.disclaimer)}</p>`);
  return out.join("\n");
}

// The articles index. Without this it fell to pageBodyHtml, which emits only a
// heading and a summary, so the static document listed zero of the 147
// articles: a crawler that does not run JavaScript saw an index page with
// nothing indexed on it. The articles were reachable from sitemap.xml alone,
// which gets them crawled but passes no anchor text and no internal links, and
// internal linking from a topical hub is most of what an index page is for.
//
// Titles and links only, no excerpts. The excerpt is a summary of prose that
// already lives on the article's own page, so repeating all 147 of them here
// would ship the same text twice for no gain to the crawler that reads either.
// The anchor text is the part that carries weight, and that is the part kept.
function insightsBodyHtml(title: string, desc: string): string {
  const heading = title.replace(/\s*[·|]\s*LALUM\s*$/, "").trim();
  const items = blogMeta
    .map((m) => `        <li><a href="/insights/${esc(encodeURI(m.slug))}/">${esc(m.title)}</a></li>`)
    .join("\n");
  const topics = TOPICS_IN_ORDER
    .map((t) => ({ t, n: articlesByTopic(strings.he).get(t.slug)?.length ?? 0 }))
    .filter((x) => x.n > 0)
    .map((x) => `<li><a href="${topicPath(x.t.slug)}/">${esc(x.t.name)}</a> (${x.n})</li>`)
    .join("");
  return [
    `        <h1>${esc(heading)}</h1>`,
    `        <p>${esc(desc)}</p>`,
    `        <h2>${esc("נושאים")}</h2>`,
    `        <ul>${topics}</ul>`,
    `        <h2>${esc("כל המאמרים")}</h2>`,
    `        <ul>`,
    items,
    `        </ul>`,
  ].join("\n");
}

// The case law page. Unlike the other marketing routes, this one has real
// records behind it, so the static document carries them: a crawler that runs
// no JavaScript reads the citation, the court, the date and what each ruling
// held, which is the part anyone searching for a docket number is looking for.
function rulingsBodyHtml(title: string, desc: string): string {
  const heading = title.replace(/\s*[·|]\s*LALUM\s*$/, "").trim();
  const out = [`        <h1>${esc(heading)}</h1>`, `        <p>${esc(desc)}</p>`];
  for (const r of rulings) {
    out.push(`        <h2>${esc(rulingTitle(r))}</h2>`);
    out.push(`        <p>${esc(`${r.court}, ${r.dateLabel}${r.bench ? `, ${r.bench}` : ""}`)}</p>`);
    if (r.issue) out.push(`        <p>${esc(`השאלה המשפטית: ${r.issue}`)}</p>`);
    out.push(`        <p>${esc(`ההלכה למעשה: ${r.holding}`)}</p>`);
    if (r.implications) out.push(`        <p>${esc(`השלכות מעשיות: ${r.implications}`)}</p>`);
    out.push(`        <p>${esc(`תחומים: ${r.areas.map(areaLabel).join(", ")}`)}</p>`);
    if (r.article) out.push(`        <p><a href="/insights/${esc(encodeURI(r.article))}/">${esc("להרחבה במאמר של המשרד")}</a></p>`);
  }
  out.push(`        <p>${esc("התמצית נכתבה בידי המשרד ואינה תחליף לקריאת פסק הדין במקור. אין באמור ייעוץ משפטי, והוא אינו מהווה חוות דעת מחייבת.")}</p>`);
  return out.join("\n");
}

// The home page, built from the same dictionary the page component renders
// from: the hero, the positioning paragraphs, the six AI and risk layers, the
// reasons, and the Q&A the page already publishes. The root document is the one
// file the route loop never wrote, so it kept the template placeholder: the most
// linked page on the site introduced itself in English, under an English title,
// to every crawler and answer engine that does not run JavaScript.
function homeBodyHtml(dict = strings.he, lang: Lang = "he"): string {
  const h = dict.home;
  const out = [
    `        <h1>${esc(`${h.heroH1a} ${h.heroH1b}`)}</h1>`,
    `        <p>${esc(h.heroLede)}</p>`,
    // The audience router, flattened. On screen it is four tabs over four
    // panels of rubrics; without this, the page a crawler reads never says who
    // the practice serves or where each of those readers is supposed to go.
    `        <h2>${esc(h.audienceTitle)}</h2>`,
    ...h.audiences.flatMap((a) => [
      `        <h3>${esc(a.label)}</h3>`,
      `        <p>${esc(a.body)}</p>`,
      `        <ul>${a.rubrics.map((r) => `<li><a href="${r.to}/">${esc(r.label)}</a>: ${esc(r.body)}</li>`).join("")}</ul>`,
    ]),
    `        <h2>${esc(`${h.aboutH2a} ${h.aboutH2b}`)}</h2>`,
    `        <p>${esc(h.aboutP1)}</p>`,
    `        <p>${esc(h.aboutP2)}</p>`,
    `        <h2>${esc(h.pillarsH2)}</h2>`,
  ];
  for (const p of dict.data.pillars) {
    out.push(`        <h3>${esc(p.title)}</h3>\n        <p>${esc(p.body)}</p>`);
  }
  // The person, in the static body. The founder block renders for a reader but
  // never reached the document a crawler without JavaScript reads, so the name
  // people actually search for, and the treatises behind it, were missing from
  // the one page most likely to answer that search.
  out.push(`        <h2>${esc(h.founderName)}</h2>`);
  out.push(`        <p>${esc(h.founderCreds1)}. ${esc(h.founderBio)}</p>`);
  out.push(`        <p>${esc(h.founderWorks)} <a href="${cvPath(lang)}">${esc(h.founderCv)}</a></p>`);
  out.push(`        <h2>${esc(h.whyH2)}</h2>`);
  out.push(`        <ul>${dict.data.why.map((w) => `<li>${esc(w.title)}: ${esc(w.body)}</li>`).join("")}</ul>`);
  for (const it of faqsForPath(dict, "/", lang)) {
    out.push(`        <h3>${esc(it.q)}</h3>`, `        <p>${esc(it.a)}</p>`);
  }
  return out.join("\n");
}

// Any other marketing route: at minimum its real Hebrew heading and summary,
// plus the Q&A the page already publishes as structured data. Those pages still
// hold their prose inline in JSX, so emitting it would mean running the React
// tree at build time; that is a larger change and is deliberately not done.
function pageBodyHtml(title: string, desc: string, path: string, dict = strings.he, lang: Lang = "he"): string {
  const heading = title.replace(/\s*[·|]\s*LALUM\s*$/, "").trim();
  const out = [`        <h1>${esc(heading)}</h1>`, `        <p>${esc(desc)}</p>`];
  for (const it of faqsForPath(dict, `/${path}`, lang)) {
    // QA.a is a single string. Iterating it as if it were a list of paragraphs
    // walks it character by character and emits one <p> per letter.
    out.push(`        <h2>${esc(it.q)}</h2>`, `        <p>${esc(it.a)}</p>`);
  }
  return out.join("\n");
}

// Replace one tag's content by a precise pattern. `re` must capture the prefix
// up to the opening content quote in group 1 and the closing quote (+ tag end)
// in group 2, tolerating the multiline attribute layout Vite emits.
function replaceTag(html: string, re: RegExp, prefix: string, value: string, suffix: string): string {
  return re.test(html) ? sub(html, re, (_m, a, b) => `${prefix === "$1" ? a : prefix}${esc(value)}${suffix === "$2" ? b : suffix}`) : html;
}

// Search engines truncate the <title> around 60 characters, so a 100+ char
// editorial headline shows up chopped mid-word in results. Produce a concise
// <title> (prefer the pre-colon headline, else a clean word-boundary cut),
// while og:title and twitter:title keep the FULL headline for social cards.
function shortTitle(full: string, allowColonCut = true): string {
  if (full.length <= 60) return full;
  const m = full.match(/^([\s\S]*?)(\s*[·|]\s*LALUM)\s*$/);
  const head = m ? m[1] : full;
  const suffix = m ? m[2] : "";
  const budget = 60 - suffix.length;
  let t = head;
  if (t.length > budget) {
    const colon = head.indexOf(":");
    // Cut at the colon only when the half before it is a headline in its own
    // right, filling most of the budget. On 62 pages it was not: a title like
    // "שקיפות אלגוריתמית: האתיקה של הבינה המלאכותית במרחב המשפטי-כלכלי" was
    // shown to searchers as "שקיפות אלגוריתמית", two words, when 26 more
    // characters of it would have fitted. A short head means the subject is
    // stated after the colon, so the plain cut keeps more of the meaning.
    if (allowColonCut && colon >= Math.max(15, budget * 0.6) && colon <= budget) {
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

// Two pages whose headlines share a long opening trimmed to the same 60
// characters ship the same <title>, which is one of the few things a search
// engine treats as a page being a copy of another. It happened to the two
// pillar pages in Spanish and French, and to two articles that differ only
// after their colon. So the trimmed titles are tracked across the build: a
// collision retries without the pre-colon shortcut, which usually keeps the
// distinguishing half, and falls back to the untrimmed headline when even that
// repeats. Longer than ideal beats identical.
const usedTitles = new Set<string>();
function tagTitle(full: string): string {
  for (const candidate of [shortTitle(full), shortTitle(full, false), full]) {
    if (!usedTitles.has(candidate)) {
      usedTitles.add(candidate);
      return candidate;
    }
  }
  return full;
}

function applyMeta(template: string, r: { title: string; desc: string; url: string; path: string; image?: string; noindex?: boolean }): string {
  let h = template;
  h = sub(h, /<title>[\s\S]*?<\/title>/, () => `<title>${esc(tagTitle(r.title))}</title>`);
  // description and og:description are emitted multiline; collapse to one line.
  h = sub(h, /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/, () => `<meta name="description" content="${esc(r.desc)}" />`);
  h = sub(h, /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/, () => `<meta property="og:description" content="${esc(r.desc)}" />`);
  h = replaceTag(h, /(<meta property="og:title" content=")[^"]*("\s*\/>)/, "$1", r.title, "$2");
  h = replaceTag(h, /(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, "$1", r.title, "$2");
  h = replaceTag(h, /(<meta property="og:url" content=")[^"]*("\s*\/>)/, "$1", r.url, "$2");
  h = replaceTag(h, /(<link rel="canonical" href=")[^"]*("\s*\/>)/, "$1", r.url, "$2");
  // Point each hreflang alternate at this route (the template carries the home
  // route's set). A route with no translation claims none, so its inherited
  // set is removed rather than repointed: telling Google that four translated
  // versions exist when the same Hebrew document is served at all of them is
  // what got those URLs crawled and then discarded as duplicates.
  const alts = alternatesFor(`/${r.path}`);
  if (alts.length === 0) {
    h = h.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/>/g, "");
  } else {
    for (const a of alts) {
      const re = new RegExp(`(<link rel="alternate" hreflang="${a.hreflang}" href=")[^"]*("\\s*/>)`);
      h = replaceTag(h, re, "$1", a.href, "$2");
    }
  }
  if (r.noindex) {
    h = replaceTag(h, /(<meta name="robots" content=")[^"]*("\s*\/>)/, "$1", "noindex, follow", "$2");
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
      // Watch mode runs this more than once per process; a stale set would make
      // the second build think every title was already taken.
      usedTitles.clear();
      const template = readFileSync(join(outDir, "index.html"), "utf8");
      // Curated articles live in the app's own copy (strings.data.articles),
      // not in blogMeta. They are linked from the site and listed in the sitemap,
      // so they must be prerendered too, otherwise a crawler or a direct hit gets
      // only the empty SPA shell for them. Use the Hebrew copy to match the
      // prerendered document's lang, and skip any slug blogMeta already covers.
      const blogSlugs = new Set(blogMeta.map((m) => m.slug));
      // Article prose, keyed by slug. Authored and imported posts carry one
      // markdown-ish body that the shared splitter turns into blocks; curated
      // articles already ship as blocks.
      const bodyBySlug = new Map(blogPosts.map((p) => [p.slug, p.body]));
      const curated = strings.he.data.articles
        .filter((a) => !blogSlugs.has(a.slug))
        .map((a) => ({
          path: `insights/${a.slug}`,
          title: `${a.title} · LALUM`,
          desc: a.dek,
          image: undefined as string | undefined,
          article: { slug: a.slug, headline: a.title, date: a.date },
          blocks: a.blocks as ArticleBlock[],
        }));
      const routes = [
        ...STATIC_ROUTES.map((s) => ({ path: s.path, title: s.title, desc: s.desc, noindex: s.noindex, image: s.image, article: undefined as undefined | { slug: string; headline: string; date: string }, blocks: undefined as ArticleBlock[] | undefined })),
        ...blogMeta.map((m) => ({
          path: `insights/${m.slug}`,
          title: `${m.title} · LALUM`,
          desc: m.excerpt,
          // m.cover is already absolute for wixstatic-hosted covers; only
          // site-relative covers (e.g. /images/foo.svg) need SITE prefixed.
          image: m.cover ? (m.cover.startsWith("http") ? m.cover : `${SITE}${m.cover.startsWith("/") ? "" : "/"}${m.cover}`) : undefined,
          article: { slug: m.slug, headline: m.title, date: m.date },
          blocks: toBlocks(bodyBySlug.get(m.slug) ?? ""),
        })),
        ...curated,
      ];
      // The same corpus the app scores against, so a prerendered article ends
      // with exactly the three links the rendered page ends with.
      const corpus = articleCorpus(strings.he);
      let written = 0;
      for (const r of routes) {
        let html = applyMeta(template, { title: r.title, desc: clip(r.desc), url: langUrl(`/${r.path}`, "he"), path: r.path, image: r.image, noindex: (r as { noindex?: boolean }).noindex });
        // Bake per-article structured data into the static HTML for crawlers and
        // AI answer engines; the runtime PageMeta finds this same #page-jsonld
        // script on hydration and updates it in place, so nothing duplicates.
        if (r.article) {
          const topic = topicOfArticle(strings.he, r.article.slug);
          const script = articleJsonLd({ ...r.article, desc: clip(r.desc), image: r.image, body: r.blocks?.length ? blocksToText(r.blocks) : undefined, topic });
          html = sub(html, "</head>", () => `    ${script}\n  </head>`);
          // Put the article's own prose in the raw HTML, replacing the generic
          // site fallback, so a crawler that skips JS reads the piece itself.
          if (r.blocks?.length) html = withStaticBody(html, articleBodyHtml(r.article.headline, r.desc, r.blocks, relatedTo(r.article.slug, corpus), topic));
        } else {
          // Bake the FAQPage structured data for FAQ-bearing pages (/faq, /advisory)
          // so the Q&A is visible to crawlers and AI answer engines without running
          // JS. Uses the same faqsForPath/faqPageNode helpers the runtime PageMeta
          // uses, so hydration finds a matching #page-jsonld and nothing duplicates.
          const faqNode = pageJsonLd([faqPageNode(faqsForPath(strings.he, `/${r.path}`))]);
          if (faqNode) {
            const script = `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(faqNode)}</script>`;
            html = sub(html, "</head>", () => `    ${script}\n  </head>`);
          }
          // Replace the generic English fallback with this route's own Hebrew
          // heading and summary. /faq carries its full Q&A; the other routes
          // carry the Q&A they already publish as structured data.
          // The prerendered document is the Hebrew one, so the Hebrew copy.
          const pillar = pillarPagesFor("he").find((p: PillarPage) => p.path === r.path);
          const sector = SECTORS.find((x: Sector) => x.path === r.path);
          const staticBody =
            r.path === TOOLS_PAGE.path ? toolsBodyHtml()
            : sector ? sectorBodyHtml(sector)
            : r.path === "faq" ? faqBodyHtml()
            : r.path === "rulings" ? rulingsBodyHtml(r.title, r.desc)
            : r.path === "insights" ? insightsBodyHtml(r.title, r.desc)
            : pillar ? pillarBodyHtml(pillar)
            : pageBodyHtml(r.title, r.desc, r.path);
          html = withStaticBody(html, staticBody);
        }
        const file = join(outDir, r.path, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html, "utf8");
        written++;
      }
      // The take-away booklet for every sector, emitted as print-ready HTML.
      // scripts/build-booklet-pdf.mjs turns it into the PDF that ships in
      // public/downloads, so the file a municipality receives is generated
      // from the same data as the page it came from.
      {
        const wordmark = readFileSync(join(process.cwd(), "public", "lalum-logo-inverse.svg"), "utf8");
        for (const sec of SECTORS) {
          const bf = join(outDir, "downloads", `${sec.slug}-booklet.html`);
          mkdirSync(dirname(bf), { recursive: true });
          writeFileSync(bf, sectorBookletHtml(sec, wordmark), "utf8");
        }
      }
      // The readiness assessment and its shareable results. Each result is its
      // own prerendered document with its own Open Graph tags and preview
      // image, because LinkedIn builds a card from the raw HTML of the shared
      // URL: it runs no JavaScript, and it dropped the `summary` parameter that
      // the draft relied on, so a share pointing at the site root with the text
      // in a query string would have shown the generic site card.
      {
        const riskTitle = `מבדק מוכנות Tech-Legal: כמה הארגון שלכם חשוף?`;
        const riskDesc = `מבדק קצר בן שלוש שאלות שמעריך את מוכנות הארגון בממשל בינה מלאכותית, בבדיקת חוזים ובתיעוד החלטות. תיאור עצמי, בלי להעלות שום מסמך.`;
        let h = applyMeta(template, { title: `${riskTitle} | LALUM`, desc: clip(riskDesc), url: langUrl("/risk", "he"), path: "risk", image: `${SITE}/og/risk-intro.png` });
        h = withStaticBody(h, `        <h1>${esc(riskTitle)}</h1>\n        <p>${esc(riskDesc)}</p>`);
        const rf = join(outDir, "risk", "index.html");
        mkdirSync(dirname(rf), { recursive: true });
        writeFileSync(rf, h, "utf8");
        written++;

        for (const tr of TRACKS) {
          for (const band of BANDS) {
            const r = resultFor(tr.id, band);
            const title = `${r.title}: מוכנות Tech-Legal ב${tr.blurb}`;
            const path = resultPath(tr.id, band).slice(1);
            let rh = applyMeta(template, {
              title: `${title} | LALUM`, desc: clip(r.body), url: langUrl(`/${path}`, "he"),
              path, image: `${SITE}/og/risk-${tr.id}-${band}.png`,
            });
            const inner = [
              `        <h1>${esc(title)}</h1>`,
              `        <p>${esc(r.body)}</p>`,
              `        <p>${esc(r.next)}</p>`,
              `        <p>${esc(`התוצאה מבוססת על תיאור עצמי בן שלוש שאלות, בסולם של ${MAX_SCORE} נקודות חשיפה. היא אינה ביקורת משפטית ואינה חוות דעת.`)}</p>`,
            ].join("\n");
            rh = withStaticBody(rh, inner);
            const f = join(outDir, path, "index.html");
            mkdirSync(dirname(f), { recursive: true });
            writeFileSync(f, rh, "utf8");
            written++;
          }
        }
      }

      // Topic hubs. Each is a real page for one subject, with its own title,
      // description and the full list of that subject's writing as anchor
      // text. Hebrew only, like the writing itself, so they claim no
      // translated alternates.
      {
        const byTopic = articlesByTopic(strings.he);
        for (const topic of TOPICS_IN_ORDER) {
          const rows = byTopic.get(topic.slug) ?? [];
          if (!rows.length) continue;
          const path = topicPath(topic.slug).slice(1);
          let h = applyMeta(template, {
            title: `${topic.title} | LALUM`, desc: clip(topic.desc), url: langUrl(`/${path}`, "he"), path,
          });
          const graph = pageJsonLd([pageNode("CollectionPage", topic.title, topic.desc, `${SITE}${topicPath(topic.slug)}/`)]);
          if (graph) {
            h = sub(h, "</head>", () => `    <script id="page-jsonld" type="application/ld+json">${JSON.stringify(graph)}</script>\n  </head>`);
          }
          const inner = [
            `        <h1>${esc(topic.name)}</h1>`,
            `        <p>${esc(topic.lede)}</p>`,
            ...(topic.pillar ? [`        <p><a href="/${esc(topic.pillar.path)}/">${esc(topic.pillar.label)}</a></p>`] : []),
            `        <ul>${rows.map((r) => `<li><a href="/insights/${esc(encodeURI(r.slug))}/">${esc(r.title)}</a></li>`).join("")}</ul>`,
          ].join("\n");
          h = withStaticBody(h, inner);
          const f = join(outDir, path, "index.html");
          mkdirSync(dirname(f), { recursive: true });
          writeFileSync(f, h, "utf8");
          written++;
        }
      }

      // The Hebrew home document. It is Vite's own index.html, so the route
      // loop above never wrote it: it kept the template's English title,
      // English description and English placeholder body, and its ?lang=
      // alternates pointed at hrefs that no longer resolve. Every other route
      // served correct Hebrew; the root, the page that carries the site's name
      // and most of its links, did not. It gets the same treatment here: its
      // own metadata, a self-referencing canonical, the real hreflang set, the
      // Q&A it publishes, and a Hebrew static body.
      {
        const homeFile = join(outDir, "index.html");
        const seo = strings.he.seo.home;
        let h = applyMeta(template, {
          title: seo.title, desc: clip(seo.desc), url: langUrl("/", "he"), path: "", image: undefined,
        });
        const faqNode = pageJsonLd([faqPageNode(faqsForPath(strings.he, "/"))]);
        if (faqNode) {
          h = sub(h, "</head>", () => `    <script id="page-jsonld" type="application/ld+json">${JSON.stringify(faqNode)}</script>\n  </head>`);
        }
        h = withStaticBody(h, homeBodyHtml());
        writeFileSync(homeFile, h, "utf8");
        written++;
      }

      // Language variants. Only the routes measured as genuinely translated get
      // one, and each is a real file at /<lang>/<path>/ carrying that language's
      // metadata, its own self-referencing canonical, and the same reciprocal
      // hreflang set. This is what a query parameter could never do: the host
      // serves one document per path whatever the query, so ?lang=en returned
      // the Hebrew file under a Hebrew canonical and Google folded it away.
      const VARIANTS: { path: string; seoKey: "home" | "advisory" | "knowledge" | "book" | "legal" | null }[] = [
        { path: "", seoKey: "home" },
        { path: "advisory", seoKey: "advisory" },
        { path: "ai-legal-advisory", seoKey: null },
        { path: "real-estate-legal-advisory", seoKey: null },
        { path: "mediation-dispute-resolution", seoKey: null },
        { path: "knowledge", seoKey: "knowledge" },
        { path: "book", seoKey: "book" },
        { path: "legal", seoKey: "legal" },
      ];
      for (const v of VARIANTS) {
        for (const l of LANGS) {
          if (l.code === "he") continue;
          const lang = l.code as Lang;
          const dict = strings[lang];
          const pillar = pillarPagesFor(lang).find((x: PillarPage) => x.path === v.path);
          const title = pillar ? `${pillar.title} | LALUM` : dict.seo[v.seoKey!].title;
          const desc = pillar ? pillar.desc : dict.seo[v.seoKey!].desc;
          let html = applyMeta(template, {
            title, desc: clip(desc), url: langUrl(`/${v.path}`, lang), path: v.path, image: undefined,
          });
          // The document must declare the language it is written in, not the
          // template's Hebrew.
          html = sub(html, /<html[^>]*>/, () => `<html lang="${lang}" dir="${l.dir}">`);
          const faqNode = pageJsonLd([faqPageNode(pillar ? pillar.faqs : faqsForPath(dict, `/${v.path}`, lang))]);
          if (faqNode) {
            html = sub(html, "</head>", () => `    <script id="page-jsonld" type="application/ld+json">${JSON.stringify(faqNode)}</script>\n  </head>`);
          }
          const inner = pillar ? pillarBodyHtml(pillar)
            : v.path === "" ? homeBodyHtml(dict, lang)
            : pageBodyHtml(title, desc, v.path, dict, lang);
          html = withStaticBody(html, inner, l.dir, lang);
          const file = join(outDir, lang, v.path, "index.html");
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, html, "utf8");
          written++;
        }
      }
      // Stamp a dynamic lastmod on every sitemap URL at build time, so crawlers
      // see a fresh, self-updating date on each deploy instead of a hand-edited
      // one that drifts. Only URLs that do not already carry a <lastmod> are
      // stamped, so any hand-set date is preserved.
      const sitemapPath = join(outDir, "sitemap.xml");
      try {
        const today = new Date().toISOString().slice(0, 10);
        let xml = readFileSync(sitemapPath, "utf8");
        // Add the language variants. They are real, indexable addresses, so a
        // crawler should find them in the sitemap and not only by following an
        // hreflang link from the Hebrew page.
        const hubRows = TOPICS_IN_ORDER
          .filter((t) => (articlesByTopic(strings.he).get(t.slug)?.length ?? 0) > 0)
          .map((t) => `${SITE}${topicPath(t.slug)}/`)
          .filter((loc) => !xml.includes(`<loc>${loc}</loc>`))
          .map((loc) => `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        if (hubRows.length) xml = sub(xml, "</urlset>", () => `${hubRows.join("\n")}\n</urlset>`);
        const rows = VARIANTS.flatMap((v) =>
          LANGS.filter((l) => l.code !== "he").map((l) => langUrl(`/${v.path}`, l.code)),
        )
          .filter((loc) => !xml.includes(`<loc>${loc}</loc>`))
          .map((loc) => `  <url><loc>${loc}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
        if (rows.length) xml = sub(xml, "</urlset>", () => `${rows.join("\n")}\n</urlset>`);
        // Auto-add every sector rubric, so a new one is in the sitemap the
        // moment it is added to sectors.ts. They update as the case law and
        // the regulator's instructions do, hence weekly, and they carry the
        // pillar's own priority because they are where the outreach points.
        const sectorRows = [...SECTORS.map((x: Sector) => x.path), TOOLS_PAGE.path]
          .map((path) => `${SITE}/${path}/`)
          .filter((loc) => !xml.includes(`<loc>${loc}</loc>`))
          .map((loc) => `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        if (sectorRows.length) xml = sub(xml, "</urlset>", () => `${sectorRows.join("\n")}\n</urlset>`);
        // Auto-add every article from blogMeta, so a newly published /insights/
        // post is always in the sitemap without a manual edit. Slugs are
        // percent-encoded to match the canonical served URL (Hebrew slugs), and
        // deduped against whatever the static sitemap already lists.
        const articleRows = blogMeta
          .map((m) => `${SITE}/insights/${encodeURI(m.slug)}/`)
          .filter((loc) => !xml.includes(`<loc>${loc}</loc>`))
          .map((loc) => `  <url><loc>${loc}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
        if (articleRows.length) xml = sub(xml, "</urlset>", () => `${articleRows.join("\n")}\n</urlset>`);
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
