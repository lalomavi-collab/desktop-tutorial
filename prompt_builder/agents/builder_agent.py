"""
סוכן בניית פרומפטים גנרי - מודל 6 השלבים.

הסוכן מתאים את עצמו דינמית לכל תחום:
- שואל מה התחום ולאן בונים
- בכל שלב שואל שאלה + אפשרויות רלוונטיות לתחום (נוצרות ע"י Claude)
- שואל שאלת העמקה מקצועית
- בסוף מייצר פרומפט מקצועי
"""

import anthropic

from prompt_builder.templates.app_templates import STEPS, PromptSession


SYSTEM_PROMPT = """\
אתה סוכן מומחה בבניית פרומפטים לאפליקציות AI.

## איך אתה עובד:
אתה מנהל שיחה מובנית של 6 שלבים לבניית פרומפט מושלם.
בכל שלב אתה:
1. מציג את השאלה המרכזית
2. מציע 3-4 אפשרויות רלוונטיות **לתחום הספציפי** שהמשתמש הגדיר
3. נותן למשתמש לבחור או להקליד תשובה חופשית
4. שואל שאלת העמקה אחת חכמה ומקצועית שרלוונטית לתחום

## כללים:
- שאלה אחת בכל פעם - אל תציף
- התאם את האפשרויות, השפה, והדוגמאות לתחום המקצועי
- שאל שאלות מקצועיות שרק מומחה בתחום היה שואל
- כשהמשתמש עונה בקצרה, בקש פירוט אם חסר
- הצע ברירות מחדל חכמות
- כתוב בעברית
- כשאתה שואל שאלת העמקה, הסבר למה היא חשובה

## מבנה ה-6 שלבים:
1. תפקיד (Role) - מי ה-AI
2. קהל יעד (Audience) - עבור מי
3. נתונים (Input) - על בסיס מה
4. משימה (Task) - מה לעשות
5. אילוצים (Constraints) - מה המגבלות
6. פלט (Output) - איך נראה
"""


class PromptBuilderAgent:
    """סוכן גנרי לבניית פרומפטים - מתאים את עצמו לכל תחום"""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.conversation: list[dict] = []
        self.session = PromptSession()

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def set_project_info(self, name: str, domain: str, platform: str = "") -> None:
        """הגדרת פרטי הפרויקט"""
        self.session.project_name = name
        self.session.domain = domain
        self.session.platform = platform

    # ------------------------------------------------------------------
    # Step-by-step interaction
    # ------------------------------------------------------------------

    def ask_step(self, user_message: str | None = None) -> str:
        """
        מריץ את השלב הנוכחי.
        - אם user_message=None: מציג את השאלה עם אפשרויות
        - אם user_message מסופק: מעבד את התשובה ושואל העמקה
        """
        step = self.session.get_current_step()
        if not step:
            return self._generate_final_prompt()

        # בניית הקשר
        context = self._build_context()

        if user_message is None:
            # שלב חדש - בקש מ-Claude להציג שאלה עם אפשרויות מותאמות לתחום
            prompt = (
                f"אנחנו בשלב {step.number}/6: **{step.title_he}** ({step.title_en})\n\n"
                f"השאלה המרכזית: {step.core_question}\n"
                f"הנחיה: {step.guidance}\n\n"
                f"הצג למשתמש את השאלה, והצע 3-4 אפשרויות ממוספרות שרלוונטיות "
                f"לתחום '{self.session.domain}'"
                f"{f' בפלטפורמת {self.session.platform}' if self.session.platform else ''}.\n"
                f"הוסף אפשרות לתשובה חופשית."
            )
        else:
            # המשתמש ענה - שמור ושאל העמקה
            self.session.save_answer(user_message)
            prompt = (
                f"בשלב {step.number}/6 ({step.title_he}), המשתמש ענה: '{user_message}'\n\n"
                f"שאל שאלת העמקה אחת קצרה וחכמה שתעזור לחדד את הפרומפט.\n"
                f"השאלה צריכה להיות מקצועית ורלוונטית לתחום '{self.session.domain}'.\n"
                f"הסבר בקצרה למה השאלה חשובה."
            )

        return self._chat(prompt, context)

    def process_follow_up(self, answer: str) -> None:
        """מעבד תשובת העמקה ומעדכן את התשובה"""
        step = self.session.get_current_step()
        if step and answer:
            current = self.session.answers.get(step.key, "")
            self.session.save_answer(f"{current}. {answer}" if current else answer)

    def advance(self) -> bool:
        """עובר לשלב הבא"""
        return self.session.advance()

    # ------------------------------------------------------------------
    # Direct chat (free-form conversation)
    # ------------------------------------------------------------------

    def chat(self, message: str) -> str:
        """שיחה חופשית עם הסוכן"""
        context = self._build_context()
        return self._chat(message, context)

    # ------------------------------------------------------------------
    # Prompt generation
    # ------------------------------------------------------------------

    def generate_prompt(self) -> str:
        """מייצר את הפרומפט המובנה"""
        return self.session.generate_full_prompt()

    def generate_one_liner(self) -> str:
        """מייצר פרומפט בשורה אחת"""
        return self.session.generate_one_liner()

    def generate_enhanced_prompt(self) -> str:
        """משתמש ב-Claude לשפר את הפרומפט"""
        raw = self.session.generate_full_prompt()

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=(
                f"אתה מומחה בכתיבת פרומפטים מקצועיים בתחום: {self.session.domain}.\n"
                f"קיבלת פרומפט גולמי שנבנה ב-6 שלבים.\n"
                f"שפר אותו: הפוך לפרומפט אחד זורם ומקצועי, "
                f"הוסף פרטים חסרים לפי הידע שלך בתחום, "
                f"הבהר דרישות עמומות, ותן דוגמה לפלט צפוי.\n"
                f"שמור על פורמט Markdown. כתוב בעברית."
            ),
            messages=[{"role": "user", "content": f"שפר את הפרומפט:\n\n{raw}"}],
        )
        return response.content[0].text

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_context(self) -> str:
        """בונה את ההקשר המלא לשיחה"""
        parts = [
            f"שם הפרויקט: {self.session.project_name}",
            f"תחום: {self.session.domain}",
        ]
        if self.session.platform:
            parts.append(f"פלטפורמה: {self.session.platform}")

        step = self.session.get_current_step()
        if step:
            parts.append(f"שלב נוכחי: {step.number}/6 - {step.title_he}")
            parts.append(f"התקדמות: {self.session.get_progress()}")

        if self.session.answers:
            parts.append("\nתשובות שנאספו:")
            for s in STEPS:
                if s.key in self.session.answers:
                    parts.append(f"  שלב {s.number} ({s.title_he}): {self.session.answers[s.key]}")

        return "\n".join(parts)

    def _chat(self, user_message: str, context: str) -> str:
        """שולח הודעה ל-Claude עם הקשר"""
        system = SYSTEM_PROMPT + f"\n\n## הקשר נוכחי:\n{context}"

        self.conversation.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=self.conversation,
        )

        text = response.content[0].text
        self.conversation.append({"role": "assistant", "content": text})
        return text

    def _generate_final_prompt(self) -> str:
        """מייצר הודעת סיום עם הפרומפט"""
        return (
            "כל 6 השלבים הושלמו! הנה הפרומפט שנבנה:\n\n"
            + self.session.generate_one_liner()
        )
