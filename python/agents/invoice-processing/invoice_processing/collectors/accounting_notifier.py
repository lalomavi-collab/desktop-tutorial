"""הכנת ושליחת מייל סיכום להנהלת חשבונות דרך Microsoft Graph API (M365).
שליחה רק עם אישור מפורש confirm='true'.
המייל כולל מכתב פתיחה מסכם ומניעת כפילויות.
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


def _dedupe(paths: list) -> list:
    """מסיר כפילויות לפי שם קובץ + גודל (אותה חשבונית לא תצורף פעמיים)."""
    seen = set()
    unique = []
    for path in paths:
        p = Path(path)
        try:
            size = p.stat().st_size if p.exists() else -1
        except OSError:
            size = -1
        key = (p.name.lower(), size)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def _build_cover_letter(income_files, expense_files, period, accountant_name=""):
    """בונה מכתב פתיחה מסכם בעברית."""
    greeting = f"שלום {accountant_name}," if accountant_name else "שלום רב,"
    total = len(income_files) + len(expense_files)
    period_txt = f" לתקופה {period}" if period else ""

    def _names(files):
        return [Path(f).name for f in files]

    lines = []
    lines.append(greeting)
    lines.append("")
    lines.append(
        f"מצורף סיכום החשבוניות שנאספו אוטומטית{period_txt}."
    )
    lines.append("")
    lines.append(f'סה"כ מסמכים: {total}')
    lines.append(f"• הכנסות: {len(income_files)}")
    lines.append(f"• הוצאות: {len(expense_files)}")
    lines.append("")

    if income_files:
        lines.append("חשבוניות הכנסה:")
        for i, name in enumerate(_names(income_files), 1):
            lines.append(f"  {i}. {name}")
        lines.append("")

    if expense_files:
        lines.append("חשבוניות הוצאה:")
        for i, name in enumerate(_names(expense_files), 1):
            lines.append(f"  {i}. {name}")
        lines.append("")

    lines.append(
        "הקבצים מצורפים למייל זה. נבקש לאמת את הנתונים מול המסמכים."
    )
    lines.append("")
    lines.append("תודה,")
    lines.append("מערכת איסוף החשבוניות האוטומטית")
    return "\n".join(lines)


def prepare_accounting_email(
    invoice_files: list = None,
    summary_text: str = "",
    income_files: list = None,
    expense_files: list = None,
    period: str = "",
) -> dict:
    """מכין טיוטת מייל (לא שולח) עם מכתב פתיחה מסכם וללא כפילויות."""
    income_files = _dedupe(income_files or [])
    expense_files = _dedupe(expense_files or [])

    # אם לא סופק פיצול הכנסה/הוצאה — נשתמש ברשימה הכללית.
    if not income_files and not expense_files and invoice_files:
        expense_files = _dedupe(invoice_files)

    # הסרת כפילויות בין קטגוריות: קובץ שסווג כהכנסה לא יופיע שוב כהוצאה.
    _income_names = {Path(f).name.lower() for f in income_files}
    expense_files = [f for f in expense_files if Path(f).name.lower() not in _income_names]

    all_files = _dedupe(income_files + expense_files)
    accountant_name = os.environ.get("ACCOUNTING_NAME", "")
    body = summary_text or _build_cover_letter(
        income_files, expense_files, period, accountant_name
    )

    draft = {
        "from": os.environ.get("MS_SENDER", os.environ.get("OUTLOOK_USER", "")),
        "to": os.environ.get("ACCOUNTING_EMAIL", ""),
        "subject": os.environ.get("ACCOUNTING_SUBJECT", "סיכום חשבוניות"),
        "body": body,
        "attachments": all_files,
        "income_count": len(income_files),
        "expense_count": len(expense_files),
        "total_count": len(all_files),
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
    return {"status": "error", "code": resp.status_code, "request_id": resp.headers.get("request-id"), "detail": resp.text[:300]}
