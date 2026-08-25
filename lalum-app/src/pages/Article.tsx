import { Link, useParams, Navigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import type { ArticleBlock } from "../lib/content";
import { blogPosts } from "../lib/blogPosts";
import { blogMeta } from "../lib/blogMeta";
import { toIsoDate } from "../lib/isoDate";

// Blog post bodies come in two shapes. Imported posts are one plain-text run
// with no line breaks: those are grouped into readable paragraphs by sentence.
// Authored posts use "## " on their own line for section headings and blank
// lines between paragraphs: those render with real headings for a uniform,
// professional structure. Both are handled by the same splitter.
function toBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const raw of body.split(/\n+/)) {
    const seg = raw.trim();
    if (!seg) continue;
    if (seg.startsWith("## ")) {
      blocks.push({ type: "h2", text: seg.slice(3).trim() });
      continue;
    }
    const sentences = seg.split(/(?<=[.!?])\s+/);
    let cur: string[] = [];
    for (const s of sentences) {
      cur.push(s);
      if (cur.join(" ").length > 300) {
        blocks.push({ type: "p", text: cur.join(" ") });
        cur = [];
      }
    }
    if (cur.length) blocks.push({ type: "p", text: cur.join(" ") });
  }
  return blocks;
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "p":
      return <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--ink)", margin: "0 0 24px", maxWidth: "66ch" }}>{block.text}</p>;
    case "h2":
      return <h2 className="serif" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.25, margin: "44px 0 18px" }}>{block.text}</h2>;
    case "quote":
      return (
        <blockquote style={{ margin: "36px 0", padding: "4px 26px", borderInlineStart: "3px solid var(--clay)", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1.5, color: "var(--clay)" }}>
          {block.text}
        </blockquote>
      );
    case "list":
      return (
        <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14, maxWidth: "64ch" }}>
          {block.items.map((it) => (
            <li key={it} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 17, lineHeight: 1.65, color: "var(--ink)" }}>
              <span style={{ flex: "none", color: "var(--clay)", marginTop: 3 }}><Icon name="check" size={18} /></span>
              {it}
            </li>
          ))}
        </ul>
      );
    case "cta":
      return (
        <p style={{ margin: "8px 0 28px" }}>
          <Link to={block.to} className="btn btn-clay" style={{ display: "inline-flex" }}>{block.text}</Link>
        </p>
      );
  }
}

