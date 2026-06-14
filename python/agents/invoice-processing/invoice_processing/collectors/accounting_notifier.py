"""הכנת ושליחת מייל סיכום להנהלת חשבונות — שליחה רק עם אישור מפורש."""
import os
import json
import smtplib
from pathlib import Path
from email.message import EmailMessage

_DRAFT_PATH = Path(os.environ.get("ACCOUNTING_DRAFT_PATH", "accounting_draft.json"))

def prepare_accounting_email(invoice_files: list, summary_text: str = "") -> dict:
    """מכין טיוטת מייל (לא שולח) ושומר אותה לקובץ לבדיקה."""
    body = summary_text or f"מצורפות {len(invoice_files)} חשבוניות שנאספו אוטומטית."
    draft = {
        "to": os.environ.get("ACCOUNTING_EMAIL", ""),
        "subject": os.environ.get("ACCOUNTING_SUBJECT", "סיכום חשבוניות"),
        "body": body,
        "attachments": invoice_files,
    }
    _DRAFT_PATH.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"status": "draft_ready", "draft": draft,
            "note": "המייל לא נשלח. הרץ send_accounting_email(confirm='true') לשליחה."}

def send_accounting_email(confirm: str = "false") -> dict:
    """שולח את הטיוטה השמורה — רק אם confirm == 'true'."""
    if str(confirm).lower() != "true":
        return {"status": "blocked", "note": "השליחה דורשת confirm='true'."}
    if not _DRAFT_PATH.exists():
        return {"status": "error", "note": "אין טיוטה. הרץ prepare_accounting_email קודם."}
    draft = json.loads(_DRAFT_PATH.read_text(encoding="utf-8"))
    msg = EmailMessage()
    msg["From"] = os.environ["SMTP_USER"]
    msg["To"] = draft["to"]
    msg["Subject"] = draft["subject"]
    msg.set_content(draft["body"])
    for path in draft["attachments"]:
        p = Path(path)
        if p.exists():
            msg.add_attachment(p.read_bytes(), maintype="application",
                               subtype="octet-stream", filename=p.name)
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"],
                          int(os.environ.get("SMTP_PORT", "465"))) as s:
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        s.send_message(msg)
    return {"status": "sent", "to": draft["to"],
            "attachments": len(draft["attachments"])}
