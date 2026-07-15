import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { articles } from "../lib/content";

export function Insights() {
  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 56px", textAlign: "center" }}>
          <span className="pill">The Algorist Notes</span>
          <h1 className="serif" style={{ fontSize: 54, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
            On legal reasoning, <span className="italic-clay">machine memory, and defensibility.</span>
          </h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>
            Our continuing notes on what it takes to build judgment that holds up in front of a court.
          </p>
        </div>
      </section>

      {/* ARTICLE GRID */}
      <section className="wrap" style={{ paddingBottom: "var(--sec)" }}>
        <div className="grid grid-3">
          {articles.map((a) => (
            <Link
              key={a.slug}
              to={`/insights/${a.slug}`}
              style={{ display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", color: "inherit" }}
            >
              <div style={{ height: 150, position: "relative", background: "var(--clay-tint)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <span style={{ color: "var(--clay)" }}><Icon name={a.icon} size={40} /></span>
                <span style={{ position: "absolute", top: 14, insetInlineEnd: 14, fontSize: 11, color: "var(--clay)", background: "var(--paper)", border: "1px solid var(--clay-soft)", padding: "4px 12px", borderRadius: 9999 }}>{a.category}</span>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.35, margin: "0 0 10px" }}>{a.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: "0 0 20px", flex: 1 }}>{a.dek}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--slate)" }} dir="ltr">
                  <span>{a.date}</span><span style={{ color: "var(--clay)" }}>·</span><span>{a.read}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ContactCTA
        title="Bring the same rigor to your matters"
        body="Reading is good. Applying it to your own exposure is better. Start with a Tech-Legal Diagnostics session."
      />
    </>
  );
}
