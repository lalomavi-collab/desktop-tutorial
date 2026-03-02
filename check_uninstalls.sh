#!/bin/bash

# ======================================================
# בדיקת מחיקת התקנות: openclaw, tailscale, hostinger
# Uninstall Verification Script
# ======================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

echo ""
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   בדיקת מחיקת התקנות / Uninstall Check             ${NC}"
echo -e "${BLUE}   תאריך: $(date)${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

check_uninstalled() {
    local app_name="$1"
    local found=0
    local details=()

    echo -e "${YELLOW}--- בודק: $app_name ---${NC}"

    # 1. Check if command/binary exists in PATH
    if command -v "$app_name" &>/dev/null 2>&1; then
        found=1
        details+=("  ❌ פקודה נמצאה ב-PATH: $(command -v $app_name)")
    fi

    # 2. Check common install directories
    for dir in \
        "/usr/bin/$app_name" \
        "/usr/local/bin/$app_name" \
        "/opt/$app_name" \
        "/opt/${app_name}*" \
        "$HOME/.local/bin/$app_name" \
        "$HOME/.$app_name" \
        "/etc/$app_name" \
        "/var/lib/$app_name" \
        "/usr/share/$app_name" \
        "/usr/lib/$app_name" \
        "/usr/lib/${app_name}*" \
        "/Applications/${app_name}*" ; do
        # Use glob expansion
        for expanded in $dir; do
            if [ -e "$expanded" ]; then
                found=1
                details+=("  ❌ קובץ/תיקייה נמצא: $expanded")
            fi
        done
    done

    # 3. Check running processes
    if pgrep -i "$app_name" &>/dev/null 2>&1; then
        found=1
        details+=("  ❌ תהליך פעיל נמצא: $(pgrep -ia "$app_name" | head -3)")
    fi

    # 4. Check systemd services (Linux)
    if command -v systemctl &>/dev/null 2>&1; then
        svc=$(systemctl list-units --all 2>/dev/null | grep -i "$app_name" | head -3)
        if [ -n "$svc" ]; then
            found=1
            details+=("  ❌ שירות systemd נמצא: $svc")
        fi
        svc_file=$(systemctl list-unit-files 2>/dev/null | grep -i "$app_name" | head -3)
        if [ -n "$svc_file" ]; then
            found=1
            details+=("  ❌ קובץ שירות נמצא: $svc_file")
        fi
    fi

    # 5. Check package managers
    # dpkg (Debian/Ubuntu)
    if command -v dpkg &>/dev/null 2>&1; then
        pkg=$(dpkg -l 2>/dev/null | grep -i "$app_name" | grep -v "^rc")
        if [ -n "$pkg" ]; then
            found=1
            details+=("  ❌ חבילת dpkg נמצאה: $pkg")
        fi
    fi

    # rpm (RHEL/CentOS/Fedora)
    if command -v rpm &>/dev/null 2>&1; then
        pkg=$(rpm -qa 2>/dev/null | grep -i "$app_name")
        if [ -n "$pkg" ]; then
            found=1
            details+=("  ❌ חבילת rpm נמצאה: $pkg")
        fi
    fi

    # brew (macOS)
    if command -v brew &>/dev/null 2>&1; then
        pkg=$(brew list 2>/dev/null | grep -i "$app_name")
        if [ -n "$pkg" ]; then
            found=1
            details+=("  ❌ חבילת brew נמצאה: $pkg")
        fi
    fi

    # snap
    if command -v snap &>/dev/null 2>&1; then
        pkg=$(snap list 2>/dev/null | grep -i "$app_name")
        if [ -n "$pkg" ]; then
            found=1
            details+=("  ❌ חבילת snap נמצאה: $pkg")
        fi
    fi

    # 6. Check leftover config files
    for cfg in \
        "$HOME/.config/$app_name" \
        "$HOME/.config/${app_name}*" \
        "/etc/${app_name}" \
        "/etc/${app_name}.conf" \
        "/etc/default/${app_name}" ; do
        for expanded in $cfg; do
            if [ -e "$expanded" ]; then
                details+=("  ⚠️  קובץ הגדרות שנשאר: $expanded")
            fi
        done
    done

    # Report result
    if [ "$found" -eq 0 ]; then
        echo -e "  ${GREEN}✅ $app_name - נמחק בהצלחה!${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}❌ $app_name - נמצאו שרידים!${NC}"
        FAIL=$((FAIL + 1))
    fi

    for d in "${details[@]}"; do
        echo -e "$d"
    done
    echo ""
}

# ---- Run checks ----

check_uninstalled "tailscale"
check_uninstalled "tailscaled"   # tailscale daemon
check_uninstalled "hostinger"
check_uninstalled "openclaw"

# ---- Summary ----
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   סיכום / Summary${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "  ${GREEN}עברו: $PASS${NC}"
echo -e "  ${RED}נכשלו (נמצאו שרידים): $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}🎉 כל ההתקנות נמחקו בהצלחה!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  נמצאו שרידים של התוכנות. בדוק את הפרטים למעלה.${NC}"
    exit 1
fi
