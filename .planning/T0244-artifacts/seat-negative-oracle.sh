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
# v2 (nach Refute-Lens 2026-06-21): KRITISCHER FIX gegen false-PASS —
#   „Connection refused" (RST) bedeutet, das Paket hat den Host ERREICHT (Port
#   nur zu) → die Isolation hat NICHT gegriffen. v1 wertete refused==blockiert
#   (false PASS). v2 unterscheidet:
#     CONNECTED / REFUSED  → Host erreicht → bei NEG = VERLETZUNG
#     TIMEOUT / NOROUTE    → geblockt      → bei NEG = OK
#   Plus UDP-Egress- + externe-ICMP-Proben (waren blinde Flecken).
#
# ORACLE (R31, Erfolgskriterium VOR dem Lauf als Zahl fixiert):
#   PASS  ⟺  (a) JEDE Negativ-Probe ist geblockt (TIMEOUT|NOROUTE|UNREACH)
#        AND (b) JEDE Positiv-Probe (nur die 2 Broker-Ports) ist CONNECTED.
#   Irgendeine NEG erreicht den Host (CONNECTED|REFUSED) ODER eine POS scheitert → NO-GO.
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM (`ip netns exec <seat>`). Der
#   Verifier (root) ist NICHT der Seat; er prüft, was ein auf die Seat-ns
#   beschränkter Prozess erreichen kann. Build-/Boot-Self-Test gated den Spawner.
#   KEIN Live-Touch beim Schreiben — Lauf erst nach Christin/Hub-Go in der VM.
# =============================================================================
set -uo pipefail

# ---- Konfiguration (SSOT-Werte aus Artefakt 01 §1) --------------------------
LLM_IP=10.99.0.1;    LLM_PORT=8443
MERKEL_IP=10.99.0.2; MERKEL_PORT=8500
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
TIMEOUT=3            # niedrig halten: 5 Seats * ~16 Proben darf den selftest nicht hängen
STRICT=0; SEATS=()

# Negativ-Ziele { Beschreibung | typ(tcp|tcp6|udp|ping|ping6|dns) | Adresse | Port }
#   MÜSSEN ALLE geblockt sein (TIMEOUT|NOROUTE|UNREACH), aus jeder Seat-ns.
NEG_TARGETS=(
  "Anthropic-direkt          |tcp |api.anthropic.com|443"
  "Anthropic-IP(1.1.1.1)     |tcp |1.1.1.1|443"
  "Merkel-direkt(.81)        |tcp |192.168.20.81|8000"
  "Hub-Mac(:7890)            |tcp |192.168.20.HUBHOST|7890"
  "Broker-Mac(:7899)         |tcp |192.168.20.HUBHOST|7899"
  "Fleet-LAN-Host(.20.171)   |tcp |192.168.20.171|443"
  "LAN-Gateway(.20.1)        |ping|192.168.20.1|-"
  "VLAN50-GW/UDM(.50.1)      |ping|192.168.50.1|-"
  "Eigene-VM-eth0(.50.2)     |ping|192.168.50.2|-"
  "Extern-ICMP(1.1.1.1)      |ping|1.1.1.1|-"
  "DNS-UDP-extern(:53)       |udp |1.1.1.1|53"
  "NTP-UDP-extern(:123)      |udp |192.168.20.1|123"
  "DNS-Resolver-Name         |dns |api.anthropic.com|53"
  "Broker-falscher-Port(SSH) |tcp |10.99.0.1|22"
  "Merkel-Broker-falsch(:80) |tcp |10.99.0.2|80"
  "IPv6-Egress(Anthropic-v6) |tcp6|2606:4700:4700::1111|443"
)
# Positiv-Ziele: NUR diese dürfen CONNECTED sein.
POS_TARGETS=(
  "LLM-Broker    |tcp|$LLM_IP|$LLM_PORT"
  "Merkel-Broker |tcp|$MERKEL_IP|$MERKEL_PORT"
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

# classify <ns> <typ> <addr> <port>  →  echo: CONNECTED|REFUSED|TIMEOUT|NOROUTE|UNREACH|OTHER
#   CONNECTED/REFUSED = Host wurde ERREICHT (Paket kam durch) → NEG-Verletzung
#   TIMEOUT/NOROUTE/UNREACH = geblockt → NEG ok
classify(){
  local ns="$1" typ="$2" addr="$3" port="$4" out rc
  case "$typ" in
    tcp|tcp6)
      out=$(ip netns exec "$ns" timeout "$TIMEOUT" bash -c "exec 3<>/dev/tcp/$addr/$port" 2>&1); rc=$?
      if   [ $rc -eq 0 ];   then echo CONNECTED
      elif [ $rc -eq 124 ]; then echo TIMEOUT
      elif grep -qi 'refused'                    <<<"$out"; then echo REFUSED
      elif grep -qiE 'no route|unreachable|network is' <<<"$out"; then echo NOROUTE
      else echo OTHER; fi ;;
    udp)
      # UDP: in der routenlosen Seat-ns schlägt der send() mit ENETUNREACH fehl.
      # (Begrenzung: bei vorhandener Route + nft-drop kann send() lokal „gelingen";
      #  Seats haben aber KEINE Route → no-route ist die dominante Kontrolle. Ehrlich kennzeichnen.)
      out=$(ip netns exec "$ns" timeout "$TIMEOUT" bash -c "echo -n x >/dev/udp/$addr/$port" 2>&1); rc=$?
      if   [ $rc -eq 124 ]; then echo TIMEOUT
      elif grep -qiE 'no route|unreachable|network is' <<<"$out"; then echo UNREACH
      elif [ $rc -eq 0 ];   then echo CONNECTED   # send() gelang = Route existierte → verdächtig
      else echo OTHER; fi ;;
    ping|ping6)
      local f=-4; [ "$typ" = ping6 ] && f=-6
      if ip netns exec "$ns" ping $f -c1 -W"$TIMEOUT" "$addr" &>/dev/null; then echo CONNECTED
      else echo NOROUTE; fi ;;   # ping-Fehler in routenloser ns = geblockt
    dns)
      if ip netns exec "$ns" timeout "$TIMEOUT" getent hosts "$addr" &>/dev/null; then echo CONNECTED
      else echo NOROUTE; fi ;;
    *) echo OTHER ;;
  esac
}
reached(){ case "$1" in CONNECTED|REFUSED) return 0;; *) return 1;; esac; }  # Host erreicht?

