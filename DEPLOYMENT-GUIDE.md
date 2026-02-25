# OpenClaw on VPS with Tailscale-Only Access

## Architecture

```
Internet ──X──> VPS (no public ports open)
                 │
Tailscale ─────> tailscale container (:443 HTTPS)
                 │  network_mode: service:tailscale
                 └──> openclaw container (:8080 internal)
```

- **Zero public ports** — the VPS firewall blocks everything except SSH (and you can move SSH to Tailscale too).
- **Tailscale Serve** terminates TLS and reverse-proxies into OpenClaw on `127.0.0.1:8080`.
- **One `docker compose up`** brings everything up.

---

## Prerequisites

| Item | Details |
|------|---------|
| VPS | Ubuntu 22.04/24.04, 2+ GB RAM, 10 GB disk |
| Docker | Engine 24+ with Compose v2 plugin |
| Tailscale account | Free tier works — [tailscale.com](https://tailscale.com) |
| API key | Anthropic (or OpenAI / OpenRouter / Gemini) |

---

## Step-by-Step Deployment

### 1. Prepare the VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker compose version
```

### 2. Clone this repository

```bash
git clone https://github.com/lalomavi-collab/desktop-tutorial.git
cd desktop-tutorial
```

### 3. Create a Tailscale auth key

1. Go to [Tailscale Admin Console → Settings → Keys](https://login.tailscale.com/admin/settings/keys)
2. Click **Generate auth key**
3. Settings:
   - **Reusable**: Yes
   - **Ephemeral**: Yes (recommended)
   - **Tags**: `tag:container` (create the tag in ACL first if needed)
4. Copy the key (`tskey-auth-...`)

### 4. Configure environment

```bash
cp .env.example .env
nano .env    # fill in your actual values
```

Fill in:
- `TS_AUTHKEY` — the Tailscale auth key from step 3
- `ANTHROPIC_API_KEY` — your Claude API key
- `AUTH_PASSWORD` — a strong password for the web UI
- `OPENCLAW_GATEWAY_TOKEN` — generate with: `openssl rand -hex 32`

### 5. Launch

```bash
docker compose up -d
```

Check that both containers are healthy:

```bash
docker compose ps
docker compose logs -f
```

### 6. Access OpenClaw

Open your browser and go to:

```
https://openclaw.<your-tailnet-name>.ts.net
```

Log in with the `AUTH_USERNAME` / `AUTH_PASSWORD` you configured.

> You can find your tailnet name in the [Tailscale admin console](https://login.tailscale.com/admin/machines).

---

## Hardening Checklist

- [ ] **Firewall**: `ufw allow ssh && ufw enable` — no other ports needed
- [ ] **SSH via Tailscale**: Install Tailscale on the VPS host too, then `ufw deny ssh` from public
- [ ] **Tailscale ACLs**: Restrict which users/devices can reach `tag:container`
- [ ] **Rotate keys**: Change `AUTH_PASSWORD` and `OPENCLAW_GATEWAY_TOKEN` periodically
- [ ] **Updates**: `docker compose pull && docker compose up -d`

---

## Useful Commands

```bash
# View logs
docker compose logs -f openclaw
docker compose logs -f tailscale

# Restart
docker compose restart

# Stop
docker compose down

# Update to latest
docker compose pull
docker compose up -d

# Shell into OpenClaw
docker compose exec openclaw bash

# Check Tailscale status
docker compose exec tailscale tailscale status
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tailscale won't authenticate | Verify `TS_AUTHKEY` is valid and not expired |
| Cannot reach `https://openclaw.*.ts.net` | Run `docker compose exec tailscale tailscale status` to verify it's connected |
| Permission errors on `/data` | Ensure volume ownership: `docker compose exec openclaw chown -R node:node /data` |
| OpenClaw UI not loading | Check `docker compose logs openclaw` for startup errors |

---

## References

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Coollabs OpenClaw Docker](https://github.com/coollabsio/openclaw)
- [Tailscale Docker Docs](https://tailscale.com/kb/1282/docker)
- [Tailscale Docker Deep Dive](https://tailscale.com/blog/docker-tailscale-guide)
