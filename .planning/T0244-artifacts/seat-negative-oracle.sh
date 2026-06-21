#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02 — seat-negative-oracle.sh   (Verdikt-Blocker B1b)
# =============================================================================
# ZWECK: Beweist die KERN-INVARIANTE aus der SEAT-NETNS-PERSPEKTIVE, NEGATIV.
#   Der alte §3.5-Oracle maß auf VM-Ebene (.50.2) + testete POSITIV. Ein Seat
#   darf Anthropic/.81/LAN NICHT direkt erreichen, NUR die 2 Broker-veth-Adressen.
#
# v2 (Refute-Lens-1): „Connection refused"(RST) = Host ERREICHT → bei NEG Verletzung
#   (v1 wertete refused==blockiert = false PASS). + UDP/ICMP-Proben.
# v3 (Refute-Lens-2/Codex): WEITERE false-PASS-Klassen geschlossen —
#   (Befund 4) Platzhalter wie '192.168.20.HUBHOST' ist keine IP → /dev/tcp→OTHER
#     → wurde als „nicht erreicht"=OK gewertet. v3: Platzhalter = INVALID = FAIL.
#   (Befund 9) fehlendes ping/getent (Tool-/NSS-Fehler) wurde als „blockiert" gewertet.
#     v3: Tool-Fehler = TOOLERR = FAIL. Inconclusive ist NIE „blockiert" (fail-closed).
#   HUB_HOST muss real gesetzt sein, sonst FAIL (kein Gate-Pass mit Platzhalter).
#
# ORACLE (R31, Erfolgskriterium VOR dem Lauf als Zahl fixiert):
#   PASS  ⟺  (a) JEDE Negativ-Probe ist EINDEUTIG geblockt (TIMEOUT|NOROUTE|UNREACH)
#        AND (b) JEDE Positiv-Probe (nur die 2 Broker-Ports) ist CONNECTED.
#   NEG = CONNECTED|REFUSED (Host erreicht)  ODER  INVALID|TOOLERR|OTHER (inconclusiv)
#         → VERLETZUNG. POS != CONNECTED → VERLETZUNG.
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM (`ip netns exec <seat>`). Build-/
#   Boot-Self-Test gated den Spawner. KEIN Live-Touch beim Schreiben.
#   HINWEIS: Dieses Oracle beweist die SEAT-NETZ-ISOLATION (B1b). Den CAP-DROP des
#   echten Seat-Prozesses (B1c) beweist seat-hardening-oracle.sh (separat, Lens-2 #5).
# =============================================================================
set -uo pipefail

# ---- Konfiguration (SSOT-Werte aus Artefakt 01 §1) --------------------------
LLM_IP=10.99.0.1;    LLM_PORT=8443
MERKEL_IP=10.99.0.2; MERKEL_PORT=8500
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
TIMEOUT=3
STRICT=0; SEATS=()
# PFLICHT am Build setzen: echte LAN-IP des Mac-Hubs (Mac :7890/:7899). Unset/Platzhalter → FAIL.
HUB_HOST="${ZONE_HUB_HOST:-}"      # z.B. export ZONE_HUB_HOST=192.168.20.XX vor dem Lauf

