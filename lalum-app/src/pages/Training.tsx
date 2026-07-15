import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { audiences, trainingModules, formats } from "../lib/content";

export function Training() {
  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 1000, padding: "96px 32px 80px", textAlign: "center" }}>
          <span className="pill">Professional Training</span>
          <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "18ch" }}>
            Train the people who <span className="italic-clay">build and decide.</span>
          </h1>
          <p className="lede" style={{ maxWidth: "60ch", margin: "26px auto 36px" }}>
            AI moves faster than any compliance memo. We give leadership and development teams the shared fluency to move fast
            without walking into legal, IP, or regulatory exposure: practical, role-specific, and grounded in real matters.
          </p>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:training@lalum.co" className="btn btn-clay">Design a program</a>
            <a href="#curriculum" className="btn btn-ghost">See the curriculum →</a>
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="section-line">
        <div className="wrap section">
          <div style={{ maxWidth: "56ch", margin: "0 auto 52px", textAlign: "center" }}>
            <p className="eyebrow">Who it's for</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>Two rooms, one shared language</h2>
          </div>
          <div className="grid grid-2">
            {audiences.map((a) => (
              <div key={a.title} className="card" style={{ borderRadius: 18, padding: 40 }}>
                <span className="icon-badge" style={{ width: 52, height: 52, borderRadius: 13 }}><Icon name={a.icon} size={26} /></span>
                <h3 className="h3" style={{ fontSize: 25, margin: "22px 0 12px" }}>{a.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--slate)", margin: "0 0 20px" }}>{a.body}</p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                  {a.points.map((pt) => (
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
          <p className="eyebrow">Curriculum</p>
          <h2 className="h2">Modules we assemble to fit you</h2>
        </div>
        <div className="grid grid-3">
          {trainingModules.map((m) => (
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
            <p className="eyebrow">Formats</p>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.18, letterSpacing: "-0.015em" }}>However your team learns best</h2>
          </div>
          <div className="grid grid-3">
            {formats.map((f) => (
              <div key={f.title} style={{ textAlign: "center", padding: 8 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--clay)", marginBottom: 6 }}>{f.meta}</div>
                <h3 className="h3" style={{ fontSize: 22, margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--slate)", margin: "0 auto", maxWidth: "34ch" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA
        title="Build fluency into your team"
        body="Tell us who's in the room and what they ship. We'll design a program around your real products and exposure."
        primaryLabel="Design a program"
        email="training@lalum.co"
      />
    </>
  );
}
