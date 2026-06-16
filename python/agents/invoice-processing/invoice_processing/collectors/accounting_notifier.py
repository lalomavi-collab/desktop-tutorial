"""הכנת ושליחת מייל סיכום להנהלת חשבונות דרך Microsoft Graph API (M365).
שליחה רק עם אישור מפורש confirm='true'.
"""
import os
import json
import base64
from pathlib import Path

import msal
import requests

_DRAFT_PATH = Path(os.environ.get("ACCOUNTING_DRAFT_PATH", "accounting_draft.json"))
_GRAPH_SEND = "https://graph.microsoft.com/v1.0/users/{sender}/sendMail"


def _get_token() -> str:
    """מקבל access token מ-Azure AD דרך client credentials."""
    authority = f"https://login.microsoftonline.com/{os.environ['MS_TENANT_ID']}"
    app = msal.ConfidentialClientApplication(
        client_id=os.environ["MS_CLIENT_ID"],
        client_credential=os.environ["MS_CLIENT_SECRET"],
        authority=authority,
    )
    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )
    if "access_token" not in result:
        raise RuntimeError(f"Token error: {result.get('error_description', result)}")
    return result["access_token"]


def prepare_accounting_email(invoice_files: list, summary_text: str = "") -> dict:
    """מכין טיוטת מייל (לא שולח) ושומר אותה לקובץ לבדיקה."""
    body = summary_text or f"מצורפות {len(invoice_files)} חשבוניות שנאספו אוטומטית."
    draft = {
        "from": os.environ.get("MS_SENDER", os.environ.get("OUTLOOK_USER", "")),
        "to": os.environ.get("ACCOUNTING_EMAIL", ""),
        "subject": os.environ.get("ACCOUNTING_SUBJECT", "סיכום חשבוניות"),
        "body": body,
        "attachments": invoice_files,
    }
    _DRAFT_PATH.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "status": "draft_ready",
        "draft": draft,
        "note": "המייל לא נשלח. הרץ send_accounting_email(confirm='true') לשליחה.",
    }


def send_accounting_email(confirm: str = "false") -> dict:
    """שולח את הטיוטה השמורה דרך Microsoft Graph — רק אם confirm == 'true'."""
    if str(confirm).lower() != "true":
        return {"status": "blocked", "note": "השליחה דורשת confirm='true'."}
    if not _DRAFT_PATH.exists():
        return {"status": "error", "note": "אין טיוטה. הרץ prepare_accounting_email קודם."}

    draft = json.loads(_DRAFT_PATH.read_text(encoding="utf-8"))
    token = _get_token()

    attachments = []
    for path in draft["attachments"]:
        p = Path(path)
        if p.exists():
            content = base64.b64encode(p.read_bytes()).decode()
            attachments.append({
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": p.name,
                "contentBytes": content,
            })

    payload = {
        "message": {
            "subject": draft["subject"],
            "body": {"contentType": "Text", "content": draft["body"]},
            "toRecipients": [{"emailAddress": {"address": draft["to"]}}],
            "attachments": attachments,
        },
        "saveToSentItems": "true",
    }

    sender = draft["from"]
    url = _GRAPH_SEND.format(sender=sender)
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    if resp.status_code == 202:
        return {"status": "sent", "to": draft["to"], "attachments": len(attachments)}
    return {"status": "error", "code": resp.status_code, "detail": resp.text[:300]}
