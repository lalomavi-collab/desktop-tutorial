#!/usr/bin/env bash
set -euo pipefail

# OpenClaw Installation Script
# https://github.com/openclaw/openclaw

REQUIRED_NODE_VERSION=22

echo "=== OpenClaw Installation Script ==="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "OpenClaw requires Node.js >= $REQUIRED_NODE_VERSION"
    echo "Install it from https://nodejs.org/ or use nvm:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "  nvm install $REQUIRED_NODE_VERSION"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    echo "Error: Node.js version $REQUIRED_NODE_VERSION or higher is required."
    echo "Current version: $(node -v)"
    echo "Please upgrade Node.js and try again."
    exit 1
fi

echo "Node.js $(node -v) detected - OK"
echo ""

# Detect package manager
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
elif command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
else
    PKG_MANAGER="npm"
fi

echo "Using package manager: $PKG_MANAGER"
echo ""

# Install OpenClaw globally
echo "Installing OpenClaw globally..."
$PKG_MANAGER install -g openclaw@latest

echo ""
echo "OpenClaw installed successfully!"
echo ""

# Check if configuration already exists
CONFIG_DIR="$HOME/.openclaw"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "No configuration found. Creating default configuration..."
    mkdir -p "$CONFIG_DIR"
    cp "$(dirname "$0")/openclaw.json" "$CONFIG_FILE" 2>/dev/null || cat > "$CONFIG_FILE" << 'EOF'
{
  "agent": {
    "model": "anthropic/claude-opus-4-6"
  }
}
EOF
    echo "Default configuration created at $CONFIG_FILE"
else
    echo "Existing configuration found at $CONFIG_FILE"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Run the onboarding wizard:"
echo "     openclaw onboard --install-daemon"
echo ""
echo "2. Or start the gateway directly:"
echo "     openclaw gateway --port 18789 --verbose"
echo ""
echo "3. Run diagnostics if needed:"
echo "     openclaw doctor"
echo ""
echo "For more info, see: https://github.com/openclaw/openclaw"