export function Article() {
  const { slug } = useParams();
  const { t, dir } = useLang();
  const article = t.data.articles.find((a) => a.slug === slug);
  const post = article ? undefined : blogPosts.find((b) => b.slug === slug);
  if (!article && !post) return <Navigate to="/insights" replace />;

  const view = article
    ? { category: article.category, title: article.title, dek: article.dek, date: article.date, read: article.read as string | undefined, cover: undefined as string | undefined, blocks: article.blocks }
    : { category: t.insights.fromBlog, title: post!.title, dek: post!.excerpt, date: post!.date, read: undefined as string | undefined, cover: post!.cover, blocks: toBlocks(post!.body) };

  // Related reading: the same curated-then-imported ordering the Insights list
  // uses, minus the current piece. These internal links keep readers (and
  // crawlers) moving between articles instead of dead-ending after one.
  const related = [
    ...t.data.articles.map((a) => ({ slug: a.slug, title: a.title })),
    ...blogMeta.map((b) => ({ slug: b.slug, title: b.title })),
  ].filter((a) => a.slug !== slug).slice(0, 3);

  // schema.org datePublished must be ISO 8601. The visible date stays the
  // human string; the structured-data field gets a parsed ISO date, or is
  // omitted when the string cannot be parsed.
  const datePublished = toIsoDate(view.date);

  return (
    <>
      <PageMeta
        title={`${view.title} · LALUM`}
        description={view.dek}
        image={view.cover}
        path={`/insights/${slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BlogPosting",
              headline: view.title,
              description: view.dek,
              ...(datePublished ? { datePublished } : {}),
              // Person author (stronger E-E-A-T than an Organization author),
              // linked by @id to the verified founder node in index.html's graph
              // so the two JSON-LD blocks resolve to one identity. Real name and
              // profile only; no invented author or links.
              author: {
                "@type": "Person",
                "@id": "https://lalumapp.com/#founder",
                name: "Dr. Avraham Lalum",
                url: "https://lalumapp.com/",
                sameAs: ["https://www.linkedin.com/in/dr-avraham-lalum-ab833929/"],
              },
              publisher: {
                "@type": "Organization",
                name: "LALUM",
                logo: { "@type": "ImageObject", url: "https://lalumapp.com/icon-512.png" },
              },
              mainEntityOfPage: `https://lalumapp.com/insights/${slug}/`,
              image: view.cover || "https://lalumapp.com/og-card-v2.png",
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://lalumapp.com/" },
                { "@type": "ListItem", position: 2, name: "Insights", item: "https://lalumapp.com/insights/" },
                { "@type": "ListItem", position: 3, name: view.title, item: `https://lalumapp.com/insights/${slug}/` },
              ],
            },
          ],
        }}
      />
      <div className="wrap" style={{ maxWidth: 760, padding: "64px 32px 0" }}>
        <Link to="/insights" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>
          <span style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)" }}><Icon name={dir === "rtl" ? "chevron-r" : "chevron-l"} size={16} /></span>
          {t.ui.article.allArticles}
        </Link>
        <div style={{ marginTop: 24, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--clay)", fontWeight: 600 }}>{view.category}</div>
        <h1 className="serif" style={{ fontSize: 46, lineHeight: 1.12, letterSpacing: "-0.01em", margin: "14px 0 20px" }}>{view.title}</h1>
        <p style={{ fontSize: 20, lineHeight: 1.55, color: "var(--slate)", fontFamily: "var(--serif)", margin: "0 0 24px" }}>{view.dek}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--slate)", paddingBottom: 28, borderBottom: "1px solid var(--line)" }}>
          <span>{t.ui.article.by}</span><span style={{ color: "var(--clay)" }}>·</span>
          <span>{view.date}</span>{view.read ? <><span style={{ color: "var(--clay)" }}>·</span><span>{view.read}</span></> : null}
        </div>
      </div>

      {view.cover && (
        <div className="wrap" style={{ maxWidth: 760, padding: "28px 32px 0" }}>
          <img src={view.cover} alt={view.title} decoding="async" style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid var(--line)", display: "block" }} />
        </div>
      )}

      <article className="wrap" style={{ maxWidth: 760, padding: "36px 32px 24px" }}>
        {view.blocks.map((b, i) => <Block key={i} block={b} />)}
      </article>

      <div className="wrap" style={{ maxWidth: 760, padding: "16px 32px 64px" }}>
        <div style={{ background: "var(--clay-tint)", border: "1px solid var(--clay-soft)", borderRadius: 14, padding: 30, display: "flex", gap: 22, alignItems: "center" }}>
          <div style={{ flex: "none", width: 72, height: 72, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--clay-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--clay)" }} dir="ltr">AL</span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 500 }}>{t.home.founderName}</div>
            <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>{t.ui.article.seal}</div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section-line">
          <div className="wrap" style={{ maxWidth: 760, padding: "48px 32px 8px" }}>
            <p className="eyebrow" style={{ textAlign: "center" }}>{t.ui.article.moreArticles}</p>
            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/insights/${r.slug}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px", color: "var(--ink)", textDecoration: "none" }}
                >
                  <span className="serif" style={{ fontSize: 17, lineHeight: 1.4 }}>{r.title}</span>
                  <span style={{ flex: "none", color: "var(--clay)" }} aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-line">
        <div className="wrap" style={{ maxWidth: 760, padding: "56px 32px", textAlign: "center" }}>
          <p className="eyebrow">{t.ui.article.keepReading}</p>
          <h2 className="serif" style={{ fontSize: 30, lineHeight: 1.2, margin: "0 0 24px" }}>{t.ui.article.keepReadingHead}</h2>
          <Link to="/book" className="btn btn-clay" style={{ display: "inline-flex" }}>{t.ui.bookPage.navCta}</Link>
        </div>
      </section>
    </>
  );
}
