#!/usr/bin/env bash
# T-0183 TLS-Phase deploy — runs INSIDE LXC 156. Voraussetzungen:
#   - /opt/dolibarr läuft bereits (deploy-dolibarr.sh, .env mit DB/Admin-Secrets)
#   - dns01.env mit DNS01_TOKEN=… liegt unter /opt/dolibarr/dns01.env (600)
#     (Quelle: Netzi → /home/dev/.config/fleet-secrets/dolibarr-dns01.env auf dem Mac,
#      per scp auf die LXC kopieren — NICHT über Chat/Git)
#   - Dockerfile.caddy, Caddyfile, docker-compose.tls.yml liegen neben diesem Script
# Usage: deploy-tls.sh <LAN_IP> <DNS_PROVIDER>
set -euo pipefail
LAN_IP="${1:?usage: deploy-tls.sh <LAN_IP> <DNS_PROVIDER>}"
DNS_PROVIDER="${2:?usage: deploy-tls.sh <LAN_IP> <DNS_PROVIDER>}"
APP=/opt/dolibarr; cd "$APP"
HERE="$(cd "$(dirname "$0")" && pwd)"

# --- preflight ---
[ -f "$APP/.env" ] || { echo "FATAL: $APP/.env fehlt (erst deploy-dolibarr.sh)"; exit 1; }
[ -f "$APP/dns01.env" ] || { echo "FATAL: $APP/dns01.env fehlt (Netzi-Token, 600)"; exit 1; }
grep -q '^DNS01_TOKEN=.' "$APP/dns01.env" || { echo "FATAL: DNS01_TOKEN leer in dns01.env"; exit 1; }
chmod 600 "$APP/dns01.env"

# --- stage artifacts ---
for f in Dockerfile.caddy Caddyfile docker-compose.tls.yml; do
  [ -f "$HERE/$f" ] || { echo "FATAL: $HERE/$f fehlt"; exit 1; }
  cp "$HERE/$f" "$APP/$f"
done
mv "$APP/docker-compose.tls.yml" "$APP/docker-compose.yml"

# --- compose env (LAN_IP + DNS_PROVIDER zusätzlich zu den bestehenden Secrets) ---
grep -q '^LAN_IP=' "$APP/.env" || echo "LAN_IP=$LAN_IP" >> "$APP/.env"
sed -i "s|^LAN_IP=.*|LAN_IP=$LAN_IP|" "$APP/.env"
grep -q '^DNS_PROVIDER=' "$APP/.env" || echo "DNS_PROVIDER=$DNS_PROVIDER" >> "$APP/.env"
sed -i "s|^DNS_PROVIDER=.*|DNS_PROVIDER=$DNS_PROVIDER|" "$APP/.env"

# --- build custom caddy (xcaddy + caddy-dns plugin) + up ---
docker compose build caddy
docker compose up -d
echo "[up] waiting for Caddy on ${LAN_IP}:443 ..."
for i in $(seq 1 60); do
  if curl -ksf -o /dev/null --max-time 4 --resolve "dashboard.bikinibottom.capital:443:${LAN_IP}" \
       "https://dashboard.bikinibottom.capital/"; then
    echo "[verify] HTTPS antwortet auf ${LAN_IP}:443"; break
  fi
  sleep 5
done

echo "=== listen check (MUSS ${LAN_IP}:80/:443 zeigen, NICHT 0.0.0.0) ==="
ss -ltnp | grep -E ':80 |:443 ' || true
echo "=== cert check (Issuer muss Let's Encrypt sein, kein self-signed) ==="
echo | openssl s_client -connect "${LAN_IP}:443" -servername dashboard.bikinibottom.capital 2>/dev/null \
  | openssl x509 -noout -issuer -subject -enddate || true
echo "=== Dolibarr-Redirect-Check (kein Loop): HTTP-Code der Root-Seite ==="
curl -ks -o /dev/null -w '%{http_code}\n' --resolve "dashboard.bikinibottom.capital:443:${LAN_IP}" \
  "https://dashboard.bikinibottom.capital/"
echo "NOTE: ACME-Issue kann 1-3 min dauern (DNS-01-Propagation). Logs: docker compose logs -f caddy"
