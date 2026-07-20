#!/usr/bin/env python3
"""
Telegram Bot Command Listener
Runs via GitHub Actions every minute, processes commands from Telegram.
State (last update ID) is stored as a GitHub Actions Variable.
"""

import json
import os
import urllib.request
import urllib.error

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
        webhook = os.environ.get("ZAPIER_OUTLOOK_SEND", "")
        if not webhook:
            return (
                "❌ שליחת מייל עדיין לא מוגדרת. "
                "יש ליצור Zap של Catch Hook עם Outlook Send Email "
                "ולשמור את כתובת ה-webhook כ-secret בשם ZAPIER_OUTLOOK_SEND"
            )
        fields = [p.strip() for p in " ".join(args).split("|")]
        if len(fields) < 3 or not fields[0] or "@" not in fields[0]:
            return "שימוש: /mail כתובת | נושא | תוכן ההודעה"
        to, subject = fields[0], fields[1]
        body = " | ".join(fields[2:])
        payload = json.dumps({"to": to, "subject": subject, "body": body}).encode()
        req = urllib.request.Request(
            webhook, data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                r.read()
            return f"📧 המייל אל {to} נשלח דרך Outlook"
        except urllib.error.HTTPError as e:
            return f"❌ שליחת המייל נכשלה (שגיאה {e.code})"

    return None


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

        if chat_id != CHAT_ID:
            continue

        if text.startswith("/"):
            response = process_command(text)
            if response:
                send(response)

    if new_last_id > last_id:
        set_last_id(new_last_id)


if __name__ == "__main__":
    main()
