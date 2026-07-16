import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";

export function Advisory() {
  const { t } = useLang();
  const a = t.advisory;

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 1000, padding: "96px 32px 80px", textAlign: "center" }}>
          <span className="pill">{a.heroPill}</span>
          <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "18ch" }}>
            {a.heroH1a} <span className="italic-clay">{a.heroH1b}</span>
          </h1>
          <p className="lede" style={{ maxWidth: "60ch", margin: "26px auto 36px" }}>{a.heroLede}</p>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/portal" className="btn btn-clay">{t.ui.initiateRisk}</Link>
            <a href="#mediation" className="btn btn-ghost">{a.heroCta2}</a>
          </div>
        </div>
      </section>

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

      {/* TESTIMONIALS */}
      <section className="wrap section">
        <div style={{ maxWidth: "48ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{a.testimonialsEyebrow}</p>
          <h2 className="h2">{a.testimonialsH2}</h2>
        </div>
        <div className="grid grid-3">
          {t.data.testimonials.map((tm) => (
            <div key={tm.attr} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--clay)", opacity: 0.6 }}><Icon name="quote" size={26} /></span>
              <p style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.5, color: "var(--ink)", margin: "18px 0 24px", flex: 1 }}>{tm.quote}</p>
              <div style={{ height: 1, background: "var(--line)", marginBottom: 16 }} />
              <div style={{ fontSize: 13, color: "var(--slate)" }}>{tm.attr}</div>
            </div>
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
                <Link to="/portal" className="btn btn-clay" style={{ justifyContent: "center" }}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA title={a.ctaTitle} body={a.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
