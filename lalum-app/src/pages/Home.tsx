import { useState } from "react";
import { Link } from "../components/AppLink";
import { Icon } from "../components/Icon";
import { PageMeta } from "../components/PageMeta";
import { AmbientBackground } from "../components/AmbientBackground";
import { HomeAcademy } from "../components/HomeAcademy";
import { FocusAreas } from "../components/FocusAreas";
import { ScenarioCard } from "../components/ScenarioCard";
import { faqPageNode, pageJsonLd } from "../lib/schema";
import { coreFaqsForPath } from "../lib/pageFaqsCore";
import { howToForPath } from "../lib/pageHowTos";
import { useLang } from "../context/LangContext";
import { cvPath } from "../lib/hreflang";
import { Wordmark } from "../components/Wordmark";
import { VoiceNote } from "../components/VoiceNote";
import { coverThumb } from "../lib/covers";
import { PillarArt } from "../components/PillarArt";
import { HeroVideo } from "../components/HeroVideo";
import { HomeFilm } from "../components/HomeFilm";
import { EngineVideo } from "../components/EngineVideo";
import { LeadForm } from "../components/LeadForm";
import { ArchitecturalSection } from "../components/ArchitecturalSection";
import { DecisionRoomPreview } from "../components/DecisionRoomPreview";
import { ClassifyCertifyDefendGrid } from "../components/ClassifyCertifyDefendGrid";
import { FwdArrow } from "../components/FwdArrow";

// One accent for the four cards: the site's own green. Four different edge
// colours on four cards read as four different products.
const INSIGHTS_PALETTE = [{ accent: "var(--clay)", tint: "var(--clay-tint)" }];
// The hero card carries the firm's own mark, not a personal portrait: a
// visitor's first view of the site should read as the practice, not as one
// person. The founder's own photo and story still appear, further down the
// page, in ABOUT and again in FOUNDER, which is where "about him" belongs.

