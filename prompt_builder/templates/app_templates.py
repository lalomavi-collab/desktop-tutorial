"""
מודל 6 השלבים לבניית פרומפטים מקצועיים.

כל פרומפט נבנה מ-6 שלבים מובנים:
1. תפקיד (Role & Goal) - מי ה-AI?
2. קהל יעד (Target Audience) - עבור מי?
3. הזנת נתונים (Input Context) - על בסיס מה?
4. המשימה (The Task) - מה לעשות?
5. אילוצים וחוקים (Constraints) - מה המגבלות?
6. מבנה הפלט (Output Structure) - איך זה נראה?
"""

from dataclasses import dataclass, field


@dataclass
class StepOption:
    """אפשרות בחירה בתוך שלב"""
    label: str
    description: str = ""


@dataclass
class PromptStep:
    """שלב בודד בתהליך בניית הפרומפט"""
    number: int
    key: str
    title: str
    question: str
    options: list[StepOption] = field(default_factory=list)
    allow_custom: bool = True
    follow_up_hint: str = ""


@dataclass
class DomainTemplate:
    """תבנית תחום מקצועי עם 6 שלבים מותאמים"""
    name: str
    display_name: str
    description: str
    steps: list[PromptStep] = field(default_factory=list)
    extra_questions: list[str] = field(default_factory=list)


# ======================================================================
# שלבי הבסיס (6 Steps) - ברירת מחדל גנרית
# ======================================================================

BASE_STEPS = [
    PromptStep(
        number=1,
        key="role",
        title="הגדרת התפקיד (Role & Goal)",
        question="מהו ה-Persona שה-AI צריך לאמץ?",
        options=[
            StepOption("מומחה טכני", "מהנדס תוכנה / ארכיטקט מערכות"),
            StepOption("יועץ עסקי", "יועץ אסטרטגי / ניהולי"),
            StepOption("מעצב מוצר", "UX/UI designer"),
            StepOption("כותב תוכן", "קופירייטר / כותב טכני"),
        ],
        follow_up_hint="שאל על התמחות ספציפית, שנות ניסיון, וסגנון תקשורת",
    ),
    PromptStep(
        number=2,
        key="audience",
        title="קהל היעד (Target Audience)",
        question="עבור מי התוצר מיועד?",
        options=[
            StepOption("משתמש קצה", "אנשים שאינם טכניים - שפה פשוטה"),
            StepOption("מפתחים", "צוות טכני - שפה מקצועית"),
            StepOption("הנהלה", "מנהלים - דגש על ROI ותובנות"),
            StepOption("לקוחות", "לקוחות חיצוניים - דגש על ערך"),
        ],
        follow_up_hint="שאל על רמת הידע של הקהל, מה חשוב להם, ובאיזה שפה הם מדברים",
    ),
    PromptStep(
        number=3,
        key="input_context",
        title="הזנת הנתונים (Input Context)",
        question="על איזה בסיס נתונים ה-AI נשען?",
        options=[
            StepOption("קובץ/מסמך", "PDF, Word, Excel שהמשתמש מעלה"),
            StepOption("טקסט חופשי", "המשתמש מקליד את המידע"),
            StepOption("API / בסיס נתונים", "נתונים ממערכת קיימת"),
            StepOption("שילוב מקורות", "כמה סוגי קלט ביחד"),
        ],
        follow_up_hint="שאל על פורמט הנתונים, גודל, ומה קורה כשחסר מידע",
    ),
    PromptStep(
        number=4,
        key="task",
        title="המשימה (The Task)",
        question="מה הפעולה הספציפית שהאפליקציה צריכה לבצע?",
        options=[
            StepOption("ניתוח", "ניתוח מידע והפקת תובנות"),
            StepOption("יצירת תוכן", "כתיבה, סיכום, תרגום"),
            StepOption("קבלת החלטות", "המלצות, השוואות, דירוג"),
            StepOption("אוטומציה", "תהליך אוטומטי מקצה לקצה"),
        ],
        follow_up_hint="שאל על המשימה הספציפית, מה מצופה כתוצר, ומה ההגדרה של הצלחה",
    ),
    PromptStep(
        number=5,
        key="constraints",
        title="אילוצים וחוקים (Constraints & Logic)",
        question="מהם האילוצים שחייבים להיצמד אליהם?",
        options=[
            StepOption("רגולציה / חוק", "תקנות, חוקים, תקנים"),
            StepOption("פורמט ספציפי", "מכתב רשמי, טופס, תבנית קבועה"),
            StepOption("אורך / גודל", "מגבלת מילים, עמודים, זמן"),
            StepOption("שפה וטון", "רשמי, ידידותי, טכני, משפטי"),
        ],
        allow_custom=True,
        follow_up_hint="שאל על חוקים עסקיים, דברים שאסור לכלול, ורמת דיוק נדרשת",
    ),
    PromptStep(
        number=6,
        key="output_structure",
        title="מבנה הפלט (Output Structure)",
        question="איך התוצאה צריכה להיראות?",
        options=[
            StepOption("טבלה", "טבלה מובנית עם עמודות מוגדרות"),
            StepOption("רשימת Checklist", "רשימת פריטים עם סימון V"),
            StepOption("מסמך מובנה", "מסמך עם כותרות וסעיפים"),
            StepOption("JSON / מבנה נתונים", "פלט מובנה לשימוש באפליקציה"),
        ],
        follow_up_hint="שאל על עמודות/שדות ספציפיים, סדר המידע, ומה חייב להופיע",
    ),
]


