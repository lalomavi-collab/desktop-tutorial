# NotebookLM CLI — Setup Guide

## Prerequisites

Run these commands **on your local machine** (not in the cloud sandbox):

```bash
# Step 1 — Install package
pip install "notebooklm-py[browser]"

# Step 2 — Install Chromium (required for browser login)
playwright install chromium

# Step 3 — Login with Google (opens a real browser window)
notebooklm login
```

> **Note:** `notebooklm login` opens a Chromium window.  
> Sign in with the same Google account you use for NotebookLM.  
> Your session cookie is saved locally for future runs.

---

## Daily Automated Workflow

### What it does (every day at 9:00 AM)
1. Creates a new NotebookLM notebook titled "AI News Deep Research — YYYY-MM-DD"
2. Adds 3 AI news sources (TechCrunch, VentureBeat, The Verge)
3. Runs a deep research query on global AI news
4. Generates and saves to `~/Desktop/notebooklm_daily/YYYY-MM-DD/`:
   - `research_notes.md` — Full research summary
   - `slides.md` — Presentation slides
   - `mindmap.md` — Mind map
   - `podcast_script.md` — Podcast script
   - `infographic_summary.md` — Visual infographic summary

### Setup cron job (run once after login)
```bash
bash scripts/setup_notebooklm_cron.sh
```

### Run manually
```bash
python3 scripts/notebooklm_daily.py
```

### View logs
```bash
tail -f ~/Desktop/notebooklm_daily/cron.log
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `playwright install` fails (403) | You're in a restricted network/sandbox — run on your local machine |
| `notebooklm login` fails | Make sure Chromium is installed first |
| `AuthenticationError` | Re-run `notebooklm login` to refresh the session |
| Cron job not running | Check: `crontab -l` and ensure cron daemon is running |
