import { useState } from "react";
import { Link } from "../components/AppLink";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { AmbientBackground } from "../components/AmbientBackground";
import { SiteSearch } from "../components/SiteSearch";
import { HomeAcademy } from "../components/HomeAcademy";
import { FocusAreas } from "../components/FocusAreas";
import { LinkedInFeed } from "../components/LinkedInFeed";
import { ScenarioCard } from "../components/ScenarioCard";
import { AudiencePaths } from "../components/AudiencePaths";
import { officePhone, directPhone, personalLine } from "../lib/content";
import { faqPageNode, pageJsonLd } from "../lib/schema";
import { faqsForPath } from "../lib/pageFaqs";
import { howToForPath } from "../lib/pageHowTos";
import { useLang } from "../context/LangContext";
import { cvPath } from "../lib/hreflang";
import { Wordmark } from "../components/Wordmark";
import { RotatingCta } from "../components/RotatingCta";
import { VoiceNote } from "../components/VoiceNote";
// Imported so Vite emits a content-hashed filename: swapping the photo always
// busts any browser or CDN cache instead of serving a stale /founder.webp.
// WebP, resized to 944px (2x the on-page display width) for a sharp retina
// portrait at a fraction of the original JPEG weight.
import founderPhoto from "../assets/founder.webp";

