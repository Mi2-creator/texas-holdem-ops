#!/bin/bash
# =============================================================================
# Bootstrap a fresh Ubuntu 22.04/24.04 server for Texas Hold'em deployment
# Run ON the remote server (or via: ssh user@host 'bash -s' < scripts/prod/bootstrap_server.sh)
# =============================================================================
set -euo pipefail

echo "========================================"
echo "[BOOTSTRAP] Texas Hold'em Server Setup"
echo "========================================"

# Must run as root or with sudo
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: Run as root or with sudo"
    exit 1
fi

DEPLOY_USER="${1:-deploy}"
DEPLOY_DIR="${2:-/opt/texas-holdem}"

# --- System packages ---
echo "[BOOTSTRAP] Updating system packages..."
apt-get update -qq
apt-get install -y -qq curl rsync ufw ca-certificates gnupg lsb-release

# --- Docker ---
if ! command -v docker &>/dev/null; then
    echo "[BOOTSTRAP] Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "[BOOTSTRAP] Docker installed: $(docker --version)"
else
    echo "[BOOTSTRAP] Docker already installed: $(docker --version)"
fi

# --- Deploy user ---
if ! id "$DEPLOY_USER" &>/dev/null; then
    echo "[BOOTSTRAP] Creating deploy user: $DEPLOY_USER"
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
else
    echo "[BOOTSTRAP] User $DEPLOY_USER exists, ensuring docker group..."
    usermod -aG docker "$DEPLOY_USER"
fi

# --- Deploy directory ---
echo "[BOOTSTRAP] Creating deploy directory: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"/{data,backups,data/caddy}
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$DEPLOY_DIR"

# --- Firewall ---
echo "[BOOTSTRAP] Configuring firewall (ufw)..."
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
echo "[BOOTSTRAP] Firewall rules:"
ufw status numbered

# --- Docker auto-restart on boot ---
systemctl enable docker

echo ""
echo "========================================"
echo "[BOOTSTRAP] DONE"
echo "========================================"
echo "Deploy user: $DEPLOY_USER"
echo "Deploy dir:  $DEPLOY_DIR"
echo "Docker:      $(docker --version)"
echo "Compose:     $(docker compose version)"
echo "Firewall:    SSH(22), HTTP(80), HTTPS(443)"
echo ""
echo "Next: copy .env.prod to $DEPLOY_DIR/.env and run deploy_prod.sh"
echo "========================================"
