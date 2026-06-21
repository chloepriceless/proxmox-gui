#!/usr/bin/env bash
# =============================================================================
# T-0244 zone-seat-probe.sh  — Cap-Drop-Self-Proof (B1c)
# =============================================================================
# Läuft als `ExecStartPre=` (OHNE '+') im echten `zone-seat@%i.service` (Round-5-
# Vereinfachung: KEINE separate Fixture-Unit mehr). ExecStartPre erbt die volle Unit-
# Confinement (NetworkNamespacePath/CapBounding/SystemCallFilter/NNP/PrivateUsers/
# RestrictNamespaces) → der Prozess läuft unter EXAKT der echten Seat-Härtung, FRISCH
# bei jedem (Re-)Start, BEVOR `claude` (ExecStart) läuft. Exit≠0 → Seat startet nicht.
#
# Self-Proof: der confinte Prozess inspiziert SICH SELBST (kein Privileg, das zu
# fälschen) + versucht die gefährlichen Ops. Exit 0 NUR wenn vollständig gesperrt.
# Identität/Ownership des Scripts verriegelt der seat-hardening-oracle (safe_canonical
# + ExecStartPreEx-Parse: exakter Pfad, ohne '+'/ohne ignore-failure, --seat-Instanz).
#
# H3-FIX (Round-3): NUR SIGSYS (rc==159 = 128+31) zählt als seccomp-Verweigerung —
#   NICHT `rc>=128` (das akzeptierte fälschlich SIGKILL/SIGSEGV/SIGTERM = false-PASS).
# =============================================================================
set -uo pipefail
bad=0
fail(){ echo "PROBE-FAIL: $1"; bad=1; }

st=/proc/self/status
# --- (A) Self-Static: Caps/NoNewPrivs/Seccomp -------------------------------
for f in CapEff CapBnd CapInh CapAmb; do
  v=$(awk -v k="$f:" '$1==k{print $2}' "$st")
  [ "$v" = 0000000000000000 ] || fail "$f NICHT leer ($v) — Cap nicht gedroppt"
done
[ "$(awk '/^NoNewPrivs:/{print $2}' "$st")" = 1 ] || fail "NoNewPrivs!=1"
[ "$(awk '/^Seccomp:/{print $2}' "$st")"   = 2 ] || fail "Seccomp!=2 (kein Filter)"

# --- (B) Self-netns: NICHT in der init/root-netns (best effort) -------------
if mine=$(readlink /proc/self/ns/net 2>/dev/null) && root=$(readlink /proc/1/ns/net 2>/dev/null); then
  [ "$mine" != "$root" ] || fail "läuft in der INIT-netns ($mine) — keine Seat-ns"
fi

# --- (C) uid_map: outer-Ranges disjunkt von {0,8001,8002,8003} --------------
if [ -r /proc/self/uid_map ]; then
  while read -r inside outside count; do
    [ -z "${outside:-}" ] && continue
    for u in 0 8001 8002 8003; do
      [ "$u" -ge "$outside" ] && [ "$u" -lt $((outside+count)) ] && fail "uid_map-Range [$outside..$((outside+count-1))] enthält $u"
    done
  done < /proc/self/uid_map
else fail "uid_map nicht lesbar"; fi

# --- (D) Denied-Ops: JEDE MUSS durch Policy scheitern (EPERM/EACCES/SIGSYS) --
try_denied(){
  local out rc; out=$("$@" 2>&1); rc=$?
  if   [ $rc -eq 0 ];   then fail "ERLAUBT (SOLL verweigert): $*"
  elif [ $rc -eq 127 ]; then fail "TOOLERR not-found: $* (Probe-Tool fehlt → inconclusiv)"
  elif grep -qiE 'operation not permitted|permission denied|not permitted|bad system call' <<<"$out"; then : # OK: Policy-Verweigerung
  elif [ $rc -eq 159 ]; then : # OK: durch SIGSYS getötet (seccomp). NUR 159 — H3-Fix.
  else fail "INCONCLUSIV rc=$rc (kein EPERM/SIGSYS): $* :: $out"; fi
}
for t in ip nft unshare nsenter setpriv; do command -v "$t" >/dev/null || fail "Probe-Tool fehlt: $t"; done
try_denied ip route add 0.0.0.0/0 via 10.99.0.1   # CAP_NET_ADMIN
try_denied nft list ruleset                        # CAP_NET_ADMIN
try_denied unshare -n true                         # clone(CLONE_NEWNET)/RestrictNamespaces
try_denied nsenter -t 1 -n true                    # setns in root-netns
try_denied setpriv --reuid 8001 true               # CAP_SETUID → Broker-UID
try_denied cat /etc/shadow                         # FS-Confinement (ProtectSystem=strict)

[ "$bad" = 0 ] && { echo "zone-seat-probe: vollständig gesperrt"; exit 0; }
echo "zone-seat-probe: Härtung UNVOLLSTÄNDIG → B1c NICHT bewiesen"; exit 1
