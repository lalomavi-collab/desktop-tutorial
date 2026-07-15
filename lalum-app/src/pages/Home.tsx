import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { heroRows, pillars, frameworks, why, faqs } from "../lib/content";

export function Home() {
  const [faqOpen, setFaqOpen] = useState<number>(-1);

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div
          className="wrap"
          style={{
            padding: "100px 32px 92px",
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div>
            <span className="pill">Code · Law · Economics</span>
            <h1 className="h1" style={{ margin: "26px 0 0", maxWidth: "16ch" }}>
              Your breakthrough. <span className="italic-clay">Our legal architecture.</span>
            </h1>
            <p className="lede" style={{ maxWidth: "52ch", margin: "26px 0 34px" }}>
              Legal, technological, and economic counsel for startups and breakthrough companies. We navigate the risks of
              tomorrow and engineer the competitive advantage of today.
            </p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link to="/portal" className="btn btn-clay">Initiate a risk assessment</Link>
              <a href="#practice" className="btn btn-ghost">See what we do →</a>
            </div>
            <div style={{ marginTop: 46, display: "flex", gap: 34, flexWrap: "wrap", color: "var(--slate)", fontSize: 14 }}>
              <span><strong style={{ color: "var(--ink)" }}>1-hour</strong> response</span>
              <span><strong style={{ color: "var(--ink)" }}>20+ years</strong> in high-stakes practice</span>
              <span><strong style={{ color: "var(--ink)" }}>Defensible</strong> by design</span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 30, boxShadow: "0 30px 60px -34px rgba(60,45,30,.35)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 19 }}>Tech-Legal &amp; Strategic Advisory</span>
                <span style={{ fontSize: 12, color: "var(--clay)", fontWeight: 600, background: "var(--clay-tint)", padding: "4px 10px", borderRadius: 9999 }}>Live</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                {heroRows.map((r) => (
                  <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 15, padding: "15px 0", borderBottom: "1px solid var(--line)" }}>
                    <span className="icon-badge" style={{ width: 36, height: 36, borderRadius: 10, flex: "none" }}>
                      <Icon name={r.icon} size={19} />
                    </span>
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

      {/* ABOUT / PHILOSOPHY */}
      <section className="section-line">
        <div className="wrap section" style={{ maxWidth: 900, textAlign: "center" }}>
          <p className="eyebrow">Our positioning</p>
          <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em", margin: "0 0 26px" }}>
            We don't just interpret the law. <span className="italic-clay">We design the technology beneath it.</span>
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto 18px", maxWidth: "70ch" }}>
            Most law firms advise on regulation without reading a single line of code. Most AI engineers build systems without
            understanding their IP exposure or their legality. We bridge that gap.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: "var(--slate)", margin: "0 auto", maxWidth: "70ch" }}>
            We provide an absolute Tech-Legal envelope: full legal counsel, protected deployment of AI platforms inside your
            organization, and professional training for leadership and development teams. We build the technological, economic,
            and legal infrastructure that lets you move fast, legal, and safe.
          </p>
        </div>
      </section>

      {/* PRACTICE */}
      <section id="practice" className="wrap section">
        <div style={{ maxWidth: "58ch", margin: "0 0 52px" }}>
          <p className="eyebrow">Our pillars</p>
          <h2 className="h2">Three pillars of the engagement</h2>
        </div>
        <div className="grid grid-3">
          {pillars.map((p) => (
            <div key={p.title} className="card">
              <span className="icon-badge"><Icon name={p.icon} size={23} /></span>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)", margin: "20px 0 6px" }} dir="ltr">{p.tag}</div>
              <h3 className="h3" style={{ fontSize: 23, margin: "0 0 12px", lineHeight: 1.25 }}>{p.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE ENGINE */}
      <section id="engine" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="wrap section">
          <div style={{ maxWidth: "62ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>The Tech-Legal envelope</p>
            <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 16px" }}>We embed inside your organization</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: 0 }}>
              Beyond advice: we deploy protected AI, wire in continuous governance, and train the people who run it, so you move
              fast, legal, and safe.
            </p>
          </div>
          <div className="grid grid-3">
            {frameworks.map((f) => (
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
          <p className="eyebrow">Why LALUM</p>
          <h2 className="h2">A firm and an AI lab, under one roof</h2>
        </div>
        <div className="grid grid-4">
          {why.map((w) => (
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
        <div className="wrap section" style={{ display: "grid", gridTemplateColumns: ".82fr 1.18fr", gap: 56, alignItems: "center" }}>
          <div style={{ background: "var(--clay-tint)", border: "1px solid var(--clay-soft)", borderRadius: 20, padding: 48, textAlign: "center" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 20px", borderRadius: "50%", background: "var(--card)", border: "1px solid var(--clay-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--clay)" }}>AL</span>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500 }}>Dr. Avraham Lalum</div>
            <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 6, lineHeight: 1.55 }}>
              Attorney &amp; Notary · Ph.D. Law &amp; Economics<br />Head of AI, Lalum.
            </div>
          </div>
          <div>
            <p className="eyebrow">Our story</p>
            <h2 className="serif" style={{ fontSize: 36, lineHeight: 1.22, letterSpacing: "-0.015em", margin: "0 0 20px" }}>
              Judgment where code, law, and economics meet
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 16px" }}>
              Over two decades in high-stakes real estate and contract governance, and increasingly in the algorithms now shaping
              legal reasoning, one pattern kept repeating: brilliant judgment buried under work no lawyer should be doing by hand.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>
              So we automated everything that doesn't require a law degree. What's left is pure lawyer work: strategy, judgment,
              and the decisions that carry real exposure, kept structured, monitored, and defensible by the DOM, RECIR, and SRME
              frameworks.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="wrap section" style={{ maxWidth: 820 }}>
        <div style={{ textAlign: "center", margin: "0 0 32px" }}>
          <p className="eyebrow">FAQ</p>
          <h2 className="serif" style={{ fontSize: 38, lineHeight: 1.15, letterSpacing: "-0.015em" }}>
            Navigating the <span className="italic-clay">Tech-Legal Convergence</span>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((f, i) => {
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
                {open && (
                  <div style={{ padding: "0 26px 24px", fontSize: 16, lineHeight: 1.72, color: "var(--slate)", maxWidth: "66ch" }}>{f.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ContactCTA
        title="Ready to begin?"
        body="Your goal is clear. Now is the time to give it the right infrastructure."
      />
    </>
  );
}
