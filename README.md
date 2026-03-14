# Desktop Tutorial - Project Collection

Collection of tools, games, educational content, and DevOps utilities.

## Projects

### Games
- **[Horse Riding Game](games/horse-riding/)** - Interactive horse riding game for kids (HTML/CSS/JS)
- **[Memory Game](games/memory-game/)** - Memory card game with themes, sounds, and animations (HTML/CSS/JS)

### AI Tools
- **[Prompt Builder Agent](prompt_builder/)** - 6-step structured prompt builder for professional applications (Python + Anthropic API)
- **[MD Agent / Dev Agents](md-agent/)** - CLI agents for generating project files, managing email, and more (Node.js)

### Education
- **[AI Education Program](ai-education-program/)** - AI curriculum for Israeli schools (grades 7-12)
- **[Just-AI Program](just-ai-program/)** - Lawyer-Technologist training program (120h, 2-year track)
- **[AI Excellence Program](ai-excellence-program/)** - Presentation for Gefen/Ministry of Education

### DevOps & Security
- **[OpenClaw Setup](openclaw-setup/)** - Docker + Tailscale deployment with security guide
- **[SSH Remote Access](ssh-remote-access/)** - SSH server/client setup scripts
- **[Uninstall Tools](uninstall-tools/)** - Verification and cleanup scripts for openclaw/tailscale/hostinger

### Design
- **[VAYRON Shorts Collection](vayron-shorts/)** - Product catalog page with SVG illustrations

### Utilities
- **[Hebrew Greetings](hebrew-greetings/)** - Hebrew greeting validation module with tests (Python)

## Setup

### Python projects (Prompt Builder, Hebrew Greetings)
```bash
pip install -e .
```

### Node.js projects (MD Agent)
```bash
cd md-agent && npm install
```

## Security Notes
- Never commit `.env` files with real credentials
- Email agent config is stored locally with restricted permissions (600)
- SSH keys should always use a passphrase
- OpenClaw setup uses Tailscale-only access (no public ports)