export function Home() {
  const { t, lang } = useLang();
  const h = t.home;
  // The word "AI" is the point of the headline: it is set as a large mark above the rest of the
  // sentence (hero-ai in index.css). Only where the sentence opens with it; the text is unchanged.
  const [heroFirst, ...heroRest] = h.heroH1a.split(" ");
  const bigAi = heroFirst === "AI" || heroFirst === "IA";
  const [faqOpen, setFaqOpen] = useState<number>(-1);
  const [faqShown, setFaqShown] = useState(false);

  return (
    <>
      <PageMeta
        title={t.seo.home.title}
        description={t.seo.home.desc}
        path="/"
        jsonLd={pageJsonLd([faqPageNode(coreFaqsForPath(t, "/") ?? []), howToForPath(t, "/")])}
      />
      {/* HERO. One headline, two actions, one fact. The credential strip
          (frameworks by name), the search box (the header already has one) and
          the rotating second button used to sit here too: a first-time visitor
          met three acronyms and four calls to action before the first
          sentence had landed. What stays: book a consultation, check how Legal
          AI fits you, and a quiet way into the writing. The framework names
          live where they are explained, on the AI pages. */}
      <section className="hero-home" style={{ position: "relative", overflow: "hidden" }}>
        <AmbientBackground />
        <div className="wrap hero-grid" style={{ position: "relative", zIndex: 1, padding: "96px 32px 88px", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 64, alignItems: "center" }}>
          <div className="hero-copy">
            {/* One line and one action. The pill and the paragraph moved out of
                sight (the lede stays in the DOM for search engines and screen
                readers): the clip beside it now carries the explanation. */}
            <span className="sr-only">{h.heroPill}</span>
            <h1 className="h1 hero-h1" style={{ margin: 0 }}>
              {bigAi ? <><span className="hero-ai">{heroFirst}</span>{" "}{heroRest.join(" ")}</> : h.heroH1a}
              {" "}
              <span className="italic-clay">{h.heroH1b}</span>
            </h1>
            <p className="sr-only">{h.heroLede}</p>
            <div className="hero-actions" style={{ marginTop: 30 }}>
              <Link to="/book" className="btn btn-clay">{t.practice.riskCalc.cta}</Link>
              <Link to="/advisory" className="btn btn-outline">{h.heroCtaAi}</Link>
            </div>
          </div>

          {/* The clip sits where the brand panel used to: a silent loop on the
              two areas the practice leads with, AI and real estate. Decorative
              (the same message is in the headline and the cards below), so it
              is hidden from assistive tech and carries no controls. It is drawn
              in code and regenerated with scripts/hero-video.mjs; the poster is
              the AI scene, so the first paint is already on message. */}
          <HeroVideo />
        </div>
      </section>

      {/* The readiness check (the Decision Room, /risk): eight questions and a score. One band under the hero so a
          visitor can reach it without opening the menu. */}
      <div className="wrap" style={{ padding: "0 32px" }}>
        <div className="home-risk-band">
          <p>
            <b>{h.riskBandLead}</b>{" "}
            {h.riskBandBody}
          </p>
          <Link to="/risk" className="btn btn-clay">{h.riskBandCta}</Link>
        </div>
      </div>

      {/* The page speaks about Legal AI from the hero down to the engine. The
          second area (real estate and urban renewal) and the entry-by-role
          matrix follow lower, after the engine and the academy. */}
      <ArchitecturalSection id="why" index="01" code="CLASSIFY // CERTIFY // DEFEND">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">Legal AI</p>
          <h2 className="h2">{h.whyH2}</h2>
        </div>
        <ClassifyCertifyDefendGrid />
      </ArchitecturalSection>

      {/* The film: below the first section, never in the hero (the top of the page is Legal AI alone).
          Nothing but the poster loads until it is played. */}
      <section id="film" className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "58ch", margin: "0 0 36px" }}>
            <p className="eyebrow">{h.filmEyebrow}</p>
            <h2 className="h2">{h.filmH2}</h2>
            <p className="p" style={{ marginTop: 12 }}>{h.filmP}</p>
          </div>
          <div style={{ maxWidth: 960 }}>
            <HomeFilm />
          </div>
        </div>
      </section>

      {/* Privacy law explainer (Hebrew only, a separate page): below the film, never in the hero. */}
      {lang === "he" && (
        <section id="privacy-law" className="section-line band-tint">
          <div className="wrap section" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ maxWidth: "60ch" }}>
              <p className="eyebrow">AI ומשפט</p>
              <h2 className="h2">חוק הגנת הפרטיות אחרי תיקון 13</h2>
              <p className="p" style={{ marginTop: 12 }}>מדריך מנוסח החוק הישראלי, חוברת להורדה וסרטון הסבר: מה השתנה, מה זה אומר על עבודה עם בינה מלאכותית, ומה כדאי לבדוק בארגון.</p>
            </div>
            <Link to="/privacy-law" className="btn btn-clay">למדריך, לחוברת ולסרטון</Link>
          </div>
        </section>
      )}

      {/* Order: services (areas, then the AI layer), proof (clients, then the writing), then the engine. */}
      {/* PRACTICE (AI + risk-governance pillars) */}
      <ArchitecturalSection id="practice" index="02" code="PRACTICE // AI LAYER">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">{h.pillarsEyebrow}</p>
          <h2 className="h2">{h.pillarsH2}</h2>
        </div>
        {/* Layers, not a grid of cards. The section is named for a layer, and
            six identical boxes said nothing of the sort: these are bands that
            stack, each with its own edge colour, so the six read as one system
            and the eye can run down them. */}
        <div className="pillar-grid">
          {t.data.pillars.map((p) => (
            <Link key={p.title} to="/advisory" className="pillar-card" aria-label={p.title}>
              <span className="pillar-mark" aria-hidden="true"><Icon name={p.icon} size={22} /></span>
              <span className="pillar-txt">
                <span className="pillar-line">
                  <h3 className="h3 pillar-title">{p.title}</h3>
                </span>
                <p className="pillar-body">{p.body}</p>
              </span>
              <span className="pillar-go" aria-hidden="true"><FwdArrow /></span>
            </Link>
          ))}
        </div>
      </ArchitecturalSection>

      {/* TESTIMONIALS: existing client proof, surfaced on the home page as an
          at-a-glance trust signal (previously only on the Advisory page). It
          carries the tint because below the dark engine chapter the page ran
          six pale sections in a row, and a reader crossed from the reasons to
          the proof to the founder with nothing marking any of the crossings. */}
      <section className="section-line band-tint">
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

      {/* INSIGHTS: graphic, clickable cards into the article library itself,
          rather than another paragraph describing it. AI & Law gets the
          whole section (the practice's primary focus area, per the firm's
          positioning): the four pieces are the firm's own curated,
          five-language thought-leadership set (t.data.articles), the same
          set /insights opens with, so every language shows real content
          here, not a Hebrew-only fallback. A short strip of real client
          questions (t.data.faqs) follows, each one opening straight to its
          answer in the FAQ section below instead of only naming that the
          FAQ exists. */}
      <ArchitecturalSection index="03" code="INSIGHTS // LIBRARY">
      <div className="home-insights">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{h.insightsEyebrow}</p>
          <h2 className="h2">{h.insightsH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{h.insightsLede}</p>
        </div>
        <div className="grid grid-4">
          {t.data.articles.slice(0, 4).map((a, i) => {
            const p = INSIGHTS_PALETTE[i % INSIGHTS_PALETTE.length];
            return (
              <Link key={a.slug} to={`/insights/${a.slug}`} className="article-card" style={{ borderTop: `3px solid ${p.accent}` }}>
                <div className="article-card-head article-card-head-img">
                  <img src={coverThumb(a.slug)} alt="" width={1200} height={630} loading="lazy" decoding="async" />
                  <span className="article-card-cat" style={{ color: p.accent, borderColor: p.accent }}>{a.category}</span>
                </div>
                <div className="article-card-body">
                  <h3 className="serif article-card-title">{a.title}</h3>
                  <p className="article-card-dek">{a.dek}</p>
                  <div className="article-card-meta">
                    <span>{a.date}</span><span style={{ color: p.accent }}>·</span><span>{a.read}</span>
                    <span className="article-card-go" style={{ color: p.accent }}>{t.ui.article.read} <FwdArrow /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", margin: "36px 0 0" }}>
          <Link to="/insights" className="btn btn-clay">{h.insightsCtaAll}</Link>
        </div>
      </div>
      </ArchitecturalSection>

      {/* ENGINE */}
      {/* A decision lattice drifts behind "the engine", literally what the
          section names, so the dark panel is no longer a flat block. It sits
          on z-index 0 behind the content (z-index 1) and freezes under
          prefers-reduced-motion, same as the hero backdrop. */}
      <section id="engine" style={{ background: "var(--ink)", color: "var(--paper)", position: "relative", overflow: "hidden" }}>
        <AmbientBackground variant="lattice" />
        <div style={{ position: "relative", zIndex: 1 }}>
        <ArchitecturalSection index="04" code="ENGINE // DECISION ROOM" status="PREVIEW">
          <div style={{ maxWidth: "62ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--clay-bright)" }}>{h.engineEyebrow}</p>
            <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 16px" }}>{h.engineH2}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>{h.engineP}</p>
            {/* Names what "Engine" is made of, the same way the FocusAreas
                cards and the Clinic hero now do: a quiet capability line, not
                another sentence about the same thing. */}
            <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.01em", color: "var(--clay-bright)", margin: "14px 0 0" }}>{h.engineTagline}</p>
          </div>
          {/* The Engine's claim shown as a mechanism: one document through five
              stations, stopping only where a lawyer decides. */}
          <div style={{ margin: "0 0 56px" }}>
            <DecisionRoomPreview />
          </div>
          <EngineVideo />
        </ArchitecturalSection>
        </div>
      </section>

      {/* LALUM ACADEMY promo band */}
      <HomeAcademy />

      {/* The second area and the entry-by-role matrix, lower on the page. */}
      <FocusAreas />

      {/* Entry by role (four tabs and a list of links) is navigation, not proof:
          it lives on /advisory, the hub the nav already points at. */}

      {/* FOUNDER */}
      <ArchitecturalSection index="05" code="PROFILE // FOUNDER">
        <div className="founder-grid" style={{ display: "grid", gridTemplateColumns: ".82fr 1.18fr", gap: 56, alignItems: "start" }}>
          <div className="founder-card" style={{ background: "var(--clay-tint)", border: "1px solid var(--clay-soft)", borderRadius: 20, padding: 40, textAlign: "center", position: "sticky", top: 96 }}>
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
            <a href={cvPath(lang)} target="_blank" rel="noopener noreferrer" className="btn btn-clay btn-sm" style={{ justifyContent: "center", width: "100%", marginTop: 20 }}>
              <Icon name="file" size={16} /> {h.founderCv}
            </a>
          </div>
          <div>
            {/* Same decorative-art treatment as the ABOUT section above, in
                place of the founder's own clip: neither this section nor the
                hero carries a personal photo or video now, so the page
                reads as the practice throughout, not as one person. */}
            <aside className="pillar-hero-art home-founder-art" style={{ margin: "0 0 28px" }}>
              <PillarArt theme="knowledge" />
            </aside>
            <p className="eyebrow">{h.storyEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 36, lineHeight: 1.22, letterSpacing: "-0.015em", margin: "0 0 20px" }}>{h.storyH2}</h2>
            {/* Same two paragraphs as before, in the same panel treatment as
                the About section above, so the founder's story reads as a
                module beside the info card rather than bare text filling
                the column. */}
            <div className="prose-panel" style={{ padding: "32px 36px" }}>
              <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 16px" }}>{h.storyP1}</p>
              <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{h.storyP2}</p>
            </div>
          </div>
        </div>
      </ArchitecturalSection>

      {/* LEAD: the consent form that used to live only in the signed-in chat
          panel, now open on the page, right before the questions, where a
          visitor who has read this far is ready to leave a contact. Same
          component, same server function, same consent record. */}
      <section className="section-line band-tint">
        <div className="wrap section lead-band">
          <div className="lead-card">
            <LeadForm startOpen source="site" />
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

      {/* No closing band: the open lead form above and the founder band in the
          footer already carry the contact actions, and a third ask under a
          different name only competed with them. */}
    </>
  );
}
