#!/usr/bin/env bash
# ============================================================================
# Akzeptanz-Oracle fuer hook-integrity-watch.sh (R31 — gemessene Evidenz).
# Spec: HOOK-INTEGRITY-WATCH-DESIGN.md §"Akzeptanz-Oracle" + 9-Fall-Erweiterung (V1/V2/V3)
#       + Codex-R22-Fold R1 (core.hooksPath, authoritativer Lockdown, repo-config, Global-Bypass)
#       + Codex-R22-Fold R2 (include-Bypass, lockdown-VERIFY, Global-Source-Neutralisierung).
#
# TEST_MODE=1: relaxt NUR uid==0 + chattr-Immutabilitaet + runuser-ACL (non-root-Harness).
# Diese werden LIVE als root auf LXC 160 authoritativ getestet (separater Canary-Lauf). Alles
# uid-UNABHAENGIGE (group/other-writable, Symlink, sha, exist/exec, config-Werte INKL. includes,
# Dispatcher-Pattern, authoritativer Lockdown + Verify, Global-Bypass, Marker, Kuma) laeuft hier voll.
# ============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WATCH="$HERE/hook-integrity-watch.sh"
LOCK_MARKER="# HOOK-INTEGRITY-WATCH-LOCKDOWN"

GOLDEN_CONTENT='#!/bin/sh\nexit 0\n'
GOLDEN_SHA="$(printf '%b' "$GOLDEN_CONTENT" | sha256sum | awk '{print $1}')"
DISP_CONTENT='#!/bin/sh\nfor h in "$(dirname "$0")"/pre-receive.d/*; do [ -x "$h" ] && { "$h" || exit 1; }; done\n'

ENVS=()
cleanup() { local d; for d in "${ENVS[@]:-}"; do [ -n "$d" ] && rm -rf "$d"; done; }
trap cleanup EXIT
P=0; F=0; RESULTS=()
ok() { P=$((P+1)); RESULTS+=("PASS  $1"); }
bad() { F=$((F+1)); RESULTS+=("FAIL  $1  ($2)"); }