# ======================================================================
# תבניות תחומים מקצועיים
# ======================================================================

LEGAL_DOMAIN = DomainTemplate(
    name="legal",
    display_name="משפטי / עריכת דין",
    description="אפליקציות בתחום המשפטי - חוזים, ייעוץ, ליטיגציה",
    steps=[
        PromptStep(
            number=1,
            key="role",
            title="הגדרת התפקיד (Role & Goal)",
            question="מהו ה-Persona שה-AI צריך לאמץ?",
            options=[
                StepOption("עורך דין מומחה לנדל\"ן", "התמחות בעסקאות, תמ\"א 38, קומבינציה"),
                StepOption("חוקר אקדמי במשפטים", "ניתוח פסיקה, מאמרים אקדמיים"),
                StepOption("מרצה בקורס משפטי", "הוראה, הסברה, בניית סילבוס"),
                StepOption("בורר בסכסוך", "גישור, בוררות, פתרון סכסוכים"),
            ],
            follow_up_hint="שאל על תחום ההתמחות הספציפי, שנות ניסיון, והאם נדרש ייצוג בבית משפט מסוים",
        ),
        PromptStep(
            number=2,
            key="audience",
            title="קהל היעד (Target Audience)",
            question="עבור מי התוצר מיועד?",
            options=[
                StepOption("לקוח בקליניקה", "שפה פשוטה וברורה, ללא ז'רגון משפטי"),
                StepOption("בית משפט", "שפה משפטית פורמלית, הפניות לחוק ופסיקה"),
                StepOption("סטודנטים בקורס", "שפה לימודית, דוגמאות מעשיות"),
                StepOption("מנהל המשרד", "דאשבורד ניהולי, סטטיסטיקות, KPIs"),
            ],
            follow_up_hint="שאל על רמת הידע המשפטי של הקהל ומה הם צריכים להבין מהתוצר",
        ),
        PromptStep(
            number=3,
            key="input_context",
            title="הזנת הנתונים (Input Context)",
            question="על איזה בסיס נתונים ה-AI נשען?",
            options=[
                StepOption("קובץ PDF של חוזה", "חוזה סרוק או דיגיטלי לניתוח"),
                StepOption("תיק לקוח מהקליניקה", "מסמכי תיק, פרוטוקולים, תכתובות"),
                StepOption("סילבוס של קורס", "תוכנית לימודים, מקורות, מטלות"),
                StepOption("נתוני אקסל של גבייה", "טבלאות חובות, תשלומים, תאריכים"),
            ],
            follow_up_hint="שאל על היקף הנתונים, רגישות המידע, והאם יש מסמכים נלווים",
        ),
        PromptStep(
            number=4,
            key="task",
            title="המשימה (The Task)",
            question="מה הפעולה הספציפית שהאפליקציה צריכה לבצע?",
            options=[
                StepOption("ניתוח סיכונים בחוזה", "זיהוי סעיפים בעייתיים, סיכונים כספיים"),
                StepOption("בניית מערך שיעור", "הכנת חומר לימודי לקורס חדש"),
                StepOption("סיכום סטטוס תיקים", "דוח מצב תיקים ללקוח או למשרד"),
                StepOption("ניסוח מכתב משפטי", "מכתב התראה, חוות דעת, תשובה לתביעה"),
            ],
            follow_up_hint="שאל מה בדיוק צריך לבדוק, מה ההגדרה של הצלחה, ומה קורה עם edge cases",
        ),
        PromptStep(
            number=5,
            key="constraints",
            title="אילוצים וחוקים (Constraints & Logic)",
            question="מהן 'שורות הקוד' המשפטיות שחייבים להיצמד אליהן?",
            options=[
                StepOption("לפי חוק המכר (דירות)", "חוק המכר, תקנות, פסיקה רלוונטית"),
                StepOption("בפורמט מכתב התראה", "מבנה רשמי, אזהרות, מועדים"),
                StepOption("מקסימום 300 מילים", "תמציתי, ממוקד, ללא מילוי"),
                StepOption("התייחסות למודל כלכלי", "עסקת קומבינציה, תמ\"א 38, פינוי-בינוי"),
            ],
            follow_up_hint="שאל על חוקים ספציפיים, פסיקה רלוונטית, ומגבלות תוכן",
        ),
        PromptStep(
            number=6,
            key="output_structure",
            title="מבנה הפלט (Output Structure)",
            question="איך התוצאה צריכה להיראות ויזואלית?",
            options=[
                StepOption("טבלה להשוואה", "טבלה: סיכון | משמעות כספית | המלצה"),
                StepOption("רשימת Checklist", "צ'קליסט של פעולות נדרשות"),
                StepOption("מסמך משפטי מובנה", "כותרות, סעיפים, סיכום"),
                StepOption("מצגת של 5 שקפים", "שקופיות מובנות עם נקודות מפתח"),
            ],
            follow_up_hint="שאל על עמודות ספציפיות, מה חייב להופיע, ומה סדר העדיפויות",
        ),
    ],
    extra_questions=[
        "האם נדרשת הפנייה לסעיפי חוק ספציפיים?",
        "האם יש פסיקה מנחה שצריך להתייחס אליה?",
        "מהי רמת הסודיות של המידע?",
        "האם התוצר ישמש כבסיס למסמך משפטי רשמי?",
    ],
)

