#!/usr/bin/env python3
"""
Obsidian Local REST API Client
Requires: obsidian-local-rest-api plugin running in Obsidian
Default port: 27123 (HTTP) or 27124 (HTTPS)
"""

import json
import os
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# --- Config ---
OBSIDIAN_HOST = os.getenv("OBSIDIAN_HOST", "http://localhost:27123")
OBSIDIAN_API_KEY = os.getenv("OBSIDIAN_API_KEY", "")  # Set in env or .env file


class ObsidianClient:
    def __init__(self, host: str = OBSIDIAN_HOST, api_key: str = OBSIDIAN_API_KEY):
        self.host = host.rstrip("/")
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "",
        }

    def _request(self, method: str, path: str, body: Optional[dict] = None) -> dict:
        url = f"{self.host}{path}"
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, headers=self.headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                content = resp.read().decode()
                return json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Obsidian API error {e.code}: {e.read().decode()}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Cannot connect to Obsidian at {self.host}\n"
                "Make sure Obsidian is open and the Local REST API plugin is enabled."
            ) from e

    # --- Vault info ---
    def status(self) -> dict:
        return self._request("GET", "/")

    def list_files(self, path: str = "/") -> list:
        result = self._request("GET", f"/vault/{path.lstrip('/')}")
        return result.get("files", [])

    # --- Notes ---
    def read_note(self, note_path: str) -> str:
        """Read note content (markdown)"""
        result = self._request("GET", f"/vault/{note_path}")
        return result.get("content", "")

    def create_or_update_note(self, note_path: str, content: str) -> dict:
        """Create or overwrite a note"""
        return self._request("PUT", f"/vault/{note_path}", {"content": content})

    def append_to_note(self, note_path: str, content: str) -> dict:
        """Append text to existing note"""
        return self._request("POST", f"/vault/{note_path}", {"content": content})

    def delete_note(self, note_path: str) -> dict:
        return self._request("DELETE", f"/vault/{note_path}")

    # --- Search ---
    def search(self, query: str) -> list:
        """Simple text search across vault"""
        result = self._request("POST", "/search/simple/", {"query": query})
        return result if isinstance(result, list) else []

    # --- Commands ---
    def run_command(self, command_id: str) -> dict:
        """Execute an Obsidian command by ID"""
        return self._request("POST", f"/commands/{command_id}/")

    def list_commands(self) -> list:
        result = self._request("GET", "/commands/")
        return result.get("commands", [])

    # --- Active file ---
    def get_active_file(self) -> dict:
        return self._request("GET", "/active/")

    def open_file(self, note_path: str) -> dict:
        return self._request("POST", f"/open/{note_path}")


def save_ai_research_to_obsidian(date_str: str, research_dir: Path, vault_folder: str = "AI News"):
    """Save daily NotebookLM research output into Obsidian vault"""
    client = ObsidianClient()

    # Check connection
    status = client.status()
    vault_name = status.get("vault", {}).get("name", "unknown")
    print(f"Connected to Obsidian vault: {vault_name}")

    files_saved = []
    for md_file in sorted(research_dir.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        note_path = f"{vault_folder}/{date_str}/{md_file.name}"
        client.create_or_update_note(note_path, content)
        print(f"  Saved: {note_path}")
        files_saved.append(note_path)

    # Create index note
    index_content = f"# AI Research — {date_str}\n\n"
    for p in files_saved:
        name = Path(p).stem.replace("_", " ").title()
        index_content += f"- [[{Path(p).stem}]] — {name}\n"
    client.create_or_update_note(f"{vault_folder}/{date_str}/index.md", index_content)
    print(f"  Index created: {vault_folder}/{date_str}/index.md")


if __name__ == "__main__":
    client = ObsidianClient()
    print("Testing Obsidian connection...")
    try:
        status = client.status()
        print(f"OK — Vault: {status}")
    except RuntimeError as e:
        print(f"ERROR: {e}")
