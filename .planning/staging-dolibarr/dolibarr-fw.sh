#!/usr/bin/env bash
# T-0183 — LXC-156-interne Firewall (fail-closed) für Dolibarr. v2 nach R22-Refute.
# Dolibarr/Caddy sind Docker-PUBLISHED Ports → Pakete laufen durch FORWARD (nach
# DNAT), NICHT INPUT → Source-Filterung in DOCKER-USER (Docker flusht die Chain
# nie). SSH (nativer Dienst) in INPUT. Verwaltung aussperr-sicher via pct exec.
# CONSTRAINT: Host-Port == Container-Port im Compose lassen (Match ist post-DNAT)!
# Boot-Reihenfolge: Unit MUSS Before=docker.service laufen (sonst fail-open-Fenster).
set -euo pipefail

LAN="192.168.20.0/24"        # Homelab-LAN
WG="192.168.16.0/24"         # WireGuard-Server-Subnet (wgsrv2/UDM)
AG_IP="212.211.160.228/32"   # Arbeitgeber-Egress (extern via Edge-Forward 7443→443)
WAN_IF="eth0"

# --- IPv6 hart aus (Refute-HIGH: sshd lauscht dual-stack, v6 wäre ungefiltert) ---
sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1 || true
cat > /etc/sysctl.d/99-disable-ipv6.conf <<'EOF'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
EOF
# Belt-and-suspenders falls sysctl im LXC nicht greift: v6-Input/Forward dicht
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -P INPUT ACCEPT 2>/dev/null || true
  ip6tables -F INPUT 2>/dev/null || true
  ip6tables -A INPUT -i lo -j ACCEPT 2>/dev/null || true
  ip6tables -A INPUT -p ipv6-icmp -j ACCEPT 2>/dev/null || true
  ip6tables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
  ip6tables -P INPUT DROP 2>/dev/null || true
  ip6tables -P FORWARD DROP 2>/dev/null || true
fi

# --- DOCKER-USER: Source-Allowlist für published Container-Ports (80/443) ---
iptables -N DOCKER-USER 2>/dev/null || true
iptables -F DOCKER-USER
iptables -A DOCKER-USER -i "$WAN_IF" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
# LAN + WG: HTTP (bis HTTPS live; Christin-Login läuft über :80) + HTTPS
iptables -A DOCKER-USER -i "$WAN_IF" -s "$LAN" -p tcp -m multiport --dports 80,443 -j RETURN
iptables -A DOCKER-USER -i "$WAN_IF" -s "$WG"  -p tcp -m multiport --dports 80,443 -j RETURN
# Arbeitgeber-IP: NUR 443 (Edge-DNAT 7443→443 erhält die Source-IP)
iptables -A DOCKER-USER -i "$WAN_IF" -s "$AG_IP" -p tcp --dport 443 -j RETURN
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
# Container→Host: NUR Antworten (Refute-MED: kein Blanket-ACCEPT für den
# internet-exponiertesten Prozess; Docker-DNS läuft im Container-Netns)
iptables -A INPUT -i docker0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A INPUT -i br-+   -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
# SSH nur aus LAN + WG
iptables -A INPUT -s "$LAN" -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -s "$WG"  -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -m limit --limit 6/min --limit-burst 10 -j LOG --log-prefix "FW-DROP-INPUT: "
iptables -P INPUT DROP

echo "[fw] applied: DOCKER-USER allowlist (LAN/WG:80+443, AG:443) + INPUT drop (SSH LAN/WG) + v6 off"
