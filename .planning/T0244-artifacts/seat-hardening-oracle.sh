#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02b — seat-hardening-oracle.sh   (Verdikt-Blocker B1c)
# =============================================================================
# Beweist die PROZESS/CAP-Schicht (B1c). Der Negativ-Oracle beweist NUR die Netz-
# Schicht — die zwei sind NICHT redundant (SSOT §4 Layer-Split).
#
# DESIGN (Round-3 H1 + Round-4 H1/H2): das Gate läuft VOR den egress-fähigen Seats.
#   Der Beweis läuft über `zone-seat-probe@%i` (identische Härtung via Shared-Include),
#   das als BOOT-UNIT VOR diesem Gate läuft (Before=). Dieser Oracle STARTET die Probe
#   NICHT (das wäre der R4-H1-Job-Graph-Widerspruch + R4-H2-`||true`-false-PASS) —
#   er LIEST nur deren Boot-Ergebnis und addiert Struktur-/Floor-/Drift-Checks.
#
# ORACLE (R31): PASS ⟺ je Seat-Instanz: (0) beide Units ziehen DASSELBE Shared-Include
#   (fail-closed bei fehlendem Canonical), (1) Props gleich (Drift) + (1b) Policy-FLOOR
#   am echten Seat erfüllt (Gleichheit nötig, nicht hinreichend — R4-H4), (2) Probe lief
#   DIESEN Boot mit Result=success/exit 0. Sonst NO-GO.
#
# AUSFÜHRUNG: als root, im Boot-Gate (zone-selftest-hardening, NACH den Probes,
#   VOR den echten Seats — SSOT §6). KEIN Live-Touch beim Schreiben.
# =============================================================================
set -uo pipefail
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)   # R4-H5: seatI (interaktiv) IST dabei
SEATS=("${SEATS_DEFAULT[@]}"); [ $# -gt 0 ] && SEATS=("$@")
CANON=/etc/zone/zone-hardening.conf

# R4-H4 Policy-FLOOR: harte Soll-Werte am ECHTEN Seat (Gleichheit allein würde nicht
# auffallen, wenn jemand das Include schwächt — beide wären dann identisch schwach).
declare -A FLOOR=(
  [NoNewPrivileges]=yes [PrivateUsers]=yes [DynamicUser]=yes [RestrictNamespaces]=yes
  [ProtectSystem]=strict [ProtectHome]=yes [ProtectKernelTunables]=yes
  [ProtectKernelModules]=yes [ProtectControlGroups]=yes [RestrictSUIDSGID]=yes
  [LockPersonality]=yes [CapabilityBoundingSet]="" [AmbientCapabilities]="" [PrivateTmp]=yes
)
# Drift-Detektor: Probe == Seat über diese Props (M2: +PrivateTmp; instanz-spezifische
# wie ReadWritePaths bewusst NICHT — die divergieren legitim):
HARDEN_PROPS=(CapabilityBoundingSet AmbientCapabilities NoNewPrivileges PrivateUsers DynamicUser
  RestrictNamespaces SystemCallFilter SystemCallArchitectures RestrictSUIDSGID LockPersonality
  ProtectSystem ProtectHome ProtectKernelTunables ProtectKernelModules ProtectControlGroups PrivateTmp)

FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }
chk(){ CHECKS=$((CHECKS+1)); if [ "$1" = ok ]; then echo "  [$(grn OK)]   $2"; else echo "  [$(red FAIL)] $2"; FAILS=$((FAILS+1)); fi; }
prop(){ systemctl show -p "$2" --value "$1" 2>/dev/null; }

echo "=== T-0244 seat-hardening-oracle v4 (B1c, liest Probe-Boot-Ergebnis) — Seats: ${SEATS[*]} ==="
# Preflight: Canonical-Include MUSS existieren (R4-H3: sonst false-match möglich)
canon_real=$(readlink -e "$CANON" 2>/dev/null)
if [ -z "$canon_real" ] || [ ! -f "$CANON" ]; then
  echo "  [$(red FAIL)] Canonical-Include $CANON fehlt/kaputt → fail-closed"; echo ">>> NO-GO"; exit 1
fi
if ! systemctl cat "zone-seat-probe@.service" &>/dev/null; then
  echo "  [$(red FAIL)] zone-seat-probe@.service NICHT deployt (R3 H6)"; echo ">>> NO-GO"; exit 1
