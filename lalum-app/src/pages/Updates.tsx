import { Link } from "../components/AppLink";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { PillarArt } from "../components/PillarArt";
import { pageNode, pageJsonLd } from "../lib/schema";
import { useLang } from "../context/LangContext";
import { feed, KIND_LABEL, UPDATES_TITLE, UPDATES_DESC } from "../lib/ethics";

// What is new in AI and the law: the Bar's ethics opinions, rulings, and the
// regulatory developments around them, newest first. A single feed, so a reader
// who comes back tomorrow reads from the top until they reach what they saw.

export function Updates() {
  const { t } = useLang();
  const items = feed();

  return (
    <>
      <PageMeta title={UPDATES_TITLE} description={UPDATES_DESC} path="/updates" jsonLd={pageJsonLd([pageNode("CollectionPage", UPDATES_TITLE, UPDATES_DESC, "https://lalumapp.com/updates")])} />

      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap pillar-hero-layout" style={{ maxWidth: 1140, padding: "96px 32px 32px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <span className="pill">חדשנו</span>
            <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
              מה חדש ב-AI ובמשפט
            </h1>
            <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>
              פסיקה, גילויי דעת של הלשכה והתפתחויות רגולטוריות, מהחדש לישן.
            </p>
          </div>
          <aside className="pillar-hero-art"><PillarArt theme="clinic" /></aside>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 32 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((it) => (
            <article key={it.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "18px 22px", borderInlineStart: "3px solid var(--clay)" }}>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>{it.dateLabel} · {KIND_LABEL[it.kind]}</p>
              <h2 className="serif" style={{ fontSize: 19, fontWeight: 500, margin: "6px 0 0" }}>
                {it.external ? <a href={it.href} target="_blank" rel="noopener noreferrer">{it.title}</a> : <Link to={it.href}>{it.title}</Link>}
              </h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, margin: "8px 0 0" }}>{it.summary}</p>
            </article>
          ))}
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: "8px 0 0" }}>
            הרשימה מתעדכנת מדי יום. תמצית פסק דין נכתבה בידי המשרד ואינה תחליף לקריאתו במקור. אין באמור ייעוץ משפטי.
          </p>
        </div>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
