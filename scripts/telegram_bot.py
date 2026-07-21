#!/usr/bin/env python3
"""
Telegram Bot Command Listener
Runs via GitHub Actions every minute, processes commands from Telegram.
State (last update ID) is stored as a GitHub Actions Variable.
"""

import json
import os
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from email.mime.text import MIMEText

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHAT_ID = str(os.environ["TELEGRAM_CHAT_ID"])
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = "lalomavi-collab/desktop-tutorial"
VAR_NAME = "TELEGRAM_LAST_UPDATE_ID"


def telegram(method, payload=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data else {}
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if e.code == 401:
            raise SystemExit(
                "ERROR: Telegram returned 401 Unauthorized. "
                "The TELEGRAM_BOT_TOKEN secret is invalid or was revoked. "
                "Get the current token from @BotFather (/mybots) and update "
                f"the repo secret. API response: {body}"
            )
        raise SystemExit(f"ERROR: Telegram API {method} failed ({e.code}): {body}")


def send(text):
    telegram("sendMessage", {"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"})


def send_to(chat_id, text):
    """שולח הודעה ל-chat כלשהו (לקוח), בלי Markdown כדי לא לשבור טקסט חופשי"""
    telegram("sendMessage", {"chat_id": chat_id, "text": text})


RECEPTIONIST_PROMPT = (
    "אתה פקיד הקבלה הווירטואלי של LALUM, משרד עורכי דין (עו\"ד לалו מави). "
    "אתה עונה ללקוחות ופונים שכותבים למשרד בטלגרם.\n"
    "הכללים שלך:\n"
    "- כתוב בעברית, בטון חם, מקצועי ומכבד.\n"
    "- אתה פקיד קבלה, לא עורך דין. אל תיתן ייעוץ משפטי ואל תתחייב בשם המשרד.\n"
    "- המטרה: לקבל בברכה, להבין בקצרה מה הפונה צריך, ולאסוף שם מלא, נושא הפנייה וטלפון לחזרה.\n"
    "- הבהר שעורך דין מהמשרד יחזור אליו בהקדם, בלי הבטחות לגבי תוצאות או מועדים מדויקים.\n"
    "- שמור על תשובה קצרה, שתיים עד ארבע שורות.\n"
    "- אל תשתמש במקפים כסימני פיסוק. השתמש בפסיק, נקודה או סוגריים."
)

FALLBACK_REPLY = (
    "שלום, קיבלנו את פנייתך. עורך דין מהמשרד יחזור אליך בהקדם. "
    "אנא השאר שם מלא וטלפון לחזרה."
)


def ai_reply(user_text):
    """מנסח תשובה טבעית בעברית דרך Anthropic. נופל לתשובת ברירת מחדל אם אין מפתח."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return FALLBACK_REPLY
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 400,
            "system": RECEPTIONIST_PROMPT,
            "messages": [{"role": "user", "content": user_text}],
        }).encode(),
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
        return data.get("content", [{}])[0].get("text", "").strip() or FALLBACK_REPLY
    except (urllib.error.HTTPError, urllib.error.URLError, KeyError, IndexError):
        return FALLBACK_REPLY


def gh(path, method="GET", body=None):
    url = f"https://api.github.com/repos/{REPO}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return {"_error": e.code}


def get_last_id():
    result = gh(f"/actions/variables/{VAR_NAME}")
    try:
        return int(result.get("value", 0))
    except (TypeError, ValueError):
        return 0


def set_last_id(update_id):
    result = gh(f"/actions/variables/{VAR_NAME}", "PATCH",
                {"name": VAR_NAME, "value": str(update_id)})
    if result.get("_error") == 404:
        gh("/actions/variables", "POST",
           {"name": VAR_NAME, "value": str(update_id)})


def trigger_workflow(workflow_file, ref="main"):
    result = gh(f"/actions/workflows/{workflow_file}/dispatches",
                "POST", {"ref": ref})
    return "_error" not in result


def get_recent_runs():
    result = gh("/actions/runs?per_page=5")
    runs = result.get("workflow_runs", [])
    lines = []
    for r in runs:
        icon = {"success": "✅", "failure": "❌", "cancelled": "⛔"}.get(
            r.get("conclusion", ""), "⏳"
        )
        name = r["name"][:28]
        date = r["created_at"][:10]
        lines.append(f"{icon} {name} ({date})")
    return "\n".join(lines) if lines else "אין ריצות"


def process_command(text):
    parts = text.strip().split()
    cmd = parts[0].lower().split("@")[0]
    args = parts[1:]

    if cmd == "/help":
        return (
            "🤖 *פקודות זמינות:*\n\n"
            "/ping: בדיקה שהבוט פעיל\n"
            "/status: סטטוס ריצות אחרונות\n"
            "/task תיאור: יצירת משימה חדשה\n"
            "/tasks: רשימת משימות פתוחות\n"
            "/done 12: סגירת משימה מספר 12\n"
            "/mail כתובת | נושא | תוכן: שליחת מייל מ-Outlook\n"
            "/test\_telegram: בדיקת חיבור טלגרם\n"
            "/test\_whatsapp: בדיקת חיבור וואטסאפ\n"
            "/post 001: פרסום פוסט לפי מספר\n"
            "/help: רשימה זו"
        )

    if cmd == "/ping":
        return "🏓 הבוט פעיל ועובד"

    if cmd == "/status":
        runs = get_recent_runs()
        return f"📊 *ריצות אחרונות:*\n\n{runs}"

    if cmd == "/test_telegram":
        ok = trigger_workflow("test-telegram-connection.yml")
        return "✅ בדיקת טלגרם הופעלה — תקבל הודעה בעוד שניות" if ok else "❌ שגיאה בהפעלה"

    if cmd == "/test_whatsapp":
        ok = trigger_workflow("test-whatsapp-connection.yml")
        return "✅ בדיקת וואטסאפ הופעלה" if ok else "❌ שגיאה בהפעלה"

    if cmd == "/post":
        if not args:
            return "שימוש: /post 001"
        post_num = args[0].zfill(3)
        ok = trigger_workflow(f"scheduled-post-{post_num}.yml")
        return f"📤 פוסט {post_num} הופעל" if ok else f"❌ לא נמצא workflow לפוסט {post_num}"

    if cmd == "/task":
        if not args:
            return "שימוש: /task תיאור המשימה"
        title = " ".join(args)
        result = gh("/issues", "POST", {"title": title, "labels": ["task", "from-telegram"]})
        num = result.get("number") if isinstance(result, dict) else None
        return f"📝 משימה #{num} נוצרה: {title}" if num else "❌ שגיאה ביצירת המשימה"

    if cmd == "/tasks":
        result = gh("/issues?state=open&labels=task&per_page=10")
        if not isinstance(result, list):
            return "❌ שגיאה בשליפת משימות"
        if not result:
            return "🎉 אין משימות פתוחות"
        lines = [f"#{i['number']}: {i['title']}" for i in result]
        return "📋 *משימות פתוחות:*\n" + "\n".join(lines)

    if cmd == "/done":
        if not args or not args[0].lstrip("#").isdigit():
            return "שימוש: /done 12"
        num = args[0].lstrip("#")
        result = gh(f"/issues/{num}", "PATCH", {"state": "closed"})
        closed = isinstance(result, dict) and result.get("number")
        return f"✅ משימה #{num} נסגרה" if closed else f"❌ לא הצלחתי לסגור משימה #{num}"

    if cmd == "/mail":
        fields = [p.strip() for p in " ".join(args).split("|")]
        if len(fields) < 3 or not fields[0] or "@" not in fields[0]:
            return "שימוש: /mail כתובת | נושא | תוכן ההודעה"
        to, subject = fields[0], fields[1]
        body = " | ".join(fields[2:])
        return send_mail(to, subject, body)

    return None


def send_mail(to, subject, body):
    """שולח מייל בערוץ הזמין: Gmail, Microsoft Graph, או Zapier webhook"""
    if os.environ.get("GMAIL_ADDRESS") and os.environ.get("GMAIL_APP_PASSWORD"):
        return send_gmail(to, subject, body)
    if os.environ.get("MS_CLIENT_ID"):
        return send_outlook_mail(to, subject, body)
    if os.environ.get("ZAPIER_OUTLOOK_SEND"):
        return send_via_zapier(to, subject, body)
    return (
        "❌ שליחת מייל עדיין לא מוגדרת. אפשרויות: "
        "secret בשם ZAPIER_OUTLOOK_SEND (webhook של Zapier), "
        "או GMAIL_ADDRESS + GMAIL_APP_PASSWORD (סיסמת אפליקציה של Google)"
    )


def send_via_zapier(to, subject, body):
    """שולח מייל דרך Zapier webhook שמחובר ל-Outlook Send Email"""
    webhook = os.environ["ZAPIER_OUTLOOK_SEND"]
    req = urllib.request.Request(
        webhook,
        data=json.dumps({"to": to, "subject": subject, "body": body}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
        return f"📧 המייל אל {to} נשלח דרך Outlook (Zapier)"
    except urllib.error.HTTPError as e:
        return f"❌ שליחת המייל נכשלה (שגיאה {e.code})"


def send_gmail(to, subject, body):
    """שולח מייל דרך Gmail SMTP עם App Password (בלי Zapier ובלי Azure)"""
    addr = os.environ["GMAIL_ADDRESS"]
    pwd = os.environ["GMAIL_APP_PASSWORD"].replace(" ", "")
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = addr
    msg["To"] = to
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
            server.login(addr, pwd)
            server.sendmail(addr, [to], msg.as_string())
        return f"📧 המייל אל {to} נשלח מ-{addr}"
    except smtplib.SMTPAuthenticationError:
        return (
            "❌ Gmail דחה את ההתחברות. ודא ש-GMAIL_APP_PASSWORD הוא "
            "סיסמת אפליקציה (16 תווים) ולא הסיסמה הרגילה, "
            "ושאימות דו שלבי מופעל בחשבון"
        )
    except (smtplib.SMTPException, OSError) as e:
        return f"❌ שליחת המייל נכשלה: {e}"


def send_outlook_mail(to, subject, body):
    """שולח מייל ישירות דרך Microsoft Graph API (בלי Zapier)"""
    tenant = os.environ.get("MS_TENANT_ID", "")
    client_id = os.environ.get("MS_CLIENT_ID", "")
    client_secret = os.environ.get("MS_CLIENT_SECRET", "")
    sender = os.environ.get("MS_SENDER_EMAIL", "")
    if not all([tenant, client_id, client_secret, sender]):
        return (
            "❌ החיבור הישיר ל-Outlook עדיין לא מוגדר. "
            "נדרשים 4 secrets: MS_TENANT_ID, MS_CLIENT_ID, "
            "MS_CLIENT_SECRET, MS_SENDER_EMAIL"
        )

    token_req = urllib.request.Request(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data=urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }).encode(),
    )
    try:
        with urllib.request.urlopen(token_req) as r:
            access_token = json.loads(r.read())["access_token"]
    except urllib.error.HTTPError as e:
        return f"❌ אימות מול Microsoft נכשל (שגיאה {e.code}). בדוק את MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID"

    mail_req = urllib.request.Request(
        f"https://graph.microsoft.com/v1.0/users/{urllib.parse.quote(sender)}/sendMail",
        data=json.dumps({
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": to}}],
            },
            "saveToSentItems": True,
        }).encode(),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(mail_req) as r:
            r.read()
        return f"📧 המייל אל {to} נשלח מ-{sender}"
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:200]
        if e.code == 403:
            return "❌ אין הרשאת Mail.Send. יש להוסיף את ההרשאה ב-Azure ולאשר Admin Consent"
        return f"❌ שליחת המייל נכשלה (שגיאה {e.code}): {detail}"


def main():
    last_id = get_last_id()
    result = telegram("getUpdates", {"offset": last_id + 1, "timeout": 0, "limit": 20})
    updates = result.get("result", [])

    if not updates:
        return

    new_last_id = last_id
    for update in updates:
        uid = update["update_id"]
        new_last_id = max(new_last_id, uid)

        msg = update.get("message", {})
        chat_id = str(msg.get("chat", {}).get("id", ""))
        text = msg.get("text", "")
        if not text:
            continue

        if chat_id == CHAT_ID:
            # הבעלים: פקודות בלבד
            if text.startswith("/"):
                response = process_command(text)
                if response:
                    send(response)
        else:
            # פונה חיצוני (לקוח): מענה AI + עותק לבעלים
            frm = msg.get("from", {})
            name = " ".join(
                p for p in [frm.get("first_name"), frm.get("last_name")] if p
            ) or "לא ידוע"
            reply = ai_reply(text)
            send_to(chat_id, reply)
            send(
                "📨 פנייה חדשה מלקוח\n"
                f"מאת: {name} (chat {chat_id})\n\n"
                f"הלקוח: {text}\n"
                f"הבוט ענה: {reply}"
            )

    if new_last_id > last_id:
        set_last_id(new_last_id)


if __name__ == "__main__":
    main()
