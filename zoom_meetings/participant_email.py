"""
Generates a short, professional follow-up email draft for meeting participants.
"""
import os
from anthropic import Anthropic

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def generate_participant_email(
    topic: str,
    meeting_date_str: str,
    participants: list[dict],
    summary_text: str,
) -> str:
    """Return a ready-to-send email text in Hebrew for the participants."""

    recipient_names = ", ".join(
        p.get("name", "") for p in participants[:5] if p.get("name")
    ) or "שלום"

    prompt = f"""אתה עוזר מקצועי שכותב מיילים עסקיים קצרים ומנומסים בעברית.

נושא הפגישה: {topic}
תאריך: {meeting_date_str}
משתתפים: {recipient_names}

סיכום הפגישה (לפי תוכן):
{summary_text[:1500]}

כתוב מייל מעקב קצר ומקצועי לשליחה למשתתפי הפגישה. המייל צריך:
1. שורת נושא (Subject) — קצרה וברורה
2. פתיחה מנומסת
3. תקציר קצר (3-5 שורות מקסימום) של מה שהוחלט / הוסכם
4. רשימת משימות (bullet points) — מי עושה מה ועד מתי (אם ידוע)
5. סיום מקצועי עם הצעה לפגישה הבאה אם רלוונטי
6. חתימה: "בברכה,\nאברהם ללום"

פורמט:
---
נושא: [שורת הנושא]

[גוף המייל]
---

כתוב בעברית, בצורה חמה אך מקצועית, קצר ולעניין."""

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
