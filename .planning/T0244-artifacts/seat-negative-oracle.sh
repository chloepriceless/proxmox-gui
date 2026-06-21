#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02 — seat-negative-oracle.sh   (Verdikt-Blocker B1b)
# =============================================================================
# ZWECK: Beweist die KERN-INVARIANTE aus der SEAT-NETNS-PERSPEKTIVE, NEGATIV.
#   Der alte §3.5-Oracle maß auf VM-Ebene (.50.2) und testete POSITIV, dass
#   api.anthropic.com erreichbar ist — das ist die FALSCHE Ebene und das
#   FALSCHE Vorzeichen. Ein Seat darf Anthropic/.81/LAN genau NICHT direkt
#   erreichen, NUR die beiden Broker-veth-Adressen.
#
# ORACLE (R31, Erfolgskriterium VOR dem Lauf als Zahl fixiert):
#   PASS  ⟺  (a) JEDE Negativ-Probe schlägt fehl (kein Connect/no-route/timeout)
#        AND (b) JEDE Positiv-Probe (nur die 2 Broker-Ports) gelingt.
#   Irgendeine Negativ-Probe gelingt  ODER  eine Positiv-Probe scheitert  → NO-GO (exit!=0).
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM. Prüft die Seat-Sicht von außen
#   via `ip netns exec <seat>` — der Verifier (root) ist NICHT der Seat; er prüft,
#   was ein auf die Seat-ns beschränkter Prozess erreichen kann.
#   Build-/Boot-Self-Test (Artefakt 01 §6 gated den Spawner darauf).
#
# KEIN Live-Touch beim Schreiben — dies ist das Build-Artefakt. Lauf erst nach
#   Christin/Hub-Go in der gebauten VM.
# =============================================================================
set -uo pipefail

# ---- Konfiguration (SSOT-Werte aus Artefakt 01 §1) --------------------------
LLM_IP=10.99.0.1;    LLM_PORT=8443
MERKEL_IP=10.99.0.2; MERKEL_PORT=8500
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
TIMEOUT=5
STRICT=0; SEATS=()

# Negativ-Ziele: { Beschreibung | Probe-Typ | Adresse | Port }
#   Diese MÜSSEN ALLE fehlschlagen, aus jeder Seat-ns.
NEG_TARGETS=(
  "Anthropic-direkt           |tcp|api.anthropic.com|443"
  "Anthropic-IP-Rotation(1.1) |tcp|1.1.1.1|443"
  "Merkel-direkt(.81)         |tcp|192.168.20.81|8000"
  "Hub-Mac(:7890)             |tcp|192.168.20.<HUBHOST>|7890"
  "Broker-Mac(:7899)          |tcp|192.168.20.<HUBHOST>|7899"
  "LAN-Gateway(.20.1)         |ping|192.168.20.1|-"
  "VLAN50-GW/UDM(.50.1)       |ping|192.168.50.1|-"
  "Eigene-VM-eth0(.50.2)      |ping|192.168.50.2|-"
  "Fleet-LAN-Host(.20.171)    |tcp|192.168.20.171|443"
  "DNS-Resolver-direkt        |dns|api.anthropic.com|53"
  "Broker-falscher-Port(SSH)  |tcp|10.99.0.1|22"
  "Merkel-Broker-falsch(:80)  |tcp|10.99.0.2|80"
  "IPv6-Egress(Anthropic-v6)  |tcp6|2606:4700:4700::1111|443"
)
# Positiv-Ziele: NUR diese dürfen gelingen.
POS_TARGETS=(
  "LLM-Broker     |tcp|$LLM_IP|$LLM_PORT"
  "Merkel-Broker  |tcp|$MERKEL_IP|$MERKEL_PORT"
)

usage(){ echo "usage: $0 [--all-seats|--seat <ns>] [--strict]"; exit 2; }
while [ $# -gt 0 ]; do case "$1" in
  --all-seats) SEATS=("${SEATS_DEFAULT[@]}");;
  --seat) shift; SEATS+=("$1");;
  --strict) STRICT=1;;
  -h|--help) usage;;
  *) echo "unknown arg: $1"; usage;;
