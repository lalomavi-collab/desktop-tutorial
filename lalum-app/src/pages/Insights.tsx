import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";

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

export function Insights() {
  const { t } = useLang();
  const ins = t.insights;

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
          {t.data.articles.map((art, i) => {
            const p = PALETTE[i % PALETTE.length];
            return (
              <Link key={art.slug} to={`/insights/${art.slug}`} className="article-card" style={{ borderTop: `3px solid ${p.accent}` }}>
                <div className="article-card-head" style={{ background: `linear-gradient(140deg, ${p.tint} 0%, var(--card) 100%)` }}>
                  <span className="article-card-icon" style={{ color: p.accent, borderColor: p.tint }}>
                    <Icon name={art.icon} size={30} />
                  </span>
                  <span className="article-card-cat" style={{ color: p.accent, borderColor: p.accent }}>{art.category}</span>
                </div>
                <div className="article-card-body">
                  <h3 className="serif article-card-title">{art.title}</h3>
                  <p className="article-card-dek">{art.dek}</p>
                  <div className="article-card-meta">
                    <span>{art.date}</span><span style={{ color: p.accent }}>·</span><span>{art.read}</span>
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
