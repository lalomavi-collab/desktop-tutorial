#!/usr/bin/env python3
"""
Synthesia Avatar Setup
מאמת את ה-API ומציג את האווטרים הזמינים בחשבון

Usage:
  SYNTHESIA_API_KEY=your_key python scripts/avatar_setup.py

Steps:
  1. Go to synthesia.io → Avatars → create Personal Avatar (upload video)
  2. Wait for approval (~24h)
  3. Run this script to find your avatar_id
  4. Add the avatar_id to avatar-config/soul_config.json
  5. Add SYNTHESIA_API_KEY to GitHub Secrets
"""

import os
import json
import urllib.request

API_BASE = "https://api.synthesia.io/v2"
CONFIG_PATH = "avatar-config/soul_config.json"


def get_headers():
    key = os.environ.get("SYNTHESIA_API_KEY", "")
    if not key:
        raise RuntimeError("Set SYNTHESIA_API_KEY environment variable first.")
    return {"Authorization": key, "Content-Type": "application/json"}


def list_avatars():
    req = urllib.request.Request(
        f"{API_BASE}/avatars",
        headers=get_headers(),
        method="GET",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def save_avatar_config(avatar_id: str, avatar_name: str):
    os.makedirs("avatar-config", exist_ok=True)
    config = {
        "provider": "synthesia",
        "avatar_id": avatar_id,
        "avatar_name": avatar_name,
        "voice_id": "he-IL-AvriNeural",
        "background_id": "green_screen",
        "video_ratio": "16:9",
        "status": "ready",
        "note": "Update voice_id if needed: he-IL-AvriNeural (male) or he-IL-HilaNeural (female)"
    }
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Config saved to {CONFIG_PATH}")


def main():
    print("\n🎭 Synthesia Avatar Setup")
    print("=" * 50)

    print("\n📋 Available avatars in your account:\n")
    data = list_avatars()
    avatars = data.get("avatars", data) if isinstance(data, dict) else data

    personal = []
    stock = []
    for av in avatars:
        av_id = av.get("id", av.get("avatarId", "?"))
        av_name = av.get("name", av.get("avatarName", "Unnamed"))
        av_type = av.get("type", "stock")
        if av_type == "personal":
            personal.append((av_id, av_name))
        else:
            stock.append((av_id, av_name))

    if personal:
        print("  ✅ Personal avatars (use one of these):")
        for av_id, av_name in personal:
            print(f"     ID: {av_id}  |  Name: {av_name}")
    else:
        print("  ⚠️  No personal avatars found yet.")
        print("      Go to synthesia.io → My Avatars → + New Avatar")
        print("      Upload a 2-minute video of yourself speaking.")
        print("      Approval takes ~24 hours.")

    if stock:
        print(f"\n  📦 Stock avatars available: {len(stock)}")

    if personal:
        print("\n  ─────────────────────────────")
        chosen_id = personal[0][0]
        chosen_name = personal[0][1]
        if len(personal) > 1:
            print("  Multiple personal avatars found — using first one.")
            print("  Edit avatar-config/soul_config.json to change.")
        save_avatar_config(chosen_id, chosen_name)
        print(f"\n  Next: add SYNTHESIA_API_KEY to GitHub Secrets")
        print(f"        then merge the PR and the workflow runs automatically")


if __name__ == "__main__":
    main()