EDUCATION_DOMAIN = DomainTemplate(
    name="education",
    display_name="חינוך / הוראה",
    description="אפליקציות בתחום החינוך - קורסים, הדרכות, תוכן לימודי",
    steps=[
        PromptStep(
            number=1,
            key="role",
            title="הגדרת התפקיד (Role & Goal)",
            question="מהו ה-Persona שה-AI צריך לאמץ?",
            options=[
                StepOption("מרצה אקדמי", "פרופסור/מרצה עם סמכות אקדמית"),
                StepOption("מורה פרטי", "סבלני, מותאם אישית, צעד-אחרי-צעד"),
                StepOption("מעצב הדרכה", "Instructional Designer - בניית תוכניות"),
                StepOption("מנטור מקצועי", "מנחה מנוסה עם גישה מעשית"),
            ],
            follow_up_hint="שאל על התחום האקדמי, רמת ההוראה, וגישה פדגוגית מועדפת",
        ),
        PromptStep(
            number=2,
            key="audience",
            title="קהל היעד (Target Audience)",
            question="עבור מי התוצר מיועד?",
            options=[
                StepOption("תלמידי תיכון", "גילאי 15-18, שפה נגישה"),
                StepOption("סטודנטים לתואר ראשון", "רמה אקדמית בסיסית"),
                StepOption("סטודנטים מתקדמים", "תואר שני/שלישי, רמה גבוהה"),
                StepOption("אנשי מקצוע בהכשרה", "למידה מקצועית, דגש על יישום"),
            ],
            follow_up_hint="שאל על ידע מוקדם, גודל הכיתה, ואתגרים צפויים",
        ),
        PromptStep(
            number=3,
            key="input_context",
            title="הזנת הנתונים (Input Context)",
            question="על איזה בסיס נתונים ה-AI נשען?",
            options=[
                StepOption("סילבוס קיים", "תוכנית לימודים מוכנה"),
                StepOption("ספר לימוד / מאמרים", "חומר אקדמי כתוב"),
                StepOption("הקלטות / וידאו", "תמלול הרצאות קיימות"),
                StepOption("נתוני תלמידים", "ציונים, נוכחות, משובים"),
            ],
            follow_up_hint="שאל על היקף החומר, פורמט, ומה כבר קיים לעומת מה שצריך ליצור",
        ),
        PromptStep(
            number=4,
            key="task",
            title="המשימה (The Task)",
            question="מה הפעולה הספציפית?",
            options=[
                StepOption("בניית מערך שיעור", "תכנון שיעור מלא עם פעילויות"),
                StepOption("יצירת מבחן / מטלה", "שאלות, רובריקה, קריטריונים"),
                StepOption("סיכום חומר לימודי", "תמצות ושכתוב חומר קיים"),
                StepOption("מתן משוב מותאם", "משוב אישי על עבודות תלמידים"),
            ],
            follow_up_hint="שאל על יעדי הלמידה, משך השיעור, ושיטות הערכה",
        ),
        PromptStep(
            number=5,
            key="constraints",
            title="אילוצים וחוקים (Constraints)",
            question="מהם האילוצים?",
            options=[
                StepOption("תקן תוכנית לימודים", "התאמה לתל\"ן / מה\"ט / אקדמיה"),
                StepOption("זמן מוגבל", "שיעור של 45/90 דקות"),
                StepOption("נגישות", "התאמה ללקויות למידה, רב-תרבותיות"),
                StepOption("טכנולוגיה זמינה", "רק לוח, מחשב, או Zoom"),
            ],
            follow_up_hint="שאל על מגבלות פיזיות, תקציב, וכלים זמינים",
        ),
        PromptStep(
            number=6,
            key="output_structure",
            title="מבנה הפלט (Output Structure)",
            question="איך התוצאה צריכה להיראות?",
            options=[
                StepOption("מערך שיעור מובנה", "פתיחה, גוף, סיכום, משימה"),
                StepOption("מצגת", "שקופיות מוכנות לשימוש"),
                StepOption("דף עבודה", "תרגילים ושאלות לתלמיד"),
                StepOption("רובריקה להערכה", "טבלת קריטריונים וציונים"),
            ],
            follow_up_hint="שאל על פורמט מועדף, מספר עמודים, ומה חייב להיכלל",
        ),
    ],
    extra_questions=[
        "מהם יעדי הלמידה המרכזיים?",
        "איזה שיטות הוראה מועדפות? (חזיתי, שיתופי, PBL)",
        "האם נדרשת דיפרנציאציה לרמות שונות?",
    ],
)

