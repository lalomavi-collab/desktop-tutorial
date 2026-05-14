"""
Main entry point: python -m zoom_meetings.processor

Fetches Zoom meetings that ended in the last LOOKBACK_MINUTES,
generates an AI summary with Claude, and emails it to the recipient.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .zoom_client import ZoomClient
from .summarizer import enhance_summary
from .email_sender import send_summary_email

LOOKBACK_MINUTES = int(os.environ.get("LOOKBACK_MINUTES", "65"))
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "avraham@lalum.co")
STATE_FILE = Path(__file__).parent / "processed.json"


# ── State helpers ──────────────────────────────────────────────────────────

def _load_processed() -> set[str]:
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text()))
    return set()


def _save_processed(ids: set[str]) -> None:
    # Keep only the last 500 UUIDs to avoid unbounded growth
    trimmed = list(ids)[-500:]
    STATE_FILE.write_text(json.dumps(trimmed, indent=2))


# ── Main ───────────────────────────────────────────────────────────────────

def run() -> int:
    zoom = ZoomClient()
    processed = _load_processed()

    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(minutes=LOOKBACK_MINUTES)

    print(f"[processor] window: {from_dt.isoformat()} → {now.isoformat()}")

    try:
        meetings = zoom.get_recent_recordings(from_dt, now)
    except Exception as e:
        print(f"[processor] ERROR fetching recordings: {e}")
        return 1

    print(f"[processor] found {len(meetings)} recording(s)")

    newly_processed: list[str] = []

    for m in meetings:
        uuid = m.get("uuid", "")
        meeting_id = str(m.get("id", ""))
        topic = m.get("topic") or "פגישה ללא שם"
        duration = m.get("duration", 0)
        start_str = m.get("start_time", "")

        if uuid in processed:
            print(f"  [skip] already processed: {topic}")
            continue

        print(f"  [process] {topic} ({uuid})")

        # Parse start time
        try:
            meeting_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            meeting_date = now

        # Gather data
        try:
            participants = zoom.get_participants(uuid)
            zoom_summary = zoom.get_meeting_summary(meeting_id)
            transcript = None
            if not zoom_summary:
                transcript = zoom.get_transcript_text(uuid)
        except Exception as e:
            print(f"    WARNING: data fetch error: {e}")
            participants, zoom_summary, transcript = [], None, None

        if not zoom_summary and not transcript and not participants:
            print("    No data available — skipping")
            continue

        # Generate enhanced summary
        try:
            summary_text = enhance_summary(
                topic, zoom_summary, transcript, participants, duration
            )
        except Exception as e:
            print(f"    ERROR generating summary: {e}")
            continue

        # Send email
        try:
            send_summary_email(
                topic=topic,
                meeting_date=meeting_date,
                duration_minutes=duration,
                participants=participants,
                summary_text=summary_text,
                to_email=RECIPIENT_EMAIL,
            )
        except Exception as e:
            print(f"    ERROR sending email: {e}")
            continue

        newly_processed.append(uuid)
        print(f"    Done ✓")

    if newly_processed:
        processed.update(newly_processed)
        _save_processed(processed)
        print(f"[processor] processed {len(newly_processed)} meeting(s)")
    else:
        print("[processor] nothing new to process")

    return 0


if __name__ == "__main__":
    sys.exit(run())
