#!/usr/bin/env bash
# ============================================================================
# JoyFlow — build locally, ship to the VPS over rsync/SSH, restart services
#
# The VPS does not need a git clone; this script pushes the built frontend
# (client/dist) and the server source, then restarts PM2 + reloads Nginx.
#
# Config is read from deployment/.env.deploy (not committed — create it from
# deployment/.env.deploy.example). Example:
#
#   SERVER_USER=root
#   SERVER_HOST=123.45.67.89
#   SERVER_PATH=/var/www/joyflow-ecommerce
#   APP_NAME=joyflow-api
#
# Usage:
#   bash deployment/deploy.sh
# ============================================================================
set -euo pipefail

# --- Load server coordinates (optional file) --------------------------------
deploy_env_file="${DEPLOY_ENV_FILE:-deployment/.env.deploy}"
if [ -f "$deploy_env_file" ]; then
  set -a
  . "$deploy_env_file"
  set +a
fi

SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-your-vps-ip}"
SERVER_PATH="${SERVER_PATH:-/var/www/joyflow-ecommerce}"
APP_NAME="${APP_NAME:-joyflow-api}"
SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

echo "==> Building the React frontend (Vite)"
npm ci
npm run build

echo "==> Staging the server bundle"
rm -rf .deploy_tmp
mkdir -p .deploy_tmp
cp -r server .deploy_tmp/server-bundle
cp ecosystem.config.cjs .deploy_tmp/
# Do not carry dev junk, test fixtures, node_modules or the runtime data store.
rm -rf \
  .deploy_tmp/server-bundle/node_modules \
  .deploy_tmp/server-bundle/data \
  .deploy_tmp/server-bundle/.env \
  .deploy_tmp/server-bundle/test \
  .deploy_tmp/server-bundle/playwright* \
  .deploy_tmp/server-bundle/package-lock.json

echo "==> Ensuring remote directories exist"
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" \
  "mkdir -p '${SERVER_PATH}/server-bundle' '${SERVER_PATH}/client'"

echo "==> Uploading (rsync) frontend to ${SERVER_PATH}/client/dist"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude '*.map' \
  ./dist/ "${SSH_TARGET}:${SERVER_PATH}/client/dist/"

echo "==> Uploading backend to ${SERVER_PATH}/server-bundle"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.deploy_tmp' \
  .deploy_tmp/ "${SSH_TARGET}:${SERVER_PATH}/"

echo "==> Installing backend dependencies on the VPS"
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" \
  "cd '${SERVER_PATH}/server-bundle' && npm ci --omit=dev"

echo "==> (Re)starting ${APP_NAME} with PM2"
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" \
  "cd '${SERVER_PATH}/server-bundle' && (pm2 describe '${APP_NAME}' >/dev/null 2>&1 && pm2 restart '${APP_NAME}' --update-env || pm2 start ecosystem.config.cjs) && pm2 save"

echo "==> Reloading Nginx (config already provisioned by setup-server.sh)"
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" \
  "sudo nginx -t && sudo systemctl reload nginx"

rm -rf .deploy_tmp
echo "==> Done."
echo "    Check:  ssh ${SSH_TARGET} 'pm2 status; curl -s http://127.0.0.1:5000/api/health'"
