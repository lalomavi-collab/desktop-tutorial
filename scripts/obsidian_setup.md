# Obsidian Local REST API — Setup Guide

## Step 1: Install the Plugin

### Option A — Direct link (opens in Obsidian)
Click: `obsidian://show-plugin?id=obsidian-local-rest-api`

### Option B — Manual install
1. Obsidian → Settings → Community plugins → Browse
2. Search: **Local REST API**
3. Install → Enable

---

## Step 2: Configure the Plugin

1. Settings → Community plugins → Local REST API → Settings
2. Note your **API Key** (or generate one)
3. Default port: **27123** (HTTP) or **27124** (HTTPS)
4. Enable: **Enable non-encrypted (HTTP) server** (for local use)

---

## Step 3: Set Environment Variables

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export OBSIDIAN_HOST="http://localhost:27123"
export OBSIDIAN_API_KEY="paste-your-api-key-here"
export OBSIDIAN_ENABLED="true"
```

Then reload: `source ~/.bashrc`

---

## Step 4: Test the Connection

```bash
# Quick Node.js test
node scripts/obsidian_test.js

# Python test
python3 scripts/obsidian_client.py
```

Expected output:
```
✓ Connected! Vault: "My Vault"
✓ Vault root has 42 items
✓ 150 Obsidian commands available
Obsidian integration is ready.
```

---

## What Gets Saved to Obsidian

Every day at 9:00 AM the NotebookLM workflow saves to your vault:

```
AI News/
  2026-04-01/
    index.md              ← Links to all files
    research_notes.md     ← Full deep research
    slides.md             ← Presentation slides
    mindmap.md            ← Mind map
    podcast_script.md     ← Podcast script
    infographic_summary.md
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ECONNREFUSED` on port 27123 | Obsidian not open, or plugin not enabled |
| `401 Unauthorized` | Wrong or missing API key |
| `404` on vault path | Note path doesn't exist (will be created on write) |
| Plugin not in community list | Enable community plugins in Obsidian settings first |
