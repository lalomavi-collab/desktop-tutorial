import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";

export function Insights() {
  const { t } = useLang();
  const ins = t.insights;

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 56px", textAlign: "center" }}>
          <span className="pill">{ins.heroPill}</span>
          <h1 className="serif" style={{ fontSize: 54, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
            {ins.heroH1a} <span className="italic-clay">{ins.heroH1b}</span>
          </h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{ins.heroLede}</p>
        </div>
      </section>

      {/* GRID */}
      <section className="wrap" style={{ paddingBottom: "var(--sec)" }}>
        <div className="grid grid-3">
          {t.data.articles.map((art) => (
            <Link key={art.slug} to={`/insights/${art.slug}`} style={{ display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", color: "inherit" }}>
              <div style={{ height: 150, position: "relative", background: "var(--clay-tint)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <span style={{ color: "var(--clay)" }}><Icon name={art.icon} size={40} /></span>
                <span style={{ position: "absolute", top: 14, insetInlineEnd: 14, fontSize: 11, color: "var(--clay)", background: "var(--paper)", border: "1px solid var(--clay-soft)", padding: "4px 12px", borderRadius: 9999 }}>{art.category}</span>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.35, margin: "0 0 10px" }}>{art.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: "0 0 20px", flex: 1 }}>{art.dek}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--slate)" }}>
                  <span>{art.date}</span><span style={{ color: "var(--clay)" }}>·</span><span>{art.read}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ContactCTA title={ins.ctaTitle} body={ins.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
