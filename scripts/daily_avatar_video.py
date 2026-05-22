#!/usr/bin/env python3
"""
Daily Avatar Video Generator — Higgsfield Soul 2.0
מייצר וידאו יומי אוטומטי עם האווטר שלך על בסיס התסריט מסוכן המחקר

Reads: daily-research/YYYY-MM-DD/avatar_script.md
Uses:  avatar-config/soul_config.json (trained soul_id)
Saves: daily-research/YYYY-MM-DD/avatar_video.json (job info + URL)
"""

import os
import json
import datetime
import time
import urllib.request
import urllib.parse

OUTPUT_DIR = "daily-research"
CONFIG_DIR = "avatar-config"


def load_soul_config() -> dict:
    path = os.path.join(CONFIG_DIR, "soul_config.json")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Soul config not found at {path}. Run scripts/avatar_train.py first."
        )
    with open(path) as f:
        cfg = json.load(f)
    if cfg.get("status") != "ready":
        raise RuntimeError(
            f"Soul character not ready yet (status: {cfg.get('status')}). "
            "Run: python scripts/avatar_train.py --status <soul_id>"
        )
    return cfg


def load_avatar_script(today: str) -> str:
    path = os.path.join(OUTPUT_DIR, today, "avatar_script.md")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Avatar script not found: {path}")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # Strip YAML front matter
    if content.startswith("---"):
        parts = content.split("---", 2)
        content = parts[2].strip() if len(parts) >= 3 else content
    return content


def extract_prompt(script: str) -> str:
    """Convert the talking-point script into a Higgsfield video prompt."""
    # Take the HOOK + Problem lines as the video prompt (max ~300 chars)
    lines = [l.strip() for l in script.split("\n") if l.strip() and not l.startswith("#")]
    # Find the hook section
    prompt_lines = []
    for line in lines[:12]:
        if "[" not in line:  # skip stage directions
            prompt_lines.append(line)
        if len(" ".join(prompt_lines)) > 250:
            break

    prompt = " ".join(prompt_lines)[:280]
    return (
        f"Professional real estate lawyer speaking directly to camera in an office setting. "
        f"Confident, authoritative yet approachable tone. Israeli professional. "
        f"Script: {prompt}"
    )


def generate_video(soul_id: str, prompt: str) -> dict:
    api_key = os.environ.get("HIGGSFIELD_API_KEY", "")
    if not api_key:
        raise RuntimeError("HIGGSFIELD_API_KEY environment variable not set")

    payload = json.dumps({
        "model": "soul_2",
        "prompt": prompt,
        "soul_id": soul_id,
        "duration": 30,
        "aspect_ratio": "9:16",  # vertical for social media
    }).encode()

    req = urllib.request.Request(
        "https://api.higgsfield.ai/v1/generate/video",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def poll_job(job_id: str, timeout: int = 300) -> dict:
    api_key = os.environ.get("HIGGSFIELD_API_KEY", "")
    start = time.time()
    while time.time() - start < timeout:
        req = urllib.request.Request(
            f"https://api.higgsfield.ai/v1/jobs/{job_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        with urllib.request.urlopen(req) as resp:
            job = json.loads(resp.read())

        status = job.get("status", "")
        print(f"  ⟳ Job {job_id[:8]}… status: {status}")

        if status == "completed":
            return job
        if status in ("failed", "error"):
            raise RuntimeError(f"Video generation failed: {job}")

        time.sleep(15)

    raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")


def save_result(today: str, job: dict, script: str):
    result = {
        "date": today,
        "job_id": job.get("id"),
        "status": job.get("status"),
        "video_url": job.get("output_url") or job.get("url"),
        "duration_seconds": job.get("duration"),
        "model": "soul_2",
        "script_preview": script[:200],
    }
    path = os.path.join(OUTPUT_DIR, today, "avatar_video.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def notify_telegram(video_url: str, today: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return

    msg = (
        f"🎬 *וידאו אווטר יומי — {today}*\n\n"
        f"✅ הוידאו מוכן!\n"
        f"🔗 [צפה בוידאו]({video_url})\n\n"
        f"_נוצר אוטומטית ע\"י Higgsfield Soul 2.0_"
    )
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
    }).encode()

    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        method="POST",
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

    cfg = load_soul_config()
    soul_id = cfg["soul_id"]
    print(f"  🎭 Soul: {cfg['soul_name']} ({soul_id[:8]}…)")

    script = load_avatar_script(today)
    prompt = extract_prompt(script)
    print(f"  📝 Prompt: {prompt[:80]}…")

    print("  ⟳ Submitting video generation job…")
    job_resp = generate_video(soul_id, prompt)
    job_id = job_resp.get("id") or job_resp.get("job_id")
    print(f"  ✅ Job submitted: {job_id}")

    print("  ⏳ Waiting for video (up to 5 minutes)…")
    completed_job = poll_job(job_id)

    result = save_result(today, completed_job, script)
    video_url = result["video_url"]
    print(f"  🎉 Video ready: {video_url}")

    notify_telegram(video_url, today)


if __name__ == "__main__":
    main()
