"""סוכן בניית פרומפטים - הליבה של המערכת.

הסוכן משתמש ב-Claude API כדי לנהל שיחה אינטראקטיבית עם המשתמש,
לאסוף מידע על האפליקציה הרצויה, ולייצר פרומפט מובנה ומפורט.
"""

import anthropic

from prompt_builder.templates.app_templates import ALL_TEMPLATES, AppTemplate
from prompt_builder.utils.formatter import format_prompt


SYSTEM_PROMPT = """\
אתה סוכן מומחה בבניית פרומפטים לפיתוח אפליקציות.
התפקיד שלך הוא לעזור למשתמש להגדיר בצורה ברורה ומפורטת את האפליקציה שהוא רוצה לבנות.

## איך אתה עובד:
1. שאל את המשתמש שאלות ממוקדות על כל חלק באפליקציה
2. עזור לו לחשוב על דברים שאולי פספס
3. הצע אפשרויות טכנולוגיות מבוססות על הצרכים שלו
4. בסוף, צור פרומפט מובנה ומוכן לשימוש

## כללים:
- שאל שאלה אחת בכל פעם, אל תציף את המשתמש
- הצע ברירות מחדל חכמות כשאפשר
- תן דוגמאות כשזה עוזר
- כתוב בעברית
- כשהמשתמש מוכן, צור את הפרומפט המלא בפורמט Markdown
"""


class PromptBuilderAgent:
    """סוכן אינטראקטיבי לבניית פרומפטים"""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.conversation: list[dict] = []
        self.template: AppTemplate | None = None
        self.answers: dict[str, str] = {}
        self.current_section_idx: int = 0

    def select_template(self, template_name: str) -> AppTemplate | None:
        """בחירת תבנית לפי שם"""
        self.template = ALL_TEMPLATES.get(template_name)
        return self.template

    def get_current_section_prompt(self) -> str | None:
        """מחזיר הנחיה לחלק הנוכחי"""
        if not self.template:
            return None
        if self.current_section_idx >= len(self.template.sections):
            return None
        section = self.template.sections[self.current_section_idx]
        required_tag = " (חובה)" if section.required else " (אופציונלי)"
        return f"**{section.title}**{required_tag}: {section.description}"

    def chat(self, user_message: str) -> str:
        """שולח הודעה ומקבל תשובה מהסוכן"""
        context_parts = []
        if self.template:
            context_parts.append(f"סוג האפליקציה: {self.template.description}")
            current = self.get_current_section_prompt()
            if current:
                context_parts.append(f"החלק הנוכחי לדיון: {current}")
            if self.answers:
                filled = "\n".join(
                    f"- {k}: {v}" for k, v in self.answers.items()
                )
                context_parts.append(f"מה שכבר מולא:\n{filled}")

        system = SYSTEM_PROMPT
        if context_parts:
            system += "\n\n## הקשר נוכחי:\n" + "\n".join(context_parts)

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

    def save_answer(self, section_title: str, answer: str) -> None:
        """שומר תשובה לחלק מסוים"""
        self.answers[section_title] = answer

    def advance_section(self) -> bool:
        """עובר לחלק הבא. מחזיר False אם סיימנו"""
        self.current_section_idx += 1
        if not self.template:
            return False
        return self.current_section_idx < len(self.template.sections)

    def generate_prompt(self) -> str:
        """מייצר את הפרומפט המלא"""
        if not self.template:
            return "לא נבחרה תבנית"
        return format_prompt(self.template, self.answers)

    def generate_enhanced_prompt(self) -> str:
        """משתמש ב-Claude כדי לשפר ולהרחיב את הפרומפט"""
        raw_prompt = self.generate_prompt()

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=(
                "אתה מומחה בכתיבת פרומפטים לפיתוח תוכנה. "
                "קיבלת פרומפט גולמי. שפר אותו: הוסף פרטים טכניים, "
                "הבהר דרישות עמומות, והפוך אותו למוכן לשימוש. "
                "שמור על הפורמט Markdown. כתוב בעברית."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"שפר את הפרומפט הבא:\n\n{raw_prompt}",
                }
            ],
        )
        return response.content[0].text
