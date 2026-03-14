"""
מודל 6 השלבים לבניית פרומפטים מקצועיים.

מבנה אחיד שעובד לכל תחום, עם דגש על שירותים מקצועיים:
עורכי דין, רואי חשבון, יועצים עסקיים, משרדים מקצועיים.

הסוכן (Claude) מתאים את השאלות דינמית בהתאם לתחום,
ויודע לשאול שאלות מקצועיות ברמה גבוהה.
"""

from dataclasses import dataclass, field


@dataclass
class StepDefinition:
    """הגדרת שלב במודל 6 השלבים"""
    number: int
    key: str
    title_he: str
    title_en: str
    core_question: str
    guidance: str  # הנחיה לסוכן - מה לברר בשלב הזה


# 6 השלבים הקבועים - המבנה אחיד, התוכן דינמי
STEPS: list[StepDefinition] = [
    StepDefinition(
        number=1,
        key="role",
        title_he="הגדרת התפקיד",
        title_en="Role & Goal",
        core_question="מהו ה-Persona שה-AI צריך לאמץ?",
        guidance=(
            "ברר: מה התפקיד המקצועי (עו\"ד, רו\"ח, יועץ, מתווך, שמאי, "
            "מנהל חשבונות, ברוקר ביטוח, יועץ מס...). "
            "מה תחום ההתמחות הספציפי (נדל\"ן, מיסוי, חברות, עבודה, ביטוח...). "
            "מה רמת הבכירות (שותף, בכיר, זוטר). "
            "איזה סגנון תקשורת: רשמי-משפטי, עסקי-ממוקד, או נגיש ללקוח. "
            "האם ה-AI צריך 'סמכות' מקצועית מסוימת (חוות דעת, ייעוץ, ניתוח)."
        ),
    ),
    StepDefinition(
        number=2,
        key="audience",
        title_he="קהל היעד",
        title_en="Target Audience",
        core_question="עבור מי התוצר מיועד?",
        guidance=(
            "ברר: מי קורא את התוצר בפועל? "
            "לקוח פרטי (שפה פשוטה, ללא ז'רגון) / "
            "לקוח עסקי-תאגידי (שפה עסקית, מספרים, bottom line) / "
            "בית משפט או רשות (שפה משפטית פורמלית, הפניות לחוק) / "
            "רשות המיסים (טפסים, נספחים, דיוק טכני) / "
            "עמית מקצועי או שותף (שפה פנימית, קיצורים מקצועיים) / "
            "הנהלה ודירקטוריון (תמצות, dashboard, KPIs). "
            "מה רמת הידע המקצועי שלהם? "
            "מה הם מצפים לקבל ובאיזו רמת פירוט?"
        ),
    ),
    StepDefinition(
        number=3,
        key="input_context",
        title_he="הזנת הנתונים",
        title_en="Input Context",
        core_question="על איזה בסיס נתונים ה-AI נשען?",
        guidance=(
            "ברר: מה סוג המסמכים/נתונים שנכנסים? "
            "חוזה/הסכם PDF / כתב תביעה / דוח כספי / דוח שמאי / "
            "תיק לקוח עם מסמכים / אקסל גבייה-חייבים / "
            "פסקי דין ופסיקה / טפסי מס / דוח ביקורת / "
            "פרוטוקול ישיבה / נתוני CRM-לקוחות. "
            "האם המידע רגיש (חיסיון עו\"ד-לקוח, סודיות עסקית)? "
            "מה קורה כשחסר מידע - לשאול, להניח, או לסמן?"
        ),
    ),
    StepDefinition(
        number=4,
        key="task",
        title_he="המשימה",
        title_en="The Task",
        core_question="מה הפעולה הספציפית שהאפליקציה צריכה לבצע?",
        guidance=(
            "ברר: מה בדיוק צריך לייצר? "
            "ניתוח סיכונים בחוזה / ניסוח מכתב התראה / חוות דעת מקצועית / "
            "סיכום תיק ללקוח / בדיקת נאותות (due diligence) / "
            "הכנת תוכנית מס / ביקורת דוחות כספיים / "
            "ניתוח עסקת קומבינציה / הכנת הצעת מחיר / "
            "השוואה בין חלופות עסקיות / סקירת ציות (compliance). "
            "מה ההגדרה של הצלחה? מה ה-edge cases? "
            "מה קורה עם מצבים חריגים?"
        ),
    ),
    StepDefinition(
        number=5,
        key="constraints",
        title_he="אילוצים וחוקים",
        title_en="Constraints & Logic",
        core_question="מהם האילוצים שחייבים להיצמד אליהם?",
        guidance=(
            "ברר: איזה חקיקה ורגולציה רלוונטית? "
            "חוק המכר (דירות) / חוק החוזים / פקודת מס הכנסה / "
            "חוק מיסוי מקרקעין / תקני ביקורת / IFRS / "
            "חוק הגנת הפרטיות / חוק איסור הלבנת הון / "
            "תקנות רשות ני\"ע / הוראות בנק ישראל. "
            "האם יש פורמט חובה (מכתב התראה, חוו\"ד, טופס)? "
            "מגבלות אורך? רמת פירוט? "
            "דברים שאסור לכלול (ייעוץ ישיר, הבטחות, אחריות)? "
            "דיסקליימר נדרש?"
        ),
    ),
    StepDefinition(
        number=6,
        key="output_structure",
        title_he="מבנה הפלט",
        title_en="Output Structure",
        core_question="איך התוצאה צריכה להיראות?",
        guidance=(
            "ברר: מה הפורמט הרצוי? "
            "טבלת סיכונים (סיכון | חומרה | המלצה) / "
            "מכתב משפטי מובנה (כותרת, נמען, גוף, דרישות, מועדים) / "
            "דוח מקצועי עם סעיפים / צ'קליסט עם V / "
            "דאשבורד עם מספרים / "
            "JSON מובנה לאפליקציה / "
            "מצגת עם שקפים / סיכום של עמוד אחד (one-pager). "
            "מה העמודות/שדות הספציפיים? "
            "מה סדר העדיפויות? מה חייב להופיע ומה אופציונלי?"
        ),
    ),
]

