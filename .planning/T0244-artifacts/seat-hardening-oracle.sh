#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02b — seat-hardening-oracle.sh   (Verdikt-Blocker B1c)
# =============================================================================
# WARUM (Refute-Lens-2/Codex, Befund 5): seat-negative-oracle.sh beweist die
#   NETZ-Isolation (B1b), aber NICHT, dass der ECHTE Seat-Prozess ohne
#   CAP_NET_ADMIN/CAP_SYS_ADMIN/CAP_SETUID/setns/unshare/ptrace läuft. Der
#   Cap-Drop war „plausibel, aber unbewiesen". Dieses Oracle beweist B1c.
#
# ZWEI Beweisteile:
#   (A) STATIC — /proc/$PID/status des realen `zone-seat@%i`-Hauptprozesses:
#       CapEff/CapBnd == 0 (alle Caps weg), NoNewPrivs==1, Seccomp==2 (filter),
#       uid_map → reale (äußere) UID ∉ {0, 8001, 8002, 8003}.
#   (B) DYNAMIC — ein `zone-seat-probe@%i`-Dienst (IDENTISCHE Härtungs-Direktiven
#       wie zone-seat@, nur ExecStart=zone-seat-probe.sh) versucht die gefährlichen
#       Operationen; JEDE muss mit EPERM/Fehler scheitern. (Man kann nicht in den
#       laufenden claude-Prozess injizieren → Beweis über einen identisch
#       gehärteten Probe-Prozess.)
#
# ORACLE (R31): PASS ⟺ (A) alle Static-Assertions grün UND (B) ALLE Negativ-
#   Operationen verweigert. Eine erlaubte gefährliche Op ODER eine nicht
#   ableitbare Static-Property → NO-GO (fail-closed).
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM. Teil des Boot-Self-Tests
#   (Artefakt 01 §6) zusammen mit seat-negative-oracle.sh. KEIN Live-Touch beim Schreiben.
# =============================================================================
set -uo pipefail
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
BROKER_UIDS="8001 8002 8003"
SEATS=("${SEATS_DEFAULT[@]}"); [ $# -gt 0 ] && SEATS=("$@")
FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }
chk(){ CHECKS=$((CHECKS+1)); if [ "$1" = ok ]; then echo "  [$(grn OK)]   $2"; else echo "  [$(red FAIL)] $2"; FAILS=$((FAILS+1)); fi; }

main_pid(){ systemctl show -p MainPID --value "zone-seat@$1.service" 2>/dev/null; }

echo "=== T-0244 seat-hardening-oracle (B1c) — Seats: ${SEATS[*]} ==="
for ns in "${SEATS[@]}"; do
  echo "--- $ns ---"
  PID=$(main_pid "$ns")
  if [ -z "$PID" ] || [ "$PID" = 0 ] || [ ! -d "/proc/$PID" ]; then
    chk fail "$ns: kein laufender zone-seat@-Hauptprozess (PID='$PID')"; continue
  fi
  st="/proc/$PID/status"

  # (A) STATIC --------------------------------------------------------------
  capeff=$(awk '/^CapEff:/{print $2}' "$st"); capbnd=$(awk '/^CapBnd:/{print $2}' "$st")
  nnp=$(awk '/^NoNewPrivs:/{print $2}' "$st"); secc=$(awk '/^Seccomp:/{print $2}' "$st")
  [ "$capeff" = 0000000000000000 ] && chk ok "CapEff leer (alle Caps weg): $capeff" \
                                     || chk fail "CapEff NICHT leer: $capeff (CAP_NET_ADMIN/SYS_ADMIN möglich!)"
  [ "$capbnd" = 0000000000000000 ] && chk ok "CapBnd leer: $capbnd" \
                                     || chk fail "CapBnd NICHT leer: $capbnd"
  [ "$nnp" = 1 ] && chk ok "NoNewPrivs=1" || chk fail "NoNewPrivs != 1 (=$nnp) → Privesc via setuid möglich"
  [ "$secc" = 2 ] && chk ok "Seccomp=2 (filter aktiv)" || chk fail "Seccomp != 2 (=$secc) → kein seccomp-Filter"

  # uid_map: äußere (reale) UID ∉ {0, Broker-UIDs}
  outer=$(awk 'NR==1{print $2}' "/proc/$PID/uid_map" 2>/dev/null)
  bad=0; for u in 0 $BROKER_UIDS; do [ "$outer" = "$u" ] && bad=1; done
  if [ -z "$outer" ]; then chk fail "uid_map nicht lesbar (PrivateUsers aktiv?)"
  elif [ "$bad" = 1 ]; then chk fail "reale UID=$outer ist root/Broker-UID → Isolation gebrochen"
  else chk ok "reale UID=$outer ∉ {0,$BROKER_UIDS}"; fi

  # (B) DYNAMIC — Probe-Dienst (falls deployt) -----------------------------
  if systemctl cat "zone-seat-probe@.service" &>/dev/null; then
    systemctl start "zone-seat-probe@$ns.service" 2>/dev/null || true
    rc=$(systemctl show -p ExecMainStatus --value "zone-seat-probe@$ns.service" 2>/dev/null)
    [ "$rc" = 0 ] && chk ok "Probe-Dienst: ALLE gefährlichen Ops verweigert" \
                   || chk fail "Probe-Dienst exit=$rc → eine gefährliche Op war ERLAUBT (journalctl -u zone-seat-probe@$ns)"
  else
    chk fail "zone-seat-probe@.service NICHT deployt → Dynamic-Beweis (B) fehlt (Lens-2 #5 verlangt ihn)"
  fi
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS, $FAILS Verletzung(en) ==="
[ "$FAILS" -ne 0 ] && { echo ">>> NO-GO: Cap-Drop (B1c) NICHT bewiesen."; exit 1; }
echo ">>> PASS: Seat läuft ohne Caps/NewPrivs, seccomp aktiv, UID disjunkt, gefährliche Ops verweigert."
exit 0

# ---------------------------------------------------------------------------
# zone-seat-probe.sh  (ExecStart des zone-seat-probe@.service — IDENTISCHE Härtung
# wie zone-seat@: CapabilityBoundingSet=, NoNewPrivileges, RestrictNamespaces,
# SystemCallFilter ~setns/unshare, PrivateUsers/DynamicUser, NetworkNamespacePath).
# Exit 0 NUR wenn JEDE gefährliche Op verweigert wurde (= fail-closed-Beweis):
# ---------------------------------------------------------------------------
#   #!/usr/bin/env bash
#   bad=0
#   try_denied(){ "$@" 2>/dev/null && { echo "ERLAUBT (SOLL verweigert): $*"; bad=1; }; }
#   try_denied ip route add 0.0.0.0/0 via 10.99.0.254     # CAP_NET_ADMIN
#   try_denied nft list ruleset                           # CAP_NET_ADMIN
#   try_denied unshare -n true                            # clone(CLONE_NEWNET)
#   try_denied nsenter -t 1 -n true                       # setns in root-netns
#   try_denied setpriv --reuid 8001 true                  # CAP_SETUID → Broker-UID
#   try_denied sh -c 'cat /etc/shadow'                    # FS-Confinement
#   # ptrace: ein anderer PID anhängen muss EPERM geben
#   exit $bad
