"""Telegram-Claude Code bridge bot.

Polls Telegram for messages and:
- For new/unpaired chats: generates a 6-char pairing code and replies with it.
- For paired chats: relays the message to Claude Code via GitHub Actions dispatch.

Required env vars:
  TELEGRAM_BOT_TOKEN  – bot token from @BotFather
  GITHUB_TOKEN        – token with repo write access (for repository_dispatch)
  GITHUB_REPOSITORY   – e.g. "lalomavi-collab/desktop-tutorial" (auto-set in Actions)
"""

import json
import logging
import os
import random
import string
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN: str = os.environ["TELEGRAM_BOT_TOKEN"]
STORE_PATH = Path(__file__).parent / "store.json"
BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
CODE_TTL_HOURS = 1
POLL_TIMEOUT = 30  # long-poll seconds


# ---------------------------------------------------------------------------
# Store helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def load_store() -> dict:
    if STORE_PATH.exists():
        data = json.loads(STORE_PATH.read_text())
    else:
        data = {}
    return {
        "codes": data.get("codes", {}),       # code  → {chat_id, expires_at}
        "sessions": data.get("sessions", {}),  # str(chat_id) → {session_id, paired_at}
        "offset": data.get("offset", 0),
    }


def save_store(store: dict) -> None:
    STORE_PATH.write_text(json.dumps(store, indent=2, default=str))


# ---------------------------------------------------------------------------
# Telegram API helpers
# ---------------------------------------------------------------------------

def _tg_get(method: str, **params) -> dict:
    r = httpx.get(f"{BASE_URL}/{method}", params=params, timeout=POLL_TIMEOUT + 5)
    r.raise_for_status()
    return r.json()


def _tg_post(method: str, **body) -> dict:
    r = httpx.post(f"{BASE_URL}/{method}", json=body, timeout=10)
    r.raise_for_status()
    return r.json()


def send(chat_id: int, text: str) -> None:
    _tg_post("sendMessage", chat_id=chat_id, text=text, parse_mode="Markdown")


def get_updates(offset: int) -> list[dict]:
    try:
        data = _tg_get("getUpdates", offset=offset, timeout=POLL_TIMEOUT)
        return data.get("result", []) if data.get("ok") else []
    except httpx.ReadTimeout:
        return []
    except Exception as e:
        logger.warning("getUpdates failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# Pairing helpers
# ---------------------------------------------------------------------------

def _generate_code() -> str:
    """Return a random 6-char alphanumeric code (uppercase)."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _issue_code(chat_id: int, store: dict) -> str:
    """Invalidate any existing codes for this chat, create a fresh one."""
    cid = str(chat_id)
    store["codes"] = {
        k: v for k, v in store["codes"].items() if str(v["chat_id"]) != cid
    }
    code = _generate_code()
    expires = (_utcnow() + timedelta(hours=CODE_TTL_HOURS)).isoformat()
    store["codes"][code] = {"chat_id": chat_id, "expires_at": expires}
    return code


def _is_paired(chat_id: int, store: dict) -> bool:
    return str(chat_id) in store["sessions"]


# ---------------------------------------------------------------------------
# Relay
# ---------------------------------------------------------------------------

def _dispatch_to_actions(chat_id: int, text: str, session_id: str) -> bool:
    """Fire a repository_dispatch event so GitHub Actions can relay the message."""
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "lalomavi-collab/desktop-tutorial")
    if not token:
        logger.warning("GITHUB_TOKEN not set – cannot relay message")
        return False

    r = httpx.post(
        f"https://api.github.com/repos/{repo}/dispatches",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={
            "event_type": "telegram-message",
            "client_payload": {
                "chat_id": str(chat_id),
                "text": text,
                "session_id": session_id,
                "ts": _utcnow().isoformat(),
            },
        },
        timeout=10,
    )
    if r.status_code == 204:
        return True
    logger.error("dispatch failed %s: %s", r.status_code, r.text)
    return False


# ---------------------------------------------------------------------------
# Update handler
# ---------------------------------------------------------------------------

def handle_update(update: dict, store: dict) -> None:
    msg = update.get("message") or update.get("channel_post") or {}
    chat = msg.get("chat", {})
    text = (msg.get("text") or "").strip()
    chat_id: int | None = chat.get("id")

    if not chat_id or not text:
        return

    if _is_paired(chat_id, store):
        session_id = store["sessions"][str(chat_id)].get("session_id", "")
        ok = _dispatch_to_actions(chat_id, text, session_id)
        if ok:
            send(chat_id, "✅ _Message relayed to Claude Code._")
        else:
            send(chat_id, "⚠️ Relay failed – check that the bot has a valid GITHUB\\_TOKEN.")
    else:
        code = _issue_code(chat_id, store)
        send(
            chat_id,
            f"🔗 *Pairing code:* `{code}`\n\n"
            f"In Claude Code, run:\n"
            f"```\n/telegram:access pair {code}\n```\n\n"
            f"_Code expires in {CODE_TTL_HOURS}h. Send any message to get a new one._",
        )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
    )
    logger.info("Telegram bridge bot starting…")

    while True:
        store = load_store()  # reload every cycle to pick up pairing changes
        updates = get_updates(store["offset"])
        for upd in updates:
            try:
                handle_update(upd, store)
            except Exception:
                logger.exception("Error handling update %s", upd.get("update_id"))
            store["offset"] = upd["update_id"] + 1

        if updates:
            save_store(store)
        else:
            time.sleep(1)


if __name__ == "__main__":
    run()