STEP_KEYS = [s.key for s in STEPS]


@dataclass
class PromptSession:
    """סשן בנייה של פרומפט - מחזיק את כל המידע שנאסף"""
    project_name: str = ""
    domain: str = ""  # תחום חופשי שהמשתמש מזין
    platform: str = ""  # לאן בונים (אתר, אפליקציה, בוט, וכו')
    answers: dict[str, str] = field(default_factory=dict)
    current_step: int = 0  # אינדקס 0-5

    @property
    def is_complete(self) -> bool:
        return self.current_step >= len(STEPS)

    def get_current_step(self) -> StepDefinition | None:
        if self.is_complete:
            return None
        return STEPS[self.current_step]

    def save_answer(self, answer: str) -> None:
        step = self.get_current_step()
        if step:
            self.answers[step.key] = answer

    def advance(self) -> bool:
        self.current_step += 1
        return not self.is_complete

    def get_progress(self) -> str:
        filled = min(self.current_step, len(STEPS))
        bar = "█" * filled + "░" * (len(STEPS) - filled)
        return f"[{bar}] {filled}/{len(STEPS)}"

    def generate_one_liner(self) -> str:
        """מייצר פרומפט בשורה אחת ממוספרת"""
        parts = []
        mappings = [
            ("role", "פעל כ"),
            ("audience", "התוצר מיועד ל"),
            ("input_context", "התבסס על "),
            ("task", "המשימה היא "),
            ("constraints", "הקפד על "),
            ("output_structure", "הפלט צריך להיות "),
        ]
        for i, (key, prefix) in enumerate(mappings, 1):
            val = self.answers.get(key, "")
            if val:
                parts.append(f"{prefix}{val} ({i})")
        return ". ".join(parts) + "." if parts else ""

    def generate_full_prompt(self) -> str:
        """מייצר פרומפט מלא מובנה"""
        lines = [f"# פרומפט: {self.project_name or 'אפליקציה חדשה'}"]
        if self.domain:
            lines.append(f"**תחום:** {self.domain}")
        if self.platform:
            lines.append(f"**פלטפורמה:** {self.platform}")
        lines.append("")

        # פרומפט זורם
        lines.append("## הפרומפט")
        lines.append("")
        lines.append(self.generate_one_liner())
        lines.append("")

        # פירוט
        lines.append("---")
        lines.append("## פירוט לפי שלבים")
        lines.append("")

        for step in STEPS:
            answer = self.answers.get(step.key, "*לא הוגדר*")
            lines.append(f"### שלב {step.number}: {step.title_he} ({step.title_en})")
            lines.append(answer)
            lines.append("")

        return "\n".join(lines)