WORK=""; REPO_BASE=""; POLICY_DIR=""; VIOL_DIR=""; KUMA_OUT=""; GITHOME=""; SYSGC=""; RC=""
mk_repo() {  # $1=key
  local rd="$REPO_BASE/$1.git"
  git init -q --bare "$rd"; mkdir -p "$rd/hooks/pre-receive.d"
  printf '%b' "$DISP_CONTENT" > "$rd/hooks/pre-receive"; chmod 0755 "$rd/hooks/pre-receive"
  printf '%b' "$GOLDEN_CONTENT" > "$rd/hooks/pre-receive.d/50-secrets"; chmod 0755 "$rd/hooks/pre-receive.d/50-secrets"
  mkdir -p "$POLICY_DIR/$(dirname "$1")"; printf 'age1xxxx\n@recovery age1yyyy\n' > "$POLICY_DIR/$1.allow"
}
fresh_env() {
  WORK="$(mktemp -d)"; ENVS+=("$WORK")
  REPO_BASE="$WORK/repos"; POLICY_DIR="$WORK/policy"; VIOL_DIR="$WORK/viol"
  KUMA_OUT="$WORK/kuma.out"; GITHOME="$WORK/githome"; SYSGC="$WORK/sys-gitconfig"
  mkdir -p "$REPO_BASE/testorg" "$POLICY_DIR/testorg" "$VIOL_DIR" "$GITHOME"
  printf 'testorg\n' > "$POLICY_DIR/secret-orgs"
  printf 'https://uptime.bottom.zone/api/push/TESTTOKEN\n' > "$POLICY_DIR/.kuma-push-url"
  printf '%s' "$GOLDEN_SHA" > "$POLICY_DIR/.golden-hook-sha256"
  mk_repo testorg/r
}
run_watch() {
  : > "$KUMA_OUT"
  env FORGEJO_SECRETS_TEST_MODE=1 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_REPO_BASE="$REPO_BASE" \
      FORGEJO_SECRETS_GOLDEN="$POLICY_DIR/.golden-hook-sha256" FORGEJO_SECRETS_ORGS="$POLICY_DIR/secret-orgs" \
      FORGEJO_SECRETS_VIOLATIONS="$VIOL_DIR" FORGEJO_SECRETS_KUMA_FILE="$POLICY_DIR/.kuma-push-url" \
      FORGEJO_SECRETS_KUMA_OUT="$KUMA_OUT" FORGEJO_GIT_HOME="$GITHOME" FORGEJO_SYSTEM_GITCONFIG="$SYSGC" \
      bash "$WATCH" >/dev/null 2>&1
  RC=$?
}
RD() { printf '%s' "$REPO_BASE/$1.git"; }
ld_present()  { grep -q "$LOCK_MARKER" "$(RD "$1")/hooks/pre-receive" 2>/dev/null && echo yes || echo no; }
mk_present()  { [ -e "$VIOL_DIR/${1//\//__}.violation" ] && echo yes || echo no; }
kuma_status() { tail -n1 "$KUMA_OUT" 2>/dev/null | sed -n 's/^status=\([a-z]*\).*/\1/p'; }
hookspath()   { git config -f "$(RD "$1")/config" --get core.hooksPath 2>/dev/null || true; }
expect() {  # <label> <want_exit> <want_lockdown testorg/r yes|no> <want_kuma>
  local lbl="$1" wrc="$2" wld="$3" wkm="$4" fails="" ld km
  ld="$(ld_present testorg/r)"; km="$(kuma_status)"
  [ "$RC" = "$wrc" ] || fails+="exit=$RC!=$wrc "
  [ "$ld" = "$wld" ] || fails+="lockdown=$ld!=$wld "
  [ "$km" = "$wkm" ] || fails+="kuma=$km!=$wkm "
  [ -z "$fails" ] && ok "$lbl" || bad "$lbl" "$fails"
}

# === 1. gesunde Repo -> clean ================================================================
fresh_env; run_watch; expect "1. gesunde Repo (clean)" 0 no up

# === 2. 50-secrets geloescht -> authoritativer Lockdown (top-level deny-all) =================
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
expect "2. 50-secrets geloescht -> Lockdown" 1 yes down
grep -q "$LOCK_MARKER" "$(RD testorg/r)/hooks/pre-receive" && ok "2b. top-level pre-receive = deny-all (authoritativ)" || bad "2b. authoritativ" "kein Marker"
[ "$(mk_present testorg/r)" = yes ] && ok "2c. Marker geschrieben" || bad "2c. Marker" "kein Marker"

# === 3. sha-Drift -> Lockdown ================================================================
fresh_env; printf 'x' >> "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
expect "3. 50-secrets sha-Drift -> Lockdown" 1 yes down

# === 4. group-writable -> Lockdown ===========================================================
fresh_env; chmod g+w "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
expect "4. 50-secrets group-writable -> Lockdown" 1 yes down

# === 5. procReceiveRefs gesetzt -> Lockdown + neutralisiert ==================================
fresh_env; git --git-dir="$(RD testorg/r)" config receive.procReceiveRefs refs/for; run_watch
expect "5. procReceiveRefs gesetzt -> Lockdown" 1 yes down
[ -z "$(git config -f "$(RD testorg/r)/config" --get receive.procReceiveRefs 2>/dev/null || true)" ] && ok "5b. procReceiveRefs neutralisiert" || bad "5b. neutralisiert" "noch gesetzt"

# === 6. neue Repo in Secret-Org OHNE Hook -> Lockdown (HIGH-5) ===============================
fresh_env
NR="$REPO_BASE/testorg/fresh.git"; git init -q --bare "$NR"; mkdir -p "$NR/hooks/pre-receive.d"
printf '%b' "$DISP_CONTENT" > "$NR/hooks/pre-receive"; chmod 0755 "$NR/hooks/pre-receive"
run_watch
nrld=no; grep -q "$LOCK_MARKER" "$NR/hooks/pre-receive" && nrld=yes
{ [ "$RC" = 1 ] && [ "$nrld" = yes ] && [ "$(kuma_status)" = down ]; } && ok "6. neue Repo ohne Hook -> Lockdown" || bad "6. neue Repo ohne Hook" "exit=$RC nrld=$nrld kuma=$(kuma_status)"

