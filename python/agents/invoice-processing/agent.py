"""
סוכן איסוף חשבוניות LALUM — מבוסס Google ADK.
"""

from dotenv import load_dotenv
load_dotenv()  # טוען .env לפני כל דבר אחר

from datetime import datetime

from google.adk.agents import Agent

from invoice_processing.collectors.email_collector import collect_from_emails
from invoice_processing.collectors.folder_collector import collect_from_folder
from invoice_processing.senders.smtp_sender import (
    prepare_accounting_email,
    send_accounting_email,
)


def _current_month() -> str:
    return datetime.now().strftime("%Y-%m")


root_agent = Agent(
    name="invoice_collector",
    model="gemini-2.0-flash",
    description="סוכן איסוף חשבוניות חודשי ל-LALUM",
    instruction="""\
אתה סוכן איסוף חשבוניות אוטומטי עבור LALUM. עבוד תמיד לפי הזרימה הבאה:

1. קבע חודש: אם המשתמש ציין חודש (למשל "מאי") — השתמש בו. אחרת — החודש הנוכחי.
2. אסוף ממיילים: קרא ל-collect_from_emails(month).
3. אסוף מתיקייה: קרא ל-collect_from_folder(month).
4. רכז ודווח: הצג טבלה — שם קובץ, מקור, האם יש PDF.
5. הכן טיוטה: קרא ל-prepare_accounting_email עם רשימת הפריטים. הצג למשתמש את הטיוטה.
6. עצור ובקש אישור: שלח (send_accounting_email confirm="true") רק אחרי שהמשתמש כתב "שלח" / "אשר שליחה".

כללים:
- אל תמחק קבצים או מיילים לעולם.
- אם אין חשבוניות — דווח ואל תכין מייל ריק.
- אם חסר משתנה .env — דווח איזה משתנה חסר.
""",
    tools=[
        collect_from_emails,
        collect_from_folder,
        prepare_accounting_email,
        send_accounting_email,
    ],
)
