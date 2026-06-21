#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02b — seat-hardening-oracle.sh   (Verdikt-Blocker B1c)
# =============================================================================
# WARUM: seat-negative-oracle.sh beweist die NETZ-Isolation (B1b), NICHT dass der
#   Seat-Prozess ohne CAP_NET_ADMIN/CAP_SYS_ADMIN/setns/unshare/ptrace läuft (B1c).
#
# DESIGN (Round-3 H1): das Gate läuft VOR den egress-fähigen echten Seats.
#   Dieser Oracle inspiziert NICHT den realen claude-Seat (der startet erst nach
#   bestandenem Gate), sondern beweist B1c über ein PROBE-FIXTURE:
#   (1) Template-GLEICHHEIT — `zone-seat-probe@%i` trägt byte-identische Härtung
#       wie `zone-seat@%i` (gemeinsames Include); hier per `systemctl show` über
#       eine ERWEITERTE Property-Liste (Round-3 H5) verifiziert, inkl. derselben
#       NetworkNamespacePath=%i.
#   (2) Probe-LAUF — `zone-seat-probe.sh` (läuft UNTER der Härtung) inspiziert sich
#       selbst (/proc/self: Caps=0/NoNewPrivs/Seccomp/uid_map/nicht-init-netns) +
#       versucht alle gefährlichen Ops; exit 0 NUR wenn vollständig gesperrt.
#   Kompositions-Argument: Probe beweist „Template sperrt einen Prozess"; der
#   Negativ-Oracle beweist „netns %i isoliert"; Template-Gleichheit beweist
#   „echter Seat = selbe Härtung + selbe netns %i" → echter Seat gesperrt+isoliert.
#
# ORACLE (R31): PASS ⟺ je Seat-Instanz: Template-Props Probe==Seat UND Probe lief
#   FRISCH mit Result=success (exit 0). Sonst NO-GO (fail-closed).
#
# AUSFÜHRUNG: als root in der gebauten Zone-VM, im Boot-Gate VOR den echten Seats
#   (Artefakt 01 §6). KEIN Live-Touch beim Schreiben.
# =============================================================================
set -uo pipefail
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
SEATS=("${SEATS_DEFAULT[@]}"); [ $# -gt 0 ] && SEATS=("$@")
# Round-3 H5: ERWEITERTE Property-Liste (Probe darf in NICHTS abweichen):
HARDEN_PROPS=(CapabilityBoundingSet AmbientCapabilities NoNewPrivileges PrivateUsers DynamicUser
  RestrictNamespaces SystemCallFilter SystemCallArchitectures RestrictSUIDSGID LockPersonality
  ProtectSystem ProtectHome ProtectKernelTunables ProtectKernelModules ProtectControlGroups
  NetworkNamespacePath)
FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }
chk(){ CHECKS=$((CHECKS+1)); if [ "$1" = ok ]; then echo "  [$(grn OK)]   $2"; else echo "  [$(red FAIL)] $2"; FAILS=$((FAILS+1)); fi; }
prop(){ systemctl show -p "$2" --value "$1" 2>/dev/null; }

echo "=== T-0244 seat-hardening-oracle v3 (B1c, gate-vor-Seat) — Seats: ${SEATS[*]} ==="
if ! systemctl cat "zone-seat-probe@.service" &>/dev/null; then
  echo "  [$(red FAIL)] zone-seat-probe@.service NICHT deployt → B1c-Dynamic-Beweis fehlt (Round-3 H6)"
  echo ">>> NO-GO"; exit 1
fi

CANON=/etc/zone/zone-hardening.conf
for ns in "${SEATS[@]}"; do
  echo "--- $ns ---"
  # (0) STRUKTUR (Round-3 Schnüffi-V1, PRIMÄRgarantie): beide Units ziehen DASSELBE
  #     Härtungs-Include als drop-in → Identität by-construction, nicht per Liste.
  s_ok=0; p_ok=0
  for d in $(prop "zone-seat@$ns.service" DropInPaths); do
    [ "$(readlink -f "$d" 2>/dev/null)" = "$(readlink -f "$CANON" 2>/dev/null)" ] && s_ok=1; done
  for d in $(prop "zone-seat-probe@$ns.service" DropInPaths); do
    [ "$(readlink -f "$d" 2>/dev/null)" = "$(readlink -f "$CANON" 2>/dev/null)" ] && p_ok=1; done
  [ "$s_ok" = 1 ] && [ "$p_ok" = 1 ] \
    && chk ok "beide Units ziehen Shared-Include $CANON (strukturelle Identität)" \
    || chk fail "Shared-Include fehlt (seat=$s_ok probe=$p_ok) → Härtung nicht strukturell garantiert"

  # (1) Props-Vergleich = DRIFT-DETEKTOR obendrauf (failt bei abweichendem Override) -
  mismatch=""
  for p in "${HARDEN_PROPS[@]}"; do
    a=$(prop "zone-seat@$ns.service" "$p"); b=$(prop "zone-seat-probe@$ns.service" "$p")
    [ "$a" = "$b" ] || mismatch+=" $p(seat='$a' probe='$b')"
  done
  [ -z "$mismatch" ] && chk ok "Probe-Härtung == realer Seat (${#HARDEN_PROPS[@]} Props inkl. NetworkNamespacePath)" \
                      || chk fail "Probe WEICHT AB →$mismatch → beweist Seat-Härtung NICHT"
  # NetworkNamespacePath muss zudem die erwartete Seat-ns sein:
  nnsp=$(prop "zone-seat-probe@$ns.service" NetworkNamespacePath)
  [ "$nnsp" = "/var/run/netns/$ns" -o "$nnsp" = "/run/netns/$ns" ] \
     && chk ok "NetworkNamespacePath = $nnsp" \
     || chk fail "NetworkNamespacePath unerwartet: '$nnsp' (≠ netns $ns)"

  # (2) Probe FRISCH laufen lassen + Ergebnis sauber auswerten (H1/B-Beweis) -
  systemctl reset-failed "zone-seat-probe@$ns.service" 2>/dev/null || true
  inv0=$(prop "zone-seat-probe@$ns.service" InvocationID)
  systemctl start "zone-seat-probe@$ns.service" 2>/dev/null || true   # oneshot blockt bis fertig
  inv1=$(prop "zone-seat-probe@$ns.service" InvocationID)
  res=$(prop "zone-seat-probe@$ns.service" Result)
  rc=$(prop "zone-seat-probe@$ns.service" ExecMainStatus)
  if [ -z "$inv1" ] || [ "$inv1" = "$inv0" ]; then
    chk fail "Probe lief NICHT frisch (InvocationID unverändert) → Stale-Ergebnis"
  elif [ "$res" = success ] && [ "$rc" = 0 ]; then
    chk ok "Probe frisch (inv $inv1): self-static + alle denied-Ops EPERM/SIGSYS → gesperrt"
  else
    chk fail "Probe Result=$res exit=$rc → Härtung unvollständig/inconclusiv (journalctl -u zone-seat-probe@$ns)"
  fi
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS, $FAILS Verletzung(en) ==="
[ "$FAILS" -ne 0 ] && { echo ">>> NO-GO: Cap-Drop (B1c) NICHT bewiesen."; exit 1; }
echo ">>> PASS: Probe == Seat-Härtung (alle Props) UND Probe-Prozess vollständig gesperrt"
echo ">>>       (Caps=0, NoNewPrivs, seccomp, UID disjunkt, gefährliche Ops policy-verweigert)."
echo ">>>       Mit Negativ-Oracle (netns-Isolation) zusammen = B1b+B1c bewiesen VOR Seat-Start."
exit 0
