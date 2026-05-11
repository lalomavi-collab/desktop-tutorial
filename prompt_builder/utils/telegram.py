"""Telegram notification helper — sends messages via Bot API."""

import json
import os
import urllib.request
from datetime import datetime

BOT_TOKEN = os.environ.get(
    "TELEGRAM_BOT_TOKEN",
    "8204059324:AAFu6ys7r31S9FANf0FUjmrArgobcJ4Agaw",
)
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "6260591961")


def notify_telegram(message: str) -> bool:
    """Sends message to Telegram. Returns True on success."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": CHAT_ID, "text": message}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
            return result.get("ok", False)
    except Exception:
        return False


def notify_agent_done(agent_name: str, summary: str) -> None:
    """Sends a standardized agent-completion notification."""
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    message = f"✅ {agent_name} סיים משימה\n{summary}\nזמן: {now}"
    notify_telegram(message)
