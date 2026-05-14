"""
Main entry point: python -m zoom_meetings.processor

Full pipeline per meeting:
  1. Fetch Zoom recordings / AI summary / transcript / participants
  2. Generate internal summary   (Claude)
  3. Generate detailed protocol  (Claude)
  4. Generate participant email  (Claude)
  5. Save protocol + email draft to Google Drive  (LALUM/{client})
  6. Send summary email to avraham@lalum.co with Drive links + email draft attached
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .zoom_client import ZoomClient
from .summarizer import enhance_summary
from .protocol_generator import generate_protocol
from .participant_email import generate_participant_email
from .email_sender import send_summary_email

LOOKBACK_MINUTES = int(os.environ.get("LOOKBACK_MINUTES", "65"))
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "avraham@lalum.co")
STATE_FILE = Path(__file__).parent / "processed.json"

# Drive saving is optional — only runs when credentials are configured
DRIVE_ENABLED = bool(
    os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    and os.environ.get("GOOGLE_DRIVE_LALUM_FOLDER_ID")
)


# ── State helpers ──────────────────────────────────────────────────────────

def _load_processed() -> set[str]:
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text()))
    return set()


def _save_processed(ids: set[str]) -> None:
    trimmed = list(ids)[-500:]
    STATE_FILE.write_text(json.dumps(trimmed, indent=2))


# ── Main ───────────────────────────────────────────────────────────────────

def run() -> int:
    zoom = ZoomClient()
    processed = _load_processed()

    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(minutes=LOOKBACK_MINUTES)

    print(f"[processor] window: {from_dt.isoformat()} → {now.isoformat()}")
    print(f"[processor] Drive saving: {'enabled' if DRIVE_ENABLED else 'disabled (set GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_LALUM_FOLDER_ID)'}")

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

        try:
            meeting_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            meeting_date = now

        meeting_date_str = meeting_date.strftime("%d/%m/%Y %H:%M")

        # ── 1. Fetch data ──────────────────────────────────────────────
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

        # ── 2. Generate internal summary ───────────────────────────────
        try:
            summary_text = enhance_summary(
                topic, zoom_summary, transcript, participants, duration
            )
        except Exception as e:
            print(f"    ERROR generating summary: {e}")
            continue

        # ── 3. Generate detailed protocol ──────────────────────────────
        protocol_text: str | None = None
        try:
            protocol_text = generate_protocol(
                topic, meeting_date_str, duration,
                participants, zoom_summary, transcript
            )
        except Exception as e:
            print(f"    WARNING: protocol generation failed: {e}")

        # ── 4. Generate participant email draft ────────────────────────
        participant_email_text: str | None = None
        try:
            participant_email_text = generate_participant_email(
                topic, meeting_date_str, participants, summary_text
            )
        except Exception as e:
            print(f"    WARNING: participant email generation failed: {e}")

        # ── 5. Save to Google Drive ────────────────────────────────────
        drive_links: dict[str, str] = {}
        if DRIVE_ENABLED and protocol_text and participant_email_text:
            try:
                from .drive_saver import save_to_drive
                drive_links = save_to_drive(
                    topic, meeting_date, protocol_text, participant_email_text
                )
            except Exception as e:
                print(f"    WARNING: Drive save failed: {e}")

        # ── 6. Send summary email ──────────────────────────────────────
        try:
            send_summary_email(
                topic=topic,
                meeting_date=meeting_date,
                duration_minutes=duration,
                participants=participants,
                summary_text=summary_text,
                protocol_text=protocol_text,
                participant_email_text=participant_email_text,
                drive_links=drive_links,
                to_email=RECIPIENT_EMAIL,
            )
        except Exception as e:
            print(f"    ERROR sending email: {e}")
            continue

        newly_processed.append(uuid)
        print("    Done ✓")

    if newly_processed:
        processed.update(newly_processed)
        _save_processed(processed)
        print(f"[processor] processed {len(newly_processed)} meeting(s)")
    else:
        print("[processor] nothing new to process")

    return 0


if __name__ == "__main__":
    sys.exit(run())
