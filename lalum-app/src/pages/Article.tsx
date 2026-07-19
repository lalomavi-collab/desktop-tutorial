import { Link, useParams, Navigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useLang } from "../context/LangContext";
import type { ArticleBlock } from "../lib/content";

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
  }
}

export function Article() {
  const { slug } = useParams();
  const { t, dir } = useLang();
  const article = t.data.articles.find((a) => a.slug === slug);
  if (!article) return <Navigate to="/insights" replace />;

  return (
    <>
      <div className="wrap" style={{ maxWidth: 760, padding: "64px 32px 0" }}>
        <Link to="/insights" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>
          <span style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)" }}><Icon name={dir === "rtl" ? "chevron-r" : "chevron-l"} size={16} /></span>
          {t.ui.article.allArticles}
        </Link>
        <div style={{ marginTop: 24, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--clay)", fontWeight: 600 }}>{article.category}</div>
        <h1 className="serif" style={{ fontSize: 46, lineHeight: 1.12, letterSpacing: "-0.01em", margin: "14px 0 20px" }}>{article.title}</h1>
        <p style={{ fontSize: 20, lineHeight: 1.55, color: "var(--slate)", fontFamily: "var(--serif)", margin: "0 0 24px" }}>{article.dek}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--slate)", paddingBottom: 28, borderBottom: "1px solid var(--line)" }}>
          <span>{t.ui.article.by}</span><span style={{ color: "var(--clay)" }}>·</span>
          <span>{article.date}</span><span style={{ color: "var(--clay)" }}>·</span>
          <span>{article.read}</span>
        </div>
      </div>

      <article className="wrap" style={{ maxWidth: 760, padding: "36px 32px 24px" }}>
        {article.blocks.map((b, i) => <Block key={i} block={b} />)}
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