BUSINESS_DOMAIN = DomainTemplate(
    name="business",
    display_name="עסקי / ניהולי",
    description="אפליקציות עסקיות - ניתוח, דוחות, אוטומציה ניהולית",
    steps=[
        PromptStep(
            number=1,
            key="role",
            title="הגדרת התפקיד (Role & Goal)",
            question="מהו ה-Persona שה-AI צריך לאמץ?",
            options=[
                StepOption("יועץ אסטרטגי", "ניתוח שוק, אסטרטגיה עסקית"),
                StepOption("אנליסט נתונים", "ניתוח מספרים, מגמות, תחזיות"),
                StepOption("מנהל מוצר", "תעדוף, roadmap, דרישות"),
                StepOption("יועץ שיווקי", "מיתוג, קמפיינים, תוכן שיווקי"),
            ],
            follow_up_hint="שאל על התעשייה, גודל החברה, ואתגרים עסקיים ספציפיים",
        ),
        PromptStep(
            number=2,
            key="audience",
            title="קהל היעד (Target Audience)",
            question="עבור מי התוצר מיועד?",
            options=[
                StepOption("מנכ\"ל / דירקטוריון", "Executive summary, מספרים מרכזיים"),
                StepOption("צוות הניהול", "פירוט ביניים, action items"),
                StepOption("צוות מבצע", "הנחיות מעשיות, צעד-אחרי-צעד"),
                StepOption("משקיעים", "מצגת pitch, פיננסים, חזון"),
            ],
            follow_up_hint="שאל על מה מעניין אותם, באיזה תדירות הם צורכים דוחות",
        ),
        PromptStep(
            number=3,
            key="input_context",
            title="הזנת הנתונים (Input Context)",
            question="על איזה בסיס נתונים ה-AI נשען?",
            options=[
                StepOption("דוחות כספיים", "P&L, מאזן, תזרים מזומנים"),
                StepOption("נתוני CRM", "לקוחות, עסקאות, pipeline"),
                StepOption("סקרי שוק", "מחקרי שוק, נתוני מתחרים"),
                StepOption("נתונים תפעוליים", "KPIs, מדדי ביצוע, לוגים"),
            ],
            follow_up_hint="שאל על תקופת הנתונים, מקור, ואמינות",
        ),
        PromptStep(
            number=4,
            key="task",
            title="המשימה (The Task)",
            question="מה הפעולה הספציפית?",
            options=[
                StepOption("ניתוח עסקי", "SWOT, ניתוח מתחרים, הזדמנויות"),
                StepOption("הכנת דוח", "דוח ביצועים, דוח חודשי/רבעוני"),
                StepOption("בניית תוכנית", "תוכנית עסקית, תקציב, roadmap"),
                StepOption("קבלת החלטות", "השוואה בין חלופות, המלצה"),
            ],
            follow_up_hint="שאל על מה בדיוק לנתח, מה ה-KPIs, ומה ה-deadline",
        ),
        PromptStep(
            number=5,
            key="constraints",
            title="אילוצים (Constraints)",
            question="מהם האילוצים?",
            options=[
                StepOption("סודיות עסקית", "NDA, מידע רגיש, GDPR"),
                StepOption("פורמט חברה", "תבנית מוכנה, branding guidelines"),
                StepOption("תקציב", "מגבלות תקציב, ROI מינימלי"),
                StepOption("זמן", "deadline, לוח זמנים קבוע"),
            ],
            follow_up_hint="שאל על מגבלות רגולטוריות, תקציב, וסדרי עדיפויות",
        ),
        PromptStep(
            number=6,
            key="output_structure",
            title="מבנה הפלט (Output Structure)",
            question="איך התוצאה צריכה להיראות?",
            options=[
                StepOption("דאשבורד", "מספרים מרכזיים, גרפים, מגמות"),
                StepOption("מצגת ניהולית", "10-15 שקפים מובנים"),
                StepOption("דוח מפורט", "מסמך עם ניתוח, מסקנות, המלצות"),
                StepOption("One-pager", "עמוד אחד עם עיקרי הדברים"),
            ],
            follow_up_hint="שאל על מה חייב להופיע, מה משני, ומי מאשר את הדוח",
        ),
    ],
    extra_questions=[
        "מהם ה-KPIs המרכזיים שצריך לעקוב אחריהם?",
        "האם יש benchmark של התעשייה להשוואה?",
        "מה תדירות הפקת הדוח? (חד-פעמי, שבועי, חודשי)",
    ],
)

