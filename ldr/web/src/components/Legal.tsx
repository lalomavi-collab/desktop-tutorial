import { useState } from "react";

// Legal pages (Privacy, Terms, Cookies) shown in a modal from the footer.
// Drafts for review: not legal advice, should be verified with counsel.
export type LegalSection = "privacy" | "terms" | "cookies" | "about" | "contact";

const TABS: { key: LegalSection; label: string }[] = [
  { key: "about", label: "אודות" },
  { key: "privacy", label: "מדיניות פרטיות" },
  { key: "terms", label: "תנאי שימוש" },
  { key: "cookies", label: "מדיניות עוגיות" },
  { key: "contact", label: "צור קשר" },
];

function Body({ section }: { section: LegalSection }) {
  if (section === "about") return (
    <>
      <h4>אודות LAWDin</h4>
      <p>LAWDin היא הרשת המקצועית של עורכי הדין בישראל: פלטפורמה מאומתת להפניות, שיתופי פעולה, חשיפה מקצועית ומפגש בין עורכי דין ללקוחות פרטיים. החברות פתוחה לעורכי דין מורשים, חברי לשכת עורכי הדין.</p>
      <p>החזון: להפוך לבית המקצועי המוביל של קהילת המשפט בישראל, ובהמשך גם בעולם, עם תשתית לכלים משפטיים מבוססי AI.</p>
    </>
  );
  if (section === "privacy") return (
    <>
      <h4>מדיניות פרטיות</h4>
      <p>אנו מכבדים את פרטיותכם ופועלים לפי עקרון פרטיות מובנית (privacy by design). המסמך מסביר אילו נתונים נאספים, לשם מה, וכיצד הם מוגנים.</p>
      <p><b>נתונים שנאספים:</b> פרטי הרשמה (שם, אימייל, מספר רישיון לשכה), נתוני פרופיל שאתם מזינים, ומידע שימוש בסיסי.</p>
      <p><b>שימוש:</b> הפעלת השירות, אימות, התאמת הפניות, ושיפור המוצר. איננו מוכרים מידע אישי לצדדים שלישיים.</p>
      <p><b>שמירה:</b> המידע נשמר כל עוד החשבון פעיל, ונמחק לפי בקשה או בתום תקופת שמירה סבירה.</p>
      <p><b>זכויותיכם:</b> עיון, תיקון, מחיקה וייצוא של המידע. לפנייה: privacy@lawdin.co.il.</p>
      <p style={{ fontSize: 12, color: "var(--cream-dim)" }}>טיוטה לעיון בלבד, אינה ייעוץ משפטי. יש לאמת מול עו״ד לפני פרסום מחייב.</p>
    </>
  );
  if (section === "terms") return (
    <>
      <h4>תנאי שימוש</h4>
      <p>השימוש ב-LAWDin כפוף לתנאים אלה. ההצטרפות מיועדת לעורכי דין מורשים ולאנשים פרטיים המחפשים שירות משפטי.</p>
      <p><b>אחריות המשתמש:</b> שמירה על סודיות פרטי ההתחברות, מסירת מידע נכון, ושימוש הוגן ללא הטעיה.</p>
      <p><b>אימות:</b> מעמד עורך דין מאומת מול מספר רישיון הלשכה. פרופילים להמחשה מסומנים בבירור כ"בטא".</p>
      <p><b>הגבלת אחריות:</b> LAWDin היא פלטפורמת חיבור ואינה צד לקשר המשפטי בין עורך דין ללקוח, ואינה נותנת ייעוץ משפטי.</p>
      <p style={{ fontSize: 12, color: "var(--cream-dim)" }}>טיוטה לעיון בלבד, אינה ייעוץ משפטי.</p>
    </>
  );
  if (section === "cookies") return (
    <>
      <h4>מדיניות עוגיות</h4>
      <p>אנו משתמשים בעוגיות חיוניות לצורך התחברות ושמירת העדפות (למשל שפה). עוגיות אלה נדרשות לתפקוד השירות.</p>
      <p>עוגיות אנליטיקה אנונימיות עשויות לשמש לשיפור המוצר. ניתן לנהל עוגיות דרך הגדרות הדפדפן.</p>
    </>
  );
  return (
    <>
      <h4>צור קשר</h4>
      <p>נשמח לשמוע מכם:</p>
      <p dir="ltr" style={{ textAlign: "right" }}>support@lawdin.co.il</p>
      <p>לפניות פרטיות: <span dir="ltr">privacy@lawdin.co.il</span></p>
    </>
  );
}

export default function LegalModal({ initial, onClose }: { initial: LegalSection; onClose: () => void }) {
  const [section, setSection] = useState<LegalSection>(initial);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" dir="rtl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>מידע ומסמכים</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TABS.map((tt) => (
            <button key={tt.key} onClick={() => setSection(tt.key)}
              className={`btn ${section === tt.key ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12.5, padding: "6px 12px" }}>
              {tt.label}
            </button>
          ))}
        </div>
        <div style={{ lineHeight: 1.8, fontSize: 14 }}>
          <Body section={section} />
        </div>
      </div>
    </div>
  );
}
