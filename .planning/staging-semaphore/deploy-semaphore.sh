#!/usr/bin/env bash
# T-0116 Semaphore deploy — runs INSIDE LXC 157. Arg: LAN_IP (bind target, fail-closed).
# v2 nach R22-Refute: UID-1001-Ownership der Mounts (HIGH-1), harter Tag-Pin ohne
# latest-Fallback (HIGH-2, v2.19 entfernt bolt → wir fahren sqlite), /etc/semaphore
# persistiert (MED-2, sonst first-run bei jedem Recreate + ACCESS_KEY-Verlustpfad),
# harte Verifikation mit Exit≠0 (MED-1, kein stiller Teilerfolg).
set -euo pipefail
LAN_IP="${1:?usage: deploy-semaphore.sh <LAN_IP>}"
APP=/opt/semaphore; mkdir -p "$APP"; cd "$APP"
# Image läuft als UID 1001 (GID 0) und kann Bind-Mounts nicht selbst chownen:
install -d -o 1001 -g 0 -m 770 "$APP/data" "$APP/config"
SECRETS="$APP/.env"
# --- generate secrets ONCE (idempotent) ---
if [ ! -f "$SECRETS" ]; then
  umask 077
  ADMIN_PW=$(openssl rand -hex 18)
  KEY_ENC=$(openssl rand -base64 32)
  cat > "$SECRETS" <<EOF
SEMAPHORE_ADMIN_PASSWORD=$ADMIN_PW
SEMAPHORE_ACCESS_KEY_ENCRYPTION=$KEY_ENC
EOF
  chmod 600 "$SECRETS"
  echo "[secrets] generated $SECRETS (600) — ACCESS_KEY_ENCRYPTION ist DR-kritisch (Key Store), MUSS ins NetBoard"
fi
# --- image: HART gepinnt, KEIN latest-Fallback (R22 HIGH-2) ---
IMG="semaphoreui/semaphore:v2.18.12"
docker manifest inspect "$IMG" >/dev/null 2>&1 || { echo "FATAL: pinned tag $IMG nicht auffindbar — NICHT auf :latest ausweichen, Tag prüfen"; exit 1; }
echo "[img] using $IMG"
# --- compose: Semaphore + SQLite (bolt-Nachfolge, übersteht v2.19), bound ONLY to LAN_IP ---
cat > "$APP/docker-compose.yml" <<EOF
services:
  semaphore:
    image: ${IMG}
    restart: unless-stopped
    environment:
      SEMAPHORE_DB_DIALECT: sqlite
      SEMAPHORE_ADMIN: admin
      SEMAPHORE_ADMIN_NAME: 'Fleet Admin'
      SEMAPHORE_ADMIN_EMAIL: 'admin@fleet.local'
      SEMAPHORE_ADMIN_PASSWORD: \${SEMAPHORE_ADMIN_PASSWORD}
      SEMAPHORE_ACCESS_KEY_ENCRYPTION: \${SEMAPHORE_ACCESS_KEY_ENCRYPTION}
    ports:
      - "${LAN_IP}:3000:3000"   # FAIL-CLOSED: bind ONLY to LAN IP, never 0.0.0.0
    volumes:
      - "./data:/var/lib/semaphore"
      - "./config:/etc/semaphore"   # persistiert config.json → kein re-setup bei Recreate
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/ping"]
      interval: 30s
      timeout: 5s
      retries: 3
EOF
echo "[compose] written (semaphore bound to ${LAN_IP}:3000 only)"
docker compose pull -q
docker compose up -d
echo "[up] container starting; waiting for Semaphore HTTP on ${LAN_IP}:3000 ..."
ok=0
for i in $(seq 1 36); do
  body=$(curl -s --max-time 4 "http://${LAN_IP}:3000/api/ping" 2>/dev/null || true)
  [ "$body" = "pong" ] && { ok=1; break; }
  sleep 5
done
if [ "$ok" != "1" ]; then
  echo "FATAL: /api/ping liefert kein 'pong' — Container-Logs:"
  docker compose logs --tail 50
  exit 1
fi
echo "[verify] /api/ping → pong"
# --- listen check: HART (0.0.0.0 = Abbruch) ---
if ss -ltn | grep -q '0\.0\.0\.0:3000'; then
  echo "FATAL: Port 3000 lauscht auf 0.0.0.0 — fail-closed verletzt"; exit 1
fi
ss -ltn | grep -q "${LAN_IP}:3000" || { echo "FATAL: Port 3000 lauscht NICHT auf ${LAN_IP}"; exit 1; }
echo "[verify] listen nur auf ${LAN_IP}:3000"
echo "=== admin login = admin (pw in ${SECRETS}, NOT logged) ==="
