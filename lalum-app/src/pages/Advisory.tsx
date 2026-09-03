import { Link } from "../components/AppLink";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { AmbientBackground } from "../components/AmbientBackground";
import { PageMeta } from "../components/PageMeta";
import { PreDealStrategy } from "../components/PreDealStrategy";
import { PracticeAreas } from "../components/PracticeAreas";
import { MnaSpotlight } from "../components/MnaSpotlight";
import { Capabilities } from "../components/Capabilities";
import { PracticeHub } from "../components/PracticeHub";
import { FocusAreas } from "../components/FocusAreas";
import { PracticeFaq } from "../components/PracticeFaq";
import { ScenarioCard } from "../components/ScenarioCard";
import { faqPageNode, pageJsonLd } from "../lib/schema";
import { faqsForPath } from "../lib/pageFaqs";
import { howToForPath } from "../lib/pageHowTos";
import { useLang } from "../context/LangContext";

export function Advisory() {
  const { t } = useLang();
  const a = t.advisory;

  return (
    <>
      <PageMeta title={t.seo.advisory.title} description={t.seo.advisory.desc} path="/advisory" jsonLd={pageJsonLd([faqPageNode(faqsForPath(t, "/advisory")), howToForPath(t, "/advisory")])} />
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <AmbientBackground />
        <div className="wrap" style={{ position: "relative", zIndex: 1, maxWidth: 1000, padding: "96px 32px 80px", textAlign: "center" }}>
          <span className="pill">{a.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(32px, 8vw, 56px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "18ch" }}>
            {a.heroH1a} <span className="italic-clay">{a.heroH1b}</span>
          </h1>
          <p className="lede" style={{ maxWidth: "60ch", margin: "26px auto 36px" }}>{a.heroLede}</p>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-clay">{t.ui.bookPage.navCta}</Link>
            <a href="#mediation" className="btn btn-ghost">{a.heroCta2}</a>
          </div>
        </div>
      </section>

      {/* The two areas the practice leads with. The hub is what the top bar
          and the phone tab bar point at, so the pair has to be reachable from
          here and not only from the home page. */}
      <FocusAreas />

      {/* SERVICES */}
      <section id="services" className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "56ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow">{a.servicesEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>{a.servicesH2}</h2>
          </div>
          <div className="grid grid-2">
            {t.data.advisoryServices.map((s) => (
              <div key={s.title} className="card" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <span className="icon-badge" style={{ flex: "none", width: 48, height: 48 }}><Icon name={s.icon} size={24} /></span>
                <div>
                  <h3 className="h3" style={{ fontSize: 21, margin: "0 0 8px" }}>{s.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE LEGAL PRACTICE AREAS */}
      <PracticeAreas />

      {/* M&A spotlight: mergers and acquisitions as a headline practice */}
      <MnaSpotlight />

      {/* PRE-DEAL STRATEGY + interactive risk calculator */}
      <PreDealStrategy />

      {/* MEDIATION / DOM */}
      <section id="mediation" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="wrap section">
          <div style={{ maxWidth: "62ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>{a.mediationEyebrow}</p>
            <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 16px" }}>{a.mediationH2}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>{a.mediationP}</p>
          </div>
          <div className="grid grid-3">
            {t.data.domModules.map((m) => (
              <div key={m.title} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 16, padding: 32 }}>
                <span style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(193,95,60,.22)", color: "var(--clay-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={m.icon} size={24} />
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--paper)", margin: "20px 0 10px" }}>{m.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.66, color: "#C6C0B4", margin: 0 }}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPRESENTATIVE-SCENARIO HUB */}
      <PracticeHub />

      {/* TESTIMONIALS */}
      <section className="wrap section">
        <div style={{ maxWidth: "48ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{a.testimonialsEyebrow}</p>
          <h2 className="h2">{a.testimonialsH2}</h2>
        </div>
        <div className="grid grid-3">
          {t.data.testimonials.map((tm) => (
            <ScenarioCard key={tm.sector} s={tm} />
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="engagement" className="section-line">
        <div className="wrap section" style={{ maxWidth: 1000 }}>
          <div style={{ maxWidth: "56ch", margin: "0 auto 48px", textAlign: "center" }}>
            <p className="eyebrow">{a.engagementEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>{a.engagementH2}</h2>
          </div>
          <div className="grid grid-2">
            {t.data.plans.map((p) => (
              <div key={p.name} className="card" style={{ position: "relative", display: "flex", flexDirection: "column", borderColor: p.popular ? "var(--clay-soft)" : "var(--line)" }}>
                {p.popular && (
                  <span style={{ position: "absolute", top: -11, insetInlineEnd: 26, background: "var(--clay)", color: "var(--paper)", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 9999 }}>{a.mostPopular}</span>
                )}
                <h3 className="serif" style={{ fontSize: 27, fontWeight: 500, margin: "0 0 6px" }}>{p.name}</h3>
                <p style={{ fontSize: 15, color: "var(--slate)", margin: "0 0 6px" }}>{p.tagline}</p>
                <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 22px" }}>{p.best}</p>
                <div style={{ height: 1, background: "var(--line)", marginBottom: 22 }} />
                <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0, display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                  {p.features.map((feat) => (
                    <li key={feat} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "var(--ink)" }}>
                      <span style={{ color: "var(--clay)", flex: "none" }}><Icon name="check" size={18} /></span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/book" className="btn btn-clay" style={{ justifyContent: "center" }}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONSULTATION FORMAT. It sat on the home page, which meant the one place
          that explained how a meeting actually happens was the page a reader
          leaves first. It belongs beside the engagement plans. */}
      <section className="section-line">
        <div className="wrap" style={{ maxWidth: 720, padding: "64px 32px" }}>
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
              <span className="serif" style={{ fontSize: 20, lineHeight: 1.25 }}>{t.home.cardTitle}</span>
              <span style={{ flex: "none", fontSize: 12, color: "var(--clay)", fontWeight: 600, background: "var(--clay-tint)", padding: "4px 10px", borderRadius: 9999 }}>{t.home.advisoryBadge}</span>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: "16px 0 4px" }}>{t.home.advisoryIntro}</p>
            <div className="label" style={{ margin: "20px 0 12px" }}>{t.home.advisoryFormat}</div>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                <span className="icon-badge" style={{ width: 38, height: 38, borderRadius: 11, flex: "none" }}><Icon name="user" size={19} /></span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.home.advisoryInPersonTitle}</div>
                  <div style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.5 }}>{t.home.advisoryInPersonBody}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                <span className="icon-badge" style={{ width: 38, height: 38, borderRadius: 11, flex: "none" }}><Icon name="spark" size={19} /></span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.home.advisoryVirtualTitle}</div>
                  <div style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.5 }}>{t.home.advisoryVirtualBody}</div>
                </div>
              </div>
            </div>
            <Link to="/book" className="btn btn-clay" style={{ width: "100%", justifyContent: "center", marginTop: 22 }}>
              <Icon name="calendar" size={17} /> {t.home.advisoryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <Capabilities />

      {/* PRACTICE-AREA FAQ with FAQPage schema */}
      <PracticeFaq />

      <ContactCTA title={a.ctaTitle} body={a.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
