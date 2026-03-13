"""
סוכן בניית פרומפטים - מודל 6 השלבים.

הסוכן מנהל שיחה אינטראקטיבית עם המשתמש, עובר שלב-אחרי-שלב,
שואל שאלות מעמיקות, ובסוף מייצר פרומפט מקצועי ומובנה.
"""

import anthropic

from prompt_builder.templates.app_templates import (
    ALL_DOMAINS,
    DomainTemplate,
    PromptStep,
)


SYSTEM_PROMPT = """\
אתה סוכן מומחה בבניית פרומפטים לאפליקציות AI.
אתה עובד במודל של 6 שלבים מובנים:

1. **תפקיד (Role)** - מי ה-AI? איזה Persona הוא מאמץ?
2. **קהל יעד (Audience)** - עבור מי התוצר?
3. **הזנת נתונים (Input)** - על איזה מידע ה-AI נשען?
4. **המשימה (Task)** - מה הפעולה הספציפית?
5. **אילוצים (Constraints)** - מה המגבלות והחוקים?
6. **מבנה הפלט (Output)** - איך התוצאה נראית?

## איך אתה עובד:
- בכל שלב, שאל שאלה ממוקדת אחת
- הצג את האפשרויות הזמינות
- אם המשתמש בחר אפשרות, שאל שאלת העמקה אחת רלוונטית
- אל תציף - שאלה אחת בכל פעם
- כשיש לך מספיק מידע בשלב, עבור לשלב הבא
- הצע ברירות מחדל חכמות כשאפשר
- כתוב בעברית

## כשמבקשים לייצר את הפרומפט הסופי:
צור פרומפט מובנה שמשלב את כל 6 השלבים לפרומפט אחד זורם ומקצועי.
הפרומפט צריך להיות מוכן להעתקה ושימוש ישיר.
"""


