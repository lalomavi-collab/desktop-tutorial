import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";
import { blogPosts } from "../lib/blogPosts";

// A warm, brand-cohesive palette. Each article card takes the next accent so
// the grid reads as one family, gently varied, rather than a flat wall of
// identical clay cards. Pairs are {accent, tint} tuned to sit on the paper.
const PALETTE = [
  { accent: "#a8482a", tint: "#f6e6de" }, // clay
  { accent: "#9a7328", tint: "#f3ecd6" }, // ochre / gold
  { accent: "#8a3f45", tint: "#f3e3e4" }, // wine
  { accent: "#3f6f68", tint: "#e1ede9" }, // teal
  { accent: "#5a4f9a", tint: "#e8e5f3" }, // indigo
  { accent: "#41663f", tint: "#e5eede" }, // forest
  { accent: "#3a5a7a", tint: "#e2e9f1" }, // slate blue
];

type Card = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  date: string;
  read?: string;
  icon?: string;
  cover?: string;
};

export function Insights() {
  const { t } = useLang();
  const ins = t.insights;

  // The curated bilingual pieces lead, followed by every article imported from
  // the firm's blog (shown with its real cover image).
  const curated: Card[] = t.data.articles.map((a) => ({
    slug: a.slug, title: a.title, dek: a.dek, category: a.category, date: a.date, read: a.read, icon: a.icon,
  }));
  const imported: Card[] = blogPosts.map((b) => ({
    slug: b.slug, title: b.title, dek: b.excerpt, category: t.insights.fromBlog, date: b.date, cover: b.cover,
  }));
  const cards = [...curated, ...imported];

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 56px", textAlign: "center" }}>
          <span className="pill">{ins.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
            {ins.heroH1a} <span className="italic-clay">{ins.heroH1b}</span>
          </h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{ins.heroLede}</p>
        </div>
      </section>

      {/* GRID */}
      <section className="wrap" style={{ paddingBottom: "var(--sec)" }}>
        <div className="grid grid-3">
          {cards.map((c, i) => {
            const p = PALETTE[i % PALETTE.length];
            return (
              <Link key={c.slug} to={`/insights/${c.slug}`} className="article-card" style={{ borderTop: `3px solid ${p.accent}`, animationDelay: `${i * 60}ms` }}>
                {c.cover ? (
                  <div className="article-card-head article-card-head-img">
                    <img src={c.cover} alt="" loading="lazy" />
                    <span className="article-card-cat" style={{ color: p.accent, borderColor: p.accent }}>{c.category}</span>
                  </div>
                ) : (
                  <div className="article-card-head" style={{ background: `linear-gradient(140deg, ${p.tint} 0%, var(--card) 100%)` }}>
                    <span className="article-card-icon" style={{ color: p.accent, borderColor: p.tint }}>
                      <Icon name={c.icon ?? "book"} size={30} />
                    </span>
                    <span className="article-card-cat" style={{ color: p.accent, borderColor: p.accent }}>{c.category}</span>
                  </div>
                )}
                <div className="article-card-body">
                  <h3 className="serif article-card-title">{c.title}</h3>
                  <p className="article-card-dek">{c.dek}</p>
                  <div className="article-card-meta">
                    <span>{c.date}</span>{c.read ? <><span style={{ color: p.accent }}>·</span><span>{c.read}</span></> : null}
                    <span className="article-card-go" style={{ color: p.accent }}>{t.ui.article.read} &rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <ContactCTA title={ins.ctaTitle} body={ins.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
