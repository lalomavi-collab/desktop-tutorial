"""
Saves meeting protocol and participant email draft to Google Drive.

Folder structure expected:
  LALUM/
    ClientName1/
    ClientName2/
    ...

Uses a Google Service Account stored as JSON in GOOGLE_SERVICE_ACCOUNT_JSON env var.
The LALUM root folder ID is stored in GOOGLE_DRIVE_LALUM_FOLDER_ID env var.
"""
import json
import os
import re
from difflib import SequenceMatcher
from datetime import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

SCOPES = ["https://www.googleapis.com/auth/drive"]
LALUM_FOLDER_ID_ENV = "GOOGLE_DRIVE_LALUM_FOLDER_ID"
SA_JSON_ENV = "GOOGLE_SERVICE_ACCOUNT_JSON"


def _get_service():
    sa_json = os.environ[SA_JSON_ENV]
    sa_info = json.loads(sa_json)
    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _list_subfolders(service, parent_id: str) -> list[dict]:
    """Return all subfolders inside parent_id."""
    result = service.files().list(
        q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=200,
    ).execute()
    return result.get("files", [])


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _find_best_folder(service, lalum_id: str, topic: str) -> tuple[str, str]:
    """
    Find the best matching client subfolder for the meeting topic.
    Returns (folder_id, folder_name).
    Falls back to LALUM root if no good match.
    """
    folders = _list_subfolders(service, lalum_id)
    if not folders:
        return lalum_id, "LALUM"

    best_id, best_name, best_score = lalum_id, "LALUM", 0.0
    for folder in folders:
        name = folder["name"]
        score = _similarity(topic, name)
        # Also check if folder name appears as substring in topic
        if name.lower() in topic.lower() or topic.lower() in name.lower():
            score = max(score, 0.7)
        if score > best_score:
            best_score, best_id, best_name = score, folder["id"], name

    # Only use subfolder if similarity is reasonable
    if best_score < 0.35:
        return lalum_id, "LALUM (ללא תיק מתאים)"
    return best_id, best_name


def _create_google_doc(service, name: str, content: str, parent_id: str) -> str:
    """Upload a plain-text file as a Google Doc. Returns the file URL."""
    file_meta = {
        "name": name,
        "parents": [parent_id],
        "mimeType": "application/vnd.google-apps.document",
    }
    media = MediaInMemoryUpload(
        content.encode("utf-8"),
        mimetype="text/plain",
        resumable=False,
    )
    file = service.files().create(
        body=file_meta,
        media_body=media,
        fields="id, webViewLink",
    ).execute()
    return file.get("webViewLink", "")


def save_to_drive(
    topic: str,
    meeting_date: datetime,
    protocol_text: str,
    participant_email_text: str,
) -> dict[str, str]:
    """
    Save protocol and participant email draft to the correct LALUM subfolder.
    Returns dict with drive URLs.
    """
    lalum_id = os.environ.get(LALUM_FOLDER_ID_ENV, "")
    if not lalum_id:
        raise ValueError(f"Missing env var: {LALUM_FOLDER_ID_ENV}")

    service = _get_service()
    folder_id, folder_name = _find_best_folder(service, lalum_id, topic)

    date_str = meeting_date.strftime("%Y-%m-%d")
    # Sanitize topic for filename
    safe_topic = re.sub(r'[\\/:*?"<>|]', "", topic)[:50].strip()

    protocol_name = f"פרוטוקול {safe_topic} {date_str}"
    email_draft_name = f"טיוטת מייל {safe_topic} {date_str}"

    protocol_url = _create_google_doc(service, protocol_name, protocol_text, folder_id)
    email_url = _create_google_doc(service, email_draft_name, participant_email_text, folder_id)

    print(f"  Drive: saved to '{folder_name}' | protocol={protocol_url} | email={email_url}")
    return {
        "folder_name": folder_name,
        "protocol_url": protocol_url,
        "email_draft_url": email_url,
    }
