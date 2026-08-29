import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { Icon } from "../components/Icon";
import { useLang } from "../context/LangContext";
import { pageNode, faqPageNode, pageJsonLd } from "../lib/schema";
import { faqsForPath } from "../lib/pageFaqs";
import { realEstatePillar as P } from "../lib/pillars";

export function RealEstateLegalAdvisory() {
  const { t } = useLang();
  const faqs = faqsForPath(t, "/real-estate-legal-advisory");
  const jsonLd = pageJsonLd([pageNode("WebPage", P.title, P.desc, P.url), faqPageNode(faqs)]);

  return (
    <>
      <PageMeta title={`${P.title} | LALUM`} description={P.desc} path="/real-estate-legal-advisory" jsonLd={jsonLd} />

      {/* HERO */}
      <section className="wrap section" style={{ maxWidth: 900, paddingTop: 72 }}>
        <p className="eyebrow">{P.heroEyebrow}</p>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
          {P.title}
        </h1>
        <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch" }}>{P.lede}        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> לתיאום פגישת אבחון</Link>
          <Link to="/advisory" className="btn btn-ghost">שירותי הייעוץ המלאים</Link>
        </div>
      </section>

      {/* WHAT WE COVER */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{P.coversEyebrow}</p>
          <h2 className="h2">{P.coversH2}</h2>
        </div>
        <div className="grid grid-2">
          {P.cards.map((p) => (
            <div key={p.title} className="card">
              <span className="icon-badge"><Icon name={p.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 21, margin: "18px 0 10px" }}>{p.title}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHEN A SECOND OPINION */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">{P.whenEyebrow}</p>
          <h2 className="h2">{P.whenH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{P.whenLede}          </p>
        </div>
        <div className="grid grid-2">
          {P.when.map((w) => (
            <div key={w} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--clay)", flexShrink: 0, marginTop: 2 }}><Icon name="check" size={18} /></span>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}>{w}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{P.stepsEyebrow}</p>
          <h2 className="h2">{P.stepsH2}</h2>
        </div>
        <div className="grid grid-3">
          {P.steps.map((s) => (
            <div key={s.n} className="card">
              <div style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--clay)", lineHeight: 1 }}>{s.n}</div>
              <h3 className="h3" style={{ fontSize: 20, margin: "14px 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RELATED READING (internal links) */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">{P.relatedEyebrow}</p>
          <h2 className="h2">{P.relatedH2}</h2>
        </div>
        <div className="grid grid-3">
          {P.related.map((r) => (
            <Link key={r.slug} to={`/insights/${r.slug}`} className="card" style={{ display: "block" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)" }}>מאמר</span>
              <h3 className="h3" style={{ fontSize: 18, margin: "10px 0 0", lineHeight: 1.35 }}>{r.title}</h3>
              <span className="card-go">קריאה &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ (feeds the FAQPage schema above) */}
      <section className="wrap section section-line" style={{ maxWidth: 820 }}>
        <div style={{ margin: "0 0 28px" }}>
          <p className="eyebrow">{P.faqEyebrow}</p>
          <h2 className="h2">{P.faqH2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faqs.map((f) => (
            <div key={f.q} className="card" style={{ padding: "20px 22px" }}>
              <h3 style={{ fontSize: 17.5, fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>{f.q}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <h2 className="serif" style={{ fontSize: "clamp(26px, 5.5vw, 36px)", lineHeight: 1.2, margin: "0 0 14px" }}>{P.ctaH2}        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "0 auto 24px", maxWidth: "52ch" }}>{P.ctaBody}        </p>
        <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> לתיאום פגישת אבחון</Link>
        <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 20 }}>{P.disclaimer}        </p>
      </section>
    </>
  );
}
