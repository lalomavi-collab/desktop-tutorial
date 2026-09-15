# -*- coding: utf-8 -*-
"""
התראה על תוצאת ההרצה החודשית.

ההרצה של ה-1 בחודש רצה כשאף אחד לא מסתכל. בלי ההתראה הזו, הרצה שנכשלה
נראית בדיוק כמו הרצה שהצליחה: שקטה. הקובץ הזה נקרא מ-run_monthly.bat
עם קוד היציאה, ושולח מייל לתיבה של המשרד דרך Outlook.

קודי יציאה של run_pipeline.py:
   0  נשלח להנהלת החשבונות
  11  טיוטה מוכנה ב-Outlook, ממתינה לאישור ידני
  12  שער האימות חסם את השליחה - סכומים לא מאומתים
  13  תיקיית החודש ריקה
  14  שגיאה מול Outlook
   1  חריגה שלא נתפסה בפייתון
 אחר  קריסה
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

TITLES = {
    0: "נשלחה להנהלת החשבונות",
    11: "טיוטה מוכנה, ממתינה לאישור שלך",
    12: "לא נשלחה - יש פריטים לא מאומתים",
    13: "לא רצה - תיקיית החודש ריקה",
    14: "נכשלה מול Outlook",
}

EXPLAIN = {
    0: ("הדוח והטבלה נשלחו להנהלת החשבונות. אין צורך בפעולה. "
        "העותק נמצא בפריטים שנשלחו ב-Outlook."),
    11: ("הטיוטה מוכנה בתיקיית הטיוטות ב-Outlook, עם הדוח וטבלת החישוב מצורפים. "
        "פתח, עבור על גיליון 'לאימות' בטבלה, ולחץ שלח. "
        "עד שתשלח, הנהלת החשבונות לא קיבלה דבר."),
    12: ("השליחה נעצרה במכוון: יש מסמכים שהסכום בהם לא אומת. "
        "הרשימה מופיעה בפלט למטה וגם בגיליון 'לאימות' שבטבלה. "
        "תקן, והרץ שוב. אין לעקוף את הבדיקה."),
    13: ("תיקיית החודש ריקה. בדוק שהאיסוף מהמייל עבד ושהמסמכים הגיעו לתיקייה. "
        "דוח על חודש ריק גרוע מאי-דיווח."),
    14: "Outlook החזיר שגיאה. בדוק ש-Outlook פתוח ומחובר, והרץ שוב. פירוט למטה.",
}

def _recipient() -> str:
    for key in ("NOTIFY_EMAIL", "SMTP_USER", "IMAP1_USER"):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    return "avraham@lalum.co"


def _load_env():
    env = HERE / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _log_tail(path: Path, lines: int = 40) -> str:
    if not path.exists():
        return "(לא נמצא קובץ לוג)"
    try:
        content = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        return f"(לא ניתן לקרוא את הלוג: {exc})"
    return "\n".join(content[-lines:]) or "(הלוג ריק)"


def build_body(code: int, log_path: Path) -> tuple[str, str]:
    title = TITLES.get(code, "נכשלה")
    explain = EXPLAIN.get(code, "ההרצה הסתיימה בקוד שגיאה לא מוכר. פירוט בלוג למטה.")
    stamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    ok = code in (0, 11)
    prefix = "סוכן החשבוניות" if ok else "שים לב - סוכן החשבוניות"
    subject = f"{prefix}: ההרצה החודשית {title}"
    body = (
        f"הרצה חודשית, {stamp}\n"
        f"סטטוס: {title} (קוד {code})\n\n"
        f"{explain}\n\n"
        f"{'-' * 50}\n"
        f"פלט ההרצה:\n\n"
        f"{_log_tail(log_path)}\n"
    )
    return subject, body


def main() -> int:
    code = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    log_path = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "last_monthly_run.log"
    _load_env()

    subject, body = build_body(code, log_path)
    draft = {"to": _recipient(), "subject": subject, "body": body, "attachments": []}

    try:
        from invoice_processing.senders.outlook_com_sender import send_via_outlook
        result = send_via_outlook(draft)
        if result.get("sent"):
            print(f"[notify] נשלחה התראה ל-{draft['to']}")
            return 0
        reason = result.get("error") or result.get("reason") or "לא ידוע"
        print(f"[notify] Outlook לא שלח: {reason}")
    except Exception as exc:                      # noqa: BLE001
        print(f"[notify] שליחה דרך Outlook נכשלה: {exc}")

    # נפילה אחורה: אם אי אפשר לשלוח מייל, לפחות להשאיר סימן גלוי
    try:
        base = os.environ.get("INVOICE_BASE_FOLDER") or str(HERE)
        marker = Path(base) / "שים לב - ההרצה החודשית דורשת טיפול.txt"
        marker.write_text(f"{subject}\n\n{body}", encoding="utf-8")
        print(f"[notify] נכתב קובץ התראה: {marker}")
    except OSError as exc:
        print(f"[notify] גם כתיבת קובץ ההתראה נכשלה: {exc}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
