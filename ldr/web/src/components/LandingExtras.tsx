import { useState } from "react";

// Landing trust + value sections (Why LAWDin, benefits, FAQ). Every rubric is a
// working button that opens a clear explanation. Uses the landing-light tokens.

type Item = { icon: string; title: string; short: string; long: string };

const WHY: Item[] = [
  { icon: "✓", title: "מאומת בלבד", short: "רק חברי לשכה, לא קבוצה פתוחה.", long: "כל עורך דין ב-LAWDin מאומת מול מספר רישיון לשכת עורכי הדין. אין פרופילים אנונימיים ואין גורמים שאינם עורכי דין. כך נוצרת רשת מקצועית אמינה, להבדיל מקבוצת פייסבוק פתוחה." },
  { icon: "🔄", title: "הפניות אמיתיות", short: "העברת תיקים, לא פיד פוסטים.", long: "המוקד הוא העברת תיקים ושיתופי פעולה בין עורכי דין, ולא עוד פיד של פוסטים. כשמגיע אליכם תיק מחוץ לתחום או לאזור שלכם, אפשר להפנות אותו לעמית מתאים, ולהיפך." },
  { icon: "🔒", title: "פרטיות כברירת מחדל", short: "שליטה מלאה במידע המוצג.", long: "המידע שמוצג נמצא בשליטתכם, והחיסיון נשמר באמצעות אנונימיזציה בצד הלקוח. אתם בוחרים מה חשוף ולמי." },
];

const BENEFITS: Item[] = [
  { icon: "🔄", title: "הפניות מקצועיות", short: "קבלו והעבירו תיקים בין עמיתים.", long: "הפנייה מקצועית היא העברת תיק או לקוח לעו״ד אחר שמתאים יותר לתחום, לאזור או לשפה. איך זה עובד ב-LAWDin: כשעו״ד נתקל בתיק שאינו בתחומו, הוא מאתר עמית מתאים על המפה או בחיפוש, מעביר את הפנייה ישירות, וקובע מראש את תנאי התמורה (למשל אחוז הפניה). הכל שקוף, בלי מתווך ובלי עמלת פלטפורמה." },
  { icon: "🤝", title: "שיתופי פעולה", short: "טיפול משותף בתיקים גדולים.", long: "התחברו לעורכי דין מתחומים משלימים לטיפול משותף בתיקים מורכבים, ייעוץ הדדי, כיסוי גיאוגרפי רחב יותר, וגיבוי בעומסים. שיתוף פעולה נבנה דרך פרופיל, צ׳אט וקביעת פגישה ישירות במערכת." },
  { icon: "📚", title: "שיתוף ידע", short: "שאלות, תקדימים ודגלים אדומים.", long: "גישה לקהילה מאומתת לשאלות מקצועיות, תקדימים עדכניים, ודגלים אדומים רגולטוריים (למשל בהתחדשות עירונית). שיתוף ידע מקצועי בין עמיתים, לא ייעוץ פומבי." },
  { icon: "📈", title: "פיתוח עסקי", short: "חשיפה, מוניטין ולקוחות.", long: "פרופיל מקצועי על מפת המומחים, חשיפה לעמיתים וללקוחות פרטיים, ובניית מוניטין מדיד לאורך זמן. כלי פשוט לצמיחת הפרקטיקה בלי שיווק אגרסיבי." },
  { icon: "👁️", title: "חשיפה בקרב עמיתים", short: "שיופיעו אתכם להפניות.", long: "הופעה על מפת המומחים לפי תחום, אזור וניסיון, כך שעמיתים מוצאים אתכם בקלות כשיש להם תיק להפנות. ככל שהפרופיל מלא יותר, כך החשיפה גבוהה יותר." },
  { icon: "🌐", title: "גישה לקהילה המשפטית", short: "רשת סגורה ומאומתת.", long: "מרחב מקצועי סגור לעורכי דין בלבד, מאומת ונקי מרעש. מקום אחד לחיבורים, הפניות, ידע וצמיחה מקצועית." },
];

const FAQ = [
  { q: "כמה זה עולה?", a: "ההצטרפות והשימוש הבסיסי חינמיים, ללא עמלות על הפניות." },
  { q: "מי יכול להצטרף?", a: "עורכי דין מורשים, חברי לשכת עורכי הדין. אנשים פרטיים יכולים להצטרף כדי למצוא עו״ד." },
  { q: "איך מתבצע האימות?", a: "מול מספר רישיון הלשכה. פרופילים להמחשה מסומנים בבירור." },
  { q: "איך מקבלים הפניות?", a: "עורכי דין מופיעים על המפה ובחיפוש לפי תחום ואזור, ומקבלים פניות ישירות מעמיתים ומלקוחות." },
  { q: "מה לגבי פרטיות?", a: "אתם שולטים במידע המוצג, והחיסיון נשמר באמצעות אנונימיזציה בצד הלקוח." },
  { q: "אני לקוח פרטי, זה בשבילי?", a: "כן. תוכלו לחפש עו״ד לפי תחום, אזור, שפה וניסיון, ולפנות ישירות, בחינם." },
];

function Card({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card card-interactive pad" aria-label={item.title}
      style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "start", cursor: "pointer", fontFamily: "inherit", color: "var(--cream)", width: "100%" }}>
      <span style={{ fontSize: 24 }}>{item.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 15.5 }}>{item.title}</span>
        <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>{item.short}</span>
      </span>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}

export default function LandingExtras({ onJoin }: { onJoin: () => void }) {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <div className="container" dir="rtl" style={{ maxWidth: 1000, paddingBlock: 8 }}>
      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 24, margin: "8px 0 18px" }}>למה LAWDin, ולא לינקדאין או קבוצת פייסבוק?</h2>
      <div className="grid cols-3" style={{ marginBottom: 30 }}>
        {WHY.map((w) => <Card key={w.title} item={w} onOpen={() => setOpen(w)} />)}
      </div>

      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 22, margin: "8px 0 16px" }}>למה עורכי דין מצטרפים</h2>
      <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "0 0 16px" }}>לחצו על כל יתרון להסבר מלא, איך זה עובד.</p>
      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        {BENEFITS.map((b) => <Card key={b.title} item={b} onOpen={() => setOpen(b)} />)}
      </div>
      <div style={{ textAlign: "center", marginBottom: 34 }}>
        <button className="btn btn-gold" style={{ padding: "12px 30px", fontSize: 15 }} onClick={onJoin}>הצטרפו כעורך דין, בחינם</button>
      </div>

      <h2 className="font-headline" style={{ textAlign: "center", fontSize: 22, margin: "8px 0 16px" }}>שאלות נפוצות</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {FAQ.map((f) => (
          <details key={f.q} className="card" style={{ padding: "0 16px" }}>
            <summary style={{ cursor: "pointer", padding: "14px 0", fontWeight: 700, fontSize: 15, listStyle: "none" }}>{f.q}</summary>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 14px" }}>{f.a}</p>
          </details>
        ))}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div className="card pad" dir="rtl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "min(460px,94vw)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{open.icon} {open.title}</h3>
              <button className="link" onClick={() => setOpen(null)} aria-label="סגירה">✕</button>
            </div>
            <p style={{ lineHeight: 1.8, fontSize: 14.5 }}>{open.long}</p>
            <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} onClick={() => { setOpen(null); onJoin(); }}>הצטרפו כעורך דין</button>
          </div>
        </div>
      )}
    </div>
  );
}
