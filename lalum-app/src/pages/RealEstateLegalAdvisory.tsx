import { Link } from "../components/AppLink";
import { PageMeta } from "../components/PageMeta";
import { Icon } from "../components/Icon";
import { useLang } from "../context/LangContext";
import { pageNode, faqPageNode, pageJsonLd } from "../lib/schema";
import { faqsForPath } from "../lib/pageFaqs";

const URL = "https://lalumapp.com/real-estate-legal-advisory";
const TITLE = "ייעוץ משפטי וחוות דעת שנייה בנדל\"ן והתחדשות עירונית";
const DESC =
  "ייעוץ משפטי עצמאי וחוות דעת שנייה בעסקאות נדל\"ן ובהתחדשות עירונית (תמ\"א 38 ופינוי-בינוי), בשילוב Legal AI לבדיקת נאותות וניהול סיכונים, מאת ד\"ר אברהם ללום.";

// What the advisory covers.
const PILLARS = [
  { icon: "scale", title: "עסקאות נדל\"ן וחוזים", body: "ליווי וייצוג בעסקאות מכר, רכישה והשקעה: בדיקת זכויות, ניסוח והגנה חוזית, מיסוי וזיהוי סיכונים מוקדם, לפני שהם הופכים לחשיפה." },
  { icon: "gavel", title: "התחדשות עירונית: תמ\"א 38 ופינוי-בינוי", body: "ליווי בעלי דירות ונציגויות בפרויקטים מורכבים: בחינת הסכמי יזם, בטוחות, לוחות זמנים ומנגנוני הכרעה, לאיזון מול היזם ולהסכם בר-הגנה." },
  { icon: "shield", title: "בדיקת נאותות וניהול סיכונים", body: "מיפוי חשיפות משפטיות, זכויות בנייה, הערות אזהרה, מיסוי ובטוחות, ובניית ארכיטקטורת עסקה חסינה שמחזיקה גם כשמשהו משתבש." },
  { icon: "brain", title: "ניתוח מבוסס Legal AI", body: "כלים מבוססי בינה מלאכותית סורקים מאות מסמכים, נספחים והסכמים, מחלצים סתירות וסיכונים, ומאיצים את הבדיקה, תמיד בפיקוח ובאישור עורך דין." },
];

// When a second opinion pays off.
const WHEN = [
  "לפני חתימה על חוזה רכישה או מכר של נכס",
  "לפני חתימה על הסכם יזם בפרויקט תמ\"א 38 או פינוי-בינוי",
  "כשקיבלתם הסכם או חוות דעת ורוצים בדיקה בלתי תלויה",
  "כשמתגלע סכסוך בין בעלי דירות, נציגות או מול היזם",
  "לפני עסקת קומבינציה או עסקה חוצת גבולות",
  "כשנדרש בסיס מתועד ובר-הגנה להחלטה",
];

// Process.
const STEPS = [
  { n: "1", title: "אבחון", body: "ממפים את הנכס או הפרויקט, את הזכויות, החוזה והחשיפה המשפטית, ומזהים את נקודות התורפה המיידיות." },
  { n: "2", title: "חוות דעת בלתי תלויה", body: "בוחנים מחדש את העסקה בעין ביקורתית, בשילוב משפט, כלכלה וכלי Legal AI לניתוח מסמכים וסיכונים." },
  { n: "3", title: "מפת דרכים לניהול סיכון", body: "מוסרים מסמך בר-הגנה, ממוקד ומתועד, עם צעדים מעשיים להקטנת החשיפה ולחיזוק העמדה המשפטית." },
];

// Internal links: the topical cluster this pillar consolidates.
const RELATED = [
  { slug: "urban-renewal-mistakes-guide", title: "המדריך לטעויות נפוצות בהתחדשות עירונית" },
  { slug: "urban-renewal-risk", title: "ניהול סיכונים בפרויקטי התחדשות עירונית" },
  { slug: "tenant-urban-renewal-guide", title: "מדריך לדייר בהתחדשות עירונית" },
  { slug: "combination-deals-architecture", title: "ארכיטקטורת עסקאות קומבינציה" },
  { slug: "ai-realestate-risk-management", title: "ניהול סיכונים בנדל\"ן מבוסס בינה מלאכותית" },
  { slug: "contract-review-before-signing", title: "בדיקת חוזה לפני חתימה" },
];

