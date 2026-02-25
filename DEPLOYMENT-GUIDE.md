# OpenClaw on VPS — Tailscale-Only Access

> Based on the [@sina.growthtech](https://www.threads.com/@sina.growthtech) method:
> VPS + Docker container + Firewall blocking all incoming + Tailscale VPN

## Architecture

```
Internet ──X──> VPS :187.124.7.15 (UFW blocks everything)
                 │
                 ├── SSH (:22) ──> only for initial setup
                 │
Tailscale VPN ──> tailscale0 interface
                 │
                 └──> OpenClaw Docker container (:18789)
                      accessible ONLY via Tailscale IP
```

- **Zero public ports** — UFW blocks everything except SSH + Tailscale UDP
- **OpenClaw runs in Docker** — isolated from the host system
- **Tailscale mesh VPN** — only your authenticated devices can reach it
- **Runs 24/7** — `docker compose` with `restart: unless-stopped`

---

## Prerequisites

| Item | Details |
|------|---------|
| VPS | Ubuntu 22.04/24.04, min 2 GB RAM (4 GB recommended), 10 GB disk |
| Provider | IONOS, Hetzner, DigitalOcean, AWS, etc. (~$5-15/month) |
| Tailscale | Free account at [tailscale.com](https://tailscale.com) |
| API key | Anthropic, OpenAI, OpenRouter, or Gemini |

---

## Step-by-Step Deployment

### Step 1 — SSH into your VPS

```bash
ssh root@187.124.7.15
```

### Step 2 — Update the system

```bash
apt update && apt upgrade -y
```

### Step 3 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

### Step 4 — Install Tailscale on the VPS host

```bash
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate — it will print a URL, open it in your browser
tailscale up

# Verify connection
tailscale status

# Note your Tailscale IP (you'll need it later)
tailscale ip -4
```

### Step 5 — Configure the firewall (UFW)

```bash
# Install UFW
apt install -y ufw

# Allow SSH (so you don't lock yourself out!)
ufw allow ssh

# Allow Tailscale WireGuard traffic
ufw allow 41641/udp comment "Tailscale"

# Block everything else
ufw default deny incoming
ufw default allow outgoing

# Enable
ufw enable

# Verify
ufw status verbose
```

After this, **only SSH and Tailscale can reach your VPS**. Port 18789 (OpenClaw) is NOT public.

### Step 6 — Clone and install OpenClaw

```bash
cd /root
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Run the official Docker setup script
bash docker-setup.sh
```

The setup script will:
1. Build the OpenClaw Docker image
2. Launch the **onboarding wizard** (interactive)
3. Ask for your **API key** (Anthropic/OpenAI/etc.)
4. Generate a **gateway token**
5. Start the OpenClaw gateway via Docker Compose

### Step 7 — Access OpenClaw via Tailscale

From any device on your Tailscale network, open:

```
http://<tailscale-ip>:18789
```

To get the full dashboard URL with authentication token:

```bash
cd /root/openclaw
docker compose run --rm openclaw-cli dashboard --no-open
```

Copy the URL it outputs and open it in your browser.

---

## One-Shot Script (Alternative)

Instead of running each step manually, you can use the provided script:

```bash
ssh root@187.124.7.15
curl -sL <raw-url-of-vps-setup.sh> | bash
```

Or copy `vps-setup.sh` to the server and run it.

---

## Security Hardening

### Lock SSH to Tailscale only (recommended after setup)

```bash
# Allow SSH only through the Tailscale interface
ufw allow in on tailscale0 to any port 22

# Block SSH from public internet
ufw deny ssh

# Verify — now SSH only works via Tailscale
ufw status
```

After this, you SSH via Tailscale IP:
```bash
ssh root@<tailscale-ip>
```

### Tailscale ACLs

In the [Tailscale admin console](https://login.tailscale.com/admin/acls), restrict which devices can reach the VPS:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["autogroup:admin"],
      "dst": ["tag:server:*"]
    }
  ],
  "tagOwners": {
    "tag:server": ["autogroup:admin"]
  }
}
```

### Additional hardening

- [ ] Change default SSH port: `nano /etc/ssh/sshd_config` → `Port 2222`
- [ ] Disable root password login: `PermitRootLogin prohibit-password`
- [ ] Use SSH keys only: `PasswordAuthentication no`
- [ ] Rotate `OPENCLAW_GATEWAY_TOKEN` periodically
- [ ] Monitor logs: `docker compose logs -f`

---

## Useful Commands

```bash
# Check container status
docker compose ps

# View live logs
docker compose logs -f

# Restart OpenClaw
docker compose restart

# Stop everything
docker compose down

# Update to latest version
cd /root/openclaw
git pull
docker compose pull
docker compose up -d --build

# Enter the OpenClaw container
docker compose exec openclaw-gateway bash

# Check Tailscale status
tailscale status

# Check firewall
ufw status verbose

# Check Tailscale IP
tailscale ip -4
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker: command not found` | Re-run: `curl -fsSL https://get.docker.com \| sh` |
| `tailscale up` hangs | Check VPS allows outbound UDP 41641 |
| Can't reach `:18789` from laptop | Ensure Tailscale is running on your laptop too |
| Permission errors in container | `docker compose exec openclaw-gateway chown -R node:node /home/node/.openclaw` |
| Locked out of SSH | Use VPS provider's web console to fix UFW rules |
| Onboarding wizard fails | Run manually: `docker compose run --rm openclaw-cli onboard` |
| Token lost | Check `~/.openclaw/openclaw.json` for the gateway token |

---

## Cost Breakdown

| Item | Monthly Cost |
|------|-------------|
| VPS (IONOS/Hetzner 4GB) | ~$5-15 |
| Tailscale | Free (up to 100 devices) |
| Anthropic API | Pay per use |
| **Total** | **~$5-15 + API usage** |

---

## References

- [@sina.growthtech — OpenClaw VPS Setup](https://www.threads.com/@sina.growthtech/post/DUok0lxkgBC/)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Docker Setup Script](https://github.com/openclaw/openclaw/blob/main/docker-setup.sh)
- [Coollabs OpenClaw Docker](https://github.com/coollabsio/openclaw)
- [Tailscale Install](https://tailscale.com/download)
- [Tailscale Docker Guide](https://tailscale.com/blog/docker-tailscale-guide)
- [Self-Hosting OpenClaw with Tailscale (DEV.to)](https://dev.to/nunc/self-hosting-openclaw-ai-assistant-on-a-vps-with-tailscale-vpn-zero-public-ports-35fn)