# === 7. Lockdown reversibel: golden 50-secrets + echter Dispatcher zurueck -> clean ==========
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
restore_ld="$(ld_present testorg/r)"
printf '%b' "$GOLDEN_CONTENT" > "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; chmod 0755 "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"
printf '%b' "$DISP_CONTENT" > "$(RD testorg/r)/hooks/pre-receive"; chmod 0755 "$(RD testorg/r)/hooks/pre-receive"
run_watch
{ [ "$restore_ld" = yes ] && [ "$RC" = 0 ] && [ "$(ld_present testorg/r)" = no ] && [ "$(kuma_status)" = up ] && [ "$(mk_present testorg/r)" = no ]; } \
  && ok "7. Lockdown reversibel (Recovery -> clean)" || bad "7. reversibel" "ld0=$restore_ld exit=$RC ld1=$(ld_present testorg/r) kuma=$(kuma_status) marker=$(mk_present testorg/r)"

# === 8. Symlink-50-secrets -> Lockdown ======================================================
fresh_env; h="$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; tgt="$WORK/elsewhere"; printf '%b' "$GOLDEN_CONTENT" > "$tgt"; rm -f "$h"; ln -s "$tgt" "$h"; run_watch
expect "8. 50-secrets Symlink -> Lockdown" 1 yes down

# === 9. nicht-exec -> Lockdown ==============================================================
fresh_env; chmod -x "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
expect "9. 50-secrets nicht-exec -> Lockdown" 1 yes down

# === C1. core.hooksPath repo-local -> Lockdown + neutralisiert (Codex-R1-BLOCKER) ============
fresh_env; git --git-dir="$(RD testorg/r)" config core.hooksPath /tmp/empty-hooks; run_watch
expect "C1. core.hooksPath repo-local -> Lockdown" 1 yes down
[ -z "$(hookspath testorg/r)" ] && ok "C1b. core.hooksPath neutralisiert" || bad "C1b. neutralisiert" "noch: $(hookspath testorg/r)"

# === C2. repo.git/config group-writable -> nicht durable lockbar (Codex-R4-BLOCKER#1) =========
# In NON-ROOT-TEST kann der Watcher die writable config nicht immutabel machen -> verify schlaegt
# fehl -> LOCKDOWN-FAILED exit4 (ehrlich). PROD: authoritative_lockdown chattr +i config -> durable exit1.
fresh_env; chmod g+w "$(RD testorg/r)/config"; run_watch
expect "C2. repo.git/config group-writable -> LOCKDOWN-FAILED (non-root)" 4 yes down

# === C6. leerer core.hooksPath="" -> per Exit-Status erkannt -> Lockdown (Codex-R4-BLOCKER) ===
fresh_env; git --git-dir="$(RD testorg/r)" config core.hooksPath ""; run_watch
expect "C6. leerer core.hooksPath -> Lockdown" 1 yes down

# === C3. AKTIVER GLOBAL-BYPASS (git-user-global core.hooksPath) -> LOCK-ALL exit3 ============
fresh_env; mk_repo testorg/second
git config -f "$GITHOME/.gitconfig" core.hooksPath /tmp/empty-global
run_watch
g1=no; g2=no
grep -q "$LOCK_MARKER" "$(RD testorg/r)/hooks/pre-receive" && g1=yes
grep -q "$LOCK_MARKER" "$(RD testorg/second)/hooks/pre-receive" && g2=yes
gn=no; [ -z "$(git config -f "$GITHOME/.gitconfig" --get core.hooksPath 2>/dev/null || true)" ] && gn=yes
{ [ "$RC" = 3 ] && [ "$g1" = yes ] && [ "$g2" = yes ] && [ "$(kuma_status)" = down ]; } \
  && ok "C3. Global-Bypass -> LOCK-ALL (exit3, beide Repos)" || bad "C3. LOCK-ALL" "exit=$RC r=$g1 second=$g2 kuma=$(kuma_status)"
