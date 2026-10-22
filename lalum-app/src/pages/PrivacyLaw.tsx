import { useRef, useState } from "react";
import { Link } from "../components/AppLink";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { PillarArt } from "../components/PillarArt";
import { pageNode, pageJsonLd } from "../lib/schema";
import { useLang } from "../context/LangContext";
import { privacyLaw as L, PRIVACY_TITLE, PRIVACY_DESC, PRIVACY_BOOKLET, PRIVACY_GUIDE, PRIVACY_VIDEO, PRIVACY_POSTER } from "../lib/privacyLaw";

// Privacy law and Amendment 13, Hebrew only, in Israeli law only. Reached from the home
// page, not from the navigation. The video loads nothing but its poster until played.

const label = { fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--slate)", margin: "0 0 6px" } as const;
const card = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "26px 28px" } as const;

function Item({ i }: { i: { section: string; title: string; text: string; practical?: string } }) {
  return (
    <details style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>
        {i.title} <span className="muted" style={{ fontWeight: 400, fontSize: 13.5 }}>({i.section})</span>
      </summary>
      <p style={{ fontSize: 15, lineHeight: 1.75, margin: "10px 0 0" }}>{i.text}</p>
      {i.practical && <p style={{ fontSize: 15, lineHeight: 1.75, margin: "10px 0 0", paddingInlineStart: 14, borderInlineStart: "3px solid var(--clay)" }}>{i.practical}</p>}
    </details>
  );
}

