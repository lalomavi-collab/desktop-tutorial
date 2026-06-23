"""
איסוף חשבוניות משתי תיבות מייל דרך IMAP — ללא Zapier.
מוריד צרופות PDF לתיקיית החודש.
"""

import email
import imaplib
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


def _month_folder(base: Path, month: str) -> Path:
    folder = base / month
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _is_invoice_subject(subject: str) -> bool:
    keywords = [
        "חשבונית", "invoice", "receipt", "קבלה", "פקטורה",
        "חשבון עסקה", "google ads", "gett", "anthropic", "justificante",
    ]
    s = subject.lower()
    return any(k in s for k in keywords)


def _parse_date(date_str: str) -> str:
    """מחזיר תאריך בפורמט YYYY-MM-DD מכותרת Date של מייל."""
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str).strftime("%Y-%m-%d")
    except Exception:
        return date_str[:10] if date_str else ""


def collect_from_mailbox(
    host: str,
    port: int,
    user: str,
    password: str,
    month: str,
    base_folder: Path,
    label: str = "mailbox",
) -> list[dict]:
    """
    מתחבר ל-IMAP, מחפש מיילים עם חשבוניות בחודש הנתון,
    מוריד צרופות PDF לתיקיית החודש ומחזיר רשימת מסמכים.
    כל מייל = רשומה אחת. אם יש PDF — path מלא. אחרת has_attachment=False.
    """
    year, mon = month.split("-")
    since = datetime(int(year), int(mon), 1).strftime("%d-%b-%Y")
    before_month = 1 if int(mon) == 12 else int(mon) + 1
    before_year = int(year) + 1 if int(mon) == 12 else int(year)
    before = datetime(before_year, before_month, 1).strftime("%d-%b-%Y")

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
            sender = msg.get("From", "")
            date_str = _parse_date(msg.get("Date", ""))

            if not _is_invoice_subject(subject):
                continue

            # חיפוש צרופת PDF — רשומה אחת לכל מייל
            pdf_found = None
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
                    # לא מוריד שוב אם קיים
                    if not dest_path.exists():
                        with open(dest_path, "wb") as f:
                            f.write(part.get_payload(decode=True))
                    pdf_found = {"filename": safe_name, "path": str(dest_path)}
                    break  # רק צרופה ראשונה

            collected.append({
                "filename": pdf_found["filename"] if pdf_found else None,
                "path": pdf_found["path"] if pdf_found else None,
                "subject": subject,
                "sender": sender,
                "date": date_str,
                "source": label,
                "has_attachment": pdf_found is not None,
            })

        conn.logout()
    except Exception as e:
        collected.append({"error": str(e), "source": label, "has_attachment": False})

    return collected


def collect_from_emails(month: str) -> dict:
    """
    אוסף חשבוניות משתי תיבות המייל (Outlook + Gmail).
    מוריד PDFs לתיקיית ~/Desktop/LALUM/חשבוניות/YYYY-MM/.
    """
    base = Path(os.environ.get("INVOICE_BASE_FOLDER", "~/Desktop/LALUM/חשבוניות")).expanduser()

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
