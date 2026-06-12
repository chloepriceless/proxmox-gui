#!/usr/bin/env bash
# T-0116 — installiert die LXC-157-Firewall (MUSS VOR dem ersten `docker compose up`
# laufen — R22 LOW-2: sonst kurzes Fenster mit ungefiltertem Port 3000).
# Erwartet semaphore-fw.sh + semaphore-fw.service im selben Verzeichnis.
set -euo pipefail
cd "$(dirname "$0")"
install -o root -g root -m 750 semaphore-fw.sh /usr/local/sbin/semaphore-fw.sh
install -o root -g root -m 644 semaphore-fw.service /etc/systemd/system/semaphore-fw.service
# R22 MED-3: Requires= (nicht nur Wants=) — fw-Fehlschlag ⇒ Docker startet NICHT (fail-closed)
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/10-require-fw.conf <<'EOF'
[Unit]
Requires=semaphore-fw.service
After=semaphore-fw.service
EOF
systemctl daemon-reload
systemctl enable --now semaphore-fw.service
systemctl is-active semaphore-fw.service >/dev/null || { echo "FATAL: fw unit nicht aktiv"; exit 1; }
iptables -S DOCKER-USER | grep -q -- "--dport 3000" || { echo "FATAL: DOCKER-USER-Allowlist fehlt"; exit 1; }
echo "[fw-install] ok: unit enabled+active, DOCKER-USER-Regeln stehen, Docker Requires fw"
