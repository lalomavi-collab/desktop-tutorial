#!/usr/bin/env python3
"""
Avatar Training Script — Higgsfield Soul 2.0
מאמן Soul Character קבוע על בסיס תמונות

Usage:
  1. Upload 5-20 photos to avatar-photos/ directory
  2. Set HIGGSFIELD_API_KEY env var (or in GitHub Secrets)
  3. Run: python scripts/avatar_train.py

The trained soul_id is saved to avatar-config/soul_id.txt
Once trained, daily_avatar_video.py uses it automatically.
"""

import os
import sys
import json
import subprocess
import time

PHOTOS_DIR = "avatar-photos"
CONFIG_DIR = "avatar-config"
SOUL_NAME = "Uri — Real Estate Lawyer"


def check_photos() -> list[str]:
    if not os.path.exists(PHOTOS_DIR):
        os.makedirs(PHOTOS_DIR)
        print(f"  ❌ Created {PHOTOS_DIR}/ — add 5-20 clear face photos and re-run.")
        sys.exit(1)

    photos = [
        os.path.join(PHOTOS_DIR, f)
        for f in os.listdir(PHOTOS_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ]

    if len(photos) < 5:
        print(f"  ❌ Need at least 5 photos, found {len(photos)}. Add more to {PHOTOS_DIR}/")
        sys.exit(1)

    photos = photos[:20]  # Higgsfield max
    print(f"  ✅ Found {len(photos)} photos")
    return photos


def upload_photos(photos: list[str]) -> list[str]:
    """Upload photos via Higgsfield API and return media_ids."""
    import urllib.request
    import urllib.parse

    api_key = os.environ.get("HIGGSFIELD_API_KEY", "")
    if not api_key:
        print("  ❌ HIGGSFIELD_API_KEY not set")
        sys.exit(1)

    media_ids = []
    for i, photo_path in enumerate(photos):
        print(f"  ↑ Uploading photo {i+1}/{len(photos)}: {os.path.basename(photo_path)}")

        ext = os.path.splitext(photo_path)[1].lower()
        content_type = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
        filename = os.path.basename(photo_path)

        # Step 1: Get presigned URL
        req_data = json.dumps({"filename": filename, "content_type": content_type}).encode()
        req = urllib.request.Request(
            "https://api.higgsfield.ai/v1/media/upload-url",
            data=req_data,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            upload_info = json.loads(resp.read())

        media_id = upload_info["media_id"]
        upload_url = upload_info["upload_url"]

        # Step 2: PUT file bytes to presigned URL
        with open(photo_path, "rb") as f:
            file_data = f.read()

        put_req = urllib.request.Request(
            upload_url,
            data=file_data,
            headers={"Content-Type": content_type},
            method="PUT",
        )
        urllib.request.urlopen(put_req)

        # Step 3: Confirm upload
        confirm_data = json.dumps({"media_id": media_id, "type": "image"}).encode()
        confirm_req = urllib.request.Request(
            "https://api.higgsfield.ai/v1/media/confirm",
            data=confirm_data,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(confirm_req)

        media_ids.append(media_id)
        time.sleep(0.5)

    print(f"  ✅ Uploaded {len(media_ids)} photos")
    return media_ids


def train_character(media_ids: list[str]) -> str:
    """Start Soul 2.0 training and return soul_id."""
    import urllib.request

    api_key = os.environ.get("HIGGSFIELD_API_KEY", "")

    payload = json.dumps({
        "name": SOUL_NAME,
        "type": "soul_2",
        "images": media_ids,
    }).encode()

    req = urllib.request.Request(
        "https://api.higgsfield.ai/v1/characters/train",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    soul_id = result["soul_id"]
    print(f"  🎭 Training started — soul_id: {soul_id}")
    print("  ⏳ Training takes ~10 minutes. Check status with:")
    print(f"     python scripts/avatar_train.py --status {soul_id}")
    return soul_id


def save_soul_id(soul_id: str):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    config = {
        "soul_id": soul_id,
        "soul_name": SOUL_NAME,
        "type": "soul_2",
        "trained_at": __import__("datetime").date.today().isoformat(),
        "status": "training",
    }
    with open(os.path.join(CONFIG_DIR, "soul_config.json"), "w") as f:
        json.dump(config, f, indent=2)
    print(f"  💾 Config saved to {CONFIG_DIR}/soul_config.json")


def check_status(soul_id: str):
    import urllib.request

    api_key = os.environ.get("HIGGSFIELD_API_KEY", "")
    req = urllib.request.Request(
        f"https://api.higgsfield.ai/v1/characters/{soul_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    status = result.get("status", "unknown")
    print(f"\n  🎭 Soul: {result.get('name', soul_id)}")
    print(f"  📊 Status: {status}")

    if status == "ready":
        # Update config
        config_path = os.path.join(CONFIG_DIR, "soul_config.json")
        if os.path.exists(config_path):
            with open(config_path) as f:
                cfg = json.load(f)
            cfg["status"] = "ready"
            with open(config_path, "w") as f:
                json.dump(cfg, f, indent=2)
        print("  ✅ Avatar is READY — daily_avatar_video.py will use it automatically")
    elif status == "training":
        print("  ⏳ Still training — check again in a few minutes")
    elif status == "failed":
        print("  ❌ Training failed — re-run with different photos")


def main():
    if "--status" in sys.argv:
        soul_id = sys.argv[sys.argv.index("--status") + 1]
        check_status(soul_id)
        return

    print(f"\n🎭 Avatar Training — {SOUL_NAME}")
    print("=" * 50)

    photos = check_photos()
    media_ids = upload_photos(photos)
    soul_id = train_character(media_ids)
    save_soul_id(soul_id)


if __name__ == "__main__":
    main()