export function PrivacyLaw() {
  const { t } = useLang();
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  function start() {
    setStarted(true);
    requestAnimationFrame(() => void ref.current?.play().catch(() => {}));
  }

  return (
    <>
      <PageMeta title={PRIVACY_TITLE} description={PRIVACY_DESC} path="/privacy-law" jsonLd={pageJsonLd([pageNode("WebPage", PRIVACY_TITLE, PRIVACY_DESC, "https://lalumapp.com/privacy-law")])} />

      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap pillar-hero-layout" style={{ maxWidth: 1140, padding: "96px 32px 32px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <span className="pill">AI ומשפט · הגנת הפרטיות</span>
            <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
              חוק הגנת הפרטיות אחרי תיקון 13
            </h1>
            <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{L.lead}</p>
          </div>
          <aside className="pillar-hero-art"><PillarArt theme="clinic" /></aside>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 24 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <p style={label}>סרטון הסבר</p>
            {started ? (
              <video ref={ref} controls playsInline preload="auto" poster={PRIVACY_POSTER} style={{ width: "100%", borderRadius: 14, background: "#0b100c", aspectRatio: "16 / 9" }}>
                <source src={PRIVACY_VIDEO} type="video/mp4" />
              </video>
            ) : (
              <button type="button" onClick={start} aria-label="הפעלת סרטון ההסבר על חוק הגנת הפרטיות" style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, borderRadius: 14, overflow: "hidden", cursor: "pointer", background: "#0b100c" }}>
                <img src={PRIVACY_POSTER} alt="סרטון הסבר על חוק הגנת הפרטיות ותיקון 13" loading="lazy" decoding="async" width={960} height={540} style={{ display: "block", width: "100%", height: "auto" }} />
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  <span style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(11,16,12,.72)", border: "2px solid #e7c27a", display: "grid", placeItems: "center" }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="#e7c27a"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </span>
              </button>
            )}
            <p className="muted" style={{ fontSize: 13.5, margin: "12px 0 0" }}>סרטון שקט, בטקסט על המסך. אורכו כדקה ורבע.</p>
          </div>

          <div style={{ ...card, borderTop: "3px solid var(--clay)" }}>
            <p style={label}>חוברת לארגונים, להורדה</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>החוברת: החוק, התיקון והשאלות שהוא מעורר לגבי בינה מלאכותית</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "12px 0 0" }}>אותו תוכן כמו בעמוד, בקובץ PDF שאפשר להדפיס ולהעביר בארגון, עם רשימת בדיקה והסבר על מה שלא נקרא או לא אומת.</p>
            <p style={{ margin: "16px 0 0" }}><a href={PRIVACY_BOOKLET} className="btn btn-clay" download>הורדת החוברת (PDF)</a></p>
          </div>

          <div style={{ ...card, borderTop: "3px solid var(--clay)" }}>
            <p style={label}>מדריך לכל אדם, להורדה</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>המדריך לאדם הפרטי: הפרטיות שלך בחוק</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "12px 0 0" }}>מדריך בשפה פשוטה, לקריאה בלי ידע משפטי: מה החוק אוסר, מה הזכויות שלכם מול מי שמחזיק מידע עליכם, מה עושים כשפוגעים בפרטיות, תמונות וסרטונים, בינה מלאכותית, מילון ושאלות נפוצות.</p>
            <p style={{ margin: "16px 0 0" }}><a href={PRIVACY_GUIDE} className="btn btn-clay" download>הורדת המדריך לאדם הפרטי (PDF)</a></p>
          </div>

          <div style={card}>
            <p style={label}>החוק בקצרה</p>
            <p className="muted" style={{ fontSize: 14, margin: "0 0 4px" }}>{L.published}</p>
            {L.basics.map((b) => <Item key={b.title} i={b} />)}
          </div>

          {L.groups.map((g) => (
            <div key={g.id} style={card}>
              <p style={label}>מה השתנה בתיקון 13</p>
              <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{g.title}</h2>
              {g.items.map((i) => <Item key={i.title + i.section} i={i} />)}
            </div>
          ))}

          <div style={{ ...card, borderTop: "3px solid var(--clay)" }}>
            <p style={label}>הגנת הפרטיות ובינה מלאכותית</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>מה החוק אומר על עבודה עם כלי בינה מלאכותית</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "12px 0 0" }}>{L.ai.intro}</p>
            {L.ai.items.map((i) => <Item key={i.title + i.section} i={i} />)}
          </div>

          <div style={card}>
            <p style={label}>ציר התיקונים</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>תיקוני החוק, כולל תיקון 11 ותיקון 13</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "12px 0 0" }}>{L.amendments.intro}</p>
            {L.amendments.items.map((a) => (
              <details key={a.n} style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>
                  תיקון {a.n} <span className="muted" style={{ fontWeight: 400, fontSize: 13.5 }}>({a.year})</span>
                </summary>
                <p style={{ fontSize: 15, lineHeight: 1.75, margin: "10px 0 0" }}>{a.text}</p>
              </details>
            ))}
          </div>

          <div style={card}>
            <p style={label}>חקיקה נלווית</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>חוקים ישראליים נוספים שנוגעים בפרטיות</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, margin: "12px 0 0" }}>{L.relatedLaws.intro}</p>
            {L.relatedLaws.items.map((r) => (
              <details key={r.name} style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>{r.name}</summary>
                <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>{r.readLevel}</p>
                <ul style={{ margin: "10px 0 0", paddingInlineStart: 20, fontSize: 15, lineHeight: 1.75 }}>
                  {r.sections.map((x) => <li key={x.section}><bdi>{x.section}</bdi>: {x.says}</li>)}
                </ul>
              </details>
            ))}
          </div>

          <div style={card}>
            <p style={label}>תקנות</p>
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>התקנות שמשלימות את החוק</h2>
            {L.regulations.map((r) => (
              <details key={r.name} style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>{r.short}</summary>
                <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>{r.name}</p>
                <ul style={{ margin: "10px 0 0", paddingInlineStart: 20, fontSize: 15, lineHeight: 1.75 }}>
                  {r.duties.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </details>
            ))}
          </div>

          <div style={card}>
            <p style={label}>רשימת בדיקה, ניתוח שלנו</p>
            <ol style={{ margin: "10px 0 0", paddingInlineStart: 22, fontSize: 15.5, lineHeight: 1.85 }}>
              {L.checklist.map((c) => <li key={c}>{c}</li>)}
            </ol>
          </div>

          <div style={{ ...card, background: "var(--clay-tint)" }}>
            <p style={label}>מה לא נקרא או לא אומת</p>
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, fontSize: 15, lineHeight: 1.8 }}>
              {L.limits.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>

          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            {L.disclaimer} <Link to="/rulings" style={{ color: "var(--clay)", fontWeight: 600 }}>לפסיקה בתחום ה-AI</Link>
          </p>
        </div>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
