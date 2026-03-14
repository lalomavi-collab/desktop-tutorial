"""דוגמאות: בניית פרומפטים מקצועיים ב-6 שלבים - ללא API"""

from prompt_builder.templates.app_templates import PromptSession
from prompt_builder.utils.formatter import format_steps_overview


def example_lawyer_realestate():
    """דוגמה 1: עו"ד נדל"ן - ניתוח חוזה תמ"א 38"""
    print("=" * 70)
    print("דוגמה 1: עו\"ד נדל\"ן - ניתוח חוזי תמ\"א 38")
    print("=" * 70)
    print()
    print(format_steps_overview())
    print()

    session = PromptSession(
        project_name="מנתח חוזי תמ\"א 38",
        domain="עו\"ד נדל\"ן - התחדשות עירונית",
        platform="פורטל לקוחות באתר המשרד",
    )

    session.answers = {
        "role": "עורך דין מומחה להתחדשות עירונית עם 15 שנות ניסיון בעסקאות תמ\"א 38 ופינוי-בינוי",
        "audience": "לקוח פרטי (דייר) - שפה פשוטה וברורה, ללא ז'רגון משפטי, עם דגש על המשמעות הכספית",
        "input_context": "חוזה תמ\"א 38 בפורמט PDF שהלקוח מעלה. כולל: חוזה עם היזם, נספח תמורות, לוח זמנים, ערבויות",
        "task": "ניתוח סיכונים מקיף: זיהוי סעיפים בעייתיים, חישוב חשיפה כספית, בדיקת ערבויות, השוואה לסטנדרט השוק",
        "constraints": "התייחסות לחוק המכר (דירות), תקן 21 של הרשות להגנת הצרכן, פסיקת בית המשפט העליון בנושא. שפה ברורה. disclaimer שאינו מהווה ייעוץ משפטי מלא",
        "output_structure": "טבלה: סעיף בחוזה | סיכון (גבוה/בינוני/נמוך) | משמעות כספית | המלצה לדייר. בתחתית: סיכום כללי + 3 נקודות קריטיות לשים לב",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


def example_accountant_tax():
    """דוגמה 2: רו"ח - תכנון מס לעסקה"""
    print("=" * 70)
    print("דוגמה 2: רו\"ח - תכנון מס לעסקת נדל\"ן")
    print("=" * 70)
    print()

    session = PromptSession(
        project_name="יועץ מס חכם",
        domain="רו\"ח - מיסוי מקרקעין",
        platform="כלי פנימי למשרד רו\"ח",
    )

    session.answers = {
        "role": "רואה חשבון מומחה למיסוי מקרקעין ותכנון מס, בקיא בפקודת מס הכנסה וחוק מיסוי מקרקעין",
        "audience": "רו\"ח או יועץ מס עמית - שפה מקצועית, הפניות לסעיפי חוק, פסיקה ותקנות",
        "input_context": "פרטי העסקה: סוג הנכס, מחיר רכישה ומכירה, תאריכים, שיפורים, פטורים שנוצלו. נתוני מדד ושער דולר",
        "task": "חישוב חבות מס שבח ומס רכישה, בדיקת זכאות לפטורים (סעיף 49ב), הצגת חלופות לתכנון מס, חישוב אינפלציוני לינארי",
        "constraints": "לפי חוק מיסוי מקרקעין (תיקון 76), פסיקה עדכנית, הוראות ביצוע רשות המיסים. דיוק מספרי מלא. ציון כל הנחה שנעשתה",
        "output_structure": "1) טבלת חישוב מס שבח מפורטת 2) טבלת חלופות תכנון מס עם חיסכון צפוי 3) רשימת מסמכים נדרשים 4) timeline מועדים (הצהרה, תשלום)",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


def example_business_consultant():
    """דוגמה 3: יועץ עסקי - due diligence"""
    print("=" * 70)
    print("דוגמה 3: יועץ עסקי - בדיקת נאותות לרכישת חברה")
    print("=" * 70)
    print()

    session = PromptSession(
        project_name="עוזר Due Diligence",
        domain="ייעוץ עסקי - M&A",
        platform="מערכת פנימית לצוות",
    )

    session.answers = {
        "role": "יועץ עסקי בכיר בתחום מיזוגים ורכישות (M&A), עם ניסיון בהערכות שווי ובדיקות נאותות",
        "audience": "צוות ה-deal team (עו\"ד, רו\"ח, אנליסט) - שפה מקצועית, ממוקד בממצאים ודגלים אדומים",
        "input_context": "דוחות כספיים מבוקרים (3 שנים), חוזים מהותיים, רשימת עובדים, רשימת לקוחות, פטנטים וקניין רוחני, תביעות תלויות",
        "task": "ניתוח due diligence: זיהוי סיכונים, red flags, נקודות למשא ומתן, הערכת שווי ראשונית, השוואה לעסקאות דומות בענף",
        "constraints": "סודיות מלאה (NDA). התייחסות ל-IFRS. ציון רמת ודאות לכל ממצא. הפרדה בין עובדות להערכות",
        "output_structure": "דוח DD מובנה: 1) Executive Summary (עמוד אחד) 2) ממצאים לפי קטגוריה (פיננסי, משפטי, תפעולי, HR) 3) טבלת סיכונים (red/yellow/green) 4) המלצות לשלב המו\"מ",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


def example_insurance():
    """דוגמה 4: סוכן ביטוח - השוואת פוליסות"""
    print("=" * 70)
    print("דוגמה 4: סוכן ביטוח - השוואת פוליסות")
    print("=" * 70)
    print()

    session = PromptSession(
        project_name="משווה פוליסות AI",
        domain="ביטוח - פוליסות עסקיות",
        platform="בוט ווטסאפ לסוכנים",
    )

    session.answers = {
        "role": "סוכן ביטוח מורשה עם התמחות בביטוח עסקי ואחריות מקצועית",
        "audience": "בעל עסק קטן-בינוני - שפה ברורה, דגש על מה מכוסה ומה לא, תרגום הפוליסה לעברית פשוטה",
        "input_context": "2-3 הצעות פוליסה מחברות ביטוח שונות (PDF), פרטי העסק (ענף, מחזור, מספר עובדים)",
        "task": "השוואה מפורטת בין הפוליסות: כיסויים, חריגים, השתתפות עצמית, תקרות, תנאים מיוחדים. המלצה מנומקת",
        "constraints": "ציון שהמידע אינו מהווה ייעוץ ביטוחי מחייב. התייחסות לחוק חוזה הביטוח. אובייקטיביות מלאה",
        "output_structure": "טבלת השוואה: כיסוי | פוליסה A | פוליסה B | פוליסה C | הערות. למטה: 3 יתרונות ו-3 חסרונות לכל פוליסה + המלצה סופית",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


if __name__ == "__main__":
    example_lawyer_realestate()
    print("\n")
    example_accountant_tax()
    print("\n")
    example_business_consultant()
    print("\n")
    example_insurance()
