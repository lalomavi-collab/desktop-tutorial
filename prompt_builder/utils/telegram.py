"""Telegram notification helper — sends messages via @Lalumbot."""

import json
import os
import urllib.request
from datetime import datetime


def _get_credentials() -> tuple[str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in environment or .env"
        )
    return token, chat_id


def notify_telegram(message: str) -> bool:
    """Sends message to Telegram via @Lalumbot. Returns True on success."""
    try:
        token, chat_id = _get_credentials()
    except RuntimeError:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": message}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read()).get("ok", False)
    except Exception:
        return False


def notify_agent_done(agent_name: str, summary: str) -> None:
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    notify_telegram(f"✅ {agent_name} סיים משימה\n{summary}\nזמן: {now}")
