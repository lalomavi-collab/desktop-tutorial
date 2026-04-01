#!/usr/bin/env bash
# =============================================================
# Setup script: NotebookLM daily cron job at 9:00 AM
# Run once after completing: notebooklm login
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(which python3)"
DAILY_SCRIPT="$SCRIPT_DIR/notebooklm_daily.py"
LOG_FILE="$HOME/Desktop/notebooklm_daily/cron.log"
CRON_JOB="0 9 * * * $PYTHON $DAILY_SCRIPT >> $LOG_FILE 2>&1"

echo "Setting up NotebookLM daily cron job..."
echo "  Script : $DAILY_SCRIPT"
echo "  Log    : $LOG_FILE"
echo "  Schedule: every day at 09:00"
echo ""

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Add cron job (avoid duplicates)
EXISTING=$(crontab -l 2>/dev/null | grep -F "$DAILY_SCRIPT")
if [ -n "$EXISTING" ]; then
    echo "Cron job already exists:"
    echo "  $EXISTING"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added successfully."
    echo ""
    echo "Current crontab:"
    crontab -l
fi
