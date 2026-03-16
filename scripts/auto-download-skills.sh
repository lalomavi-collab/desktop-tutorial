#!/bin/bash
# =============================================================
# Auto-Download Skills for Claude Code
# =============================================================
# This script automatically downloads and sets up Claude Code
# skills, handles authentication refresh, and manages skill
# directories.
# =============================================================

set -euo pipefail

# ---- Configuration ----
SKILLS_DIR="${HOME}/.claude/skills"
AGENTS_SKILLS_DIR="${HOME}/.agents/skills"
SKILL_CREATOR_DIR="${HOME}/.claude/skill-creator"
LOG_FILE="${HOME}/.claude/skills-auto-download.log"
CONFIG_FILE="$(dirname "$0")/../skills.config.json"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---- Logging ----
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info()  { log "INFO"  "${GREEN}$*${NC}"; }
log_warn()  { log "WARN"  "${YELLOW}$*${NC}"; }
log_error() { log "ERROR" "${RED}$*${NC}"; }

# ---- Directory Setup ----
setup_directories() {
    log_info "Setting up skill directories..."

    local dirs=("$SKILLS_DIR" "$AGENTS_SKILLS_DIR" "$SKILL_CREATOR_DIR")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        else
            log_info "Directory exists: $dir"
        fi
    done
}

# ---- Authentication Check ----
check_auth() {
    log_info "Checking Claude Code authentication status..."

    # Try to detect if claude CLI is available
    if command -v claude &> /dev/null; then
        log_info "Claude CLI found."
        return 0
    else
        log_warn "Claude CLI not found in PATH."
        return 1
    fi
}

handle_auth_error() {
    log_error "============================================"
    log_error "  Authentication Error Detected (401)"
    log_error "============================================"
    log_error ""
    log_error "Your OAuth token has expired."
    log_error ""
    log_error "To fix this, run one of the following:"
    log_error ""
    log_error "  1. In Claude Code terminal:"
    log_error "     /login"
    log_error ""
    log_error "  2. In system terminal:"
    log_error "     claude login"
    log_error ""
    log_error "  3. If using API key, refresh it in:"
    log_error "     ~/.claude/credentials.json"
    log_error ""
    log_error "After re-authenticating, run this script again:"
    log_error "  bash scripts/auto-download-skills.sh"
    log_error "============================================"
}

