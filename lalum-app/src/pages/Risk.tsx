import { Link, useParams, Navigate } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { Icon } from "../components/Icon";
import { TechLegalCalculator } from "../components/TechLegalCalculator";
import { pageNode, pageJsonLd } from "../lib/schema";
import { TRACKS, BANDS, resultFor, resultPath, MAX_SCORE, type TrackId, type BandId } from "../lib/riskScore";

const TITLE = `מבדק מוכנות Tech-Legal: כמה הארגון שלכם חשוף?`;
const DESC = `מבדק קצר בן שלוש שאלות שמעריך את מוכנות הארגון בממשל בינה מלאכותית, בבדיקת חוזים ובתיעוד החלטות. תיאור עצמי, בלי להעלות שום מסמך.`;

export function Risk() {
  return (
    <>
      <PageMeta title={`${TITLE} | LALUM`} description={DESC} path="/risk"
        jsonLd={pageJsonLd([pageNode("WebPage", TITLE, DESC, "https://lalumapp.com/risk")])} />
      <section className="wrap section" style={{ maxWidth: 820, paddingTop: 72 }}>
        <p className="eyebrow">מבדק מוכנות</p>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 44px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
          {TITLE}
        </h1>
        <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "62ch" }}>
          רוב הארגונים לא יודעים היכן הם חשופים עד שמשהו משתבש. שלוש שאלות על התנהלות בפועל מספיקות כדי לסמן את הפער העיקרי, ולדעת מה הצעד הבא.
        </p>
      </section>
      <section className="wrap section" style={{ maxWidth: 820, paddingTop: 0 }}>
        <TechLegalCalculator />
      </section>
    </>
  );
}

// A shared result. Prerendered per track and band so the address a visitor
// shares carries its own Open Graph tags and preview image in the raw HTML,
// which is the only thing LinkedIn reads.
export function RiskResult() {
  const { track, band } = useParams();
  const validTrack = TRACKS.some((t) => t.id === track);
  const validBand = BANDS.includes(band as BandId);
  if (!validTrack || !validBand) return <Navigate to="/risk" replace />;

  const t = TRACKS.find((x) => x.id === track)!;
  const r = resultFor(track as TrackId, band as BandId);
  const path = resultPath(track as TrackId, band as BandId);
  const title = `${r.title}: מוכנות Tech-Legal ב${t.blurb}`;

  return (
    <>
      <PageMeta title={`${title} | LALUM`} description={r.body} path={path}
        image={`https://lalumapp.com/og/risk-${track}-${band}.png`}
        jsonLd={pageJsonLd([pageNode("WebPage", title, r.body, `https://lalumapp.com${path}`)])} />
      <section className="wrap section" style={{ maxWidth: 760, paddingTop: 72 }}>
        <p className="eyebrow">תוצאת מבדק המוכנות</p>
        <div className={"riskcalc-badge tone-" + r.tone} style={{ marginTop: 14 }}>{r.title}</div>
        <h1 className="serif" style={{ fontSize: "clamp(26px, 5.5vw, 38px)", lineHeight: 1.2, margin: "16px 0 18px" }}>
          {t.blurb}
        </h1>
        <p style={{ fontSize: 17.5, lineHeight: 1.75, color: "var(--ink)", maxWidth: "62ch" }}>{r.body}</p>
        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "var(--slate)", maxWidth: "62ch", margin: "16px 0 30px" }}>
          <strong>הצעד הבא:</strong> {r.next}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/risk" className="btn btn-clay">לביצוע המבדק בעצמכם</Link>
          <Link to="/book" className="btn btn-ghost"><Icon name="calendar" size={16} /> לתיאום פגישת אבחון</Link>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--slate)", marginTop: 26 }}>
          התוצאה מבוססת על תיאור עצמי בן שלוש שאלות, בסולם של {MAX_SCORE} נקודות חשיפה. היא אינה ביקורת משפטית, אינה חוות דעת ואינה תחליף לבדיקה פרטנית.
        </p>
      </section>
    </>
  );
}