echo "=== T-0244 seat-negative-oracle v2  (Seats: ${SEATS[*]}, timeout ${TIMEOUT}s) ==="
for ns in "${SEATS[@]}"; do
  if ! ip netns list | grep -qw "$ns"; then
    echo "  [$(red FAIL)] netns '$ns' existiert nicht"; FAILS=$((FAILS+1)); continue
  fi
  echo "--- Seat-ns: $ns ---"
  # 0. Topologie-Invarianten
  CHECKS=$((CHECKS+1))
  if ip netns exec "$ns" ip route show default 2>/dev/null | grep -q .; then
    echo "  [$(red FAIL)] $ns hat DEFAULT-ROUTE (darf KEINE haben)"; FAILS=$((FAILS+1))
  else echo "  [$(grn OK)]   keine default-route"; fi
  CHECKS=$((CHECKS+1))
  if [ "$(ip netns exec "$ns" sysctl -n net.ipv6.conf.all.disable_ipv6 2>/dev/null)" = "1" ]; then
    echo "  [$(grn OK)]   IPv6 disabled"
  else echo "  [$(red FAIL)] $ns IPv6 NICHT disabled (H2)"; FAILS=$((FAILS+1)); fi

  # 1. NEGATIV — Host darf NICHT erreicht werden (CONNECTED/REFUSED = Verletzung)
  for t in "${NEG_TARGETS[@]}"; do
    IFS='|' read -r desc typ addr port <<<"$t"
    desc="${desc// /}"; typ="${typ// /}"
    CHECKS=$((CHECKS+1))
    verdict=$(classify "$ns" "$typ" "$addr" "$port")
    if reached "$verdict"; then
      echo "  [$(red FAIL)] NEG ERREICHT ($verdict, SOLL geblockt): $desc → $addr:$port"; FAILS=$((FAILS+1))
    else
      echo "  [$(grn OK)]   NEG geblockt ($verdict): $desc"
    fi
  done

  # 2. POSITIV — nur die 2 Broker-Ports dürfen CONNECTED sein
  for t in "${POS_TARGETS[@]}"; do
    IFS='|' read -r desc typ addr port <<<"$t"
    desc="${desc// /}"; typ="${typ// /}"
    CHECKS=$((CHECKS+1))
    verdict=$(classify "$ns" "$typ" "$addr" "$port")
    if [ "$verdict" = CONNECTED ]; then
      echo "  [$(grn OK)]   POS CONNECTED (SOLL): $desc → $addr:$port"
    else
      echo "  [$(red FAIL)] POS NICHT verbunden ($verdict — Broker down/Regel falsch?): $desc"; FAILS=$((FAILS+1))
    fi
  done
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS Checks bestanden, $FAILS Verletzung(en) ==="
if [ "$FAILS" -ne 0 ]; then
  echo ">>> NO-GO: Seat-Isolation NICHT bewiesen. Egress-Bau bleibt geblockt."
  exit 1
fi
echo ">>> PASS: Seat erreicht AUSSCHLIESSLICH die beiden Broker. Invariante bewiesen."
echo ">>> HINWEIS: Dieses Oracle schließt B1 (Seat-Netz-Isolation), NICHT das Egress-GESAMT-"
echo ">>>          Risiko. Der Broker-Pivot (covert Exfil via erlaubtem Anthropic-Kanal) ist"
echo ">>>          NICHT hier getestet → Schnüffis positive-Allowlist-Oracle = Co-Gate."
exit 0