# ---- Skill Installation ----
install_skill() {
    local skill_name="$1"
    local skill_source="$2"
    local target_dir="$3"
    local skill_path="${target_dir}/${skill_name}"

    if [ -d "$skill_path" ] || [ -f "$skill_path" ] || [ -f "${skill_path}.md" ]; then
        log_info "Skill '${skill_name}' already installed at ${target_dir}"
        return 0
    fi

    log_info "Installing skill '${skill_name}' from ${skill_source}..."

    # Handle different source types
    case "$skill_source" in
        http*|https*)
            # Download from URL with retry logic
            download_with_retry "$skill_source" "$skill_path"
            ;;
        git@*|*.git)
            # Clone git repo
            git clone "$skill_source" "$skill_path" 2>/dev/null || {
                log_error "Failed to clone skill '${skill_name}'"
                return 1
            }
            ;;
        /*)
            # Local path - copy
            if [ -e "$skill_source" ]; then
                cp -r "$skill_source" "$skill_path"
            else
                log_error "Local source not found: ${skill_source}"
                return 1
            fi
            ;;
        *)
            # Treat as a skill identifier for claude CLI
            if command -v claude &> /dev/null; then
                claude skill install "$skill_name" 2>/dev/null || {
                    log_warn "Could not install via CLI: ${skill_name}"
                    return 1
                }
            else
                log_warn "Cannot install '${skill_name}' - no supported method"
                return 1
            fi
            ;;
    esac

    log_info "Successfully installed skill '${skill_name}'"
    return 0
}

download_with_retry() {
    local url="$1"
    local target="$2"
    local max_retries=4
    local retry=0
    local wait_time=2

    while [ $retry -lt $max_retries ]; do
        if curl -fsSL "$url" -o "$target" 2>/dev/null; then
            return 0
        fi

        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            log_warn "Download failed, retrying in ${wait_time}s... (attempt ${retry}/${max_retries})"
            sleep "$wait_time"
            wait_time=$((wait_time * 2))
        fi
    done

    log_error "Download failed after ${max_retries} attempts: ${url}"
    return 1
}

# ---- Load Config & Install Skills ----
load_and_install_skills() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warn "No skills config found at ${CONFIG_FILE}"
        log_info "Creating default config..."
        create_default_config
    fi

    log_info "Loading skills from config: ${CONFIG_FILE}"

    # Parse JSON config and install each skill
    if command -v python3 &> /dev/null; then
        python3 -c "
import json, sys

with open('${CONFIG_FILE}', 'r') as f:
    config = json.load(f)

for skill in config.get('skills', []):
    name = skill.get('name', '')
    source = skill.get('source', '')
    target = skill.get('target_dir', '${SKILLS_DIR}')
    auto = skill.get('auto_download', True)
    if name and auto:
        print(f'{name}|{source}|{target}')
" | while IFS='|' read -r name source target; do
            install_skill "$name" "$source" "$target"
        done
    else
        log_warn "python3 not found - cannot parse JSON config"
        log_info "Installing default skills only..."
    fi
}

create_default_config() {
    cat > "$CONFIG_FILE" << 'CONFIGEOF'
{
  "version": "1.0",
  "description": "Auto-download skills configuration for Claude Code",
  "auto_refresh_auth": true,
  "retry_on_failure": true,
  "max_retries": 4,
  "skills": [
    {
      "name": "claude-skills",
      "description": "Core Claude Code skills",
      "source": "default",
      "target_dir": "~/.claude/skills",
      "auto_download": true,
      "priority": "high"
    },
    {
      "name": "agents-skills",
      "description": "Agent-based skills collection",
      "source": "default",
      "target_dir": "~/.agents/skills",
      "auto_download": true,
      "priority": "medium"
    },
    {
      "name": "skill-creator",
      "description": "Skill creation toolkit",
      "source": "default",
      "target_dir": "~/.claude/skill-creator",
      "auto_download": true,
      "priority": "medium"
    }
  ],
  "hooks": {
    "on_session_start": true,
    "on_auth_error": "refresh",
    "on_skill_missing": "auto_install"
  }
}
CONFIGEOF
    log_info "Default config created at ${CONFIG_FILE}"
}

# ---- Session Start Hook ----
create_session_hook() {
    local hooks_dir="${HOME}/.claude/hooks"
    local hook_file="${hooks_dir}/session-start-skills.sh"

    mkdir -p "$hooks_dir"

    cat > "$hook_file" << 'HOOKEOF'
#!/bin/bash
# Claude Code Session Start Hook - Auto-download skills
# This hook runs when a new Claude Code session starts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_DOWNLOAD_SCRIPT="${SCRIPT_DIR}/../../desktop-tutorial/scripts/auto-download-skills.sh"

if [ -f "$AUTO_DOWNLOAD_SCRIPT" ]; then
    bash "$AUTO_DOWNLOAD_SCRIPT" --quiet
fi
HOOKEOF

    chmod +x "$hook_file"
    log_info "Session start hook created at ${hook_file}"
}

# ---- Status Report ----
show_status() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Claude Code Skills Status Report${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    local dirs=("$SKILLS_DIR:~/.claude/skills" "$AGENTS_SKILLS_DIR:~/.agents/skills" "$SKILL_CREATOR_DIR:~/.claude/skill-creator")

    for entry in "${dirs[@]}"; do
        local dir="${entry%%:*}"
        local label="${entry##*:}"

        if [ -d "$dir" ]; then
            local count
            count=$(find "$dir" -maxdepth 1 -not -name '.*' -not -path "$dir" 2>/dev/null | wc -l)
            echo -e "  ${GREEN}✓${NC} ${label} (${count} items)"
        else
            echo -e "  ${RED}✗${NC} ${label} (missing)"
        fi
    done

    echo ""

    # Check auth status
    if command -v claude &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Claude CLI: available"
    else
        echo -e "  ${YELLOW}!${NC} Claude CLI: not in PATH"
    fi

    echo ""
    echo -e "${BLUE}========================================${NC}"
}

# ---- Main ----
main() {
    local quiet=false

    for arg in "$@"; do
        case "$arg" in
            --quiet|-q) quiet=true ;;
            --status|-s) show_status; exit 0 ;;
            --hook) create_session_hook; exit 0 ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --quiet, -q    Suppress output"
                echo "  --status, -s   Show skills status"
                echo "  --hook         Create session start hook"
                echo "  --help, -h     Show this help"
                exit 0
                ;;
        esac
    done

    if [ "$quiet" = false ]; then
        echo -e "${BLUE}Claude Code - Auto Download Skills${NC}"
        echo ""
    fi

    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"

    # Step 1: Setup directories
    setup_directories

    # Step 2: Check authentication
    if ! check_auth; then
        handle_auth_error
    fi

    # Step 3: Load config and install skills
    load_and_install_skills

    # Step 4: Show status
    if [ "$quiet" = false ]; then
        show_status
    fi

    log_info "Auto-download skills process completed."
}

main "$@"
