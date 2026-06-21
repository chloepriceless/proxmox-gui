#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02b — seat-hardening-oracle.sh   (Verdikt-Blocker B1c)
# =============================================================================
# WARUM (Refute-Lens-2/Codex #5): seat-negative-oracle.sh beweist die NETZ-
#   Isolation (B1b), NICHT dass der ECHTE Seat-Prozess ohne CAP_NET_ADMIN/
#   CAP_SYS_ADMIN/CAP_SETUID/setns/unshare/ptrace läuft. Dieses Oracle beweist B1c.
#
# v2 (Confirm-Lens Round-2): die v1-Probe `try_denied(){ "$@" && bad=1; }" hatte
#   GENAU die false-PASS-Klasse, die #5 anprangerte (jede Nicht-Null = „verweigert").
#   Gefixt: nur EPERM/EACCES/seccomp-SIGSYS = „durch Policy verweigert" = OK;
#   Tool-not-found/bad-args/„Nexthop invalid"/falscher PID = TOOLERR/OTHER = FAIL.
#   Plus: (a) netns-Membership-Check, (b) ALLE uid_map-Ranges, (c) Probe-vs-real
#   Härtungs-GLEICHHEIT, (d) reset-failed + Result + frische InvocationID.
#
# ORACLE (R31): PASS ⟺ alle Static-Assertions grün UND Probe-Dienst lief frisch
#   mit Result=success UND ALLE gefährlichen Ops mit EPERM/SIGSYS verweigert.
#   Inconclusiv (Tool/Pfad/Stale) = NO-GO (fail-closed).
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM, Teil des Boot-Self-Tests
#   (Artefakt 01 §6, 2. ExecStart von zone-selftest.service). KEIN Live-Touch beim Schreiben.
# =============================================================================
set -uo pipefail
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
FORBIDDEN_UIDS=(0 8001 8002 8003)
# Härtungs-Properties, die Probe == realer Seat sein MÜSSEN (Lens-2-confirm c):
HARDEN_PROPS=(CapabilityBoundingSet NoNewPrivileges PrivateUsers RestrictNamespaces SystemCallFilter DynamicUser)
SEATS=("${SEATS_DEFAULT[@]}"); [ $# -gt 0 ] && SEATS=("$@")
FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }
chk(){ CHECKS=$((CHECKS+1)); if [ "$1" = ok ]; then echo "  [$(grn OK)]   $2"; else echo "  [$(red FAIL)] $2"; FAILS=$((FAILS+1)); fi; }
main_pid(){ systemctl show -p MainPID --value "zone-seat@$1.service" 2>/dev/null; }
prop(){ systemctl show -p "$2" --value "$1" 2>/dev/null; }   # prop <unit> <Property>

