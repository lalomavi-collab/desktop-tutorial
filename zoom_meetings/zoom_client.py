import os
import base64
import urllib.parse
from datetime import datetime, timedelta, timezone
import requests


class ZoomClient:
    BASE_URL = "https://api.zoom.us/v2"

    def __init__(self):
        self.account_id = os.environ["ZOOM_ACCOUNT_ID"]
        self.client_id = os.environ["ZOOM_CLIENT_ID"]
        self.client_secret = os.environ["ZOOM_CLIENT_SECRET"]
        self._token: str | None = None
        self._token_expiry: datetime | None = None

    # ── Auth ──────────────────────────────────────────────────────────────

    def _get_token(self) -> str:
        if self._token and self._token_expiry and datetime.now() < self._token_expiry:
            return self._token

        creds = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()

        resp = requests.post(
            "https://zoom.us/oauth/token",
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "account_credentials", "account_id": self.account_id},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self._token_expiry = datetime.now() + timedelta(seconds=data["expires_in"] - 60)
        return self._token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_token()}"}

    def _double_encode(self, uuid: str) -> str:
        return urllib.parse.quote(urllib.parse.quote(uuid, safe=""), safe="")

    # ── Meetings ──────────────────────────────────────────────────────────

    def get_recent_recordings(self, from_dt: datetime, to_dt: datetime) -> list[dict]:
        """Return cloud recordings that ended between from_dt and to_dt."""
        resp = requests.get(
            f"{self.BASE_URL}/users/me/recordings",
            headers=self._headers(),
            params={
                "from": from_dt.strftime("%Y-%m-%d"),
                "to": to_dt.strftime("%Y-%m-%d"),
                "page_size": 100,
            },
            timeout=30,
        )
        resp.raise_for_status()
        meetings = resp.json().get("meetings", [])

        # Filter to meetings that actually ended within the window
        result = []
        for m in meetings:
            end_str = m.get("recording_end") or m.get("start_time", "")
            if end_str:
                try:
                    end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                    if from_dt <= end_dt <= to_dt:
                        result.append(m)
                except ValueError:
                    result.append(m)
        return result

    def get_meeting_summary(self, meeting_id: str) -> dict | None:
        """Fetch Zoom AI Companion meeting summary."""
        resp = requests.get(
            f"{self.BASE_URL}/meetings/{meeting_id}/meeting_summary",
            headers=self._headers(),
            timeout=30,
        )
        if resp.status_code in (404, 400):
            return None
        resp.raise_for_status()
        return resp.json()

    def get_participants(self, meeting_uuid: str) -> list[dict]:
        """Fetch participant list from the reporting API."""
        encoded = self._double_encode(meeting_uuid)
        resp = requests.get(
            f"{self.BASE_URL}/report/meetings/{encoded}/participants",
            headers=self._headers(),
            params={"page_size": 100},
            timeout=30,
        )
        if resp.status_code in (400, 404):
            return []
        resp.raise_for_status()
        return resp.json().get("participants", [])

    def get_transcript_text(self, meeting_uuid: str) -> str | None:
        """Download VTT transcript and return plain text."""
        encoded = self._double_encode(meeting_uuid)
        resp = requests.get(
            f"{self.BASE_URL}/meetings/{encoded}/recordings",
            headers=self._headers(),
            timeout=30,
        )
        if resp.status_code in (400, 404):
            return None
        resp.raise_for_status()
        for f in resp.json().get("recording_files", []):
            if f.get("file_type") == "TRANSCRIPT" and f.get("status") == "completed":
                dl = requests.get(
                    f["download_url"],
                    headers=self._headers(),
                    timeout=60,
                )
                return dl.text
        return None
