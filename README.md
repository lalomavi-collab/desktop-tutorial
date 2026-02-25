# OpenClaw on VPS — Tailscale-Only Access

Self-hosted [OpenClaw](https://github.com/openclaw/openclaw) running in Docker on a VPS, accessible **only** through your [Tailscale](https://tailscale.com) network. Zero public ports.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/lalomavi-collab/desktop-tutorial.git
cd desktop-tutorial

# 2. Configure
cp .env.example .env
nano .env   # add your Tailscale auth key + Anthropic API key

# 3. Launch
docker compose up -d

# 4. Open in browser
# https://openclaw.<your-tailnet>.ts.net
```

## What's Included

| File | Purpose |
|------|---------|
| `docker-compose.yml` | OpenClaw + Tailscale sidecar (single network) |
| `tailscale/serve.json` | Tailscale Serve reverse-proxy config |
| `.env.example` | Environment variable template |
| `install-openclaw.sh` | Standalone install script (non-Docker) |
| `DEPLOYMENT-GUIDE.md` | Full step-by-step deployment guide |

## Requirements

- VPS with Ubuntu 22.04+, 2 GB+ RAM
- Docker Engine 24+ with Compose v2
- Tailscale account (free tier works)
- Anthropic API key (or OpenAI/OpenRouter)

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for the full detailed plan.
