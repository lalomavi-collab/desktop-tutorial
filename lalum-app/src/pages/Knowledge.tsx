import type { CSSProperties } from "react";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";
import { externalLinks } from "../lib/content";
import { OPEN_GUIDE_EVENT } from "../components/UserGuide";

// Central knowledge hub. For now Q&A and Articles link out to the firm site
// (www.lalum.co); as the content is uploaded into the app, only the hrefs here
// need to change, the layout stays. Guides open the in-app UserGuide.
const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: 28,
  color: "inherit",
  textAlign: "start",
  cursor: "pointer",
  font: "inherit",
  width: "100%",
};

const ctaRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "var(--clay)",
  fontWeight: 600,
  fontSize: 14,
};

export function Knowledge() {
  const { t } = useLang();
  const k = t.knowledge;

  const links: { icon: string; title: string; body: string; cta: string; href: string }[] = [
    { icon: "search", title: k.qaTitle, body: k.qaBody, cta: k.qaCta, href: externalLinks.qa },
    { icon: "book", title: k.articlesTitle, body: k.articlesBody, cta: k.articlesCta, href: externalLinks.articles },
  ];

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 40px", textAlign: "center" }}>
          <span className="pill">{k.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
            {k.title}
          </h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{k.sub}</p>
        </div>
      </section>

      {/* HUB CARDS */}
      <section className="wrap" style={{ paddingBottom: 24 }}>
        <div className="grid grid-3">
          {links.map((c) => (
            <a key={c.title} href={c.href} target="_blank" rel="noopener noreferrer" style={cardStyle}>
              <span className="icon-badge"><Icon name={c.icon} size={20} /></span>
              <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{c.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: 0, flex: 1 }}>{c.body}</p>
              <span style={ctaRow}>{c.cta} <Icon name="chevron-l" size={15} /></span>
            </a>
          ))}
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))} style={cardStyle}>
            <span className="icon-badge"><Icon name="compass" size={20} /></span>
            <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{k.guidesTitle}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: 0, flex: 1 }}>{k.guidesBody}</p>
            <span style={ctaRow}>{k.guidesCta} <Icon name="chevron-l" size={15} /></span>
          </button>
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: 22, fontSize: 13 }}>{k.note}</p>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
