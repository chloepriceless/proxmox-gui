#!/usr/bin/env bash
# T-0183 Option A — vorgelagertes TOTP-Gate (tinyauth) + Caddy tls internal.
# Läuft INSIDE LXC 156. Voraussetzung: /opt/dolibarr (deploy-dolibarr.sh) läuft.
# Bündelt tls-internal + 2FA in EINEM Dolibarr-Recreate (eine Downtime).
# Usage: deploy-2fa.sh <LAN_IP>
set -euo pipefail
LAN_IP="${1:?usage: deploy-2fa.sh <LAN_IP>}"
APP=/opt/dolibarr; cd "$APP"
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$APP/.env" ] || { echo "FATAL: $APP/.env fehlt (erst deploy-dolibarr.sh)"; exit 1; }

# --- env-Namen des v5-Images verifizieren (nicht raten) ---
echo "[verify] tinyauth v5 erwartete env-Vars:"
docker run --rm ghcr.io/steveiliop56/tinyauth:v5 --help 2>&1 | grep -iE 'app.url|secret|users|port' || true
echo "→ Falls die Namen von APP_URL/SECRET/USERS_FILE abweichen: tinyauth.env + compose anpassen."

# --- SECRET (32 Zeichen Session-Key) einmalig erzeugen ---
if [ ! -f "$APP/tinyauth.env" ]; then
  umask 077
  SECRET=$(openssl rand -hex 16)   # 32 hex chars
  cat > "$APP/tinyauth.env" <<EOF
APP_URL=https://${LAN_IP}
SECRET=${SECRET}
USERS_FILE=/users
EOF
  chmod 600 "$APP/tinyauth.env"
  echo "[secret] tinyauth.env erzeugt (600)"
fi

# --- TOTP-User interaktiv anlegen → QR für Christin scannen ---
# Schreibt den username:hash:totpsecret-String nach ./tinyauth-users.
if [ ! -s "$APP/tinyauth-users" ]; then
  echo "=== JETZT QR-Code scannen (Christin, Authenticator-App) ==="
  docker run -i -t --rm ghcr.io/steveiliop56/tinyauth:v5 totp generate --interactive | tee /tmp/tinyauth-gen.txt
  USERLINE=$(grep -oE '^[a-zA-Z0-9._-]+:\$[^:]+:[A-Z2-7]+' /tmp/tinyauth-gen.txt | tail -1 || true)
  [ -n "$USERLINE" ] || { echo "FATAL: kein user:hash:totp-String erkannt — manuell aus /tmp/tinyauth-gen.txt nach $APP/tinyauth-users kopieren"; exit 1; }
  printf '%s\n' "$USERLINE" > "$APP/tinyauth-users"; chmod 600 "$APP/tinyauth-users"; rm -f /tmp/tinyauth-gen.txt
  echo "[user] tinyauth-users gesetzt (600)"
fi

# --- Caddyfile (2FA-Variante) + compose stagen ---
cp "$HERE/Caddyfile.2fa" "$APP/Caddyfile"
cp "$HERE/docker-compose.2fa.yml" "$APP/docker-compose.yml"
grep -q '^LAN_IP=' "$APP/.env" || echo "LAN_IP=$LAN_IP" >> "$APP/.env"
sed -i "s|^LAN_IP=.*|LAN_IP=$LAN_IP|" "$APP/.env"

# --- Recreate (die EINE Dolibarr-Downtime) ---
docker compose pull -q tinyauth caddy
docker compose up -d
echo "[up] warte auf Caddy :443 ..."
for i in $(seq 1 30); do curl -ksf -o /dev/null --max-time 3 "https://${LAN_IP}/" && break; sleep 3; done

echo "=== VERIFY ==="
echo "1) Listen (soll ${LAN_IP}:80+:443):"; ss -ltnp | grep -E ':80 |:443 ' || true
echo "2) :443 ohne Auth → muss zur tinyauth-Login-Seite umleiten (302/200 Login), NICHT direkt Dolibarr:"
curl -ks -o /dev/null -w '   HTTP %{http_code} → %{redirect_url}\n' "https://${LAN_IP}/" || true
echo "3) :80 intern → Dolibarr direkt (HTTP 200, keine 2FA):"
curl -s -o /dev/null -w '   HTTP %{http_code}\n' "http://${LAN_IP}/" || true
echo "NOTE: tinyauth-Login = Passwort + TOTP-Code. Christins User steckt in tinyauth-users."
