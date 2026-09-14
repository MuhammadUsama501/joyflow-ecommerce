#!/usr/bin/env bash
# ============================================================================
# JoyFlow — issue/renew Let's Encrypt (Certbot) for the site
#
# Prereqs:
#   - DNS A record(s) already point at this server (see DEPLOYMENT.md §J)
#   - Nginx site deployment/nginx.conf is installed and serving the domain
#
# Usage:  sudo DOMAIN=your-domain.com bash deployment/setup-https.sh
# ============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-your-domain.com}"
EMAIL="${CERTBOT_EMAIL:-}"          # optional but recommended

if [ -z "$EMAIL" ]; then
  echo "==> No CERTBOT_EMAIL set — using --register-unsafely-without-email"
fi

sudo certbot --nginx \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  ${EMAIL:+--email "${EMAIL}"} \
  --agree-tos \
  ${EMAIL:+--no-eff-email} \
  --redirect

echo "==> Verify auto-renewal works"
sudo certbot renew --dry-run

echo "==> Reload Nginx to pick up the HTTPS server block"
sudo systemctl reload nginx

echo ""
echo "Done. Test:"
echo "  curl https://${DOMAIN}/api/health"