fi

for ns in "${SEATS[@]}"; do
  echo "--- $ns ---"
  # (0) STRUKTUR (PRIMÄR, R4-H3 fail-closed): beide Units ziehen DASSELBE Include.
  #     readlink -e (alle Komponenten existieren) + nicht-leer + == canon_real.
  s_ok=0; p_ok=0
  for d in $(prop "zone-seat@$ns.service" DropInPaths); do
    dr=$(readlink -e "$d" 2>/dev/null); [ -n "$dr" ] && [ "$dr" = "$canon_real" ] && s_ok=1; done
  for d in $(prop "zone-seat-probe@$ns.service" DropInPaths); do
    dr=$(readlink -e "$d" 2>/dev/null); [ -n "$dr" ] && [ "$dr" = "$canon_real" ] && p_ok=1; done
  [ "$s_ok" = 1 ] && [ "$p_ok" = 1 ] \
    && chk ok "beide Units ziehen Shared-Include $canon_real (strukturell)" \
    || chk fail "Shared-Include fehlt/kaputt (seat=$s_ok probe=$p_ok) → nicht strukturell garantiert"

  # (1) DRIFT-Detektor: Probe == realer Seat über die Härtungs-Props
  mismatch=""
  for p in "${HARDEN_PROPS[@]}"; do
    a=$(prop "zone-seat@$ns.service" "$p"); b=$(prop "zone-seat-probe@$ns.service" "$p")
    [ "$a" = "$b" ] || mismatch+=" $p(seat='$a' probe='$b')"
  done
  [ -z "$mismatch" ] && chk ok "Probe-Härtung == Seat (Drift-Detektor, ${#HARDEN_PROPS[@]} Props)" \
                      || chk fail "DRIFT →$mismatch"

  # (1b) Policy-FLOOR am ECHTEN Seat (R4-H4): absolute Soll-Werte, nicht nur Gleichheit
  floorbad=""
  for p in "${!FLOOR[@]}"; do
    v=$(prop "zone-seat@$ns.service" "$p")
    [ "$v" = "${FLOOR[$p]}" ] || floorbad+=" $p='$v'(soll='${FLOOR[$p]}')"
  done
  [ -z "$floorbad" ] && chk ok "Policy-Floor am Seat erfüllt (${#FLOOR[@]} harte Soll-Werte)" \
                      || chk fail "Policy-Floor VERLETZT →$floorbad → Härtung geschwächt"

  # (2) NetworkNamespacePath = erwartete Seat-ns
  nnsp=$(prop "zone-seat-probe@$ns.service" NetworkNamespacePath)
  { [ "$nnsp" = "/var/run/netns/$ns" ] || [ "$nnsp" = "/run/netns/$ns" ]; } \
     && chk ok "NetworkNamespacePath = $nnsp" || chk fail "NetworkNamespacePath '$nnsp' ≠ netns $ns"

  # (3) Probe-Boot-Ergebnis LESEN (R4-H1/H2: NICHT starten, kein ||true) ----
  res=$(prop "zone-seat-probe@$ns.service" Result)
  rc=$(prop "zone-seat-probe@$ns.service" ExecMainStatus)
  rants=$(prop "zone-seat-probe@$ns.service" ExecMainStartTimestampMonotonic)
  if [ -z "$rc" ] || [ -z "$rants" ] || [ "$rants" = 0 ]; then
    chk fail "Probe lief diesen Boot NICHT (ExecMainStatus='$rc' ts='$rants') → kein B1c-Beweis"
  elif [ "$res" = success ] && [ "$rc" = 0 ]; then
    chk ok "Probe lief (boot): self-static + alle denied-Ops EPERM/SIGSYS → gesperrt"
  else
    chk fail "Probe Result=$res exit=$rc → Härtung unvollständig (journalctl -u zone-seat-probe@$ns)"
  fi
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS, $FAILS Verletzung(en) ==="
[ "$FAILS" -ne 0 ] && { echo ">>> NO-GO: Cap-Drop (B1c) NICHT bewiesen."; exit 1; }
echo ">>> PASS: Shared-Include strukturell, Drift==0, Policy-Floor erfüllt, Probe-Prozess gesperrt."
echo ">>>       Mit Negativ-Oracle (Netz) = B1b+B1c bewiesen VOR Seat-Start."
exit 0
