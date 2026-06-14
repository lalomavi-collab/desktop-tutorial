"""
איסוף חשבוניות משתי תיבות מייל דרך IMAP — ללא Zapier.
מוריד צרופות PDF לתיקיית החודש.
"""

import imaplib
import email
import os
import re
from datetime import datetime
from email.header import decode_header
from pathlib import Path


def _decode_str(value: str) -> str:
    parts = decode_header(value)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def _month_folder(base: str, month: str) -> Path:
    folder = Path(base) / month
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _is_invoice_subject(subject: str) -> bool:
    keywords = [
        "חשבונית", "invoice", "receipt", "קבלה", "פקטורה",
        "חשבון עסקה", "google ads", "gett", "anthropic", "justificante",
    ]
    s = subject.lower()
    return any(k in s for k in keywords)


def collect_from_mailbox(
    host: str,
    port: int,
    user: str,
    password: str,
    month: str,
    base_folder: str,
    label: str = "mailbox",
) -> list[dict]:
    """
    מתחבר ל-IMAP, מחפש מיילים עם חשבוניות בחודש הנתון,
    מוריד צרופות PDF ומחזיר רשימת מסמכים.

    month: פורמט "YYYY-MM" למשל "2026-06"
    """
    year, mon = month.split("-")
    # IMAP date search: since/before
    since = datetime(int(year), int(mon), 1).strftime("%d-%b-%Y")
    # חודש הבא לצורך before
    if int(mon) == 12:
        before = datetime(int(year) + 1, 1, 1).strftime("%d-%b-%Y")
    else:
        before = datetime(int(year), int(mon) + 1, 1).strftime("%d-%b-%Y")

    dest = _month_folder(base_folder, month)
    collected = []

    try:
        conn = imaplib.IMAP4_SSL(host, port)
        conn.login(user, password)
        conn.select("INBOX")

        _, msg_ids = conn.search(None, f'(SINCE "{since}" BEFORE "{before}")')
        ids = msg_ids[0].split()

        for mid in ids:
            _, data = conn.fetch(mid, "(RFC822)")
            msg = email.message_from_bytes(data[0][1])
            subject = _decode_str(msg.get("Subject", ""))
            date_str = msg.get("Date", "")
            sender = msg.get("From", "")

            if not _is_invoice_subject(subject):
                continue

            # חפש צרופות PDF
            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                disposition = part.get("Content-Disposition", "")
                filename = part.get_filename()
                if filename:
                    filename = _decode_str(filename)
                if (
                    filename
                    and filename.lower().endswith(".pdf")
                    and "attachment" in disposition.lower()
                ):
                    safe_name = re.sub(r"[^\w\.\-]", "_", filename)
                    dest_path = dest / safe_name
                    with open(dest_path, "wb") as f:
                        f.write(part.get_payload(decode=True))
                    collected.append({
                        "filename": safe_name,
                        "path": str(dest_path),
                        "subject": subject,
                        "sender": sender,
                        "date": date_str,
                        "source": label,
                        "has_attachment": True,
                    })
                elif _is_invoice_subject(subject):
                    # מייל עם חשבונית אך ללא PDF מצורף
                    entry = {
                        "filename": None,
                        "path": None,
                        "subject": subject,
                        "sender": sender,
                        "date": date_str,
                        "source": label,
                        "has_attachment": False,
                    }
                    if entry not in collected:
                        collected.append(entry)

        conn.logout()
    except Exception as e:
        collected.append({"error": str(e), "source": label})

    return collected


def collect_from_emails(month: str) -> dict:
    """
    אוסף חשבוניות משתי תיבות המייל.
    מחזיר dict עם רשימת פריטים מכל תיבה.
    """
    base = os.environ["INVOICE_BASE_FOLDER"]

    outlook_items = collect_from_mailbox(
        host=os.environ["IMAP1_HOST"],
        port=int(os.environ.get("IMAP1_PORT", 993)),
        user=os.environ["IMAP1_USER"],
        password=os.environ["IMAP1_PASS"],
        month=month,
        base_folder=base,
        label="Outlook",
    )

    gmail_items = collect_from_mailbox(
        host=os.environ["IMAP2_HOST"],
        port=int(os.environ.get("IMAP2_PORT", 993)),
        user=os.environ["IMAP2_USER"],
        password=os.environ["IMAP2_PASS"],
        month=month,
        base_folder=base,
        label="Gmail",
    )

    all_items = outlook_items + gmail_items
    return {
        "month": month,
        "total": len(all_items),
        "items": all_items,
    }
