#!/usr/bin/env python3
"""
Daily Avatar Video Generator — Synthesia
מייצר וידאו יומי עם האווטר האישי שלך על בסיס תסריט מסוכן המחקר

Reads:  daily-research/YYYY-MM-DD/avatar_script.md
Config: avatar-config/soul_config.json
Saves:  daily-research/YYYY-MM-DD/avatar_video.json
"""

import os
import json
import datetime
import time
import urllib.request
import urllib.parse

API_BASE = "https://api.synthesia.io/v2"
OUTPUT_DIR = "daily-research"
CONFIG_PATH = "avatar-config/soul_config.json"
MAX_WAIT_SEC = 600  # 10 minutes


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(
            f"Config not found at {CONFIG_PATH}. Run: python scripts/avatar_setup.py"
        )
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    if cfg.get("status") != "ready":
        raise RuntimeError("Avatar not ready. Check soul_config.json status field.")
    return cfg


def get_headers() -> dict:
    key = os.environ.get("SYNTHESIA_API_KEY", "")
    if not key:
        raise RuntimeError("SYNTHESIA_API_KEY env var not set")
    return {"Authorization": key, "Content-Type": "application/json"}


def load_script(today: str) -> str:
    path = os.path.join(OUTPUT_DIR, today, "avatar_script.md")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Script not found: {path}")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # Strip YAML front matter
    if content.startswith("---"):
        parts = content.split("---", 2)
        content = parts[2].strip() if len(parts) >= 3 else content
    return content


def script_to_spoken_text(script: str) -> str:
    """Extract clean spoken text from the talking-point script."""
    lines = []
    for line in script.split("\n"):
        line = line.strip()
        # Skip stage directions like [HOOK - 10 שניות], [הפסקה]
        if line.startswith("[") and line.endswith("]"):
            continue
        # Skip markdown headers
        if line.startswith("#"):
            continue
        # Skip YAML fields
        if ":" in line and len(line.split(":")[0]) < 25:
            continue
        if line:
            lines.append(line)

    text = " ".join(lines)
    # Synthesia has a ~1500 char limit per scene
    return text[:1400]


def create_video(cfg: dict, spoken_text: str, today: str) -> dict:
    payload = json.dumps({
        "test": False,
        "title": f"Daily Legal Update — {today}",
        "description": f"נדל\"ן ומקרקעין — עדכון יומי {today}",
        "visibility": "private",
        "input": [{
            "avatarId": cfg["avatar_id"],
            "avatarSettings": {
                "horizontalAlign": "center",
                "scale": 1.0,
                "style": "rectangular",
                "seamless": False,
            },
            "backgroundId": cfg.get("background_id", "green_screen"),
            "scriptText": spoken_text,
            "voice": cfg.get("voice_id", "he-IL-AvriNeural"),
        }],
    }).encode()

    req = urllib.request.Request(
        f"{API_BASE}/videos",
        data=payload,
        headers=get_headers(),
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def poll_video(video_id: str) -> dict:
    headers = get_headers()
    start = time.time()
    while time.time() - start < MAX_WAIT_SEC:
        req = urllib.request.Request(
            f"{API_BASE}/videos/{video_id}",
            headers=headers,
            method="GET",
        )
        with urllib.request.urlopen(req) as resp:
            video = json.loads(resp.read())

        status = video.get("status", "")
        print(f"  ⟳ Video {video_id[:8]}… status: {status}")

        if status == "complete":
            return video
        if status in ("failed", "error"):
            raise RuntimeError(f"Video generation failed: {video}")

        time.sleep(20)

    raise TimeoutError(f"Video {video_id} did not complete in {MAX_WAIT_SEC}s")


def save_result(today: str, video: dict, script_preview: str) -> dict:
    result = {
        "date": today,
        "provider": "synthesia",
        "video_id": video.get("id"),
        "status": video.get("status"),
        "video_url": video.get("download", video.get("streamUrl", "")),
        "share_url": video.get("shareUrl", ""),
        "duration": video.get("duration"),
        "script_preview": script_preview[:200],
    }
    path = os.path.join(OUTPUT_DIR, today, "avatar_video.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def notify_telegram(result: dict, today: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return

    video_url = result.get("share_url") or result.get("video_url", "")
    msg = (
        f"🎬 *וידאו אווטר יומי מוכן — {today}*\n\n"
        f"✅ הוידאו מוכן!\n"
        f"🔗 [צפה בוידאו]({video_url})\n\n"
        f"_נוצר אוטומטית ע\"י Synthesia_"
    )
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data, method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print("  ✅ Telegram notification sent")
    except Exception as e:
        print(f"  ⚠️  Telegram: {e}")


def main():
    today = datetime.date.today().isoformat()
    print(f"\n🎬 Daily Avatar Video — {today}")
    print("=" * 50)

    cfg = load_config()
    print(f"  🎭 Avatar: {cfg.get('avatar_name', cfg['avatar_id'])}")

    script = load_script(today)
    spoken_text = script_to_spoken_text(script)
    print(f"  📝 Script: {spoken_text[:70]}…")

    print("  ⟳ Submitting to Synthesia…")
    video_resp = create_video(cfg, spoken_text, today)
    video_id = video_resp.get("id")
    print(f"  ✅ Job submitted: {video_id}")

    print("  ⏳ Waiting for render (up to 10 minutes)…")
    completed = poll_video(video_id)

    result = save_result(today, completed, spoken_text)
    print(f"  🎉 Video ready: {result.get('share_url') or result.get('video_url')}")

    notify_telegram(result, today)


if __name__ == "__main__":
    main()
