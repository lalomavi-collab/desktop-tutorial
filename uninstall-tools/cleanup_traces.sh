#!/bin/bash

# ======================================================
# ניקוי שרידים: openclaw, tailscale, hostinger
# Cleanup Residual Traces Script
# ======================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REMOVED=0
NOT_FOUND=0

echo ""
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   ניקוי שרידים / Cleanup Traces                     ${NC}"
echo -e "${BLUE}   תאריך: $(date)${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

safe_remove() {
    local path="$1"
    for expanded in $path; do
        if [ -e "$expanded" ] || [ -L "$expanded" ]; then
            echo -e "  ${YELLOW}מוחק:${NC} $expanded"
            rm -rf "$expanded" 2>/dev/null && REMOVED=$((REMOVED + 1)) \
                || echo -e "  ${RED}שגיאה במחיקת:${NC} $expanded"
        fi
    done
}

disable_service() {
    local svc="$1"
    if command -v systemctl &>/dev/null 2>&1; then
        if systemctl list-unit-files 2>/dev/null | grep -qi "$svc"; then
            echo -e "  ${YELLOW}מבטל שירות:${NC} $svc"
            systemctl stop "$svc" 2>/dev/null
            systemctl disable "$svc" 2>/dev/null
        fi
    fi
}

# ======================================================
# TAILSCALE
# ======================================================
echo -e "${BLUE}--- Tailscale ---${NC}"
disable_service "tailscale"
disable_service "tailscaled"
safe_remove "/etc/tailscale"
safe_remove "/var/lib/tailscale"
safe_remove "/var/cache/tailscale"
safe_remove "/var/log/tailscale*"
safe_remove "/run/tailscale*"
safe_remove "$HOME/.local/share/tailscale"
safe_remove "$HOME/.config/tailscale"
safe_remove "/usr/share/doc/tailscale*"
safe_remove "/etc/default/tailscale*"
safe_remove "/etc/systemd/system/tailscale*"
safe_remove "/lib/systemd/system/tailscale*"
safe_remove "/usr/lib/systemd/system/tailscale*"
echo ""

# ======================================================
# HOSTINGER
# ======================================================
echo -e "${BLUE}--- Hostinger ---${NC}"
safe_remove "$HOME/.config/hostinger"
safe_remove "$HOME/.local/share/hostinger"
safe_remove "$HOME/.hostinger"
safe_remove "/opt/hostinger"
safe_remove "/usr/share/hostinger"
safe_remove "/var/lib/hostinger"
safe_remove "/var/log/hostinger*"
safe_remove "/etc/hostinger"
echo ""

# ======================================================
# OPENCLAW
# ======================================================
echo -e "${BLUE}--- OpenClaw ---${NC}"
safe_remove "$HOME/.config/openclaw"
safe_remove "$HOME/.local/share/openclaw"
safe_remove "$HOME/.openclaw"
safe_remove "/opt/openclaw"
safe_remove "/usr/share/openclaw"
safe_remove "/var/lib/openclaw"
safe_remove "/var/log/openclaw*"
safe_remove "/etc/openclaw"
echo ""

# ======================================================
# Clean bash/zsh history entries related to these apps
# ======================================================
echo -e "${BLUE}--- ניקוי היסטוריית פקודות ---${NC}"
for histfile in "$HOME/.bash_history" "$HOME/.zsh_history" "$HOME/.history"; do
    if [ -f "$histfile" ]; then
        before=$(wc -l < "$histfile")
        tmp=$(mktemp)
        grep -iv "tailscale\|hostinger\|openclaw" "$histfile" > "$tmp" 2>/dev/null
        mv "$tmp" "$histfile"
        after=$(wc -l < "$histfile")
        removed=$((before - after))
        if [ "$removed" -gt 0 ]; then
            echo -e "  ${GREEN}הוסרו $removed שורות מ-$histfile${NC}"
            REMOVED=$((REMOVED + removed))
        else
            echo -e "  ${GREEN}לא נמצאו ערכים ב-$histfile${NC}"
        fi
    fi
done
echo ""

# ======================================================
# Summary
# ======================================================
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   סיכום / Summary${NC}"
echo -e "${BLUE}======================================================${NC}"
if [ "$REMOVED" -eq 0 ]; then
    echo -e "${GREEN}✅ לא נמצאו שרידים - המערכת נקייה לחלוטין!${NC}"
else
    echo -e "${GREEN}✅ הוסרו $REMOVED פריטים - המערכת נקייה עכשיו!${NC}"
fi
echo ""
