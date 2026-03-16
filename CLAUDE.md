# Claude Code - Auto Download Skills Setup

## Overview

This project provides an automatic skill downloading system for Claude Code.
When Claude Code starts a session, skills are automatically checked and
downloaded as needed.

## Quick Start

```bash
# Run the auto-download script
bash scripts/auto-download-skills.sh

# Check skills status
bash scripts/auto-download-skills.sh --status

# Set up session start hook (auto-runs on each session)
bash scripts/auto-download-skills.sh --hook
```

## Fixing Authentication Errors (401)

If you see this error:
```
API Error: 401 {"type":"error","error":{"type":"authentication_error",
"message":"OAuth token has expired..."}}
```

**Solution - run one of these:**

1. Inside Claude Code: `/login`
2. In terminal: `claude login`
3. Refresh API key in `~/.claude/credentials.json`

## Skills Directories

| Directory | Purpose |
|-----------|---------|
| `~/.claude/skills` | Core Claude Code skills |
| `~/.agents/skills/` | Agent-based skills |
| `~/.claude/skill-creator` | Skill creation toolkit |

## Configuration

Edit `skills.config.json` to customize:
- Which skills to auto-download
- Retry behavior on failures
- Authentication error handling
- Hook triggers

## Project Structure

```
scripts/
  auto-download-skills.sh  # Main auto-download script
skills.config.json         # Skills configuration
CLAUDE.md                  # This file
```
