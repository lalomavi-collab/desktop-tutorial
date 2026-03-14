#!/bin/bash
# =============================================================
# SSH Server Setup Script
# Run this on the REMOTE computer (the one you want to access)
# =============================================================

set -e

echo "========================================"
echo "  SSH Server Setup - Remote Computer"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "[!] Please run this script with sudo:"
    echo "    sudo bash setup-ssh-server.sh"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
elif [ "$(uname)" == "Darwin" ]; then
    OS="macos"
else
    echo "[!] Unsupported operating system"
    exit 1
fi

echo "[*] Detected OS: $OS"
echo ""

# Install OpenSSH Server
echo "[1/5] Installing OpenSSH Server..."
case $OS in
    ubuntu|debian|pop|linuxmint)
        apt update -qq
        apt install -y openssh-server
        ;;
    fedora)
        dnf install -y openssh-server
        ;;
    centos|rhel|rocky|alma)
        yum install -y openssh-server
        ;;
    arch|manjaro)
        pacman -S --noconfirm openssh
        ;;
    macos)
        echo "    macOS has SSH built-in. Enabling Remote Login..."
        systemsetup -setremotelogin on
        ;;
    *)
        echo "[!] Unsupported distro: $OS"
        echo "    Install openssh-server manually."
        exit 1
        ;;
esac
echo "    Done."
echo ""

# Enable and start SSH service
echo "[2/5] Enabling and starting SSH service..."
if [ "$OS" != "macos" ]; then
    systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null
    systemctl start ssh 2>/dev/null || systemctl start sshd 2>/dev/null
fi
echo "    Done."
echo ""

# Configure SSH for security
echo "[3/5] Applying security configuration..."
SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup original config
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"

# Apply secure settings (keep password auth enabled for initial setup)
cat > /etc/ssh/sshd_config.d/custom-security.conf 2>/dev/null << 'CONF' || true
# Custom SSH Security Settings
PermitRootLogin no
MaxAuthTries 5
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
CONF

echo "    Done."
echo ""

# Configure firewall
echo "[4/5] Configuring firewall..."
if command -v ufw &>/dev/null; then
    ufw allow ssh
    echo "    UFW: SSH port allowed."
elif command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
    echo "    firewalld: SSH port allowed."
else
    echo "    No firewall detected. Make sure port 22 is open."
fi
echo ""

# Restart SSH service
echo "[5/5] Restarting SSH service..."
if [ "$OS" != "macos" ]; then
    systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null
fi
echo "    Done."
echo ""

# Display connection info
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Connection details for this computer:"
echo ""

# Get IP addresses
echo "  Local IP addresses:"
if command -v ip &>/dev/null; then
    ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | while read ip; do
        echo "    - $ip"
    done
elif command -v ifconfig &>/dev/null; then
    ifconfig | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | while read ip; do
        echo "    - $ip"
    done
fi

echo ""
echo "  SSH Port: 22"
echo "  Username: $(logname 2>/dev/null || echo '$USER')"
echo ""
echo "  Connect from your other computer with:"
echo "    ssh $(logname 2>/dev/null || echo 'USERNAME')@<IP_ADDRESS>"
echo ""
echo "  For key-based auth (recommended), run on the CLIENT:"
echo "    ssh-keygen -t ed25519"
echo "    ssh-copy-id $(logname 2>/dev/null || echo 'USERNAME')@<IP_ADDRESS>"
echo ""