echo "=== T-0244 seat-hardening-oracle v2 (B1c) — Seats: ${SEATS[*]} ==="
for ns in "${SEATS[@]}"; do
  echo "--- $ns ---"
  PID=$(main_pid "$ns")
  if [ -z "$PID" ] || [ "$PID" = 0 ] || [ ! -d "/proc/$PID" ]; then
    chk fail "$ns: kein laufender zone-seat@-Hauptprozess (PID='$PID')"; continue
  fi
  st="/proc/$PID/status"

  # (A) STATIC -------------------------------------------------------------
  capeff=$(awk '/^CapEff:/{print $2}' "$st"); capbnd=$(awk '/^CapBnd:/{print $2}' "$st")
  capinh=$(awk '/^CapInh:/{print $2}' "$st"); capamb=$(awk '/^CapAmb:/{print $2}' "$st")
  nnp=$(awk '/^NoNewPrivs:/{print $2}' "$st"); secc=$(awk '/^Seccomp:/{print $2}' "$st")
  for pair in "CapEff:$capeff" "CapBnd:$capbnd" "CapInh:$capinh" "CapAmb:$capamb"; do
    n="${pair%%:*}"; v="${pair#*:}"
    [ "$v" = 0000000000000000 ] && chk ok "$n leer ($v)" || chk fail "$n NICHT leer: $v"
  done
  [ "$nnp" = 1 ] && chk ok "NoNewPrivs=1" || chk fail "NoNewPrivs!=1 (=$nnp)"
  [ "$secc" = 2 ] && chk ok "Seccomp=2 (filter)" || chk fail "Seccomp!=2 (=$secc)"

  # (a) netns-Membership: PID liegt in der ERWARTETEN Seat-netns (Lens-2-confirm a)
  pidns=$(ip netns identify "$PID" 2>/dev/null)
  [ "$pidns" = "$ns" ] && chk ok "PID in netns '$ns'" \
                        || chk fail "PID NICHT in '$ns' (=$pidns) → falscher netns-Kontext"

  # (b) uid_map: KEINE der verbotenen UIDs in IRGENDEINER outer-Range (Lens-2-confirm b)
  if [ ! -r "/proc/$PID/uid_map" ]; then chk fail "uid_map nicht lesbar"
  else
    badmap=0; mapdump=""
    while read -r inside outside count; do
      [ -z "${outside:-}" ] && continue
      mapdump+="[$outside..$((outside+count-1))]"
      for u in "${FORBIDDEN_UIDS[@]}"; do
        if [ "$u" -ge "$outside" ] && [ "$u" -lt $((outside+count)) ]; then badmap=1; fi
      done
    done < "/proc/$PID/uid_map"
    [ "$badmap" = 0 ] && chk ok "uid_map outer-Ranges $mapdump disjunkt von {${FORBIDDEN_UIDS[*]}}" \
                       || chk fail "uid_map $mapdump enthält root/Broker-UID → Isolation gebrochen"
  fi

  # (c) Probe-Dienst MUSS dieselben Härtungs-Properties tragen wie der reale Seat
  if ! systemctl cat "zone-seat-probe@.service" &>/dev/null; then
    chk fail "zone-seat-probe@.service NICHT deployt → Dynamic-Beweis fehlt (Lens-2 #5b)"
  else
    mismatch=""
    for p in "${HARDEN_PROPS[@]}"; do
      a=$(prop "zone-seat@$ns.service" "$p"); b=$(prop "zone-seat-probe@$ns.service" "$p")
      [ "$a" = "$b" ] || mismatch+=" $p(seat='$a' probe='$b')"
    done
    [ -z "$mismatch" ] && chk ok "Probe-Härtung == realer Seat (${HARDEN_PROPS[*]})" \
                        || chk fail "Probe-Härtung WEICHT AB →$mismatch → Probe beweist Seat-Härtung NICHT"

    # (d) Probe FRISCH starten + Ergebnis sauber auswerten (Lens-2-confirm d)
    systemctl reset-failed "zone-seat-probe@$ns.service" 2>/dev/null || true
    inv0=$(prop "zone-seat-probe@$ns.service" InvocationID)
    systemctl start "zone-seat-probe@$ns.service" 2>/dev/null || true   # oneshot blockt bis fertig
    inv1=$(prop "zone-seat-probe@$ns.service" InvocationID)
    res=$(prop "zone-seat-probe@$ns.service" Result)
    rc=$(prop "zone-seat-probe@$ns.service" ExecMainStatus)
    if [ "$inv1" = "$inv0" ] || [ -z "$inv1" ]; then
      chk fail "Probe lief NICHT frisch (InvocationID unverändert) → Stale-Ergebnis"
    elif [ "$res" = success ] && [ "$rc" = 0 ]; then
      chk ok "Probe-Dienst frisch: ALLE gefährlichen Ops mit EPERM/SIGSYS verweigert"
    else
      chk fail "Probe-Dienst Result=$res exit=$rc → erlaubte Op ODER inconclusiv (journalctl -u zone-seat-probe@$ns)"
    fi
  fi
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS, $FAILS Verletzung(en) ==="
[ "$FAILS" -ne 0 ] && { echo ">>> NO-GO: Cap-Drop (B1c) NICHT bewiesen."; exit 1; }
echo ">>> PASS: Seat ohne Caps/NewPrivs, seccomp aktiv, in erwarteter netns, UID disjunkt,"
echo ">>>       gefährliche Ops policy-verweigert (EPERM/SIGSYS), Probe == realer Seat."
exit 0

# ---------------------------------------------------------------------------
# zone-seat-probe.sh  (ExecStart des zone-seat-probe@.service — Unit MUSS BYTE-
# IDENTISCHE Härtungs-Direktiven wie zone-seat@ tragen: CapabilityBoundingSet=,
# NoNewPrivileges, PrivateUsers, DynamicUser, RestrictNamespaces, SystemCallFilter,
# NetworkNamespacePath — nur ExecStart zeigt auf dieses Script statt claude).
# Exit 0 NUR wenn JEDE gefährliche Op durch POLICY (EPERM/EACCES/SIGSYS) verweigert
# wurde — Tool-Fehler/bad-args zählen NICHT als Erfolg (Lens-2-confirm: false-PASS-Fix):
# ---------------------------------------------------------------------------
#   #!/usr/bin/env bash
#   bad=0
#   # Tool-Preflight: fehlt ein Probe-Tool → INCONCLUSIV = FAIL (nicht „verweigert")
#   for t in ip nft unshare nsenter setpriv; do command -v "$t" >/dev/null || { echo "TOOLERR fehlt: $t"; bad=1; }; done
#   try_denied(){                              # Op MUSS durch Policy scheitern
#     local out rc; out=$("$@" 2>&1); rc=$?
#     if   [ $rc -eq 0 ];   then echo "ERLAUBT (SOLL verweigert): $*"; bad=1
#     elif [ $rc -eq 127 ]; then echo "TOOLERR (not-found): $*"; bad=1
#     elif grep -qiE 'operation not permitted|permission denied|not permitted|bad system call' <<<"$out"; then : # OK: Policy-Verweigerung
#     elif [ $rc -eq 159 ] || [ $rc -ge 128 ]; then : # OK: durch Signal getötet (SIGSYS=31→159)
#     else echo "INCONCLUSIV (rc=$rc, kein EPERM/SIGSYS): $* :: $out"; bad=1; fi
#   }
#   try_denied ip route add 0.0.0.0/0 via 10.99.0.1     # CAP_NET_ADMIN
#   try_denied nft list ruleset                         # CAP_NET_ADMIN
#   try_denied unshare -n true                          # clone(CLONE_NEWNET) / RestrictNamespaces
#   try_denied nsenter -t 1 -n true                     # setns in root-netns
#   try_denied setpriv --reuid 8001 true                # CAP_SETUID → Broker-UID
#   try_denied cat /etc/shadow                          # FS-Confinement (ProtectSystem)
#   exit $bad
