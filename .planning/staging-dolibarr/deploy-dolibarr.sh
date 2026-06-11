#!/usr/bin/env bash
# T-0183 Dolibarr 22 deploy — runs INSIDE LXC 156. Arg: LAN_IP (bind target, fail-closed).
set -euo pipefail
LAN_IP="${1:?usage: deploy-dolibarr.sh <LAN_IP>}"
APP=/opt/dolibarr; mkdir -p "$APP"; cd "$APP"
SECRETS="$APP/.env"
# --- generate secrets ONCE (idempotent) ---
if [ ! -f "$SECRETS" ]; then
  umask 077
  DB_ROOT=$(openssl rand -hex 24); DB_PW=$(openssl rand -hex 24); ADMIN_PW=$(openssl rand -hex 18)
  cat > "$SECRETS" <<EOF
MARIADB_ROOT_PASSWORD=$DB_ROOT
DOLI_DB_PASSWORD=$DB_PW
DOLI_ADMIN_PASSWORD=$ADMIN_PW
EOF
  chmod 600 "$SECRETS"
  echo "[secrets] generated $SECRETS (600)"
fi
. "$SECRETS"
# --- resolve Dolibarr 22 image tag (official, prefer 22, fallback) ---
IMG="dolibarr/dolibarr:22"
docker manifest inspect "$IMG" >/dev/null 2>&1 || { echo "[img] :22 tag not found, trying :latest"; IMG="dolibarr/dolibarr:latest"; }
echo "[img] using $IMG"
# --- compose: MariaDB + Dolibarr, Dolibarr HTTP bound ONLY to LAN_IP (no 0.0.0.0/public) ---
cat > "$APP/docker-compose.yml" <<EOF
services:
  mariadb:
    image: mariadb:11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: \${MARIADB_ROOT_PASSWORD}
      MARIADB_DATABASE: dolibarr
      MARIADB_USER: dolibarr
      MARIADB_PASSWORD: \${DOLI_DB_PASSWORD}
    volumes: [ "mariadb_data:/var/lib/mysql" ]
    networks: [ internal ]
  dolibarr:
    image: ${IMG}
    restart: unless-stopped
    depends_on: [ mariadb ]
    environment:
      DOLI_DB_TYPE: mysqli
      DOLI_DB_HOST: mariadb
      DOLI_DB_NAME: dolibarr
      DOLI_DB_USER: dolibarr
      DOLI_DB_PASSWORD: \${DOLI_DB_PASSWORD}
      DOLI_ADMIN_LOGIN: superadmin
      DOLI_ADMIN_PASSWORD: \${DOLI_ADMIN_PASSWORD}
      DOLI_URL_ROOT: 'http://${LAN_IP}'
      DOLI_PROD: '1'
    ports:
      - "${LAN_IP}:80:80"   # FAIL-CLOSED: bind ONLY to LAN IP, never 0.0.0.0
    volumes:
      - "dolibarr_html:/var/www/html/custom"
      - "dolibarr_docs:/var/www/documents"
    networks: [ internal ]
volumes:
  mariadb_data: {}
  dolibarr_html: {}
  dolibarr_docs: {}
networks:
  internal: {}
EOF
echo "[compose] written (dolibarr bound to ${LAN_IP}:80 only)"
docker compose pull -q
docker compose up -d
echo "[up] containers starting; waiting for Dolibarr HTTP on ${LAN_IP}:80 ..."
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "http://${LAN_IP}/" 2>/dev/null || echo 000)
  [ "$code" != "000" ] && { echo "[verify] Dolibarr HTTP ${code} on ${LAN_IP}:80"; break; }
  sleep 5
done
echo "=== listen check (MUST show ${LAN_IP}:80, NOT 0.0.0.0:80) ==="
ss -ltnp | grep ':80 ' || true
echo "=== admin login = superadmin (pw in ${SECRETS}, NOT logged) ==="
