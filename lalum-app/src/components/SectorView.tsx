import { Link } from "../components/AppLink";
import { PageMeta } from "../components/PageMeta";
import { Icon } from "../components/Icon";
import { pageNode, faqPageNode, pageJsonLd } from "../lib/schema";
import { MATERIAL_LABEL, SECTORS_UI, sectorCases, type Sector } from "../lib/sectors";

// One rendering for every sector rubric. Everything shown comes from the
// Sector it is handed, so the copy stays in sectors.ts, where the SEO
// prerender reads the same data to write the static HTML.
//
// The page is long on purpose: it exists to replace the PDF an authority would
// otherwise be sent, and a brochure replacement that omits the case law, the
// regulator's instruction or the checklist is just a shorter brochure.

const cardBody = { fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 } as const;

export function SectorView({ S }: { S: Sector }) {
  const jsonLd = pageJsonLd([pageNode("WebPage", S.title, S.desc, S.url), faqPageNode(S.faqs)]);
  const cases = sectorCases(S);

  return (
    <>
      <PageMeta title={`${S.title} | LALUM`} description={S.desc} path={`/${S.path}`} jsonLd={jsonLd} />

      {/* HERO */}
      <section className="wrap section" style={{ maxWidth: 900, paddingTop: 60 }}>
        <div className="pillar-hero">
          <p className="eyebrow">{S.heroEyebrow}</p>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
            {S.h1}
          </h1>
          <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch", margin: 0 }}>{S.lede}</p>
          <div className="pillar-hero-cta">
            <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> {SECTORS_UI.book}</Link>
            <Link to={SECTORS_UI.trainingHref} className="btn btn-outline">{SECTORS_UI.training}</Link>
          </div>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="wrap section section-line" style={{ maxWidth: 900 }}>
        <p className="eyebrow">{S.audienceLabel}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          {S.audience.map((a) => (
            <span key={a} className="card" style={{ padding: "8px 14px", fontSize: 14.5, color: "var(--ink)" }}>{a}</span>
          ))}
        </div>
      </section>

      {/* WHAT IS ALREADY RUNNING */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">{S.realityEyebrow}</p>
          <h2 className="h2">{S.realityH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.realityLede}</p>
        </div>
        <div className="grid grid-2">
          {S.reality.map((r) => (
            <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--clay)", flexShrink: 0, marginTop: 2 }}><Icon name="check" size={18} /></span>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}>{r}</span>
            </div>
          ))}
        </div>
      </section>

      {/* RUBRIC 1: CASE LAW. Every card is a record in the verified corpus, and
          links to it, so the citation has one home and one set of sources. */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 36px" }}>
          <p className="eyebrow">{S.casesEyebrow}</p>
          <h2 className="h2">{S.casesH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.casesLede}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {cases.map(({ ruling, why }) => (
            <article key={ruling.id} className="card" style={{ padding: "26px 24px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)", margin: 0 }}>
                {ruling.citation}
              </p>
              <h3 className="h3" style={{ fontSize: 21, margin: "10px 0 12px", lineHeight: 1.35 }}>{ruling.caption ?? ruling.citation}</h3>
              <p style={{ fontSize: 14.5, color: "var(--slate)", margin: "0 0 18px", lineHeight: 1.6 }}>
                {ruling.court} · {ruling.dateLabel}
                {ruling.bench ? <><br />{SECTORS_UI.benchLabel}: {ruling.bench}</> : null}
              </p>

              {ruling.facts ? <p style={{ ...cardBody, marginBottom: 14 }}>{ruling.facts}</p> : null}

              <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>{SECTORS_UI.holdingLabel}</h4>
              <p style={{ ...cardBody, marginBottom: 14 }}>{ruling.holding}</p>

              {ruling.quote ? (
                <blockquote style={{ borderInlineStart: "3px solid var(--clay)", padding: "6px 0 6px 0", paddingInlineStart: 16, margin: "0 0 16px", fontSize: 16, lineHeight: 1.7, color: "var(--ink)" }}>
                  {ruling.quote}
                </blockquote>
              ) : null}

              <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>{SECTORS_UI.whyLabel}</h4>
              <p style={{ ...cardBody, marginBottom: 18 }}>{why}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", fontSize: 14.5 }}>
                <Link to={`/rulings?q=${encodeURIComponent(ruling.citation)}`} style={{ color: "var(--clay)", fontWeight: 600 }}>
                  {SECTORS_UI.rulingsLabel} &rarr;
                </Link>
                {ruling.sources.map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--slate)" }}>{s.label}</a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* RUBRIC 2: REGULATORY DIRECTIVES */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 36px" }}>
          <p className="eyebrow">{S.directivesEyebrow}</p>
          <h2 className="h2">{S.directivesH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.directivesLede}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {S.directives.map((d) => (
            <article key={d.title} className="card" style={{ padding: "26px 24px" }}>
              <span className="pillar-card-icon"><Icon name={d.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 21, margin: "18px 0 10px" }}>{d.title}</h3>
              <p style={{ ...cardBody, marginBottom: 16 }}>{d.body}</p>
              <ul style={{ margin: "0 0 18px", paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {d.points.map((p) => (
                  <li key={p} style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink)" }}>{p}</li>
                ))}
              </ul>
              <a href={d.sourceHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14.5, color: "var(--clay)", fontWeight: 600 }}>
                {d.sourceLabel} &rarr;
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* RUBRIC 3: WORKING TOOLS */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 36px" }}>
          <p className="eyebrow">{S.toolsEyebrow}</p>
          <h2 className="h2">{S.toolsH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.toolsLede}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {S.tools.map((tool) => (
            <article key={tool.title} className="card" style={{ padding: "26px 24px" }}>
              <span className="pillar-card-icon"><Icon name={tool.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 22, margin: "18px 0 10px" }}>{tool.title}</h3>
              <p style={{ ...cardBody, marginBottom: 20 }}>{tool.intro}</p>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 18 }}>
                {tool.items.map((it, i) => (
                  <li key={it.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, color: "var(--clay)", marginTop: 1 }}>
                      {tool.kind === "protocol"
                        ? <span className="pillar-step-n" style={{ fontSize: 15 }}>{String(i + 1).padStart(2, "0")}</span>
                        : <Icon name="check" size={19} />}
                    </span>
                    <div>
                      <h4 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.4 }}>{it.title}</h4>
                      <p style={cardBody}>{it.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {tool.note ? (
                <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--slate)", margin: "20px 0 0", padding: "14px 16px", background: "var(--wash, rgba(0,0,0,0.03))", borderRadius: 10 }}>
                  {tool.note}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{S.servicesEyebrow}</p>
          <h2 className="h2">{S.servicesH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.servicesLede}</p>
        </div>
        <div className="grid grid-2 pillar-cards">
          {S.services.map((p) => (
            <div key={p.title} className="card">
              <span className="pillar-card-icon"><Icon name={p.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 21, margin: "18px 0 10px" }}>{p.title}</h3>
              <p style={cardBody}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">{S.stepsEyebrow}</p>
          <h2 className="h2">{S.stepsH2}</h2>
        </div>
        <div className="grid grid-3 pillar-steps">
          {S.steps.map((s) => (
            <div key={s.n} className="card">
              <div className="pillar-step-n">{s.n}</div>
              <h3 className="h3" style={{ fontSize: 20, margin: "14px 0 8px" }}>{s.title}</h3>
              <p style={cardBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVING MATERIALS */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">{S.materialsEyebrow}</p>
          <h2 className="h2">{S.materialsH2}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>{S.materialsLede}</p>
        </div>
        <div className="grid grid-2">
          {S.materials.map((m) => (
            <Link key={m.href} to={m.href} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)" }}>
                  {MATERIAL_LABEL[m.kind]}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--slate)" }}>{m.date}</span>
              </div>
              <h3 className="h3" style={{ fontSize: 18, margin: "10px 0 8px", lineHeight: 1.35 }}>{m.title}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--slate)", margin: 0 }}>{m.note}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ (feeds the FAQPage schema above) */}
      <section className="wrap section section-line" style={{ maxWidth: 820 }}>
        <div style={{ margin: "0 0 28px" }}>
          <p className="eyebrow">{S.faqEyebrow}</p>
          <h2 className="h2">{S.faqH2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {S.faqs.map((f) => (
            <div key={f.q} className="card" style={{ padding: "20px 22px" }}>
              <h3 style={{ fontSize: 17.5, fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>{f.q}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <h2 className="serif" style={{ fontSize: "clamp(26px, 5.5vw, 36px)", lineHeight: 1.2, margin: "0 0 14px" }}>{S.ctaH2}</h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "0 auto 24px", maxWidth: "52ch" }}>{S.ctaBody}</p>
        <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> {SECTORS_UI.book}</Link>
        <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 20 }}>{S.disclaimer}</p>
      </section>
    </>
  );
}
