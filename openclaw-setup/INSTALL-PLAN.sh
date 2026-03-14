# OpenClaw VPS Installation — Detailed Plan
# ONE Docker container + ONLY Tailscale access
# ============================================
#
# Target: root@187.124.7.15
# Method: Tailscale VPN on host → Docker container → OpenClaw
# Result: ZERO public ports, access ONLY via Tailscale
#
# ┌─────────────────────────────────────────────┐
# │              VPS (187.124.7.15)              │
# │                                              │
# │  UFW Firewall: DENY ALL incoming             │
# │  ┌──────────────────────────────────────┐    │
# │  │        Tailscale (on host)           │    │
# │  │    tailscale0 → 100.x.x.x           │    │
# │  │        ↓ only route in               │    │
# │  │  ┌──────────────────────────────┐    │    │
# │  │  │   Docker Container (ONE)     │    │    │
# │  │  │                              │    │    │
# │  │  │   OpenClaw Gateway :18789    │    │    │
# │  │  │   OpenClaw CLI               │    │    │
# │  │  │   Node.js runtime            │    │    │
# │  │  │                              │    │    │
# │  │  │   Volumes:                   │    │    │
# │  │  │   ~/.openclaw → /config      │    │    │
# │  │  │   ~/workspace → /workspace   │    │    │
# │  │  └──────────────────────────────┘    │    │
# │  └──────────────────────────────────────┘    │
# │                                              │
# │  Internet → ❌ BLOCKED                       │
# │  Tailscale → ✅ 100.x.x.x:18789             │
# └─────────────────────────────────────────────┘

# =============================================
# PHASE 1: INITIAL SERVER PREPARATION
# =============================================

# 1.1 — SSH into the VPS
ssh root@187.124.7.15

# 1.2 — Update system packages
apt update && apt upgrade -y

# 1.3 — Install essential tools
apt install -y curl git wget nano ufw

# =============================================
# PHASE 2: INSTALL DOCKER
# =============================================

# 2.1 — Install Docker Engine
curl -fsSL https://get.docker.com | sh

# 2.2 — Verify Docker is running
docker --version
docker compose version
systemctl status docker

# =============================================
# PHASE 3: INSTALL TAILSCALE ON THE HOST
# =============================================

# 3.1 — Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 3.2 — Start Tailscale and authenticate
#        This will print a URL — open it in your browser to log in
tailscale up

# 3.3 — Verify connection and note your Tailscale IP
tailscale status
tailscale ip -4
#        → Write down the IP (e.g., 100.64.x.x) — you'll need it!

# =============================================
# PHASE 4: CONFIGURE FIREWALL (UFW)
# =============================================
# This is the KEY security step:
# Block EVERYTHING from the internet,
# allow ONLY Tailscale traffic

# 4.1 — Set default policies
ufw default deny incoming
ufw default allow outgoing

# 4.2 — Allow SSH (temporarily, for initial setup)
ufw allow ssh

# 4.3 — Allow Tailscale WireGuard UDP
ufw allow 41641/udp comment "Tailscale WireGuard"

# 4.4 — Allow all traffic on Tailscale interface
ufw allow in on tailscale0

# 4.5 — Enable the firewall
ufw enable

# 4.6 — Verify
ufw status verbose
# Output should show:
#   22/tcp    ALLOW IN    Anywhere
#   41641/udp ALLOW IN    Anywhere  (Tailscale WireGuard)
#   Anywhere  ALLOW IN    on tailscale0

# =============================================
# PHASE 5: INSTALL OPENCLAW (ONE DOCKER CONTAINER)
# =============================================

# 5.1 — Create directories
mkdir -p /root/.openclaw
mkdir -p /root/openclaw-workspace

# 5.2 — Clone OpenClaw repository
cd /root
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# 5.3 — Run the official Docker setup script
#        This launches an interactive wizard that:
#        - Builds ONE Docker container
#        - Asks for your API key (Anthropic/OpenAI/Gemini)
#        - Generates a gateway token
#        - Configures everything
bash docker-setup.sh

# During the wizard you'll need:
#   - Anthropic API key (sk-ant-...) or OpenAI key
#   - Choose messaging platform (if any)
#   - Set a gateway token (auto-generated or custom)

# 5.4 — Verify the container is running
docker compose ps
docker compose logs --tail=50

# =============================================
# PHASE 6: BIND OPENCLAW TO TAILSCALE ONLY
# =============================================

# 6.1 — Edit docker-compose.yml to bind ONLY to Tailscale IP
#        Change the port binding from 0.0.0.0:18789 to tailscale-ip:18789
TAILSCALE_IP=$(tailscale ip -4)
echo "Your Tailscale IP: $TAILSCALE_IP"

# 6.2 — Update the compose file
#        Find the ports section and change:
#          "18789:18789"        ← BEFORE (listens on all interfaces)
#          "100.x.x.x:18789:18789"  ← AFTER (Tailscale only)
#
#        Or bind to localhost only (since Tailscale runs on host):
#          "127.0.0.1:18789:18789"
nano docker-compose.yml

# 6.3 — Restart with new binding
docker compose down
docker compose up -d

# 6.4 — Verify it's bound correctly
ss -tlnp | grep 18789
# Should show 127.0.0.1:18789 or 100.x.x.x:18789

# =============================================
# PHASE 7: LOCK DOWN SSH (OPTIONAL BUT RECOMMENDED)
# =============================================
# After verifying Tailscale access works,
# move SSH behind Tailscale too

# 7.1 — Test SSH via Tailscale first (from your laptop):
#        ssh root@100.x.x.x   (your Tailscale IP)

# 7.2 — If it works, lock public SSH:
ufw delete allow ssh
ufw allow in on tailscale0 to any port 22
ufw status verbose

# Now SSH ONLY works through Tailscale!

# =============================================
# PHASE 8: ACCESS OPENCLAW
# =============================================

# 8.1 — Install Tailscale on your laptop/phone:
#        https://tailscale.com/download

# 8.2 — Get the dashboard URL with token:
cd /root/openclaw
docker compose run --rm openclaw-cli dashboard --no-open
#        → Copy the full URL with ?token=...

# 8.3 — Open in your browser:
#        http://100.x.x.x:18789/?token=YOUR_TOKEN
#        (replace 100.x.x.x with your VPS's Tailscale IP)

# =============================================
# PHASE 9: SET UP AUTO-START ON REBOOT
# =============================================

# 9.1 — Docker containers auto-restart (already in compose)
#        restart: unless-stopped

# 9.2 — Ensure Docker starts on boot
systemctl enable docker

# 9.3 — Ensure Tailscale starts on boot
systemctl enable tailscaled

# =============================================
# VERIFICATION CHECKLIST
# =============================================
# Run these commands to verify everything is secure:

# ✅ OpenClaw container is running
docker compose ps

# ✅ Port 18789 is NOT on public IP
ss -tlnp | grep 18789

# ✅ Tailscale is connected
tailscale status

# ✅ Firewall is active
ufw status verbose

# ✅ Can access from laptop (via Tailscale)
# Open: http://100.x.x.x:18789

# ✅ CANNOT access from public internet
# Test: http://187.124.7.15:18789 → should TIMEOUT

# =============================================
# DAILY MANAGEMENT COMMANDS
# =============================================

# View logs
docker compose logs -f

# Restart OpenClaw
docker compose restart

# Stop OpenClaw
docker compose down

# Update OpenClaw
cd /root/openclaw && git pull && docker compose pull && docker compose up -d --build

# Check disk usage
df -h
docker system df

# Check Tailscale devices
tailscale status
