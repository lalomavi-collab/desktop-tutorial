#!/bin/bash
# =============================================================
# SSH Client Connection Helper
# Run this on your LOCAL computer (the one you're sitting at)
# =============================================================

set -e

echo "========================================"
echo "  SSH Client - Connect to Remote PC"
echo "========================================"
echo ""

# Check if SSH client is installed
if ! command -v ssh &>/dev/null; then
    echo "[!] SSH client not found. Installing..."
    if [ -f /etc/debian_version ]; then
        sudo apt update -qq && sudo apt install -y openssh-client
    elif [ -f /etc/redhat-release ]; then
        sudo dnf install -y openssh-clients
    fi
fi

# Step 1: Generate SSH key if not exists
echo "[1/3] Checking SSH keys..."
if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
    echo "    No SSH key found. Generating one..."
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    echo "    You will be prompted to set a passphrase (recommended for security)."
    ssh-keygen -t ed25519 -f "$HOME/.ssh/id_ed25519" -C "$(whoami)@$(hostname)"
    echo "    Key generated."
else
    echo "    SSH key already exists."
fi
echo ""

# Step 2: Get remote computer details
echo "[2/3] Remote computer details"
echo ""
read -p "    Enter remote IP address: " REMOTE_IP
read -p "    Enter remote username: " REMOTE_USER

if [ -z "$REMOTE_IP" ] || [ -z "$REMOTE_USER" ]; then
    echo "[!] IP address and username are required."
    exit 1
fi

# Step 3: Copy SSH key to remote
echo ""
echo "[3/3] Setting up key-based authentication..."
echo "    You will be asked for the remote password ONE TIME."
echo ""
ssh-copy-id -i "$HOME/.ssh/id_ed25519.pub" "${REMOTE_USER}@${REMOTE_IP}"

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "  You can now connect without a password:"
echo ""
echo "    ssh ${REMOTE_USER}@${REMOTE_IP}"
echo ""

# Save connection as an alias
ALIAS_NAME="ssh-remote"
echo "  Save as quick alias? (y/n)"
read -p "  > " SAVE_ALIAS

if [ "$SAVE_ALIAS" = "y" ] || [ "$SAVE_ALIAS" = "Y" ]; then
    SHELL_RC="$HOME/.bashrc"
    [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

    echo "" >> "$SHELL_RC"
    echo "# SSH Remote Connection" >> "$SHELL_RC"
    echo "alias ${ALIAS_NAME}='ssh ${REMOTE_USER}@${REMOTE_IP}'" >> "$SHELL_RC"
    echo "  Alias saved! After restart, just type: ${ALIAS_NAME}"
fi

echo ""
echo "  Connecting now..."
echo ""
ssh "${REMOTE_USER}@${REMOTE_IP}"
