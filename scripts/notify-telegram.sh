#!/usr/bin/env bash
# Sends a Telegram message via @Lalumbot.
# Credentials come from env vars or .env file — never hardcoded.
# Usage:
#   ./notify-telegram.sh "message"
#   echo "msg" | ./notify-telegram.sh
#   JSON on stdin → Claude Code Stop hook mode

ENV_FILE="$(dirname "$0")/../.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN not set}"
CHAT_ID="${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID not set}"

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