[ "$gn" = yes ] && ok "C3b. Global-Source neutralisiert" || bad "C3b. Global-Source neutralisiert" "core.hooksPath noch global gesetzt"

# === C4. repo-local INCLUDE-Bypass (core.hooksPath via [include]) -> Lockdown (Codex-R2-BLOCKER#4)
fresh_env
printf '[core]\n\thooksPath = /tmp/empty-inc\n' > "$WORK/repo-bypass.conf"
git --git-dir="$(RD testorg/r)" config include.path "$WORK/repo-bypass.conf"
run_watch
expect "C4. repo include-bypass core.hooksPath -> Lockdown" 1 yes down

# === C5. GLOBAL INCLUDE-Bypass -> LOCK-ALL exit3 (Codex-R2-BLOCKER#4) ========================
fresh_env
printf '[core]\n\thooksPath = /tmp/empty-ginc\n' > "$WORK/global-bypass.conf"
printf '[include]\n\tpath = %s/global-bypass.conf\n' "$WORK" > "$GITHOME/.gitconfig"
run_watch
g1=no; grep -q "$LOCK_MARKER" "$(RD testorg/r)/hooks/pre-receive" && g1=yes
{ [ "$RC" = 3 ] && [ "$g1" = yes ] && [ "$(kuma_status)" = down ]; } && ok "C5. global include-bypass -> LOCK-ALL exit3" || bad "C5. global include-bypass" "exit=$RC ld=$g1 kuma=$(kuma_status)"

# === LF1. Lockdown-Schreiben schlaegt fehl -> LOCKDOWN-FAILED exit4 (Codex-R2-BLOCKER#3) =====
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"
chmod 0000 "$(RD testorg/r)/hooks/pre-receive"   # deny-all-Schreiben scheitert -> verify schlaegt fehl
run_watch
chmod 0755 "$(RD testorg/r)/hooks/pre-receive" 2>/dev/null || true   # cleanup fuer rm -rf
{ [ "$RC" = 4 ] && [ "$(kuma_status)" = down ] && grep -q 'LOCKDOWN-FAILED' "$VIOL_DIR/testorg__r.violation" 2>/dev/null; } \
  && ok "LF1. lockdown-write-fail -> LOCKDOWN-FAILED exit4" || bad "LF1. LOCKDOWN-FAILED" "exit=$RC kuma=$(kuma_status) marker=$(cat "$VIOL_DIR/testorg__r.violation" 2>/dev/null)"

# === V1a. Dispatcher fail-fast (Direct-Test) ================================================
DT="$(mktemp -d)"; ENVS+=("$DT"); mkdir -p "$DT/pre-receive.d"
printf '%b' "$DISP_CONTENT" > "$DT/pre-receive"; chmod +x "$DT/pre-receive"
printf '#!/bin/sh\nexit 1\n' > "$DT/pre-receive.d/00-LOCKDOWN"; chmod +x "$DT/pre-receive.d/00-LOCKDOWN"
printf '#!/bin/sh\nexit 0\n' > "$DT/pre-receive.d/99-noop"; chmod +x "$DT/pre-receive.d/99-noop"
"$DT/pre-receive" </dev/null >/dev/null 2>&1 && dr=0 || dr=1
[ "$dr" = 1 ] && ok "V1a. Dispatcher fail-fast (00-LOCKDOWN+99-noop -> REJECT)" || bad "V1a. fail-fast" "exit=0"

