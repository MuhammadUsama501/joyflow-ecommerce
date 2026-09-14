#!/usr/bin/env bash
# ============================================================================
# JoyFlow — one-time Ubuntu server setup for Nginx + Node + PM2
#
# Run ONCE from your machine (or a fresh VPS) to install/bake the base
# toolchain. It does NOT deploy the app or alter app code.
#
#   Usage (from the repo root on the VPS after cloning):
#     bash deployment/setup-server.sh
#
# If you are starting from a truly fresh VPS, first run it over SSH:
#   ssh root@YOUR_SERVER_IP "bash -s" < deployment/setup-server.sh
# ============================================================================
set -euo pipefail

echo "==> Updating package lists"
sudo apt-get update
sudo apt-get upgrade -y

echo "==> Installing base packages (curl, git, build tools)"
sudo apt-get install -y curl wget git build-essential ca-certificates gnupg

echo "==> Installing Nginx"
sudo apt-get install -y nginx

echo "==> Installing Certbot + Nginx plugin (for Let's Encrypt HTTPS)"
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> Installing Node.js 22 LTS (NodeSource repo)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "node: $(node -v)  npm: $(npm -v)"

echo "==> Installing PM2 globally"
sudo npm install -g pm2

echo "==> Configuring UFW (firewall)"
# Allow SSH + Nginx (HTTP/HTTPS). Port 5000 stays BLOCKED — Nginx proxies
# to 127.0.0.1 directly, so the world never reaches Node itself.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status

echo ""
echo "======================================================================"
echo " Server bootstrap complete."
echo ""
echo " Next, run the app deploy (from the repo root on the VPS):"
echo "   bash deployment/deploy.sh"
echo ""
echo " Then point DNS to this server and issue HTTPS:"
echo "   DOMAIN=your-domain.com bash deployment/setup-https.sh"
echo "======================================================================"