class PromptBuilderAgent:
    """סוכן אינטראקטיבי לבניית פרומפטים במודל 6 שלבים"""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.conversation: list[dict] = []
        self.domain: DomainTemplate | None = None
        self.current_step_idx: int = 0
        self.answers: dict[str, str] = {}
        self.project_name: str = ""
        self.follow_ups_asked: set[str] = set()

    # ------------------------------------------------------------------
    # Domain & Step Management
    # ------------------------------------------------------------------

    def select_domain(self, domain_name: str) -> DomainTemplate | None:
        """בחירת תחום מקצועי"""
        self.domain = ALL_DOMAINS.get(domain_name)
        return self.domain

    def get_current_step(self) -> PromptStep | None:
        """מחזיר את השלב הנוכחי"""
        if not self.domain:
            return None
        if self.current_step_idx >= len(self.domain.steps):
            return None
        return self.domain.steps[self.current_step_idx]

    def advance_step(self) -> bool:
        """עובר לשלב הבא. מחזיר False אם סיימנו את כל 6 השלבים."""
        self.current_step_idx += 1
        if not self.domain:
            return False
        return self.current_step_idx < len(self.domain.steps)

    def is_complete(self) -> bool:
        """האם עברנו על כל 6 השלבים?"""
        if not self.domain:
            return False
        return self.current_step_idx >= len(self.domain.steps)

    def save_answer(self, key: str, answer: str) -> None:
        """שומר תשובה לשלב"""
        self.answers[key] = answer

    # ------------------------------------------------------------------
    # Formatted step display
    # ------------------------------------------------------------------

    def format_step_display(self) -> str | None:
        """מחזיר תצוגה מעוצבת של השלב הנוכחי"""
        step = self.get_current_step()
        if not step:
            return None

        lines = [
            f"━━━ שלב {step.number}/6: {step.title} ━━━",
            "",
            f"❓ {step.question}",
            "",
        ]

        if step.options:
            lines.append("אפשרויות:")
            for i, opt in enumerate(step.options, 1):
                desc = f" - {opt.description}" if opt.description else ""
                lines.append(f"  {i}. {opt.label}{desc}")

        if step.allow_custom:
            lines.append("")
            lines.append("  (או הקלד תשובה חופשית)")

        return "\n".join(lines)

    def get_progress_bar(self) -> str:
        """מחזיר בר התקדמות ויזואלי"""
        if not self.domain:
            return ""
        total = len(self.domain.steps)
        filled = min(self.current_step_idx, total)
        bar = "█" * filled + "░" * (total - filled)
        return f"[{bar}] {filled}/{total}"

    # ------------------------------------------------------------------
    # AI Chat
    # ------------------------------------------------------------------

    def chat(self, user_message: str) -> str:
        """שולח הודעה לסוכן ומקבל תשובה"""
        # בניית ההקשר
        context_parts = []

        if self.domain:
            context_parts.append(f"תחום: {self.domain.display_name}")
            context_parts.append(f"התקדמות: שלב {self.current_step_idx + 1} מתוך {len(self.domain.steps)}")

        step = self.get_current_step()
        if step:
            options_str = ", ".join(o.label for o in step.options)
            context_parts.append(
                f"שלב נוכחי: {step.title}\n"
                f"שאלה: {step.question}\n"
                f"אפשרויות: {options_str}\n"
                f"רמז להעמקה: {step.follow_up_hint}"
            )

        if self.answers:
            filled = "\n".join(f"- {k}: {v}" for k, v in self.answers.items())
            context_parts.append(f"תשובות שנאספו עד כה:\n{filled}")

        if self.domain and self.domain.extra_questions:
            extras = "\n".join(f"- {q}" for q in self.domain.extra_questions)
            context_parts.append(f"שאלות נוספות שכדאי לשאול בהקשר:\n{extras}")

        system = SYSTEM_PROMPT
        if context_parts:
            system += "\n\n## הקשר נוכחי:\n" + "\n\n".join(context_parts)

        self.conversation.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=self.conversation,
        )

        assistant_text = response.content[0].text
        self.conversation.append({"role": "assistant", "content": assistant_text})
        return assistant_text

    # ------------------------------------------------------------------
    # Prompt Generation
    # ------------------------------------------------------------------

    def generate_prompt(self) -> str:
        """מייצר פרומפט מובנה מ-6 השלבים"""
        lines: list[str] = []
        lines.append(f"# פרומפט: {self.project_name or 'אפליקציה חדשה'}")
        lines.append("")

        step_labels = {
            "role": ("תפקיד", "פעל כ"),
            "audience": ("קהל יעד", "התוצר מיועד עבור"),
            "input_context": ("בסיס נתונים", "התבסס על"),
            "task": ("המשימה", "המשימה היא"),
            "constraints": ("אילוצים", "הקפד על"),
            "output_structure": ("מבנה הפלט", "הפלט צריך להיות"),
        }

        # פרומפט זורם
        lines.append("## הפרומפט המוכן")
        lines.append("")

        prompt_parts = []
        for key, (title, prefix) in step_labels.items():
            answer = self.answers.get(key, "")
            if answer:
                prompt_parts.append(f"{prefix} {answer}")

        if prompt_parts:
            lines.append(". ".join(prompt_parts) + ".")
        lines.append("")

        # פירוט לפי שלבים
        lines.append("---")
        lines.append("")
        lines.append("## פירוט לפי שלבים")
        lines.append("")

        for key, (title, _prefix) in step_labels.items():
            answer = self.answers.get(key, "")
            emoji_map = {
                "role": "🎭",
                "audience": "👥",
                "input_context": "📊",
                "task": "🎯",
                "constraints": "⚖️",
                "output_structure": "📋",
            }
            emoji = emoji_map.get(key, "•")
            lines.append(f"### {emoji} {title}")
            if answer:
                lines.append(answer)
            else:
                lines.append("*לא הוגדר*")
            lines.append("")

        return "\n".join(lines)

    def generate_enhanced_prompt(self) -> str:
        """משתמש ב-Claude כדי ליצור פרומפט משופר ומקצועי"""
        raw_prompt = self.generate_prompt()

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=(
                "אתה מומחה בכתיבת פרומפטים מקצועיים לאפליקציות AI. "
                "קיבלת פרומפט גולמי שנבנה ב-6 שלבים. "
                "שפר אותו: הפוך אותו לפרומפט אחד זורם ומקצועי, "
                "הוסף פרטים שחסרים, הבהר דרישות עמומות, "
                "ותן דוגמה לפלט צפוי. "
                "שמור על פורמט Markdown. כתוב בעברית."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"שפר את הפרומפט הבא:\n\n{raw_prompt}",
                }
            ],
        )
        return response.content[0].text

    def generate_one_liner(self) -> str:
        """מייצר פרומפט בשורה אחת מקצועית (כמו בדוגמה של המשתמש)"""
        parts = []

        role = self.answers.get("role", "")
        if role:
            parts.append(f"פעל כ{role} (1)")

        audience = self.answers.get("audience", "")
        if audience:
            parts.append(f"התוצר מיועד ל{audience} (2)")

        input_ctx = self.answers.get("input_context", "")
        if input_ctx:
            parts.append(f"התבסס על {input_ctx} (3)")

        task = self.answers.get("task", "")
        if task:
            parts.append(f"המשימה היא {task} (4)")

        constraints = self.answers.get("constraints", "")
        if constraints:
            parts.append(f"הקפד על {constraints} (5)")

        output = self.answers.get("output_structure", "")
        if output:
            parts.append(f"הפלט צריך להיות {output} (6)")

        return ". ".join(parts) + "."