# Negativ-Ziele { Beschreibung | typ(tcp|tcp6|udp|ping|ping6|dns) | Adresse | Port }
NEG_TARGETS=(
  # Round-3 H4: KEIN Hostname-TCP-Test — Seats haben kein DNS → /dev/tcp/<name>
  # scheitert an der Auflösung → OTHER → FAIL auf einem KORREKT isolierten System
  # (Oracle nie grün). Extern-TCP-Egress wird via IP geprüft; Name-Reachability
  # separat im dns-Test (der DARF einen Hostnamen nutzen):
  "Extern-TCP-443(1.1.1.1)   |tcp |1.1.1.1|443"
  "Extern-TCP-443(8.8.8.8)   |tcp |8.8.8.8|443"
  "Merkel-direkt(.81)        |tcp |192.168.20.81|8000"
  "Hub-Mac(:7890)            |tcp |__HUB__|7890"
  "Broker-Mac(:7899)         |tcp |__HUB__|7899"
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
POS_TARGETS=(
  "LLM-Broker    |tcp|$LLM_IP|$LLM_PORT"
  "Merkel-Broker |tcp|$MERKEL_IP|$MERKEL_PORT"
)

usage(){ echo "usage: ZONE_HUB_HOST=<mac-ip> $0 [--all-seats|--seat <ns>] [--strict]"; exit 2; }
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

# Tool-Verfügbarkeit EINMAL prüfen (Befund 9: fehlendes Tool != geblockt)
have_ping=1; have_getent=1
command -v ping   >/dev/null || have_ping=0
command -v getent >/dev/null || have_getent=0

# Adress-Validierung (Befund 4): Platzhalter (Großbuchstaben/Unterstrich-Marker) = INVALID
is_placeholder(){ [[ "$1" == *__* || ( "$1" =~ [A-Z] && ! "$1" =~ ^[0-9a-fA-F:.]+$ ) ]]; }

# classify <ns> <typ> <addr> <port> → CONNECTED|REFUSED|TIMEOUT|NOROUTE|UNREACH|INVALID|TOOLERR|OTHER
classify(){
  local ns="$1" typ="$2" addr="$3" port="$4" out rc
  # Hub-Platzhalter auflösen / sonst INVALID
  if [ "$addr" = "__HUB__" ]; then
    [ -n "$HUB_HOST" ] || { echo INVALID; return; }
    addr="$HUB_HOST"
  fi
  if is_placeholder "$addr"; then echo INVALID; return; fi
  case "$typ" in
    tcp|tcp6)
      out=$(ip netns exec "$ns" timeout "$TIMEOUT" bash -c "exec 3<>/dev/tcp/$addr/$port" 2>&1); rc=$?
      if   [ $rc -eq 0 ];   then echo CONNECTED
      elif [ $rc -eq 124 ]; then echo TIMEOUT
      elif grep -qi 'refused'                          <<<"$out"; then echo REFUSED
      elif grep -qiE 'no route|unreachable|network is' <<<"$out"; then echo NOROUTE
      else echo OTHER; fi ;;
    udp)
      out=$(ip netns exec "$ns" timeout "$TIMEOUT" bash -c "echo -n x >/dev/udp/$addr/$port" 2>&1); rc=$?
      if   [ $rc -eq 124 ]; then echo TIMEOUT
      elif grep -qiE 'no route|unreachable|network is' <<<"$out"; then echo UNREACH
      elif [ $rc -eq 0 ];   then echo CONNECTED        # send() gelang = Route existierte → verdächtig
      else echo OTHER; fi ;;
    ping|ping6)
      # Round-3 M3: ping-Exit 1 ≠ blockiert! ping: 0=reply(erreicht), 2=Netz/Host
      # unreachable=KEINE Route=blockiert, 1=gesendet aber keine Antwort=Route EXISTIERTE
      # (=Leak/verdächtig=inconclusiv=FAIL). Nur exit 2 ist eindeutig geblockt.
      [ $have_ping -eq 1 ] || { echo TOOLERR; return; }
      local f=-4; [ "$typ" = ping6 ] && f=-6
      ip netns exec "$ns" ping $f -c1 -W"$TIMEOUT" "$addr" &>/dev/null; rc=$?
      case $rc in 0) echo CONNECTED;; 2) echo NOROUTE;; *) echo OTHER;; esac ;;
    dns)
      # getent: 0=aufgelöst(erreicht!), 2=not-found(kein Resolver=blockiert), sonst=Fehler(inconclusiv).
      [ $have_getent -eq 1 ] || { echo TOOLERR; return; }
      ip netns exec "$ns" timeout "$TIMEOUT" getent hosts "$addr" &>/dev/null; rc=$?
      case $rc in 0) echo CONNECTED;; 2) echo NOROUTE;; *) echo OTHER;; esac ;;
    *) echo OTHER ;;
  esac
}
reached(){     case "$1" in CONNECTED|REFUSED) return 0;; *) return 1;; esac; }
# Round-4 M4 (layer-aware): route-LOSE Ziele (extern, nicht 10.99.0.0/24) MÜSSEN
# NOROUTE/UNREACH ergeben (Seat hat keine Route → ENETUNREACH). Ein TIMEOUT dort =
# verdächtig (Route existierte, Paket downstream gedroppt) = inconclusiv = FAIL.
# Nur on-link Broker-Subnetz (10.99.0.*, falscher Port) darf per nft-DROP TIMEOUT geben.
blocked_ok(){  # $1=verdict $2=addr
  case "$2" in
    10.99.0.*) case "$1" in TIMEOUT|NOROUTE|UNREACH) return 0;; *) return 1;; esac ;;
    *)         case "$1" in NOROUTE|UNREACH) return 0;; *) return 1;; esac ;;
  esac
}
# Alles andere (INVALID|TOOLERR|OTHER + TIMEOUT bei route-losem Ziel) = bei einem Gate FAIL.

