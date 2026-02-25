#!/usr/bin/env bash
#
# OpenClaw VPS One-Shot Setup Script
# Based on: @sina.growthtech method
#
# Usage:
#   1. SSH into your VPS:  ssh root@<your-vps-ip>
#   2. Run this script:    bash <(curl -sL <raw-url-of-this-script>)
#      — or copy-paste each section manually.
#
set -euo pipefail

echo "============================================"
echo "  OpenClaw VPS Setup (Docker + Tailscale)  "
echo "============================================"
echo ""

# ── Step 1: System update ────────────────────────────────────────
echo "[1/6] Updating system..."
apt update && apt upgrade -y

# ── Step 2: Install Docker ───────────────────────────────────────
echo ""
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    echo "Docker installed successfully."
else
    echo "Docker already installed: $(docker --version)"
fi

# Verify Docker Compose
docker compose version

# ── Step 3: Install Tailscale on the host ────────────────────────
echo ""
echo "[3/6] Installing Tailscale..."
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "Tailscale installed successfully."
else
    echo "Tailscale already installed: $(tailscale version)"
fi

echo ""
echo ">>> Authenticate Tailscale now:"
echo "    Run:  tailscale up"
echo "    Then visit the URL it shows to log in."
echo ""
read -rp "Press ENTER after you've authenticated Tailscale..."

# Verify Tailscale connection
tailscale status

# ── Step 4: Firewall (UFW) ──────────────────────────────────────
echo ""
echo "[4/6] Configuring firewall (UFW)..."
apt install -y ufw

# Allow SSH so we don't lock ourselves out
ufw allow ssh

# Allow Tailscale traffic (UDP 41641)
ufw allow 41641/udp comment "Tailscale"

# Deny everything else incoming
ufw default deny incoming
ufw default allow outgoing

# Enable firewall
echo "y" | ufw enable
ufw status verbose

echo ""
echo "Firewall active — only SSH and Tailscale allowed."

# ── Step 5: Clone OpenClaw and run Docker setup ─────────────────
echo ""
echo "[5/6] Installing OpenClaw via Docker..."
cd /root

if [ -d "openclaw" ]; then
    echo "OpenClaw directory already exists. Pulling latest..."
    cd openclaw && git pull
else
    git clone https://github.com/openclaw/openclaw.git
    cd openclaw
fi

# Run the official Docker setup script
# This will:
#   - Build the Docker image
#   - Run the onboarding wizard (interactive)
#   - Generate a gateway token
#   - Start the OpenClaw gateway via Docker Compose
echo ""
echo "Running OpenClaw Docker setup..."
echo "The onboarding wizard will ask for your API key (Anthropic/OpenAI/etc)."
echo ""
bash docker-setup.sh

# ── Step 6: Bind to Tailscale only ──────────────────────────────
echo ""
echo "[6/6] Restricting access to Tailscale only..."

# Get the Tailscale IP
TS_IP=$(tailscale ip -4)
echo "Your Tailscale IP: $TS_IP"

echo ""
echo "============================================"
echo "  SETUP COMPLETE!"
echo "============================================"
echo ""
echo "Access OpenClaw from any device on your Tailnet:"
echo ""
echo "  Web UI:  http://${TS_IP}:18789"
echo ""
echo "  To get the dashboard URL with token:"
echo "    cd /root/openclaw"
echo "    docker compose run --rm openclaw-cli dashboard --no-open"
echo ""
echo "SECURITY NOTES:"
echo "  - Firewall blocks ALL public traffic (only SSH + Tailscale)"
echo "  - Port 18789 is only reachable via Tailscale IP"
echo "  - Install Tailscale on your laptop/phone to access"
echo "  - Optional: lock SSH to Tailscale too:"
echo "      ufw deny ssh"
echo "      ufw allow in on tailscale0 to any port 22"
echo ""
echo "USEFUL COMMANDS:"
echo "  docker compose ps                # check status"
echo "  docker compose logs -f           # view logs"
echo "  docker compose restart           # restart"
echo "  tailscale status                 # check Tailscale"
echo ""
