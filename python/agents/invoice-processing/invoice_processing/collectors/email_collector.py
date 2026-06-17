"""איסוף צרופות חשבוניות משתי תיבות: Outlook דרך Microsoft Graph ו-Gmail דרך IMAP."""
import os
import base64
import imaplib
import email
from email.header import decode_header
from pathlib import Path

import msal
import requests

from invoice_processing.collectors.month_path import get_month_folder

_GRAPH = "https://graph.microsoft.com/v1.0"


def _get_token():
    authority = f"https://login.microsoftonline.com/{os.environ['MS_TENANT_ID']}"
    app = msal.ConfidentialClientApplication(
        client_id=os.environ["MS_CLIENT_ID"],
        client_credential=os.environ["MS_CLIENT_SECRET"],
        authority=authority,
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"Token error: {result.get('error_description', result)}")
    return result["access_token"]


def _classify(sender, income_sender):
    s = (sender or "").lower()
    return "income" if income_sender and income_sender.lower() in s else "expense"


def _collect_graph(mailbox, dest_dir, keywords, exts, income_sender):
    saved = []
    token = _get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = (f"{_GRAPH}/users/{mailbox}/messages"
           "?$filter=hasAttachments eq true&$select=id,subject,from&$top=50")
    while url:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            saved.append({"error": resp.text[:200]})
            break
        data = resp.json()
        for msg in data.get("value", []):
            subject = (msg.get("subject") or "").lower()
            sender = (msg.get("from", {}).get("emailAddress", {}).get("address") or "")
            kind = _classify(sender, income_sender)
            if kind == "expense" and keywords and not any(k in subject for k in keywords):
                continue
            att_url = f"{_GRAPH}/users/{mailbox}/messages/{msg['id']}/attachments"
            att_resp = requests.get(att_url, headers=headers, timeout=30)
            if att_resp.status_code != 200:
                continue
            for att in att_resp.json().get("value", []):
                name = att.get("name", "")
                if not name.lower().endswith(exts):
                    continue
                content = att.get("contentBytes")
                if not content:
                    continue
                target = Path(dest_dir) / name
                with open(target, "wb") as f:
                    f.write(base64.b64decode(content))
                saved.append({"file": str(target), "kind": kind, "from": sender})
        url = data.get("@odata.nextLink")
    return saved


def _decode(s):
    if not s:
        return ""
    parts = decode_header(s)
    return "".join((t.decode(enc or "utf-8", "ignore") if isinstance(t, bytes) else t) for t, enc in parts)


def _collect_imap(host, port, user, password, dest_dir, keywords, exts):
    saved = []
    M = imaplib.IMAP4_SSL(host, int(port))
    try:
        M.login(user, password)
        M.select("INBOX")
        typ, data = M.search(None, "ALL")
        for num in data[0].split():
            typ, msg_data = M.fetch(num, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])
            subject = _decode(msg.get("Subject", "")).lower()
            if keywords and not any(k in subject for k in keywords):
                continue
            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                filename = _decode(part.get_filename())
                if not filename or not filename.lower().endswith(exts):
                    continue
                target = Path(dest_dir) / filename
                with open(target, "wb") as f:
                    f.write(part.get_payload(decode=True))
                saved.append({"file": str(target), "kind": "expense", "from": user})
    finally:
        M.logout()
    return saved


def collect_from_emails(month: str = "") -> dict:
    """אוסף חשבוניות מ-Outlook (Graph) ו-Gmail (IMAP), מסווג הכנסה/הוצאה."""
    dest = get_month_folder(month)
    keywords = [k.strip().lower() for k in os.environ.get(
        "INVOICE_SUBJECT_KEYWORDS", "invoice,חשבונית").split(",") if k.strip()]
    exts = tuple(e.strip().lower() for e in os.environ.get(
        "INVOICE_ALLOWED_EXT", ".pdf").split(",") if e.strip())
    income_sender = os.environ.get("INCOME_SENDER", "notifications@invoice4u.co.il")

    items = []
    mailbox = os.environ.get("MS_SENDER", "")
    if mailbox:
        items += _collect_graph(mailbox, dest, keywords, exts, income_sender)

    if os.environ.get("IMAP2_HOST"):
        items += _collect_imap(
            os.environ["IMAP2_HOST"], os.environ.get("IMAP2_PORT", "993"),
            os.environ["IMAP2_USER"], os.environ["IMAP2_PASSWORD"],
            dest, keywords, exts,
        )

    files = [it["file"] for it in items if "file" in it]
    income = [it["file"] for it in items if it.get("kind") == "income"]
    expense = [it["file"] for it in items if it.get("kind") == "expense"]
    return {
        "month_folder": dest,
        "saved_files": files,
        "count": len(files),
        "income_files": income,
        "expense_files": expense,
        "income_count": len(income),
        "expense_count": len(expense),
    }
