#!/usr/bin/env bash
# T-0244 zone-netns-setup.sh — baut Broker-Bridge + pro-Seat-netns. Fail-closed.
set -euo pipefail
BR=br-zone
SEATS=(seat0:10:s0 seat1:11:s1 seat2:12:s2 seat3:13:s3 seatI:20:si)

# --- 0. Härtung des Forwardings (B1/H1 VM-intern) -------------------------
sysctl -w net.ipv4.ip_forward=0
sysctl -w net.ipv6.conf.all.forwarding=0
sysctl -w net.ipv4.conf.all.rp_filter=1

# --- 0b. /run/netns als SHARED mount sichern (Refute HIGH-2) --------------
# named-netns + systemd NetworkNamespacePath braucht /run/netns als shared mount,
# sonst propagiert der ns-Pfad nicht in die private Mount-ns der Seat-Unit
# (systemd PrivateMounts) → Seat-Unit failed silent. Vor JEDEM ip-netns-add.
mkdir -p /run/netns
mountpoint -q /run/netns || mount --bind /run/netns /run/netns
mount --make-shared /run/netns

# --- 1. Broker-Bridge (root-ns) ------------------------------------------
ip link show "$BR" &>/dev/null || ip link add "$BR" type bridge
ip link set "$BR" up
# Broker-Bridge: KEINE Default-Route. Bridge-eigene Verwaltungsadresse:
ip addr replace 10.99.0.254/24 dev "$BR"
# Broker-Listen-IPs als SEKUNDÄR-Adressen AUF der Bridge (Refute HIGH-1):
# ohne diese binden die Broker auf 10.99.0.1/.2 mit EADDRNOTAVAIL und Seats
# bekommen keine local-delivery. local delivery ignoriert das isolated-Flag
# (Refute VERIFIED gg. Kernel 7d850ab) → Seats erreichen die Bridge-IPs, aber
# NICHT einander.
ip addr replace 10.99.0.1/24 dev "$BR"
ip addr replace 10.99.0.2/24 dev "$BR"
# L2-Isolation zwischen Seat-Ports (Stern, kein Seat<->Seat):
ip link set "$BR" type bridge ageing_time 0
echo 1 > /sys/class/net/$BR/bridge/no_linklocal_learn 2>/dev/null || true

# --- 2. Pro-Seat-netns + veth-Paar ---------------------------------------
for entry in "${SEATS[@]}"; do
  NS="${entry%%:*}"; rest="${entry#*:}"; OCT="${rest%%:*}"; VETH="${rest##*:}"
  # Idempotent (Lens-2 Befund 2: '||true' verdeckte Dup-/Move-Fehler beim 2. Lauf).
  # Reconcile: netns nur anlegen wenn fehlt; veth je Lauf NEU (billig; Löschen einer
  # veth-Seite entfernt beide Enden), Adressen mit 'replace' statt 'add'.
  ip netns list | grep -qw "$NS" || ip netns add "$NS"
  # Stale-Reste VOLLSTÄNDIG räumen (Lens-2-confirm #2: veth, evtl. zurückgebliebenes
  # p-veth in root-ns aus einem vor dem netns-move abgebrochenen Lauf, alte eth0):
  ip link del "v-$VETH" 2>/dev/null || true          # entfernt beide veth-Enden
  ip link del "p-$VETH" 2>/dev/null || true          # falls p-veth noch in root-ns hängt
  ip -n "$NS" link del "p-$VETH" 2>/dev/null || true # Round-3 M2: stale p-veth IN der ns (crash vor rename)
  ip -n "$NS" link del eth0 2>/dev/null || true
  ip -n "$NS" addr flush dev eth0 2>/dev/null || true
  ip link add "v-$VETH" type veth peer name "p-$VETH"
  ip link set "v-$VETH" master "$BR"
  ip link set "v-$VETH" type bridge_slave isolated on   # Seat<->Seat L2 blockiert
  ip link set "v-$VETH" up
  ip link set "p-$VETH" netns "$NS"
  ip -n "$NS" link set lo up
  ip -n "$NS" link set "p-$VETH" name eth0
  ip -n "$NS" addr replace "10.99.0.$OCT/24" dev eth0   # replace = idempotent
  ip -n "$NS" link set eth0 up
  ip -n "$NS" route flush default 2>/dev/null || true   # defensiv: GARANTIERT keine default-route (Lens-2-confirm #2)
  # KEIN default route in der Seat-ns. Nur on-link 10.99.0.0/24 (automatisch).
  # IPv6 in der Seat-ns komplett aus (H2):
  ip netns exec "$NS" sysctl -qw net.ipv6.conf.all.disable_ipv6=1
  ip netns exec "$NS" sysctl -qw net.ipv6.conf.default.disable_ipv6=1
  ip netns exec "$NS" sysctl -qw net.ipv4.ip_forward=0
done
echo "[zone-netns-setup] OK"
# Re-Run-Test (Build-Verify): Skript 2× nacheinander → 2. Lauf exit 0, Topologie
# identisch (kein Dup, kein set-e-Abbruch). Teil des Boot-Self-Tests.