TECH_DOMAIN = DomainTemplate(
    name="tech",
    display_name="טכנולוגי / פיתוח",
    description="אפליקציות טכנולוגיות - פיתוח, DevOps, ארכיטקטורה",
    steps=[
        PromptStep(
            number=1,
            key="role",
            title="הגדרת התפקיד (Role & Goal)",
            question="מהו ה-Persona שה-AI צריך לאמץ?",
            options=[
                StepOption("ארכיטקט תוכנה", "תכנון מערכות, design patterns"),
                StepOption("מפתח Full-Stack", "React, Node, DB, DevOps"),
                StepOption("מהנדס נתונים", "ETL, pipelines, analytics"),
                StepOption("מומחה אבטחה", "penetration testing, security review"),
            ],
            follow_up_hint="שאל על שפות תכנות, frameworks מועדפים, וניסיון בענן",
        ),
        PromptStep(
            number=2,
            key="audience",
            title="קהל היעד (Target Audience)",
            question="עבור מי התוצר מיועד?",
            options=[
                StepOption("מפתחים בצוות", "קוד, דוקומנטציה טכנית"),
                StepOption("Tech Lead / CTO", "ארכיטקטורה, החלטות טכניות"),
                StepOption("Product Manager", "הסברים ללא קוד, trade-offs"),
                StepOption("משתמשי קצה", "UI, תיעוד שימוש, onboarding"),
            ],
            follow_up_hint="שאל על גודל הצוות, רמת הבכירות, ומה הם צריכים מהתוצר",
        ),
        PromptStep(
            number=3,
            key="input_context",
            title="הזנת הנתונים (Input Context)",
            question="על איזה בסיס נתונים ה-AI נשען?",
            options=[
                StepOption("קוד מקור", "repository, codebase קיים"),
                StepOption("מפרט דרישות", "PRD, user stories, tickets"),
                StepOption("תרשים ארכיטקטורה", "diagrams, system design"),
                StepOption("לוגים / מטריקות", "errors, performance data"),
            ],
            follow_up_hint="שאל על גודל הפרויקט, tech stack קיים, ותשתיות",
        ),
        PromptStep(
            number=4,
            key="task",
            title="המשימה (The Task)",
            question="מה הפעולה הספציפית?",
            options=[
                StepOption("כתיבת קוד", "implement feature, fix bug"),
                StepOption("Code Review", "סקירת קוד, מציאת בעיות"),
                StepOption("תכנון ארכיטקטורה", "system design, API design"),
                StepOption("Debug / troubleshoot", "מציאת ופתרון תקלות"),
            ],
            follow_up_hint="שאל על scope, דדליין, ואילו טסטים נדרשים",
        ),
        PromptStep(
            number=5,
            key="constraints",
            title="אילוצים (Constraints)",
            question="מהם האילוצים הטכניים?",
            options=[
                StepOption("ביצועים", "latency, throughput, scalability"),
                StepOption("תאימות", "backward compatibility, versioning"),
                StepOption("אבטחה", "OWASP, encryption, auth"),
                StepOption("תקציב ענן", "budget limits, specific cloud provider"),
            ],
            follow_up_hint="שאל על SLA, availability requirements, ומגבלות תשתית",
        ),
        PromptStep(
            number=6,
            key="output_structure",
            title="מבנה הפלט (Output Structure)",
            question="איך התוצאה צריכה להיראות?",
            options=[
                StepOption("קוד מוכן", "קבצים, פונקציות, טסטים"),
                StepOption("מסמך טכני", "RFC, ADR, design doc"),
                StepOption("תרשים", "sequence diagram, ERD, architecture"),
                StepOption("Checklist טכני", "צעדים לביצוע, migration plan"),
            ],
            follow_up_hint="שאל על שפת הקוד, conventions, ודרישות תיעוד",
        ),
    ],
    extra_questions=[
        "מה ה-tech stack הנוכחי?",
        "האם יש CI/CD pipeline קיים?",
        "מה דרישות ה-testing? (unit, integration, e2e)",
    ],
)

