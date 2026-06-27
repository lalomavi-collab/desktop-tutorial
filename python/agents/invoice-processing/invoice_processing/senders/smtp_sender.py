"""
שליחת מייל להנהלת חשבונות דרך SMTP — ישירות, ללא Zapier.
תומך בצרופות PDF.
"""

import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path


def prepare_accounting_email(items: list[dict], month: str, summary_text: str) -> dict:
    """
    מכין את תוכן המייל (לא שולח — רק מחזיר dict לתצוגה).
    items: רשימת מסמכים מ-collect_from_emails + collect_from_folder
    """
    attachments = [i for i in items if i.get("has_attachment") and i.get("path")]
    no_pdf = [i for i in items if not i.get("has_attachment")]

    subject = f"חשבוניות {month} — LALUM"
    to = os.environ.get("ACCOUNTING_EMAIL", "office@ronitkolani.co.il")

    body_lines = [
        f"שלום רונית,",
        f"",
        f"מצורפות חשבוניות חודש {month} של LALUM לטיפולך.",
        f"",
        summary_text,
        f"",
    ]

    if no_pdf:
        body_lines.append("פריטים ללא PDF מצורף (יש להוריד ידנית):")
        for item in no_pdf:
            body_lines.append(f"  • {item.get('subject', '')} | {item.get('sender', '')} | {item.get('date', '')}")
        body_lines.append("")

    body_lines += ["בברכה,", "אברהם ללום", "LALUM — חברת עורכי דין"]

    return {
        "to": to,
        "subject": subject,
        "body": "\n".join(body_lines),
        "attachments": [a["path"] for a in attachments],
        "attachment_count": len(attachments),
        "no_pdf_count": len(no_pdf),
    }


def send_accounting_email(draft: dict, confirm: str = "false") -> dict:
    """
    שולח את המייל רק אם confirm="true".
    משתמש ב-SMTP ישיר (avraham@lalum.co דרך Office 365).
    """
    if confirm.lower() != "true":
        return {"sent": False, "reason": "נדרש אישור מפורש — העבר confirm='true'"}

    if not draft.get("attachments"):
        return {"sent": False, "reason": "אין קבצי PDF מצורפים — הסוכן לא שולח ללא צרופות"}

    missing_vars = [v for v in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS") if not os.environ.get(v)]
    if missing_vars:
        return {"sent": False, "error": f"חסרים משתני .env: {', '.join(missing_vars)}"}

    smtp_host = os.environ["SMTP_HOST"]
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ["SMTP_USER"]
    smtp_pass = os.environ["SMTP_PASS"]

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = draft["to"]
    msg["Subject"] = draft["subject"]
    msg.attach(MIMEText(draft["body"], "plain", "utf-8"))

    # צרף PDF-ים
    attached = []
    missing = []
    for path_str in draft.get("attachments", []):
        p = Path(path_str)
        if p.exists():
            with open(p, "rb") as f:
                part = MIMEApplication(f.read(), Name=p.name)
            part["Content-Disposition"] = f'attachment; filename="{p.name}"'
            msg.attach(part)
            attached.append(p.name)
        else:
            missing.append(p.name)

    if missing:
        return {"sent": False, "error": f"קבצים לא נמצאו בדיסק: {', '.join(missing)}"}

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return {
            "sent": True,
            "to": draft["to"],
            "subject": draft["subject"],
            "attachments_sent": attached,
        }
    except Exception as e:
        return {"sent": False, "error": str(e)}
