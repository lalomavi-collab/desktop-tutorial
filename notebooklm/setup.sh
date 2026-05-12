#!/usr/bin/env bash
# NotebookLM setup – install dependencies and authenticate with Google
set -e

echo "==> Installing notebooklm-py with browser support..."
pip install "notebooklm-py[browser]" mcp

echo ""
echo "==> Installing Playwright browser (Chromium)..."
playwright install chromium

echo ""
echo "==> Authenticating with Google..."
echo "    A browser window will open. Sign in with your Google account."
echo "    The session is saved locally – you only need to do this once."
echo ""
notebooklm login

echo ""
echo "✓ Setup complete. You can now use the NotebookLM MCP server."
echo ""
echo "To start the MCP server manually:"
echo "  python notebooklm/mcp_server.py"
