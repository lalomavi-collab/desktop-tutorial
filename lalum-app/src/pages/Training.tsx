import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { AmbientBackground } from "../components/AmbientBackground";
import { CourseSignup } from "../components/CourseSignup";
import { CourseCatalog } from "../components/CourseCatalog";
import { useLang } from "../context/LangContext";
import { trainingEmail } from "../lib/content";

// Warm accents and icons cycled across the delivery-format cards so the section
// reads with colour and variety instead of flat centred text.
const FMT_ACCENTS = [
  { c: "#a8482a", t: "#f3e7de" },
  { c: "#9a7328", t: "#f1e9d6" },
  { c: "#8a3f45", t: "#f3e4e4" },
];
const FMT_ICONS = ["gavel", "brain", "spark"];

export function Training() {
  const { t } = useLang();
  const tr = t.training;
  const location = useLocation();

  // When arriving with a #hash (e.g. the home "Explore Academy" CTA links to
  // /training#programs), scroll that section into view after the page renders.
  useEffect(() => {
    if (!location.hash) return;
    const el = document.querySelector(location.hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [location.hash]);

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <AmbientBackground />
        <div className="wrap" style={{ position: "relative", zIndex: 1, maxWidth: 1000, padding: "96px 32px 80px", textAlign: "center" }}>
          <span className="pill">{tr.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(32px, 8vw, 56px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "18ch" }}>
            {tr.heroH1a} <span className="italic-clay">{tr.heroH1b}</span>
          </h1>
          <p className="lede" style={{ maxWidth: "60ch", margin: "26px auto 36px" }}>{tr.heroLede}</p>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#course" className="btn btn-clay">{tr.heroCta1}</a>
            <a href="#curriculum" className="btn btn-ghost">{tr.heroCta2}</a>
          </div>
        </div>
      </section>

      {/* COURSE REGISTRATION (dark premium) */}
      <CourseSignup />

      {/* LALUM ACADEMY: flagship executive programs */}
      <CourseCatalog />

      {/* AUDIENCES */}
      <section className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "56ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow">{tr.audiencesEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>{tr.audiencesH2}</h2>
          </div>
          <div className="grid grid-2">
            {t.data.audiences.map((au) => (
              <div key={au.title} className="card" style={{ borderRadius: 18, padding: 40 }}>
                <span className="icon-badge" style={{ width: 52, height: 52, borderRadius: 13 }}><Icon name={au.icon} size={26} /></span>
                <h3 className="h3" style={{ fontSize: 25, margin: "22px 0 12px" }}>{au.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--slate)", margin: "0 0 20px" }}>{au.body}</p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                  {au.points.map((pt) => (
                    <li key={pt} style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 15, color: "var(--ink)" }}>
                      <span style={{ flex: "none", color: "var(--clay)", marginTop: 2 }}><Icon name="check" size={17} /></span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CURRICULUM */}
      <section id="curriculum" className="wrap section">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">{tr.curriculumEyebrow}</p>
          <h2 className="h2">{tr.curriculumH2}</h2>
        </div>
        <div className="grid grid-3">
          {t.data.trainingModules.map((m) => (
            <div key={m.title} className="card">
              <span className="icon-badge"><Icon name={m.icon} size={23} /></span>
              <h3 className="h3" style={{ fontSize: 21, margin: "20px 0 10px" }}>{m.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: 0 }}>{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FORMATS */}
      <section className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "56ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow">{tr.formatsEyebrow}</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>{tr.formatsH2}</h2>
          </div>
          <div className="grid grid-3">
            {t.data.formats.map((f, i) => {
              const acc = FMT_ACCENTS[i % FMT_ACCENTS.length];
              return (
                <div key={f.title} className="card" style={{ textAlign: "center", borderTop: `3px solid ${acc.c}` }}>
                  <div style={{ marginBottom: 14 }}>
                    <span className="icon-badge" style={{ background: acc.t, color: acc.c, width: 52, height: 52, borderRadius: 14 }}>
                      <Icon name={FMT_ICONS[i % FMT_ICONS.length]} size={26} />
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: acc.c, marginBottom: 6 }}>{f.meta}</div>
                  <h3 className="h3" style={{ fontSize: 22, margin: "0 0 8px" }}>{f.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: "0 auto", maxWidth: "34ch" }}>{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ContactCTA title={tr.ctaTitle} body={tr.ctaBody} primaryLabel={tr.ctaPrimary} email={trainingEmail} />
    </>
  );
}
