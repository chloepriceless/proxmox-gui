#!/usr/bin/env bash
# T-0116 — LXC-157-interne Firewall (fail-closed) für Semaphore.
# Adaption des R22-refuteten dolibarr-fw.sh v2 (LXC 156, Reboot-Probe PASS):
# Semaphore ist Docker-PUBLISHED Port → Pakete laufen durch FORWARD (nach DNAT),
# NICHT INPUT → Source-Filterung in DOCKER-USER (Docker flusht die Chain nie).
# SSH (nativer Dienst) in INPUT. Verwaltung aussperr-sicher via pct exec.
# CONSTRAINT: Host-Port == Container-Port im Compose lassen (Match ist post-DNAT)!
# Boot-Reihenfolge: Unit MUSS Before=docker.service laufen (sonst fail-open-Fenster).
set -euo pipefail

LAN="192.168.20.0/24"        # Homelab-LAN
WG="192.168.16.0/24"         # WireGuard-Server-Subnet (wgsrv2/UDM)
APP_PORT="3000"              # Semaphore UI/API
WAN_IF="eth0"

# --- IPv6 hart aus (sshd lauscht dual-stack, v6 wäre ungefiltert) ---
sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1 || true
cat > /etc/sysctl.d/99-disable-ipv6.conf <<'EOF'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
EOF
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -P INPUT ACCEPT 2>/dev/null || true
  ip6tables -F INPUT 2>/dev/null || true
  ip6tables -A INPUT -i lo -j ACCEPT 2>/dev/null || true
  ip6tables -A INPUT -p ipv6-icmp -j ACCEPT 2>/dev/null || true
  ip6tables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
  ip6tables -P INPUT DROP 2>/dev/null || true
  ip6tables -P FORWARD DROP 2>/dev/null || true
fi

# --- DOCKER-USER: Source-Allowlist für published Container-Port (3000) ---
iptables -N DOCKER-USER 2>/dev/null || true
iptables -F DOCKER-USER
iptables -A DOCKER-USER -i "$WAN_IF" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
# LAN + WG: Semaphore UI/API
iptables -A DOCKER-USER -i "$WAN_IF" -s "$LAN" -p tcp --dport "$APP_PORT" -j RETURN
iptables -A DOCKER-USER -i "$WAN_IF" -s "$WG"  -p tcp --dport "$APP_PORT" -j RETURN
# fail-closed für alles andere von außen Richtung Container — mit Forensik-Log
iptables -A DOCKER-USER -i "$WAN_IF" -m limit --limit 6/min --limit-burst 10 \
  -j LOG --log-prefix "FW-DROP-DOCKER: "
iptables -A DOCKER-USER -i "$WAN_IF" -j DROP
# Nicht-eth0 (Container↔Container auf br-X): Docker-Default-Verarbeitung
iptables -A DOCKER-USER -j RETURN

# --- INPUT: native Dienste (SSH) — re-run-sicher (Policy erst ACCEPT, DROP zuletzt) ---
iptables -P INPUT ACCEPT
iptables -F INPUT
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A INPUT -p icmp -m limit --limit 10/sec -j ACCEPT
# Container→Host: NUR Antworten
iptables -A INPUT -i docker0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A INPUT -i br-+   -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
# SSH nur aus LAN + WG
iptables -A INPUT -s "$LAN" -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -s "$WG"  -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -m limit --limit 6/min --limit-burst 10 -j LOG --log-prefix "FW-DROP-INPUT: "
iptables -P INPUT DROP

echo "[fw] applied: DOCKER-USER allowlist (LAN/WG:${APP_PORT}) + INPUT drop (SSH LAN/WG) + v6 off"