HEALTH_DOMAIN = DomainTemplate(
    name="health",
    display_name="בריאות / רפואה",
    description="אפליקציות בתחום הבריאות - ניתוח רפואי, מעקב מטופלים",
    steps=[
        PromptStep(
            number=1,
            key="role",
            title="הגדרת התפקיד (Role & Goal)",
            question="מהו ה-Persona שה-AI צריך לאמץ?",
            options=[
                StepOption("רופא מומחה", "ניתוח ממצאים, אבחנה מבדלת"),
                StepOption("אחות / אח מוסמך", "מעקב מטופלים, הנחיות טיפול"),
                StepOption("חוקר קליני", "ניתוח מחקרים, סטטיסטיקה רפואית"),
                StepOption("מנהל מערכת בריאות", "תפעול, יעילות, דוחות"),
            ],
            follow_up_hint="שאל על התמחות רפואית, סביבת עבודה (בי\"ח, קופת חולים, קליניקה)",
        ),
        PromptStep(
            number=2,
            key="audience",
            title="קהל היעד (Target Audience)",
            question="עבור מי התוצר מיועד?",
            options=[
                StepOption("רופא מטפל", "שפה רפואית מקצועית"),
                StepOption("מטופל / משפחה", "שפה פשוטה, ללא ז'רגון"),
                StepOption("צוות סיעודי", "הנחיות מעשיות, פרוטוקולים"),
                StepOption("הנהלת בית חולים", "מדדי ביצוע, עלויות"),
            ],
            follow_up_hint="שאל על רמת ההבנה הרפואית, רגישויות תרבותיות",
        ),
        PromptStep(
            number=3,
            key="input_context",
            title="הזנת הנתונים (Input Context)",
            question="על איזה בסיס נתונים ה-AI נשען?",
            options=[
                StepOption("רשומה רפואית", "EMR, סיכומי אשפוז, בדיקות"),
                StepOption("מחקרים קליניים", "מאמרים, meta-analysis"),
                StepOption("פרוטוקולים רפואיים", "guidelines, SOPs"),
                StepOption("נתוני מערכת", "תפוסה, זמני המתנה, תקציב"),
            ],
            follow_up_hint="שאל על רגישות המידע, HIPAA/פרטיות, ומקורות מוסמכים",
        ),
        PromptStep(
            number=4,
            key="task",
            title="המשימה (The Task)",
            question="מה הפעולה הספציפית?",
            options=[
                StepOption("סיכום רפואי", "סיכום ממצאים, תוכנית טיפול"),
                StepOption("ניתוח מחקרי", "סקירת ספרות, evidence-based"),
                StepOption("הכנת פרוטוקול", "נוהל עבודה, checklist רפואי"),
                StepOption("דוח ניהולי", "ביצועי מחלקה, מדדי איכות"),
            ],
            follow_up_hint="שאל על רמת הדחיפות, מה ההשלכות הקליניות, ומי מאשר",
        ),
        PromptStep(
            number=5,
            key="constraints",
            title="אילוצים (Constraints)",
            question="מהם האילוצים?",
            options=[
                StepOption("פרטיות מטופל", "HIPAA, חוק זכויות החולה"),
                StepOption("evidence-based בלבד", "רק מידע מבוסס מחקר"),
                StepOption("פרוטוקול מוסדי", "התאמה לנהלי בית החולים"),
                StepOption("אזהרת disclaimer", "AI לא מחליף רופא"),
            ],
            follow_up_hint="שאל על רגולציה ספציפית, אישורי ועדת אתיקה",
        ),
        PromptStep(
            number=6,
            key="output_structure",
            title="מבנה הפלט (Output Structure)",
            question="איך התוצאה צריכה להיראות?",
            options=[
                StepOption("סיכום SOAP", "Subjective, Objective, Assessment, Plan"),
                StepOption("טבלת תרופות", "תרופה, מינון, תדירות, אינטראקציות"),
                StepOption("Checklist קליני", "רשימת בדיקה מסודרת"),
                StepOption("דוח מובנה", "ממצאים, מסקנות, המלצות"),
            ],
            follow_up_hint="שאל על פורמט EMR, שדות חובה, ומי צורך את הדוח",
        ),
    ],
    extra_questions=[
        "האם נדרש disclaimer שהמידע אינו מהווה ייעוץ רפואי?",
        "איזה מערכת EMR בשימוש?",
        "האם יש אישור ועדת הלסינקי/IRB?",
    ],
)


# ======================================================================
# רישום כל התחומים
# ======================================================================

ALL_DOMAINS: dict[str, DomainTemplate] = {
    d.name: d
    for d in [
        LEGAL_DOMAIN,
        EDUCATION_DOMAIN,
        BUSINESS_DOMAIN,
        TECH_DOMAIN,
        HEALTH_DOMAIN,
    ]
}

# ברירת מחדל גנרית
GENERIC_DOMAIN = DomainTemplate(
    name="generic",
    display_name="כללי / מותאם אישית",
    description="תבנית גנרית - מתאימה לכל תחום",
    steps=BASE_STEPS,
    extra_questions=[
        "מה התחום המקצועי של האפליקציה?",
        "מה הבעיה המרכזית שאתה פותר?",
        "מי המתחרים או הפתרונות הקיימים?",
    ],
)

ALL_DOMAINS["generic"] = GENERIC_DOMAIN
