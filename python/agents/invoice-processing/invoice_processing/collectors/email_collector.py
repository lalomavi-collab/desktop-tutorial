"""איסוף צרופות חשבוניות משתי תיבות מייל דרך IMAP."""
import os
import imaplib
import email
from email.header import decode_header
from pathlib import Path
from invoice_processing.collectors.month_path import get_month_folder

def _decode(s):
    if not s:
        return ""
    parts = decode_header(s)
    return "".join(
        (t.decode(enc or "utf-8", "ignore") if isinstance(t, bytes) else t)
        for t, enc in parts
    )

def _collect_one_mailbox(host, port, user, password, dest_dir,
                         subject_keywords, allowed_ext):
    saved = []
    M = imaplib.IMAP4_SSL(host, int(port))
    try:
        M.login(user, password)
        M.select("INBOX")
        typ, data = M.search(None, "UNSEEN")
        for num in data[0].split():
            typ, msg_data = M.fetch(num, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])
            subject = _decode(msg.get("Subject", "")).lower()
            if subject_keywords and not any(k.lower() in subject for k in subject_keywords):
                continue
            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                filename = _decode(part.get_filename())
                if not filename:
                    continue
                if allowed_ext and not any(filename.lower().endswith(e) for e in allowed_ext):
                    continue
                target = Path(dest_dir) / filename
                with open(target, "wb") as f:
                    f.write(part.get_payload(decode=True))
                saved.append(str(target))
    finally:
        M.logout()
    return saved

def collect_from_emails(month: str = "") -> dict:
    """אוסף חשבוניות משתי תיבות המייל ושומר לתיקיית החודש."""
    dest = get_month_folder(month)
    keywords = [k.strip() for k in os.environ.get(
        "INVOICE_SUBJECT_KEYWORDS", "invoice,חשבונית").split(",") if k.strip()]
    exts = [e.strip() for e in os.environ.get(
        "INVOICE_ALLOWED_EXT", ".pdf").split(",") if e.strip()]
    all_saved = []
    for idx in ("1", "2"):
        host = os.environ.get(f"IMAP{idx}_HOST")
        if not host:
            continue
        all_saved += _collect_one_mailbox(
            host=host,
            port=os.environ.get(f"IMAP{idx}_PORT", "993"),
            user=os.environ[f"IMAP{idx}_USER"],
            password=os.environ[f"IMAP{idx}_PASSWORD"],
            dest_dir=dest,
            subject_keywords=keywords,
            allowed_ext=exts,
        )
    return {"month_folder": dest, "saved_files": all_saved, "count": len(all_saved)}
