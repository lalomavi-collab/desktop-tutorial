# CLAUDE.md

## Project Overview

Multi-project repository containing tools, games, educational content, and DevOps utilities.

## Tech Stack

- Python (prompt_builder, hebrew-greetings)
- Node.js / JavaScript (md-agent)
- HTML/CSS/JS (games, presentations)
- Bash (DevOps scripts)
- Docker + Tailscale (openclaw-setup)

## Architecture

```
/games                  — HTML/JS browser games (horse-riding, memory-game)
/prompt_builder         — Python AI prompt builder agent (Anthropic API)
/md-agent               — Node.js CLI dev agents (file generation, email, git)
/ai-education-program   — AI curriculum for Israeli schools
/just-ai-program        — Lawyer-Technologist training program
/ai-excellence-program  — AI Excellence presentation
/openclaw-setup         — Docker + Tailscale deployment configs
/ssh-remote-access      — SSH server/client setup scripts
/uninstall-tools        — Cleanup and verification scripts
/vayron-shorts          — Product catalog page
/hebrew-greetings       — Hebrew string validation module
```

## Coding Rules

- Python: use type hints, follow PEP 8
- JavaScript: use ES modules (.mjs), async/await
- Shell scripts: use `set -euo pipefail`, quote variables
- Never commit secrets or .env files with real credentials
- HTML files are self-contained single-file apps

## Commands

```bash
# Python - prompt builder
pip install -e .
python -m prompt_builder.cli

# Python - Hebrew greetings tests
cd hebrew-greetings && python -m unittest test_hebrew_greetings

# Node.js - MD Agent
cd md-agent && npm install && node cli.mjs
```