export function RealEstateLegalAdvisory() {
  const { t } = useLang();
  const faqs = faqsForPath(t, "/real-estate-legal-advisory");
  const jsonLd = pageJsonLd([pageNode("WebPage", TITLE, DESC, URL), faqPageNode(faqs)]);

  return (
    <>
      <PageMeta title={`${TITLE} | LALUM`} description={DESC} path="/real-estate-legal-advisory" jsonLd={jsonLd} />

      {/* HERO */}
      <section className="wrap section" style={{ maxWidth: 900, paddingTop: 72 }}>
        <p className="eyebrow">ייעוץ וחוות דעת שנייה בנדל"ן והתחדשות עירונית</p>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
          {TITLE}
        </h1>
        <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch" }}>
          עסקאות נדל"ן ופרויקטים של התחדשות עירונית הם זירה שבה טעות חוזית אחת עולה ביוקר. אנחנו נותנים ייעוץ משפטי עצמאי וחוות דעת שנייה בלתי תלויה, בשילוב כלי Legal AI, שהופכים מאות עמודי מסמכים לתמונת סיכון ברורה, לפני שאתם מתחייבים.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> לתיאום פגישת אבחון</Link>
          <Link to="/advisory" className="btn btn-ghost">שירותי הייעוץ המלאים</Link>
        </div>
      </section>

      {/* WHAT WE COVER */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">מה הייעוץ מכסה</p>
          <h2 className="h2">שכבת ההגנה המשפטית סביב העסקה שלכם</h2>
        </div>
        <div className="grid grid-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="card">
              <span className="icon-badge"><Icon name={p.icon} size={22} /></span>
              <h3 className="h3" style={{ fontSize: 21, margin: "18px 0 10px" }}>{p.title}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHEN A SECOND OPINION */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">חוות דעת שנייה</p>
          <h2 className="h2">מתי כדאי חוות דעת משפטית שנייה בנדל"ן</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "14px 0 0" }}>
            חוות דעת שנייה בלתי תלויה אינה מגינה על החלטה שכבר התקבלה, אלא בוחנת אותה מחדש. היא מחזקת גם את הלקוח וגם את היועץ המייצג, ומספקת בסיס מתועד ובר-הגנה.
          </p>
        </div>
        <div className="grid grid-2">
          {WHEN.map((w) => (
            <div key={w} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--clay)", flexShrink: 0, marginTop: 2 }}><Icon name="check" size={18} /></span>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}>{w}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 44px" }}>
          <p className="eyebrow">איך זה עובד</p>
          <h2 className="h2">שלושה שלבים לחוות דעת בת-הגנה</h2>
        </div>
        <div className="grid grid-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--clay)", lineHeight: 1 }}>{s.n}</div>
              <h3 className="h3" style={{ fontSize: 20, margin: "14px 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RELATED READING (internal links) */}
      <section className="wrap section section-line">
        <div style={{ maxWidth: "58ch", margin: "0 0 32px" }}>
          <p className="eyebrow">להעמקה</p>
          <h2 className="h2">מאמרים בנושא נדל"ן, התחדשות עירונית ו-Legal AI</h2>
        </div>
        <div className="grid grid-3">
          {RELATED.map((r) => (
            <Link key={r.slug} to={`/insights/${r.slug}`} className="card" style={{ display: "block" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--clay)" }}>מאמר</span>
              <h3 className="h3" style={{ fontSize: 18, margin: "10px 0 0", lineHeight: 1.35 }}>{r.title}</h3>
              <span className="card-go">קריאה &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ (feeds the FAQPage schema above) */}
      <section className="wrap section section-line" style={{ maxWidth: 820 }}>
        <div style={{ margin: "0 0 28px" }}>
          <p className="eyebrow">שאלות ותשובות</p>
          <h2 className="h2">ייעוץ וחוות דעת שנייה בנדל"ן והתחדשות עירונית</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faqs.map((f) => (
            <div key={f.q} className="card" style={{ padding: "20px 22px" }}>
              <h3 style={{ fontSize: 17.5, fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>{f.q}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: "var(--slate)", margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <h2 className="serif" style={{ fontSize: "clamp(26px, 5.5vw, 36px)", lineHeight: 1.2, margin: "0 0 14px" }}>
          מוכנים לחוות דעת בלתי תלויה על העסקה שלכם?
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--slate)", margin: "0 auto 24px", maxWidth: "52ch" }}>
          פגישת אבחון קצרה ממפה את החשיפה שלכם ומגדירה מפת דרכים ברורה לניהול הסיכון בעסקה או בפרויקט.
        </p>
        <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> לתיאום פגישת אבחון</Link>
        <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 20 }}>
          המידע בעמוד זה כללי ואינו מהווה ייעוץ משפטי או תחליף לחוות דעת פרטנית.
        </p>
      </section>
    </>
  );
}