echo "=== T-0244 seat-negative-oracle v3  (Seats: ${SEATS[*]}, timeout ${TIMEOUT}s, strict=$STRICT) ==="
[ -z "$HUB_HOST" ] && echo "  [$(red WARN)] ZONE_HUB_HOST nicht gesetzt → Hub-Proben werden INVALID=FAIL (Platzhalter im Gate verboten, Lens-2 Befund 4)"

for ns in "${SEATS[@]}"; do
  if ! ip netns list | grep -qw "$ns"; then
    echo "  [$(red FAIL)] netns '$ns' existiert nicht"; FAILS=$((FAILS+1)); continue
  fi
  echo "--- Seat-ns: $ns ---"
  CHECKS=$((CHECKS+1))
  if ip netns exec "$ns" ip route show default 2>/dev/null | grep -q .; then
    echo "  [$(red FAIL)] $ns hat DEFAULT-ROUTE (darf KEINE haben)"; FAILS=$((FAILS+1))
  else echo "  [$(grn OK)]   keine default-route"; fi
  CHECKS=$((CHECKS+1))
  if [ "$(ip netns exec "$ns" sysctl -n net.ipv6.conf.all.disable_ipv6 2>/dev/null)" = "1" ]; then
    echo "  [$(grn OK)]   IPv6 disabled"
  else echo "  [$(red FAIL)] $ns IPv6 NICHT disabled (H2)"; FAILS=$((FAILS+1)); fi

  # 1. NEGATIV — OK NUR bei EINDEUTIGEM Block; reached ODER inconclusiv = Verletzung
  for t in "${NEG_TARGETS[@]}"; do
    IFS='|' read -r desc typ addr port <<<"$t"
    desc="${desc// /}"; typ="${typ// /}"
    CHECKS=$((CHECKS+1))
    verdict=$(classify "$ns" "$typ" "$addr" "$port")
    if blocked_ok "$verdict" "$addr"; then
      echo "  [$(grn OK)]   NEG geblockt ($verdict): $desc"
    elif reached "$verdict"; then
      echo "  [$(red FAIL)] NEG ERREICHT ($verdict, SOLL geblockt): $desc → $addr:$port"; FAILS=$((FAILS+1))
    else
      echo "  [$(red FAIL)] NEG INCONCLUSIV ($verdict = Platzhalter/Tool-/Probe-Fehler → fail-closed): $desc"; FAILS=$((FAILS+1))
    fi
  done

  # 2. POSITIV — OK NUR bei CONNECTED
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
  echo ">>> NO-GO: Seat-Netz-Isolation NICHT bewiesen. Egress-Bau bleibt geblockt."
  exit 1
fi
echo ">>> PASS: Seat erreicht AUSSCHLIESSLICH die beiden Broker. Netz-Invariante bewiesen."
echo ">>> HINWEIS: schließt B1b (Netz-Isolation), NICHT B1c (Cap-Drop → seat-hardening-oracle.sh)"
echo ">>>          und NICHT den Broker-Pivot (→ Schnüffis Detektor-Recall-Oracle = Co-Gate)."
exit 0
