# OpenClaw – Telegram Bot Setup

This repository contains the configuration for connecting OpenClaw to Telegram.

---

## Quick Setup

### Step 1 – Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token** you receive (format: `123456789:ABCDef...`)

### Step 2 – Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and paste your Bot Token:

```
TELEGRAM_BOT_TOKEN=123456789:your_actual_token_here
```

### Step 3 – Configure OpenClaw

Edit `config.yaml` to match your needs:

| Field | Description |
|-------|-------------|
| `mode` | `polling` (local dev) or `webhook` (production) |
| `dmPolicy` | Who can DM the bot: `open`, `pairing`, `allowlist`, `closed` |
| `groupPolicy` | Group access: `open`, `allowlist`, `closed` |

### Step 4 – Start OpenClaw

```bash
openclaw daemon start
openclaw daemon logs --follow
```

### Step 5 – Test

Search your bot username in Telegram, press **Start**, and send a message.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `401 Unauthorized` | Bot token is wrong — regenerate in BotFather |
| Bot doesn't see group messages | Disable Privacy Mode in BotFather → Group Privacy → OFF |
| Config changes not applied | Run `openclaw daemon restart` |

---

## Security Notes

- **Never commit `.env`** to version control
- The bot token is equivalent to a password — keep it private
- `.env` is listed in `.gitignore` for this reason

---

Full docs: [docs.openclaw.ai/channels/telegram](https://docs.openclaw.ai/channels/telegram)
