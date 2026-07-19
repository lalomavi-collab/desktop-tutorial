"""עוזר HTTP משותף: urllib עם timeout ו-User-Agent, ללא תלות חיצונית."""

import json
import urllib.request

USER_AGENT = "Mozilla/5.0 (LALUM deal-analysis; +https://lalum.legal)"
DEFAULT_TIMEOUT = 20


def get_json(url: str, data: dict | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """GET (או POST אם data) שמחזיר JSON. זורק חריגה בכשל, הקורא מטפל."""
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if body else {}),
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_bytes(url: str, timeout: int = DEFAULT_TIMEOUT, max_bytes: int = 20_000_000) -> bytes:
    """מוריד תוכן בינארי עם תקרת גודל."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(max_bytes)
