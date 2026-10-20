import { Link } from "../components/AppLink";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { PillarArt } from "../components/PillarArt";
import { pageNode, pageJsonLd } from "../lib/schema";
import { useLang } from "../context/LangContext";
import { instruments, shown, ETHICS_TITLE, ETHICS_DESC } from "../lib/ethics";
import { rulings, rulingTitle } from "../lib/rulings";

// The Israel Bar's ethics rules on AI, one instrument at a time.
//
// Every section comes from the instrument's own text and carries the paragraph
// it rests on, so a reader can check any line against the source. Commentary by
// the practice's principal appears only once approved.

const label = { fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--slate)", margin: "0 0 6px" } as const;

export function Ethics() {
  const { t } = useLang();
  const ai = rulings.filter((r) => r.areas.includes("ai"));

  return (
    <>
      <PageMeta title={ETHICS_TITLE} description={ETHICS_DESC} path="/ethics" jsonLd={pageJsonLd([pageNode("CollectionPage", ETHICS_TITLE, ETHICS_DESC, "https://lalumapp.com/ethics")])} />

      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap pillar-hero-layout" style={{ maxWidth: 1140, padding: "96px 32px 32px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <span className="pill">אתיקה מקצועית ו-AI</span>
            <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
              כללי האתיקה של עורכי הדין בעידן ה-AI
            </h1>
            <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>
              הנוסח הרשמי של הלשכה, מפורק לסעיפים עם הפניה לכל פסקה, ולצדו הפסיקה שמיישמת אותו. העמוד מתעדכן מדי יום.
            </p>
          </div>
          <aside className="pillar-hero-art"><PillarArt theme="clinic" /></aside>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 32 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {instruments.map((i) => (
            <article key={i.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "26px 28px", borderTop: "3px solid var(--clay)" }}>
              <p style={label}>{i.body}</p>
              <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{i.number}: {i.title}</h2>
              <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
                {i.dateLabel}{i.earlier ? `, אחרי ${i.earlier}` : ""}
              </p>
              <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "16px 0 0" }}>{i.summary}</p>
              <p style={{ margin: "14px 0 0" }}>
                <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>{i.sourceLabel} &larr;</a>
              </p>
              {i.signedBy && <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>נחתם בידי {i.signedBy}.</p>}

              {shown(i.commentary) && (
                <div style={{ marginTop: 18, paddingInlineStart: 16, borderInlineStart: "3px solid var(--clay)" }}>
                  <p style={label}>התייחסות ד״ר עו״ד אברהם ללום</p>
                  <p style={{ fontSize: 15, lineHeight: 1.75, margin: 0 }}>{shown(i.commentary)}</p>
                </div>
              )}

              {i.sections.map((s) => (
                <details key={s.letter} style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>
                    {s.letter}. {s.heading} <span className="muted" style={{ fontWeight: 400, fontSize: 13.5 }}>(סעיפים {s.paragraphs})</span>
                  </summary>
                  {s.note && <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>{s.note}</p>}
                  {shown(s.commentary) && (
                    <div style={{ margin: "12px 0 0", paddingInlineStart: 14, borderInlineStart: "3px solid var(--clay)" }}>
                      <p style={label}>התייחסות ד״ר ללום</p>
                      <p style={{ fontSize: 15, lineHeight: 1.7, margin: 0 }}>{shown(s.commentary)}</p>
                    </div>
                  )}
                  <ul style={{ margin: "12px 0 0", paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    {s.points.map((p) => (
                      <li key={p.para} style={{ fontSize: 15, lineHeight: 1.7 }}>
                        <strong>סעיף {p.para}.</strong> {p.text}
                        {p.quote && <blockquote style={{ margin: "6px 0 0", color: "var(--slate)", fontSize: 14, borderInlineStart: "2px solid var(--line-strong)", paddingInlineStart: 12 }}>״{p.quote}״</blockquote>}
                        {shown(p.commentary) && <p style={{ margin: "6px 0 0", fontSize: 14.5 }}><strong>התייחסות ד״ר ללום:</strong> {shown(p.commentary)}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              {i.sections.length === 0 && <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>הפירוט לסעיפים יתווסף בהמשך. עד אז, הנוסח המלא זמין בקישור למעלה.</p>}
            </article>
          ))}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "22px 28px" }}>
            <h2 className="serif" style={{ fontSize: 21, fontWeight: 500, margin: 0 }}>פסיקה בנושא AI ועריכת דין</h2>
            <p className="muted" style={{ fontSize: 14, margin: "8px 0 14px" }}>{ai.length} פסקי דין במאגר, מהחדש לישן. התמצית המלאה של כל אחד בעמוד הפסיקה.</p>
            <ul style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {[...ai].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <li key={r.id} style={{ fontSize: 15 }}>
                  <Link to={`/rulings?q=${encodeURIComponent(r.citation)}`} style={{ color: "var(--clay)", fontWeight: 600 }}>{rulingTitle(r)}</Link>
                  <span className="muted"> ({r.dateLabel})</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: "16px 0 0" }}><Link to="/updates" style={{ color: "var(--clay)", fontWeight: 600 }}>כל העדכונים &larr;</Link></p>
          </div>

          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            התמצית נכתבה בידי המשרד ואינה תחליף לקריאת גילוי הדעת במקור. אין באמור ייעוץ משפטי, והוא אינו מהווה חוות דעת מחייבת.
          </p>
        </div>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
