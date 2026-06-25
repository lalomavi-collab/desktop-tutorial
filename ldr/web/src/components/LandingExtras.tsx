import { useI18n } from "../i18n";

// Landing trust + value sections (Why LAWDin, benefits, FAQ). Uses the
// landing-light theme tokens so it stays consistent with the rest of the page.

const WHY = [
  { icon: "✓", title: "מאומת בלבד", desc: "רק עורכי דין חברי לשכה. לא קבוצת פייסבוק פתוחה." },
  { icon: "🔄", title: "הפניות אמיתיות", desc: "שיתופי פעולה והעברת תיקים, לא עוד פיד של פוסטים." },
  { icon: "🔒", title: "פרטיות כברירת מחדל", desc: "אנונימיזציה בצד הלקוח ושליטה מלאה במה שמוצג." },
];

const BENEFITS = [
  { icon: "🔄", t: "הפניות מקצועיות" },
  { icon: "🤝", t: "שיתופי פעולה" },
  { icon: "📚", t: "שיתוף ידע" },
  { icon: "📈", t: "פיתוח עסקי" },
  { icon: "👁️", t: "חשיפה בקרב עמיתים" },
  { icon: "🌐", t: "גישה לקהילה המשפטית" },
];

const FAQ = [
  { q: "כמה זה עולה?", a: "ההצטרפות והשימוש הבסיסי חינמיים לחלוטין, ללא עמלות על הפניות." },
  { q: "מי יכול להצטרף?", a: "עורכי דין מורשים, חברי לשכת עורכי הדין בישראל. אנשים פרטיים יכולים להצטרף כדי למצוא עו״ד." },
  { q: "איך מתבצע האימות?", a: "מול מספר רישיון הלשכה. פרופילים להמחשה מסומנים בבירור כ״בטא״." },
  { q: "איך מקבלים הפניות?", a: "עורכי דין מופיעים על המפה ובחיפוש לפי תחום ואזור, ומקבלים פניות ישירות מעמיתים ומלקוחות." },
  { q: "מה לגבי פרטיות?", a: "אתם שולטים במידע המוצג, והחיסיון נשמר באמצעות אנונימיזציה בצד הלקוח." },
  { q: "אני לקוח פרטי, זה בשבילי?", a: "כן. תוכלו לחפש עו״ד לפי תחום, אזור, שפה וניסיון, ולפנות ישירות, בחינם." },
];

export default function LandingExtras({ onJoin }: { onJoin: () => void }) {
  const { t } = useI18n();
  void t;
  return (
    <div className="container" dir="rtl" style={{ maxWidth: 1000, paddingBlock: 8 }}>
      {/* Why LAWDin */}
      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 24, margin: "8px 0 18px" }}>למה LAWDin, ולא לינקדאין או קבוצת פייסבוק?</h2>
      <div className="grid cols-3" style={{ marginBottom: 30 }}>
        {WHY.map((w) => (
          <div key={w.title} className="card pad" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30 }}>{w.icon}</div>
            <h3 style={{ margin: "8px 0 6px", fontSize: 17 }}>{w.title}</h3>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{w.desc}</p>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 22, margin: "8px 0 16px" }}>למה עורכי דין מצטרפים</h2>
      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        {BENEFITS.map((b) => (
          <div key={b.t} className="card pad" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{b.t}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginBottom: 34 }}>
        <button className="btn btn-gold" style={{ padding: "12px 30px", fontSize: 15 }} onClick={onJoin}>הצטרפו ל-LAWDin, בחינם</button>
      </div>

      {/* FAQ */}
      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 22, margin: "8px 0 16px" }}>שאלות נפוצות</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {FAQ.map((f) => (
          <details key={f.q} className="card" style={{ padding: "0 16px" }}>
            <summary style={{ cursor: "pointer", padding: "14px 0", fontWeight: 700, fontSize: 15, listStyle: "none" }}>{f.q}</summary>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 14px" }}>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