# === V1b. authoritativer deny-all BLOCKT (top-level pre-receive selbst exit1) ================
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
"$(RD testorg/r)/hooks/pre-receive" </dev/null >/dev/null 2>&1 && lr=0 || lr=1
[ "$lr" = 1 ] && ok "V1b. authoritativer top-level deny-all blockt Push" || bad "V1b. deny-all blockt" "exit=0"

# === V1c. Dispatcher group-writable -> Lockdown (inv #1b) ====================================
fresh_env; chmod g+w "$(RD testorg/r)/hooks/pre-receive"; run_watch
expect "V1c. Dispatcher group-writable -> Lockdown" 1 yes down

# === V1d. Dispatcher iteriert pre-receive.d NICHT -> Lockdown (inv #1) =======================
fresh_env; printf '#!/bin/sh\nexit 0\n' > "$(RD testorg/r)/hooks/pre-receive"; chmod 0755 "$(RD testorg/r)/hooks/pre-receive"; run_watch
expect "V1d. Dispatcher ohne pre-receive.d-Iteration -> Lockdown" 1 yes down

# === V2a-d. Watcher-Config-Bruch -> alarm-only (exit2, KEIN Auto-Lockdown) ===================
fresh_env; chmod o+w "$POLICY_DIR/.golden-hook-sha256"; run_watch
expect "V2a. golden-sha o-writable -> config-fail (exit2)" 2 no down
fresh_env; rm -f "$POLICY_DIR/secret-orgs"; printf 'testorg\n' > "$WORK/orgs-real"; ln -s "$WORK/orgs-real" "$POLICY_DIR/secret-orgs"; run_watch
expect "V2b. secret-orgs Symlink -> config-fail (exit2)" 2 no down
fresh_env; chmod g+w "$VIOL_DIR"; run_watch
expect "V2c. violations-Dir group-writable -> config-fail (exit2)" 2 no down
fresh_env; printf 'nicht-hex-garbage' > "$POLICY_DIR/.golden-hook-sha256"; run_watch
expect "V2d. golden-sha kein-64-hex -> config-fail (exit2)" 2 no down

# === V2e. git-user-global config writable (kein Bypass-Wert) -> config-fail (Codex-R2-HIGH) ==
fresh_env; printf '[user]\n\tname = x\n' > "$GITHOME/.gitconfig"; chmod g+w "$GITHOME/.gitconfig"; run_watch
expect "V2e. global-config writable (Race-Enabler) -> config-fail (exit2)" 2 no down

# === V3a. Kuma up(clean)/down(flagged) ======================================================
fresh_env; run_watch; up_line="$(cat "$KUMA_OUT")"
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch; down_line="$(cat "$KUMA_OUT")"
{ printf '%s' "$up_line" | grep -q '^status=up ' && printf '%s' "$down_line" | grep -q '^status=down '; } \
  && ok "V3a. Kuma up(clean)/down(flagged)" || bad "V3a. Kuma" "up=[$up_line] down=[$down_line]"

# === V5. Marker traegt KEINEN Secret-Wert (Report-Disziplin R2/HIGH-6) =======================
fresh_env; rm -f "$(RD testorg/r)/hooks/pre-receive.d/50-secrets"; run_watch
mf="$VIOL_DIR/testorg__r.violation"
if [ -f "$mf" ] && grep -Eq '^[0-9T:Z-]+ repo=testorg/r reasons=' "$mf" && ! grep -Eq 'AGE-SECRET-KEY|PRIVATE KEY|hunter2' "$mf"; then ok "V5. Marker ohne Secret-Wert"; else bad "V5. Marker ohne Secret" "marker=$(cat "$mf" 2>/dev/null)"; fi

echo "=== hook-integrity-watch Akzeptanz-Oracle (TEST_MODE, isolierte Fixtures) ==="
printf '%s\n' "${RESULTS[@]}"
echo "----------------------------------------------------------------------------"
echo "PASS=$P  FAIL=$F  (gemessene Lockdown/exit/Kuma-Evidenz, R31)"
[ "$F" -eq 0 ] && echo "ORACLE: GRUEN" || echo "ORACLE: ROT"
exit "$F"