esac; shift; done
[ ${#SEATS[@]} -eq 0 ] && SEATS=("${SEATS_DEFAULT[@]}")

FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }

# Rückgabe 0 = Verbindung/Erreichbarkeit GELANG, 1 = scheiterte (gewünscht bei NEG)
probe(){ # <seat-ns> <type> <addr> <port>
  local ns="$1" typ="$2" addr="$3" port="$4"
  case "$typ" in
    tcp)  ip netns exec "$ns" timeout "$TIMEOUT" bash -c \
            "exec 3<>/dev/tcp/$addr/$port" 2>/dev/null && return 0 || return 1 ;;
    tcp6) ip netns exec "$ns" timeout "$TIMEOUT" bash -c \
            "exec 3<>/dev/tcp/$addr/$port" 2>/dev/null && return 0 || return 1 ;;
    ping) ip netns exec "$ns" ping -c1 -W"$TIMEOUT" "$addr" &>/dev/null && return 0 || return 1 ;;
    dns)  ip netns exec "$ns" timeout "$TIMEOUT" getent hosts "$addr" &>/dev/null && return 0 || return 1 ;;
    *) echo "bad probe type $typ"; return 0 ;;   # unbekannt = als „gelang" werten → NO-GO
  esac
}

echo "=== T-0244 seat-negative-oracle  (Seats: ${SEATS[*]}) ==="
for ns in "${SEATS[@]}"; do
  if ! ip netns list | grep -qw "$ns"; then
    echo "  [$(red FAIL)] netns '$ns' existiert nicht"; FAILS=$((FAILS+1)); continue
  fi
  echo "--- Seat-ns: $ns ---"
  # 0. Topologie-Invarianten (müssen so sein)
  CHECKS=$((CHECKS+1))
  if ip netns exec "$ns" ip route show default 2>/dev/null | grep -q .; then
    echo "  [$(red FAIL)] $ns hat eine DEFAULT-ROUTE (darf KEINE haben)"; FAILS=$((FAILS+1))
  else echo "  [$(grn OK)]   keine default-route"; fi
  CHECKS=$((CHECKS+1))
  if [ "$(ip netns exec "$ns" sysctl -n net.ipv6.conf.all.disable_ipv6 2>/dev/null)" = "1" ]; then
    echo "  [$(grn OK)]   IPv6 disabled"
  else echo "  [$(red FAIL)] $ns IPv6 NICHT disabled (H2)"; FAILS=$((FAILS+1)); fi

  # 1. NEGATIV — jede dieser Proben MUSS fehlschlagen
  for t in "${NEG_TARGETS[@]}"; do
    IFS='|' read -r desc typ addr port <<<"$t"
    CHECKS=$((CHECKS+1))
    if probe "$ns" "$typ" "$addr" "$port"; then
      echo "  [$(red FAIL)] NEG erreichbar (SOLL NICHT): ${desc// /} → $addr:$port"; FAILS=$((FAILS+1))
    else
      echo "  [$(grn OK)]   NEG geblockt: ${desc// /}"
    fi
  done

  # 2. POSITIV — nur die 2 Broker-Ports dürfen gelingen
  for t in "${POS_TARGETS[@]}"; do
    IFS='|' read -r desc typ addr port <<<"$t"
    CHECKS=$((CHECKS+1))
    if probe "$ns" "$typ" "$addr" "$port"; then
      echo "  [$(grn OK)]   POS erreichbar (SOLL): ${desc// /} → $addr:$port"
    else
      echo "  [$(red FAIL)] POS NICHT erreichbar (Broker down/Regel falsch?): ${desc// /}"; FAILS=$((FAILS+1))
    fi
  done
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS Checks bestanden, $FAILS Verletzung(en) ==="
if [ "$FAILS" -ne 0 ]; then
  echo ">>> NO-GO: Seat-Isolation NICHT bewiesen. Egress-Bau bleibt geblockt."
  exit 1
fi
echo ">>> PASS: Seat erreicht AUSSCHLIESSLICH die beiden Broker. Invariante bewiesen."
exit 0
