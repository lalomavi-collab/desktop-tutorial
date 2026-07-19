#!/usr/bin/env python3
"""
Save a daily-research folder into NotebookLM.
שמירת תיקיית מחקר יומי אל NotebookLM (המוח השני)

Reads the markdown outputs the daily research agent writes to
daily-research/YYYY-MM-DD/ (trends, article, Q&A, avatar script), merges them
into one document, and stores it as a single source inside the second-brain
notebook. No Claude tokens are spent: the work happens directly against the
NotebookLM client.

Usage:
    python notebooklm/save_daily_research.py             # today
    python notebooklm/save_daily_research.py 2026-07-13  # explicit date
"""

import asyncio
import datetime
import sys
from pathlib import Path

try:
    from notebooklm import NotebookLMClient
except ImportError:
    print(
        "notebooklm-py not found. Run: bash notebooklm/setup.sh",
        file=sys.stderr,
    )
    sys.exit(1)

# Second-brain notebook title (matches mcp_server.SECOND_BRAIN_NAME)
SECOND_BRAIN_NAME = "המוח שלי"
RESEARCH_DIR = Path("daily-research")

# Order and Hebrew section titles for the known daily-research outputs
SECTIONS = [
    ("trends.md", "מגמות חיפוש"),
    ("article_he.md", "מאמר SEO"),
    ("qa.md", "שאלות ותשובות"),
    ("avatar_script.md", "תסריט אווטר"),
]


def _today() -> str:
    return datetime.date.today().isoformat()


def build_document(day_dir: Path, date_str: str) -> str:
    """Merge the day's markdown files into one document."""
    parts = [f"# מחקר יומי, {date_str}", ""]
    for filename, heading in SECTIONS:
        path = day_dir / filename
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            continue
        parts.append(f"## {heading}")
        parts.append("")
        parts.append(text)
        parts.append("")

    # Fall back to any other markdown files not covered above
    known = {name for name, _ in SECTIONS}
    for path in sorted(day_dir.glob("*.md")):
        if path.name in known:
            continue
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            continue
        parts.append(f"## {path.stem}")
        parts.append("")
        parts.append(text)
        parts.append("")

    return "\n".join(parts).strip()


async def _find_notebook(client, name: str):
    notebooks = await client.notebooks.list()
    for nb in notebooks:
        if nb.title == name:
            return nb.id
    return None


async def save(date_str: str) -> None:
    day_dir = RESEARCH_DIR / date_str
    if not day_dir.is_dir():
        print(f"No research folder found at {day_dir}", file=sys.stderr)
        sys.exit(1)

    document = build_document(day_dir, date_str)
    if not document:
        print(f"No markdown content found in {day_dir}", file=sys.stderr)
        sys.exit(1)

    async with await NotebookLMClient.from_storage() as client:
        nb_id = await _find_notebook(client, SECOND_BRAIN_NAME)
        if nb_id is None:
            nb = await client.notebooks.create(SECOND_BRAIN_NAME)
            nb_id = nb.id

        await client.sources.add_text(
            nb_id,
            document,
            title=f"מחקר יומי {date_str}",
            wait=True,
        )

    print(
        f"Saved daily research for {date_str} to notebook "
        f"'{SECOND_BRAIN_NAME}' (id={nb_id})."
    )


def main() -> None:
    date_str = sys.argv[1] if len(sys.argv) > 1 else _today()
    try:
        datetime.date.fromisoformat(date_str)
    except ValueError:
        print(f"Invalid date '{date_str}'. Use YYYY-MM-DD.", file=sys.stderr)
        sys.exit(1)
    asyncio.run(save(date_str))


if __name__ == "__main__":
    main()
