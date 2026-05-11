"""Telegram notification helper — sends messages via Zapier webhook."""

import json
import urllib.request
from datetime import datetime

TELEGRAM_WEBHOOK = "https://hooks.zapier.com/hooks/catch/26446500/unrrbau/"


def notify_telegram(message: str) -> bool:
    """Sends message to Telegram. Returns True on success."""
    payload = json.dumps({"message": message}).encode()
    req = urllib.request.Request(
        TELEGRAM_WEBHOOK,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


def notify_agent_done(agent_name: str, summary: str) -> None:
    """Sends a standardized agent-completion notification."""
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    message = f"✅ {agent_name} סיים משימה\n{summary}\nזמן: {now}"
    notify_telegram(message)
