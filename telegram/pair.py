"""Complete Telegram pairing from a Claude Code session.

Called by the /telegram:access slash command:

    python -m telegram.pair <CODE> [SESSION_ID]

Reads store.json, validates the code, and writes the session entry so the bot
knows which Telegram chat belongs to this session.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

STORE_PATH = Path(__file__).parent / "store.json"


def load_store() -> dict:
    if STORE_PATH.exists():
        data = json.loads(STORE_PATH.read_text())
    else:
        data = {}
    return {
        "codes": data.get("codes", {}),
        "sessions": data.get("sessions", {}),
        "offset": data.get("offset", 0),
    }


def save_store(store: dict) -> None:
    STORE_PATH.write_text(json.dumps(store, indent=2, default=str))


def pair(code: str, session_id: str = "claude-code") -> dict | None:
    """Link the code's chat_id to session_id. Returns the session dict or None."""
    code = code.upper().strip()
    store = load_store()

    if code not in store["codes"]:
        return None

    entry = store["codes"][code]
    now = datetime.now(timezone.utc)

    expires_raw = entry["expires_at"]
    expires = datetime.fromisoformat(expires_raw)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        del store["codes"][code]
        save_store(store)
        return None  # expired

    chat_id = entry["chat_id"]
    session = {
        "chat_id": chat_id,
        "session_id": session_id,
        "paired_at": now.isoformat(),
    }
    store["sessions"][str(chat_id)] = session
    del store["codes"][code]
    save_store(store)
    return session


def unpair_all() -> int:
    """Remove all sessions. Returns count removed."""
    store = load_store()
    count = len(store["sessions"])
    store["sessions"] = {}
    save_store(store)
    return count


def status() -> dict:
    store = load_store()
    return {
        "pending_codes": len(store["codes"]),
        "active_sessions": len(store["sessions"]),
        "sessions": store["sessions"],
    }


def main() -> None:
    args = sys.argv[1:]

    if not args or args[0] in ("--help", "-h", "help"):
        print("Usage: python -m telegram.pair <CODE> [SESSION_ID]")
        print("       python -m telegram.pair status")
        print("       python -m telegram.pair unpair")
        return

    if args[0] == "status":
        s = status()
        print(f"Pending codes:   {s['pending_codes']}")
        print(f"Active sessions: {s['active_sessions']}")
        for cid, info in s["sessions"].items():
            print(f"  chat {cid} → session '{info.get('session_id')}' (paired {info.get('paired_at', '')[:19]})")
        return

    if args[0] == "unpair":
        n = unpair_all()
        print(f"Removed {n} session(s).")
        return

    code = args[0]
    session_id = args[1] if len(args) > 1 else "claude-code"

    result = pair(code, session_id)
    if result:
        print(f"✅ Paired! Telegram chat {result['chat_id']} → session '{session_id}'")
        print("Messages from that chat will now be relayed here via GitHub Actions.")
    else:
        print(f"❌ Code '{code}' not found or expired.")
        sys.exit(1)


if __name__ == "__main__":
    main()
