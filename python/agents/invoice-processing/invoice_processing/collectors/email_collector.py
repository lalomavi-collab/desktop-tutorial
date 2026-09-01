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

from ..utils.credentials import get_secret, missing_secrets
from .filters import is_expense_document
from .outlook_com_collector import collect_from_outlook_com
from .base_folder import get_base_folder
from .month_path import resolve_month_folder


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
    return resolve_month_folder(month)


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

        bank_senders = [s.strip().lower() for s in
                        os.environ.get("BANK_STATEMENT_SENDERS", "").split(",") if s.strip()]

        for mid in ids:
            _, data = conn.fetch(mid, "(RFC822)")
            msg = email.message_from_bytes(data[0][1])
            subject = _decode_str(msg.get("Subject", ""))
            sender = msg.get("From", "")
            date_str = _parse_date(msg.get("Date", ""))

            # דף חשבון מהבנק: מתויק אוטומטית לתת-תיקיית _בנק החסויה,
            # לפני כל לוגיקת החשבוניות, כדי שלא יירשם בטעות כהוצאה.
            if bank_senders and any(b in sender.lower() for b in bank_senders):
                bank_dir = dest / "_בנק"
                for part in msg.walk():
                    fname = part.get_filename()
                    if not fname:
                        continue
                    fname = _decode_str(fname)
                    if not fname.lower().endswith((".pdf", ".csv", ".xlsx", ".xls")):
                        continue
                    bank_dir.mkdir(parents=True, exist_ok=True)
                    safe = re.sub(r"[^\w\.\-]", "_", fname)
                    target = bank_dir / safe
                    if not target.exists():
                        target.write_bytes(part.get_payload(decode=True))
                continue

            # חיפוש צרופת PDF — רשומה אחת לכל מייל
            pdf_found = None
            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                disposition = part.get("Content-Disposition") or ""
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

            if not is_expense_document(subject, sender, has_pdf=pdf_found is not None):
                continue

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
        collected.append({
            "error": str(e), "source": label, "has_attachment": False,
            "filename": None, "path": None, "subject": f"שגיאת חיבור: {e}",
            "sender": "", "date": "", "type": "unknown", "client": "",
            "amount": None, "currency": None,
        })

    return collected


def collect_from_emails(month: str) -> dict:
    """
    אוסף הוצאות משתי התיבות, כל אחת במסלול שעובד עבורה.

    Outlook (Exchange): דרך Outlook Desktop ב-COM. מיקרוסופט חסמה IMAP
    בסיסמה ב-Exchange Online, ולכן אין מסלול סיסמה. COM לא דורש כלום.

    Gmail: IMAP עם App Password מהכספת. חשבון ה-IMAP של Gmail בתוך Outlook
    נכשל בחיבור (0x800CCC0E) ולכן אי אפשר להישען עליו.

    MAIL_MODE=imap מכריח את שתי התיבות למסלול IMAP.
    """
    base = get_base_folder()
    errors = []
    all_items = []
    mode = os.environ.get("MAIL_MODE", "outlook_com").strip().lower()

    # --- תיבה 1: Outlook ---
    if mode == "imap":
        host, user, pw = os.environ.get("IMAP1_HOST"), os.environ.get("IMAP1_USER"), get_secret("IMAP1_PASS")
        if host and user and pw:
            all_items += collect_from_mailbox(host, int(os.environ.get("IMAP1_PORT", 993)),
                                              user, pw, month, base, "Outlook")
        else:
            errors.append("Outlook: חסרים פרטי IMAP או סיסמה")
    else:
        all_items += collect_from_outlook_com(month)

    # --- תיבה 2: Gmail ---
    # כשהיא מכובה, זו החלטה מודעת ולא תקלה, ולכן היא לא נספרת כשגיאה
    # ולא חוסמת את השליחה האוטומטית החודשית.
    gmail_on = os.environ.get("GMAIL_ENABLED", "true").strip().lower() not in ("0", "false", "no")
    if not gmail_on:
        print("ℹ️  תיבת Gmail מכובה בהגדרות (GMAIL_ENABLED=false). נאסף רק מ-Outlook.")
        host = user = pw = None

    host = os.environ.get("IMAP2_HOST") if gmail_on else None
    user = os.environ.get("IMAP2_USER") if gmail_on else None
    pw = get_secret("IMAP2_PASS") if gmail_on else None
    if not gmail_on:
        pass
    elif not host or not user:
        errors.append("Gmail: חסרים IMAP2_HOST/IMAP2_USER ב-.env")
    elif not pw:
        errors.append("Gmail: חסרה סיסמת אפליקציה בכספת — הרץ setup_credentials.bat")
    else:
        all_items += collect_from_mailbox(host, int(os.environ.get("IMAP2_PORT", 993)),
                                          user, pw, month, base, "Gmail")

    for it in list(all_items):
        if it.get("error"):
            errors.append(f"{it.get('source')}: {it['error']}")
            all_items.remove(it)

    result = {"month": month, "total": len(all_items), "items": all_items}
    if errors:
        result["error"] = " | ".join(errors)
    return result
