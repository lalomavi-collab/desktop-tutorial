#!/usr/bin/env bash
# Sends a notification to Telegram via Zapier webhook.
# Usage:
#   echo "msg" | ./notify-telegram.sh
#   ./notify-telegram.sh "msg"
#   called with no args: reads JSON from stdin (Claude Code Stop hook mode)

TELEGRAM_WEBHOOK="https://hooks.zapier.com/hooks/catch/26446500/unrrbau/"

# Determine message
if [ -n "$1" ]; then
  MESSAGE="$1"
else
  # Try to read JSON from stdin (Claude Code Stop hook)
  INPUT=$(cat)
  if echo "$INPUT" | jq -e . >/dev/null 2>&1; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
    MESSAGE="✅ הסוכן סיים את המשימה
Session: ${SESSION_ID:0:8}...
זמן: $(date '+%d/%m/%Y %H:%M')"
  else
    MESSAGE="$INPUT"
  fi
fi

if [ -z "$MESSAGE" ]; then
  exit 0
fi

curl -s -X POST "$TELEGRAM_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{\"message\": $(echo "$MESSAGE" | jq -Rs .)}" \
  > /dev/null

exit 0
