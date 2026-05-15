"""
Generates a detailed meeting protocol (פרוטוקול) in Hebrew using Claude.
"""
import os
from anthropic import Anthropic

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def generate_protocol(
    topic: str,
    meeting_date_str: str,
    duration_minutes: int,
    participants: list[dict],
    zoom_summary: dict | None,
    transcript: str | None,
) -> str:
    """Return a full detailed protocol as a markdown string in Hebrew."""

    names_rows = "\n".join(
        f"| {p.get('name', '—')} | {p.get('email', '—')} |"
        for p in participants[:20]
    ) or "| לא זמין | — |"

    raw_data = ""
    if zoom_summary:
        overview = zoom_summary.get("summary_overview") or zoom_summary.get("summary", "")
        if overview:
            raw_data += f"סקירה כללית:\n{overview}\n\n"
        for item in zoom_summary.get("summary_details", []):
            label = item.get("label", "")
            text = item.get("summary", "")
            if label and text:
                raw_data += f"{label}:\n{text}\n\n"
    if transcript and not raw_data:
        raw_data = f"תמליל (חלקי):\n{transcript[:5000]}"

    prompt = f"""אתה מזכיר/ה מקצועי/ת שכותב פרוטוקולים משפטיים ועסקיים.

נתוני הפגישה:
- נושא: {topic}
- תאריך: {meeting_date_str}
- משך: {duration_minutes} דקות
- משתתפים: {", ".join(p.get("name","") for p in participants[:20]) or "לא זמין"}

נתונים גולמיים מזום:
{raw_data or "אין נתונים אוטומטיים"}

כתוב פרוטוקול מפורט ומסודר בעברית (RTL) בפורמט Markdown עם הסעיפים הבאים:

# פרוטוקול פגישה — {topic}

## פרטי הפגישה
- **תאריך:**
- **שעה:**
- **משך:**
- **מיקום/פלטפורמה:** Zoom

## משתתפים
(טבלה: שם | תפקיד/ארגון)

## מטרת הפגישה
(משפט אחד)

## סדר יום שנדון
(ממוספר)

## תוכן הדיון — פירוט לפי נושאים
(לכל נושא: כותרת + עיקרי הדברים שנאמרו)

## החלטות שהתקבלו
(ממוספר; אם לא הוחלט — ציין זאת)

## משימות ואחריות
| משימה | אחראי | לסיום עד |
|-------|--------|-----------|

## נושאים פתוחים לפגישה הבאה

## פגישה הבאה
(תאריך ונושא — אם נקבעו)

---
*הפרוטוקול נוצר אוטומטית ועשוי לדרוש עריכה ואישור של המשתתפים.*

כתוב פרוטוקול מלא ומפורט ככל האפשר על-פי הנתונים הזמינים."""

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
