import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";

export function Home() {
  const { t } = useLang();
  const h = t.home;
  const [faqOpen, setFaqOpen] = useState<number>(-1);

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap hero-grid" style={{ padding: "100px 32px 92px", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 64, alignItems: "center" }}>
          <div>
            <span className="pill">{h.heroPill}</span>
            <h1 className="h1" style={{ margin: "26px 0 0", maxWidth: "16ch" }}>
              {h.heroH1a} <span className="italic-clay">{h.heroH1b}</span>
            </h1>
            <p className="lede" style={{ maxWidth: "52ch", margin: "26px 0 34px" }}>{h.heroLede}</p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link to="/book" className="btn btn-clay">{t.ui.bookPage.navCta}</Link>
              <a href="#practice" className="btn btn-ghost">{t.ui.seeWhatWeDo}</a>
            </div>
            <div style={{ marginTop: 46, display: "flex", gap: 34, flexWrap: "wrap", color: "var(--slate)", fontSize: 14 }}>
              <span><strong style={{ color: "var(--ink)" }}>{h.statResponseStrong}</strong> {h.statResponse}</span>
              <span><strong style={{ color: "var(--ink)" }}>{h.statYearsStrong}</strong> {h.statYears}</span>
              <span><strong style={{ color: "var(--ink)" }}>{h.statDefensibleStrong}</strong> {h.statDefensible}</span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 30, boxShadow: "0 30px 60px -34px rgba(60,45,30,.35)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 19 }}>{h.cardTitle}</span>
                <span style={{ fontSize: 12, color: "var(--clay)", fontWeight: 600, background: "var(--clay-tint)", padding: "4px 10px", borderRadius: 9999 }}>{h.cardLive}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                {t.data.heroRows.map((r) => (
                  <div key={r.tag} style={{ display: "flex", alignItems: "center", gap: 15, padding: "15px 0", borderBottom: "1px solid var(--line)" }}>
                    <span className="icon-badge" style={{ width: 36, height: 36, borderRadius: 10, flex: "none" }}><Icon name={r.icon} size={19} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{r.title}</div>
                      <div style={{ fontSize: 13, color: "var(--slate)" }}>{r.sub}</div>
                    </div>
                    <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--clay)" }} dir="ltr">{r.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section-line">
        <div className="wrap section" style={{ maxWidth: 900, textAlign: "center" }}>
          <p className="eyebrow">{h.aboutEyebrow}</p>
          <h2 className="serif" style={{ fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.18, letterSpacing: "-0.015em", margin: "0 0 26px" }}>
            {h.aboutH2a} <span className="italic-clay">{h.aboutH2b}</span>
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto 18px", maxWidth: "70ch" }}>{h.aboutP1}</p>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto", maxWidth: "70ch" }}>{h.aboutP2}</p>
        </div>
      </section>

      {/* PRACTICE */}
      <section id="practice" className="wrap section">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">{h.pillarsEyebrow}</p>
          <h2 className="h2">{h.pillarsH2}</h2>
        </div>
        <div className="grid grid-3">
          {t.data.pillars.map((p) => (
            <div key={p.title} className="card">
              <span className="icon-badge"><Icon name={p.icon} size={23} /></span>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)", margin: "20px 0 6px" }}>{p.tag}</div>
              <h3 className="h3" style={{ fontSize: 23, margin: "0 0 12px", lineHeight: 1.25 }}>{p.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{p.body}</p>
            </div>
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

      {/* FOUNDER */}
      <section className="section-line">
        <div className="wrap section founder-grid" style={{ display: "grid", gridTemplateColumns: ".82fr 1.18fr", gap: 56, alignItems: "center" }}>
          <div style={{ background: "var(--clay-tint)", border: "1px solid var(--clay-soft)", borderRadius: 20, padding: 48, textAlign: "center" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 20px", borderRadius: "50%", background: "var(--card)", border: "1px solid var(--clay-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--clay)" }} dir="ltr">AL</span>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500 }}>{h.founderName}</div>
            <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 6, lineHeight: 1.55 }}>{h.founderCreds1}<br />{h.founderCreds2}</div>
          </div>
          <div>
            <p className="eyebrow">{h.storyEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 36, lineHeight: 1.22, letterSpacing: "-0.015em", margin: "0 0 20px" }}>{h.storyH2}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 16px" }}>{h.storyP1}</p>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{h.storyP2}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="wrap section" style={{ maxWidth: 820 }}>
        <div style={{ textAlign: "center", margin: "0 0 32px" }}>
          <p className="eyebrow">{h.faqEyebrow}</p>
          <h2 className="serif" style={{ fontSize: "clamp(27px, 6vw, 38px)", lineHeight: 1.15, letterSpacing: "-0.015em" }}>
            {h.faqH2a} <span className="italic-clay">{h.faqH2b}</span>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {t.data.faqs.map((f, i) => {
            const open = faqOpen === i;
            return (
              <div key={f.q} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setFaqOpen(open ? -1 : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "22px 26px", background: "transparent", border: 0, cursor: "pointer", textAlign: "start", fontSize: 17, fontWeight: 500, color: "var(--ink)" }}
                >
                  {f.q}
                  <span style={{ flex: "none", color: "var(--clay)", fontSize: 22, transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform .2s ease" }}>+</span>
                </button>
                {open && <div style={{ padding: "0 26px 24px", fontSize: 16, lineHeight: 1.72, color: "var(--slate)", maxWidth: "66ch" }}>{f.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <ContactCTA title={h.ctaTitle} body={h.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
