import os
from anthropic import Anthropic

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _build_raw_text(zoom_summary: dict | None, transcript: str | None) -> str:
    parts = []

    if zoom_summary:
        overview = zoom_summary.get("summary_overview") or zoom_summary.get("summary", "")
        if overview:
            parts.append(f"סקירה כללית:\n{overview}")
        for item in zoom_summary.get("summary_details", []):
            label = item.get("label", "")
            text = item.get("summary", "")
            if label and text:
                parts.append(f"{label}:\n{text}")

    if transcript and not parts:
        # Use first 4000 chars of transcript as fallback
        parts.append(f"תמליל (חלקי):\n{transcript[:4000]}")

    return "\n\n".join(parts) if parts else ""


def enhance_summary(
    topic: str,
    zoom_summary: dict | None,
    transcript: str | None,
    participants: list[dict],
    duration_minutes: int,
) -> str:
    """Return a polished Hebrew summary string."""
    raw = _build_raw_text(zoom_summary, transcript)
    names = ", ".join(p.get("name", "לא ידוע") for p in participants[:15]) or "לא ידוע"

    prompt = f"""אתה עוזר מקצועי לסיכום פגישות עסקיות.

נושא הפגישה: {topic}
משתתפים: {names}
משך: {duration_minutes} דקות

נתונים גולמיים מזום:
{raw or "אין נתונים אוטומטיים מזום"}

כתוב סיכום מקצועי ומסודר בעברית (RTL) הכולל בדיוק את הסעיפים הבאים:

**תקציר**
2-3 משפטים על מהות הפגישה ומטרתה.

**נושאים שנדונו**
• רשימה תמציתית עם נקודות

**החלטות שהתקבלו**
• מה הוחלט — אם לא הוחלט דבר כתוב "לא הוחלט דבר מפורש"

**משימות ומעקב**
• שם אחראי — תיאור משימה (אם לא ידוע האחראי כתוב "לבירור")

**הצעד הבא**
משפט אחד ברור על הפעולה הדחופה ביותר.

כתוב בצורה עניינית, ללא מלל מיותר."""

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