export function Home() {
  const { t, lang } = useLang();
  const h = t.home;
  const [faqOpen, setFaqOpen] = useState<number>(-1);
  const [faqShown, setFaqShown] = useState(false);

  return (
    <>
      <PageMeta
        title={t.seo.home.title}
        description={t.seo.home.desc}
        path="/"
        jsonLd={pageJsonLd([faqPageNode(faqsForPath(t, "/")), howToForPath(t, "/")])}
      />
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <AmbientBackground />
        <div className="wrap hero-grid" style={{ position: "relative", zIndex: 1, padding: "100px 32px 92px", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 64, alignItems: "center" }}>
          <div>
            <span className="pill">{h.heroPill}</span>
            <h1 className="h1" style={{ margin: "26px 0 0", maxWidth: "16ch" }}>
              {h.heroH1a} <span className="italic-clay">{h.heroH1b}</span>
            </h1>
            <p className="lede" style={{ maxWidth: "52ch", margin: "26px 0 34px" }}>{h.heroLede}</p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link to="/book" className="btn btn-clay">{t.practice.riskCalc.cta}</Link>
              <RotatingCta to="/advisory" label={h.heroCtaAi} />
            </div>
            {/* Framework trust strip: an at-a-glance credibility signal, and the
                multi-framework positioning (EU AI Act, ISO/IEC 42001, NIST AI RMF)
                that the leading AI-governance advisories lead with. */}
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--clay)" }}>{h.frameworksLabel}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{h.heroCreds}</span>
            </div>
            <SiteSearch />
          </div>

          {/* Founder portrait, clickable, opens the full CV */}
          <a href={cvPath(lang)} target="_blank" rel="noopener noreferrer" className="founder-hero" aria-label={h.founderCv}>
            <img src={founderPhoto} alt={h.founderName} />
            <span className="founder-hero-cap">
              <span className="founder-hero-name">{h.founderName}</span>
              <span className="founder-hero-cv">{h.founderCv} &rarr;</span>
            </span>
          </a>
        </div>
      </section>

      {/* The router comes first, before any of the practice narrative: a visitor
          who knows who they are should not have to read the positioning to find
          the four entries written for them. */}
      <AudiencePaths />

      {/* The two areas the practice leads with. Shared with /advisory. */}
      <FocusAreas />

      {/* Positioning, then the risk pillars, then the engine. The practice
          areas, the deal work and the scenario hub used to sit here too, which
          made the front door twenty sections deep; they live on /advisory now,
          which is the page that exists to hold them. */}

      {/* ABOUT */}
      <section className="section-line">
        <div className="wrap section" style={{ maxWidth: 900, textAlign: "center" }}>
          <p className="eyebrow">{h.aboutEyebrow}</p>
          <h2 className="serif" style={{ fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.18, letterSpacing: "-0.015em", margin: "0 0 26px" }}>
            {h.aboutH2a} <span className="italic-clay">{h.aboutH2b}</span>
          </h2>
          {/* Centered to match the centered eyebrow and heading above. This block
              carries the `.section` class, so without an explicit center here the
              global `.section p` rule would justify the body (and fall back to
              right alignment on mobile), leaving a centered heading over a
              right-aligned body. Centering keeps the whole block aligned as one. */}
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto 18px", maxWidth: "62ch", textAlign: "center" }}>{h.aboutP1}</p>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto", maxWidth: "62ch", textAlign: "center" }}>{h.aboutP2}</p>
        </div>
      </section>

      {/* PRACTICE (AI + risk-governance pillars) */}
      <section id="practice" className="wrap section">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">{h.pillarsEyebrow}</p>
          <h2 className="h2">{h.pillarsH2}</h2>
        </div>
        {/* Layers, not a grid of cards. The section is named for a layer, and
            six identical boxes said nothing of the sort: these are bands that
            stack, each with its own edge colour, so the six read as one system
            and the eye can run down them. */}
        <div className="pillar-layers">
          {t.data.pillars.map((p) => (
            <Link key={p.title} to="/advisory" className="pillar-band" aria-label={p.title}>
              <span className="pillar-mark" aria-hidden="true"><Icon name={p.icon} size={20} /></span>
              <span className="pillar-txt">
                <span className="pillar-line">
                  <h3 className="h3 pillar-title">{p.title}</h3>
                  <span className="pillar-tag">{p.tag}</span>
                </span>
                <p className="pillar-body">{p.body}</p>
              </span>
              <span className="pillar-go" aria-hidden="true">&rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ENGINE */}
      <section id="engine" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="wrap section">
          <div style={{ maxWidth: "62ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>{h.engineEyebrow}</p>
            <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 16px" }}>{h.engineH2}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>{h.engineP}</p>
          </div>
          <div className="grid grid-3">
            {t.data.frameworks.map((f) => (
              <div key={f.code} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 16, padding: 32 }}>
                <span style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(193,95,60,.22)", color: "var(--clay-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={f.icon} size={24} />
                </span>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--clay-soft)", margin: "20px 0 4px" }} dir="ltr">{f.code}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--paper)", margin: "0 0 10px" }}>{f.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.66, color: "#C6C0B4", margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LALUM ACADEMY promo band */}
      <HomeAcademy />

      {/* WHY */}
      <section className="wrap section">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">{h.whyEyebrow}</p>
          <h2 className="h2">{h.whyH2}</h2>
        </div>
        <div className="grid grid-4">
          {t.data.why.map((w) => (
            <div key={w.title}>
              <span className="icon-badge" style={{ width: 44, height: 44, marginBottom: 16 }}><Icon name={w.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 19, margin: "0 0 8px" }}>{w.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.62, color: "var(--slate)", margin: 0 }}>{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS: existing client proof, surfaced on the home page as an
          at-a-glance trust signal (previously only on the Advisory page). */}
      <section className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
            <p className="eyebrow">{t.advisory.testimonialsEyebrow}</p>
            <h2 className="h2">{t.advisory.testimonialsH2}</h2>
          </div>
          <div className="grid grid-3">
            {t.data.testimonials.map((tm) => (
              <ScenarioCard key={tm.sector} s={tm} />
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="section-line">
        <div className="wrap section founder-grid" style={{ display: "grid", gridTemplateColumns: ".82fr 1.18fr", gap: 56, alignItems: "center" }}>
          <div style={{ background: "var(--clay-tint)", border: "1px solid var(--clay-soft)", borderRadius: 20, padding: 40, textAlign: "center" }}>
            {/* Firm logo (wordmark, tinted to the brand ink so it blends in) */}
            <Wordmark height={34} label={h.logoAlt} style={{ display: "block", height: "auto", maxWidth: "74%", margin: "0 auto 22px", opacity: 0.92 }} />
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500 }}>{h.founderName}</div>
            <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 6, lineHeight: 1.55 }}>{h.founderCreds1}<br />{h.founderCreds2}</div>
            <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.62, margin: "16px auto 0", maxWidth: "36ch" }}>{h.founderBio}</p>
            {/* The treatises. They sat in the CV page alone, which carried no
                structured data and was not in the sitemap, so the strongest
                credential the practice holds for urban renewal was invisible
                everywhere a reader or a crawler would look for it. */}
            <p style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6, margin: "10px auto 0", maxWidth: "36ch" }}>{h.founderWorks}</p>
            {/* His own voice, beside his own details. Nothing plays until it is
                asked to. */}
            <VoiceNote />
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--clay-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={`tel:${officePhone.tel}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14, color: "var(--ink)" }}>
                <span style={{ color: "var(--clay)", display: "inline-flex" }}><Icon name="phone" size={15} /></span>
                <span style={{ color: "var(--slate)" }}>{h.founderOffice}</span>
                <span dir="ltr" style={{ fontWeight: 600 }}>{officePhone.display}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", background: "var(--clay-tint)", borderRadius: 9999, padding: "2px 8px" }}>{t.ui.phoneAi}</span>
              </a>
              <a href={`tel:${personalLine.tel}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14, color: "var(--ink)" }}>
                <span style={{ color: "var(--clay)", display: "inline-flex" }}><Icon name="phone" size={15} /></span>
                <span style={{ color: "var(--slate)" }}>{h.founderPersonal}</span>
                <span dir="ltr" style={{ fontWeight: 600 }}>{personalLine.display}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", background: "var(--clay-tint)", borderRadius: 9999, padding: "2px 8px" }}>{t.ui.phonePersonal}</span>
              </a>
              <a href={`tel:${directPhone.tel}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14, color: "var(--ink)" }}>
                <span style={{ color: "var(--clay)", display: "inline-flex" }}><Icon name="phone" size={15} /></span>
                <span style={{ color: "var(--slate)" }}>{h.founderDirect}</span>
                <span dir="ltr" style={{ fontWeight: 600 }}>{directPhone.display}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", background: "var(--clay-tint)", borderRadius: 9999, padding: "2px 8px" }}>{t.ui.urgentOnly}</span>
              </a>
            </div>
            <a href={cvPath(lang)} target="_blank" rel="noopener noreferrer" className="btn btn-clay btn-sm" style={{ justifyContent: "center", width: "100%", marginTop: 20 }}>
              <Icon name="file" size={16} /> {h.founderCv}
            </a>
          </div>
          <div>
            <p className="eyebrow">{h.storyEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 36, lineHeight: 1.22, letterSpacing: "-0.015em", margin: "0 0 20px" }}>{h.storyH2}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 16px" }}>{h.storyP1}</p>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{h.storyP2}</p>
          </div>
        </div>
      </section>

      {/* FAQ (two levels: the section header reveals the questions; each question reveals its answer) */}
      <section id="faq" className="wrap section" style={{ maxWidth: 820 }}>
        <button type="button" className="faq-section-toggle" aria-expanded={faqShown} aria-controls="faq-list" onClick={() => setFaqShown((v) => !v)}>
          <p className="eyebrow" style={{ margin: "0 0 12px" }}>{h.faqEyebrow}</p>
          <h2 className="serif" style={{ fontSize: "clamp(27px, 6vw, 38px)", lineHeight: 1.15, letterSpacing: "-0.015em", margin: 0 }}>
            {h.faqH2a} <span className="italic-clay">{h.faqH2b}</span>
          </h2>
          <span className="faq-section-hint">
            <span>{faqShown ? h.faqHide : h.faqShow}</span>
            <span className={"faq-chevron" + (faqShown ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={16} /></span>
          </span>
        </button>
        {faqShown && (
        <div id="faq-list" className="faq-list" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
          {t.data.faqs.map((f, i) => {
            const open = faqOpen === i;
            const pid = `faq-panel-${i}`;
            const bid = `faq-btn-${i}`;
            return (
              <div key={f.q} className="faq-item">
                <button
                  id={bid}
                  type="button"
                  className="faq-q"
                  aria-expanded={open}
                  aria-controls={pid}
                  onClick={() => setFaqOpen(open ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <span className={"faq-chevron" + (open ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={18} /></span>
                </button>
                {open && (
                  <div id={pid} role="region" aria-labelledby={bid} className="faq-answer">{f.a}</div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </section>

      <LinkedInFeed />

      <ContactCTA title={h.ctaTitle} body={h.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
