#!/usr/bin/env bash
# Sends a Telegram message via Bot API.
# Reads credentials from env vars or .env file.
# Usage:
#   ./notify-telegram.sh "message"
#   echo "msg" | ./notify-telegram.sh
#   called with no args + JSON stdin: Claude Code Stop hook mode

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-8204059324:AAFu6ys7r31S9FANf0FUjmrArgobcJ4Agaw}"
CHAT_ID="${TELEGRAM_CHAT_ID:-6260591961}"

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
  source "$(dirname "$0")/../.env"
fi

# Determine message
if [ -n "$1" ]; then
  MESSAGE="$1"
else
  INPUT=$(cat)
  if echo "$INPUT" | jq -e . >/dev/null 2>&1; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
    MESSAGE="✅ הסוכן סיים משימה
Session: ${SESSION_ID:0:8}...
זמן: $(date '+%d/%m/%Y %H:%M')"
  else
    MESSAGE="$INPUT"
  fi
fi

[ -z "$MESSAGE" ] && exit 0

curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": $(echo "$MESSAGE" | jq -Rs .)}" \
  > /dev/null

exit 0
