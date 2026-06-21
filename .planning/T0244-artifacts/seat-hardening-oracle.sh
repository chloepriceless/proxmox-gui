#!/usr/bin/env bash
# =============================================================================
# T-0244 Artefakt 02b — seat-hardening-oracle.sh   (Verdikt-Blocker B1c)
# =============================================================================
# Beweist die PROZESS/CAP-Schicht-VORAUSSETZUNGEN (B1c) STATISCH am echten Seat.
# Der Negativ-Oracle beweist die Netz-Schicht — die zwei sind NICHT redundant.
#
# DESIGN (Round-5, Schnüffi-Vereinfachung): Der DYNAMISCHE Cap-Drop-Beweis läuft
# jetzt als `ExecStartPre=zone-seat-probe.sh` (ohne `+`) IM echten zone-seat@ — der
# Seat beweist sich selbst, frisch pro (Re-)Start, unter seiner EIGENEN Confinement.
# Damit entfällt die separate Probe-Fixture + die ganze „probe==seat"-Identitäts-
# Maschinerie (R4-H5/R5-H3 fallen weg) → weniger Code, kleinere Angriffsfläche.
#
# Dieser Oracle ist der BOOT-Aggregat-Riegel (gatet den Spawner): er prüft die
# STATISCHE Config der echten zone-seat@-Units (vor Seat-Start lesbar) gegen einen
# absoluten Policy-FLOOR + verdrahteten Self-Proof. Die DYNAMISCHE Verhaltens-
# Garantie liefert der ExecStartPre-Self-Proof zur Laufzeit.
#
# ORACLE (R31): PASS ⟺ je Seat: (1) Policy-FLOOR erfüllt, (2) SystemCallFilter
#   enthält die kritischen Denials, (3) RestrictAddressFamilies sicher,
#   (4) NetworkNamespacePath==/run/netns/%i, (5) ExecStartPre verdrahtet den
#   zone-seat-probe.sh-Self-Proof. Sonst NO-GO (fail-closed).
# =============================================================================
set -uo pipefail
SEATS_DEFAULT=(seat0 seat1 seat2 seat3 seatI)
SEATS=("${SEATS_DEFAULT[@]}"); [ $# -gt 0 ] && SEATS=("$@")

# Policy-FLOOR (R4-H4 + R5-H2 + R5-M2): absolute Soll-Werte am ECHTEN Seat.
declare -A FLOOR=(
  [NoNewPrivileges]=yes [PrivateUsers]=yes [DynamicUser]=yes [RestrictNamespaces]=yes
  [ProtectSystem]=strict [ProtectHome]=yes [ProtectKernelTunables]=yes
  [ProtectKernelModules]=yes [ProtectControlGroups]=yes [RestrictSUIDSGID]=yes
  [LockPersonality]=yes [CapabilityBoundingSet]="" [AmbientCapabilities]=""
  [PrivateTmp]=yes [SystemCallArchitectures]=native      # R5-H2
  [RestrictRealtime]=yes [ProtectClock]=yes [ProtectProc]=invisible   # R5-M2
)
# Kritische Denials, die im SystemCallFilter stehen MÜSSEN (R5-H2 semantisch, nicht nur Präsenz):
REQUIRED_DENIES=(setns unshare clone3 bpf @mount @privileged @swap)

FAILS=0; CHECKS=0
red(){ printf '\033[31m%s\033[0m' "$1"; }; grn(){ printf '\033[32m%s\033[0m' "$1"; }
chk(){ CHECKS=$((CHECKS+1)); if [ "$1" = ok ]; then echo "  [$(grn OK)]   $2"; else echo "  [$(red FAIL)] $2"; FAILS=$((FAILS+1)); fi; }
prop(){ systemctl show -p "$2" --value "$1" 2>/dev/null; }

echo "=== T-0244 seat-hardening-oracle v5 (B1c STATIC config-floor am echten Seat) — Seats: ${SEATS[*]} ==="
for ns in "${SEATS[@]}"; do
  echo "--- $ns ---"
  U="zone-seat@$ns.service"
  systemctl cat "$U" &>/dev/null || { chk fail "$U nicht deployt"; continue; }

  # (1) Policy-FLOOR
  floorbad=""
  for p in "${!FLOOR[@]}"; do
    v=$(prop "$U" "$p"); [ "$v" = "${FLOOR[$p]}" ] || floorbad+=" $p='$v'(soll='${FLOOR[$p]}')"
  done
  [ -z "$floorbad" ] && chk ok "Policy-Floor erfüllt (${#FLOOR[@]} Soll-Werte)" \
                      || chk fail "Policy-Floor VERLETZT →$floorbad"

  # (2) SystemCallFilter — kritische Denials MÜSSEN drin sein (semantisch)
  scf=$(prop "$U" SystemCallFilter)
  miss=""
  for d in "${REQUIRED_DENIES[@]}"; do grep -qiw -- "$d" <<<"$scf" || miss+=" $d"; done
  [ -z "$miss" ] && chk ok "SystemCallFilter enthält kritische Denials (${#REQUIRED_DENIES[@]})" \
                  || chk fail "SystemCallFilter fehlen Denials →$miss (dynamischer Self-Proof ist Verhaltens-Autorität)"

  # (3) RestrictAddressFamilies: kein NETLINK/PACKET (Route/nft/raw blocken), AF_UNIX+AF_INET ok
  raf=$(prop "$U" RestrictAddressFamilies)
  if [ -z "$raf" ]; then chk fail "RestrictAddressFamilies leer/ungesetzt (AF_NETLINK/PACKET offen)"
  elif grep -qiE 'AF_NETLINK|AF_PACKET' <<<"$raf"; then chk fail "RestrictAddressFamilies erlaubt NETLINK/PACKET: $raf"
  else chk ok "RestrictAddressFamilies eingeschränkt: $raf"; fi

  # (4) NetworkNamespacePath == erwartete Seat-ns (R5-H3: am ECHTEN Seat, nicht nur Probe)
  nnsp=$(prop "$U" NetworkNamespacePath)
  { [ "$nnsp" = "/var/run/netns/$ns" ] || [ "$nnsp" = "/run/netns/$ns" ]; } \
     && chk ok "NetworkNamespacePath = $nnsp" || chk fail "NetworkNamespacePath '$nnsp' ≠ netns $ns"

  # (5) Self-Proof verdrahtet: ExecStartPre ruft zone-seat-probe.sh (ohne '+', confined)
  esp=$(prop "$U" ExecStartPre)
  if grep -q 'zone-seat-probe.sh' <<<"$esp" && ! grep -qE '\+[^ ]*zone-seat-probe.sh' <<<"$esp"; then
    chk ok "ExecStartPre-Self-Proof verdrahtet (zone-seat-probe.sh, ohne '+' = confined)"
  else
    chk fail "ExecStartPre-Self-Proof FEHLT/falsch (zone-seat-probe.sh confined nötig): '$esp'"
  fi
done

echo "=== Ergebnis: $((CHECKS-FAILS))/$CHECKS, $FAILS Verletzung(en) ==="
[ "$FAILS" -ne 0 ] && { echo ">>> NO-GO: B1c-Static-Floor NICHT erfüllt."; exit 1; }
echo ">>> PASS (STATIC): Policy-Floor + Syscall-Denials + AddressFamilies + netns + Self-Proof verdrahtet."
echo ">>>       Die DYNAMISCHE Garantie liefert der ExecStartPre-Self-Proof (zone-seat-probe.sh) pro Seat-Start."
exit 0
