#!/usr/bin/env python3
"""
NotebookLM Daily AI Research Workflow
Runs every day at 9:00 AM
Performs deep research on global AI news and generates:
  - Slides
  - Mind map
  - Podcast
  - Infographic
Saves all outputs to ~/Desktop/notebooklm_daily/
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from notebooklm import NotebookLM
except ImportError:
    print("ERROR: notebooklm-py not installed. Run: pip install 'notebooklm-py[browser]'")
    sys.exit(1)

# Optional Obsidian integration
OBSIDIAN_ENABLED = os.getenv("OBSIDIAN_ENABLED", "true").lower() == "true"
try:
    from obsidian_client import save_ai_research_to_obsidian
    OBSIDIAN_AVAILABLE = True
except ImportError:
    OBSIDIAN_AVAILABLE = False

# Output directory on Desktop
OUTPUT_BASE = Path.home() / "Desktop" / "notebooklm_daily"

# Research topics
RESEARCH_QUERY = (
    "Deep research on global AI news today: "
    "latest breakthroughs, new model releases, AI regulation updates, "
    "startup funding, and key industry developments. "
    "Include sources from major tech publications."
)


def make_output_dir() -> Path:
    date_str = datetime.now().strftime("%Y-%m-%d")
    out_dir = OUTPUT_BASE / date_str
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


async def run_daily_workflow():
    out_dir = make_output_dir()
    date_str = datetime.now().strftime("%Y-%m-%d")
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Starting NotebookLM daily workflow — {date_str}")
    print(f"Output directory: {out_dir}\n")

    async with NotebookLM() as nlm:
        # --- Create notebook for today ---
        notebook_title = f"AI News Deep Research — {date_str}"
        print(f"Creating notebook: {notebook_title}")
        notebook = await nlm.create_notebook(title=notebook_title)

        # --- Add research sources ---
        print("Adding research sources...")
        sources = [
            "https://techcrunch.com/category/artificial-intelligence/",
            "https://venturebeat.com/ai/",
            "https://www.theverge.com/ai-artificial-intelligence",
        ]
        for url in sources:
            try:
                await notebook.add_source(url)
                print(f"  + Added: {url}")
            except Exception as e:
                print(f"  ! Failed to add {url}: {e}")

        # --- Deep research / notes ---
        print("\nRunning deep research query...")
        research_notes = await notebook.query(RESEARCH_QUERY)
        notes_file = out_dir / "research_notes.md"
        notes_file.write_text(f"# AI News Deep Research — {date_str}\n\n{research_notes}", encoding="utf-8")
        print(f"  Saved: {notes_file.name}")

        # --- Generate Slides ---
        print("\nGenerating slides...")
        try:
            slides = await notebook.generate_slides()
            slides_file = out_dir / "slides.md"
            slides_file.write_text(slides, encoding="utf-8")
            print(f"  Saved: {slides_file.name}")
        except Exception as e:
            print(f"  ! Slides generation failed: {e}")

        # --- Generate Mind Map ---
        print("\nGenerating mind map...")
        try:
            mindmap = await notebook.generate_mindmap()
            mindmap_file = out_dir / "mindmap.md"
            mindmap_file.write_text(mindmap, encoding="utf-8")
            print(f"  Saved: {mindmap_file.name}")
        except Exception as e:
            print(f"  ! Mind map generation failed: {e}")

        # --- Generate Podcast script ---
        print("\nGenerating podcast script...")
        try:
            podcast = await notebook.generate_podcast()
            podcast_file = out_dir / "podcast_script.md"
            podcast_file.write_text(podcast, encoding="utf-8")
            print(f"  Saved: {podcast_file.name}")
        except Exception as e:
            print(f"  ! Podcast generation failed: {e}")

        # --- Generate Infographic summary ---
        print("\nGenerating infographic summary...")
        try:
            infographic = await notebook.query(
                "Create a visual infographic-style summary: "
                "use bullet points, emojis, numbers, and clear sections. "
                "Top 5 AI stories today with key stats and takeaways."
            )
            infographic_file = out_dir / "infographic_summary.md"
            infographic_file.write_text(
                f"# AI News Infographic — {date_str}\n\n{infographic}", encoding="utf-8"
            )
            print(f"  Saved: {infographic_file.name}")
        except Exception as e:
            print(f"  ! Infographic generation failed: {e}")

    # --- Save to Obsidian (if available and enabled) ---
    if OBSIDIAN_AVAILABLE and OBSIDIAN_ENABLED:
        print("\nSaving to Obsidian vault...")
        try:
            save_ai_research_to_obsidian(date_str, out_dir)
        except RuntimeError as e:
            print(f"  ! Obsidian sync skipped: {e}")
    elif not OBSIDIAN_AVAILABLE:
        print("\n(Obsidian sync skipped — obsidian_client.py not found)")

    print(f"\nWorkflow complete. All files saved to:\n  {out_dir}\n")


if __name__ == "__main__":
    asyncio.run(run_daily_workflow())
