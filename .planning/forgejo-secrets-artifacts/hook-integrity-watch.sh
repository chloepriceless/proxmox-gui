#!/usr/bin/env bash
# ============================================================================
# hook-integrity-watch — Backstop-Detektor/Verifier fuer den Forgejo-Secrets pre-receive-Hook.
# Spec/SSOT: ../FORGEJO-SECRETS-SOPS-MODEL.md §1.4-B4 + HIGH-5.
# Design:    HOOK-INTEGRITY-WATCH-DESIGN.md (Schnueffi R22-Design-Refute 29b6f40 — Grundwahl SOUND,
#            deny-all-Hook (B) ENDORSED, BLOCKER #6 gefoldet+canary-verifiziert).
# Codex R22-Refute R1+R2 (gpt-5-codex, 2026-06-22) gefoldet — Doc §"Codex-Fold R1/R2".
# ============================================================================
# ARCHITEKTUR (Codex-R2-Konsequenz): der Watcher ist ein DETEKTOR + VERIFIER eines DEPLOY-erzwungenen
# Immutabilitaets-Baselines, NICHT der Erzeuger der Immutabilitaet. Ein Timer-Watcher kann den
# sub-60s Directory-Entry-/Config-Replace-Race NICHT selbst schliessen (git im writable repo.git/
# kann Eintraege umbenennen/ersetzen, auch wenn die Datei root-owned ist). ECHTE Schliessung =
# `chattr +i` (immutable) auf die integritaetskritischen Eintraege beim DEPLOY -> git kann sie
# weder modifizieren noch umbenennen noch unlinken. Der Watcher VERIFIZIERT diesen Baseline (lsattr)
# + alarmiert + best-effort-Lockdown bei Drift. DAS macht den 60s-Timer sound: Drift erfordert
# root/chattr-Entfernung, KEIN git-User-Push-Race mehr. (Enforcement-Modell = R22-Schnueffi-Gate +
# Canary-Toleranz-Verifikation: vertraegt Forgejo immutable config/hooks? -> live auf LXC 160.)
#
# ENFORCEMENT (Design (B), token-frei) — AUTORITATIV + VERIFIZIERT (Codex-R2-BLOCKER#3): bei VIOLATION
# wird top-level `hooks/pre-receive` SELBST durch einen root-owned (+prod immutable) deny-all ersetzt,
# Redirect-Config (core.hooksPath/procReceiveRefs) NEUTRALISIERT, und der RESULTIERENDE Lockdown
# VERIFIZIERT (exists/exec/Marker/prod:root-owned+immutable). Schlaegt das fehl -> `lockdown-FAILED`
# (LAUTER Alarm, NICHT als Erfolg gezaehlt). Der Watcher ENTFERNT NIE einen Lockdown (monoton).
#
# GLOBAL-BYPASS (Codex-R2-BLOCKER#1+#4): git-user-GLOBAL config (~git/.gitconfig + xdg + /etc/gitconfig,
# INKL. `[include]`-Ketten — via `git config --includes --show-origin`) auf core.hooksPath/
# procReceiveRefs geprueft. Aktiver Wert => globaler Total-Bypass: SOURCE neutralisieren (sonst zeigt
# git weiter am per-repo-Lockdown vorbei) + LOCK-ALL + exit 3. Git-erreichbare/erzeugbare unsichere
# Global-Config OHNE aktiven Wert => Race-Enabler => config_fail (Codex-R2-HIGH).
#
# FAIL-SEMANTIK: Per-Repo-Pruef-FEHLER = VIOLATION (fail-closed pro Repo); Sweep laeuft weiter.
# WATCHER-CONFIG blind (golden/secret-orgs/violations-Dir/Global-Config kaputt) = Alarm-only exit2.
# AKTIVER GLOBAL-BYPASS = LOCK-ALL exit3. REPORT: NUR Repo-Key + Reason-Codes, NIE ein Secret.
#
# TEST_MODE=1: relaxt NUR uid==0 + chattr/runuser-ACL (non-root-Harness); alle uid-UNABHAENGIGEN
# Checks laufen voll. Root-Ownership + Immutabilitaet + ACL werden LIVE als root auf LXC 160 getestet.
# ============================================================================
set -uo pipefail

POLICY_DIR="${FORGEJO_SECRETS_POLICY_DIR:-/etc/forgejo-secrets-policy}"
REPO_BASE="${FORGEJO_REPO_BASE:-/var/lib/forgejo/forgejo-repositories}"
GOLDEN_FILE="${FORGEJO_SECRETS_GOLDEN:-$POLICY_DIR/.golden-hook-sha256}"
SECRET_ORGS_FILE="${FORGEJO_SECRETS_ORGS:-$POLICY_DIR/secret-orgs}"
VIOL_DIR="${FORGEJO_SECRETS_VIOLATIONS:-/var/lib/forgejo-secrets/violations}"
KUMA_URL_FILE="${FORGEJO_SECRETS_KUMA_FILE:-$POLICY_DIR/.kuma-push-url}"
GIT_USER="${FORGEJO_GIT_USER:-git}"
GIT_HOME="${FORGEJO_GIT_HOME:-}"
SYSTEM_GITCONFIG="${FORGEJO_SYSTEM_GITCONFIG:-/etc/gitconfig}"
TEST_MODE="${FORGEJO_SECRETS_TEST_MODE:-0}"
LOCK_MARKER="# HOOK-INTEGRITY-WATCH-LOCKDOWN"
FORBIDDEN_KEYS="core.hooksPath receive.procReceiveRefs"

GOLDEN_SHA=""
KUMA_URL=""
T_TOTAL=0; T_VIOLATED=0; T_LOCKED=0; T_OK=0; T_LOCKFAIL=0

ts() { date -u +%FT%TZ; }
log() {  # $1=level  $2=scope  $3=msg(reason-codes, KEIN Secret)
  local level="$1" scope="$2" msg="$3" line; line="$(ts) level=$level scope=$scope msg=$msg"
  if command -v logger >/dev/null 2>&1; then
    local pri="user.info"; [ "$level" = warn ] && pri="user.warning"; [ "$level" = err ] && pri="user.err"
    logger -t hook-integrity-watch -p "$pri" -- "$line" 2>/dev/null || true
  fi
  if [ "$level" = err ] || [ "$level" = warn ]; then echo "$line" >&2; else echo "$line"; fi
}
kuma_push() {  # $1=status  $2=msg
  local status="$1" msg="$2"
  if [ "$TEST_MODE" = 1 ]; then
    [ -n "${FORGEJO_SECRETS_KUMA_OUT:-}" ] && printf 'status=%s msg=%s\n' "$status" "$msg" >> "$FORGEJO_SECRETS_KUMA_OUT"
    return 0
  fi
  [ -n "$KUMA_URL" ] || return 0
  local enc; enc="$(printf '%s' "$msg" | sed 's/ /%20/g; s/&/%26/g')"
  curl -fsS --max-time 10 "${KUMA_URL}?status=${status}&msg=${enc}&ping=" >/dev/null 2>&1 || log warn KUMA "kuma-push-failed"
}

# git effektive Schreibbarkeit AUS git-User-Sicht (ACL-aware; mode-check ist ACL-blind, Codex-R1-MED).
git_can_write() {  # $1=pfad -> 0 = git KANN schreiben (unsicher)
  [ "$TEST_MODE" = 1 ] && return 1
  [ "$(id -u 2>/dev/null)" = 0 ] || return 1
  command -v runuser >/dev/null 2>&1 || return 1
  runuser -u "$GIT_USER" -- test -w "$1" 2>/dev/null
}
# Immutabilitaet (chattr +i) — Race-Schliessung gegen Directory-Entry-Replace (Codex-R2-BLOCKER#2).
is_immutable() {  # $1=pfad -> 0 immutabel; 1 nicht; (prod ohne lsattr -> 1 = fail-closed)
  [ "$TEST_MODE" = 1 ] && return 0
  command -v lsattr >/dev/null 2>&1 || return 1
  local a; a="$(lsattr -d "$1" 2>/dev/null | awk '{print $1}')" || return 1
  case "$a" in *i*) return 0 ;; *) return 1 ;; esac
}

# Pfad-Integritaet: kein Symlink, existiert, root-owned (prod), nicht group/other-writable,
# nicht git-ACL-writable; bei require_immutable zusaetzlich chattr-immutabel (Codex-R2-BLOCKER#2).
path_secure() {  # $1=pfad  $2=require_immutable(0/1, optional)
  local p="$1" reqimm="${2:-0}"
  if [ -L "$p" ]; then echo "symlink"; return 1; fi
  if [ ! -e "$p" ]; then echo "missing"; return 1; fi
  if [ "$TEST_MODE" != 1 ]; then
    local owner; owner="$(stat -c '%u' "$p" 2>/dev/null)" || { echo "stat-failed"; return 1; }
    [ "$owner" = 0 ] || { echo "not-root-owned"; return 1; }
  fi
  if [ -n "$(find "$p" -maxdepth 0 -perm /022 2>/dev/null)" ]; then echo "grp/other-writable"; return 1; fi
  if git_can_write "$p"; then echo "git-acl-writable"; return 1; fi
  if [ "$reqimm" = 1 ] && ! is_immutable "$p"; then echo "not-immutable"; return 1; fi
  return 0
}

# Config-Audit EINER Datei: forbidden-Werte (mit --includes!) + Integritaet ALLER Origin-Dateien
# der Include-Kette (Codex-R2-BLOCKER#4). Echo't space-getrennte Reason-Codes.
audit_config() {  # $1=config-datei
  local f="$1" out="" key v origin r
  [ -e "$f" ] || return 0
  for key in $FORBIDDEN_KEYS; do
    v="$(git config -f "$f" --includes --get-all "$key" 2>/dev/null || true)"
    [ -n "$v" ] && out="$out ${key}=set"
  done
  while IFS= read -r origin; do
    [ -n "$origin" ] || continue
    r="$(path_secure "$origin" 1)" || out="$out origin-insecure:$(basename "$origin"):$r"
  done < <(git config -f "$f" --includes --show-origin --list 2>/dev/null | sed -n 's/^file:\([^\t]*\)\t.*/\1/p' | sort -u)
  printf '%s' "$out"
}

# AUTORITATIVE effektive-Config-Pruefung AUS git-User-Sicht im Repo-GITDIR-Kontext (Codex-R3-BLOCKER#1+#3):
# faengt repo-local + global + system + include + includeIf.gitdir in EINEM Check = exakt was receive-pack
# sieht. prod: runuser als git-User mit GIT_DIR; TEST_MODE/non-root: Fallback -f-Audit (repo-local + globals).
# Prueft NUR effektiv aufgeloeste verbotene WERTE (nicht Origin-Integritaet — die ist separat eine
# Violation-Ursache, NICHT das Lockdown-Erfolgskriterium: ein deny-all blockt auch bei writable config).
effective_forbidden() {  # $1=repo_dir -> echo't reason-codes (space-sep), "" = effektiv sauber
  local repo_dir="$1" out="" key v f
  if [ "$TEST_MODE" != 1 ] && [ "$(id -u 2>/dev/null)" = 0 ] && command -v runuser >/dev/null 2>&1; then
    for key in $FORBIDDEN_KEYS; do
      v="$(runuser -u "$GIT_USER" -- env GIT_DIR="$repo_dir" git config --includes --get-all "$key" 2>/dev/null || true)"
      [ -n "$v" ] && out="$out effective:${key}=set"
    done
  else
    for key in $FORBIDDEN_KEYS; do
      v="$(git config -f "$repo_dir/config" --includes --get-all "$key" 2>/dev/null || true)"
      [ -n "$v" ] && out="$out effective:${key}=set"
      for f in "${GLOBAL_CFGS[@]:-}"; do
        { [ -n "$f" ] && [ -e "$f" ]; } || continue
        v="$(git config -f "$f" --includes --get-all "$key" 2>/dev/null || true)"
        [ -n "$v" ] && out="$out effective-global:${key}=set"
      done
    done
  fi
  printf '%s' "$out"
}

# Verbotene Keys in ALLEN Origin-Dateien der Include-Kette entfernen (Codex-R3-BLOCKER#1): ein blosses
# unset im direkten config laesst einen Include-Wert stehen. Origin via --show-origin --get-all.
neutralize_keys_in_chain() {  # $1=config-datei (Kettenwurzel)
  local rootf="$1" key of
  [ -e "$rootf" ] || return 0
  for key in $FORBIDDEN_KEYS; do
    while IFS= read -r of; do
      [ -n "$of" ] || continue
      [ "$TEST_MODE" != 1 ] && command -v chattr >/dev/null 2>&1 && chattr -i "$of" 2>/dev/null || true
      git config -f "$of" --unset-all "$key" 2>/dev/null || true
      [ "$TEST_MODE" != 1 ] && command -v chattr >/dev/null 2>&1 && chattr +i "$of" 2>/dev/null || true
    done < <(git config -f "$rootf" --includes --show-origin --get-all "$key" 2>/dev/null | sed -n 's/^file:\([^\t]*\)\t.*/\1/p' | sort -u)
  done
}

write_deny_all() {  # $1=zielpfad  $2=key(log) -> 0 ok / 1 fail. prod: immutabel hinterlassen.
  local f="$1" key="$2"
  [ "$TEST_MODE" != 1 ] && command -v chattr >/dev/null 2>&1 && chattr -i "$f" 2>/dev/null || true
  if ! printf '%s\n' \
      '#!/bin/sh' \
      "$LOCK_MARKER — Repo wegen Hook-Integritaetsverletzung gesperrt." \
      '# Aufhebung NUR Operator: golden 50-secrets+Dispatcher re-deploy, Eintraege re-hardenen (root+chattr +i),' \
      '# DANN diese Sperre entfernen (chattr -i; rm/restore).' \
      'echo "PUSH ABGELEHNT: Repo gesperrt (hook-integrity-watch — Integritaetsverletzung)." >&2' \
      'exit 1' > "$f" 2>/dev/null; then
    log err "$key" "lockdown-write-failed:$f"; return 1
  fi
  chmod 0755 "$f" 2>/dev/null || true
  if [ "$TEST_MODE" != 1 ]; then chown root:root "$f" 2>/dev/null || true; command -v chattr >/dev/null 2>&1 && chattr +i "$f" 2>/dev/null || true; fi
  return 0
}
verify_lockdown() {  # $1=disp  $2=repo_dir -> 0 wenn wirksamer Lockdown verifiziert
  local disp="$1" repo_dir="$2"
  [ -f "$disp" ] && [ -x "$disp" ] || return 1
  grep -q "$LOCK_MARKER" "$disp" 2>/dev/null || return 1
  if [ "$TEST_MODE" != 1 ]; then
    [ "$(stat -c '%u' "$disp" 2>/dev/null)" = 0 ] || return 1
    is_immutable "$disp" || return 1
  fi
  # Effektiv-Check (Codex-R3): erst Erfolg, wenn KEIN Redirect-Key mehr effektiv aufgeloest wird.
  [ -z "$(effective_forbidden "$repo_dir")" ] || return 1
  return 0
}
# AUTORITATIVER, VERIFIZIERTER Lockdown. return 0 = wirksam gesperrt, 1 = LOCKDOWN-FAILED.
authoritative_lockdown() {  # $1=repo_dir  $2=key
  local repo_dir="$1" key="$2" disp="$1/hooks/pre-receive" cfg="$1/config"
  mkdir -p "$1/hooks" 2>/dev/null || true
  if ! grep -q "$LOCK_MARKER" "$disp" 2>/dev/null; then write_deny_all "$disp" "$key" || true; fi
  # Redirect-Source in ALLEN Origin-Dateien der Kette neutralisieren (inkl. Includes, Codex-R3-BLOCKER#1)
  neutralize_keys_in_chain "$cfg"
  verify_lockdown "$disp" "$repo_dir"
}

marker_path() { printf '%s/%s.violation' "$VIOL_DIR" "${1//\//__}"; }
write_marker() { local mf; mf="$(marker_path "$1")"; mkdir -p "$VIOL_DIR" 2>/dev/null || true; printf '%s repo=%s reasons=%s\n' "$(ts)" "$1" "$2" > "$mf" 2>/dev/null || log err "$1" "marker-write-failed"; }
clear_marker() { local mf; mf="$(marker_path "$1")"; [ -e "$mf" ] && rm -f "$mf" 2>/dev/null || true; }

# Konsequenz aus gesammelten reasons ziehen (gemeinsam fuer check_repo + force_lock).
apply_consequence() {  # $1=key  $2=repo_dir  $3=reasons-string ("" = clean)
  local key="$1" repo_dir="$2" reasons="$3" disp="$2/hooks/pre-receive"
  if [ -n "$reasons" ]; then
    if authoritative_lockdown "$repo_dir" "$key"; then
      write_marker "$key" "$reasons"; log err "$key" "VIOLATION reasons=$reasons -> Lockdown verifiziert"; T_VIOLATED=$((T_VIOLATED+1))
    else
      write_marker "$key" "LOCKDOWN-FAILED $reasons"; log err "$key" "VIOLATION reasons=$reasons -> LOCKDOWN-FAILED (Repo evtl. OFFEN!)"; T_LOCKFAIL=$((T_LOCKFAIL+1))
    fi
  elif grep -q "$LOCK_MARKER" "$disp" 2>/dev/null; then
    write_marker "$key" "locked-awaiting-manual-clear"; log warn "$key" "invariants-ok aber Lockdown noch present (Operator-Recovery ausstehend)"; T_LOCKED=$((T_LOCKED+1))
  else
    clear_marker "$key"; T_OK=$((T_OK+1))
  fi
}

check_repo() {  # $1=key  $2=repo_dir  $3=origin
  local key="$1" repo_dir="$2"
  local hd="$2/hooks" pd="$2/hooks/pre-receive.d" disp="$2/hooks/pre-receive" h50="$2/hooks/pre-receive.d/50-secrets" cfg="$2/config"
  local reasons=() r sha cfgr
  T_TOTAL=$((T_TOTAL+1))
  if [ ! -d "$repo_dir" ]; then log warn "$key" "repo-dir-absent (policy-without-repo, benign)"; T_OK=$((T_OK+1)); return; fi

  # inv #6/#9 — Hook-DIRS root-owned + immutabel + nicht-writable + kein Symlink
  r="$(path_secure "$hd" 1)" || reasons+=("hookdir-insecure:$r")
  r="$(path_secure "$pd" 1)" || reasons+=("pre-receive.d-insecure:$r")
  # inv #1/#1b — Dispatcher existiert, exec, iteriert pre-receive.d, root-owned+immutabel
  if [ ! -f "$disp" ]; then reasons+=("dispatcher-missing")
  else
    [ -x "$disp" ] || reasons+=("dispatcher-not-exec")
    grep -q 'pre-receive\.d' "$disp" 2>/dev/null || reasons+=("dispatcher-no-d-iteration")
    r="$(path_secure "$disp" 1)" || reasons+=("dispatcher-insecure:$r")
  fi
  # inv #2/#3/#9 — 50-secrets exists/exec/sha==golden/root-owned+immutabel
  if [ ! -f "$h50" ]; then reasons+=("50-secrets-missing")
  else
    [ -x "$h50" ] || reasons+=("50-secrets-not-exec")
    r="$(path_secure "$h50" 1)" || reasons+=("50-secrets-insecure:$r")
    sha="$(sha256sum "$h50" 2>/dev/null | awk '{print $1}')"
    if [ -z "$sha" ]; then reasons+=("50-secrets-sha-unreadable"); elif [ "$sha" != "$GOLDEN_SHA" ]; then reasons+=("50-secrets-sha-drift"); fi
  fi
  # inv #8/#9 — repo.git/config root-owned + immutabel (Race-Schliessung core.hooksPath)
  r="$(path_secure "$cfg" 1)" || reasons+=("repo-config-insecure:$r")
  # inv #4/#7 — verbotene Keys (core.hooksPath/procReceiveRefs) inkl. include-Kette + Origin-Integritaet
  cfgr="$(audit_config "$cfg")"; [ -n "$cfgr" ] && reasons+=("repo-config:${cfgr# }")
  cfgr="$(effective_forbidden "$repo_dir")"; [ -n "$cfgr" ] && reasons+=("${cfgr# }")
  # inv #5 — .allow (WARN only)
  local allow="$POLICY_DIR/$key.allow"
  if [ ! -f "$allow" ]; then log warn "$key" "allow-missing (push fail-closed-rejected ohnehin)"; elif [ ! -r "$allow" ]; then log warn "$key" "allow-unreadable"; fi

  apply_consequence "$key" "$repo_dir" "${reasons[*]:-}"
}

force_lock() {  # $1=key $2=repo_dir $3=origin — LOCK-ALL bei Global-Bypass
  local key="$1" repo_dir="$2"; T_TOTAL=$((T_TOTAL+1))
  if [ ! -d "$repo_dir" ]; then T_OK=$((T_OK+1)); return; fi
  apply_consequence "$key" "$repo_dir" "global-bypass-lock-all"
}

enumerate() {  # $1=callback(key, repo_dir, origin)
  local cb="$1"; local -A SEEN=(); local org d repo key af rel
  if [ -r "$SECRET_ORGS_FILE" ]; then
    while IFS= read -r org || [ -n "$org" ]; do
      org="${org%%#*}"; org="${org//[[:space:]]/}"; [ -n "$org" ] || continue
      shopt -s nullglob
      for d in "$REPO_BASE/$org"/*.git; do
        [ -d "$d" ] || continue; repo="$(basename "$d" .git)"; key="$org/$repo"
        if [ -z "${SEEN[$key]:-}" ]; then SEEN[$key]=1; "$cb" "$key" "$d" org; fi
      done
      shopt -u nullglob
    done < "$SECRET_ORGS_FILE"
  fi
  shopt -s nullglob
  for af in "$POLICY_DIR"/*/*.allow; do
    rel="${af#"$POLICY_DIR"/}"; key="${rel%.allow}"
    case "$key" in
      *[!A-Za-z0-9/._-]*) log warn "$key" "allow-key-unsicher (uebersprungen)"; continue ;;
      */*/*|*/) log warn "$key" "allow-key-kein-owner/repo (uebersprungen)"; continue ;;
      */*) : ;; *) continue ;;
    esac
    if [ -z "${SEEN[$key]:-}" ]; then SEEN[$key]=1; "$cb" "$key" "$REPO_BASE/$key.git" allow; fi
  done
  shopt -u nullglob
}

GLOBAL_BYPASS=0
GLOBAL_CFGS=()
check_global_git_config() {  # appendet config_reasons via nameref; setzt GLOBAL_BYPASS; fuellt GLOBAL_CFGS
  local -n creasons="$1"; local f cfgr
  [ -z "$GIT_HOME" ] && GIT_HOME="$(getent passwd "$GIT_USER" 2>/dev/null | cut -d: -f6)"
  [ -n "$GIT_HOME" ] && GLOBAL_CFGS+=("$GIT_HOME/.gitconfig" "$GIT_HOME/.config/git/config")
  GLOBAL_CFGS+=("$SYSTEM_GITCONFIG")
  local r reqimm
  for f in "${GLOBAL_CFGS[@]}"; do
    if [ ! -e "$f" ]; then
      # Creation-Race (Codex-R3-BLOCKER#2): eine git-erreichbare Global-Surface MUSS vom Deploy
      # immutabel-leer angelegt sein, sonst legt der git-User core.hooksPath zwischen Sweeps an.
      # /etc/gitconfig-Abwesenheit ist normal (root-managed); ~git-Surfaces NICHT.
      [ "$TEST_MODE" != 1 ] && [ "$f" != "$SYSTEM_GITCONFIG" ] && creasons+=("global-missing-creatable:$(basename "$f")")
      continue
    fi
    cfgr="$(audit_config "$f")"
    case "$cfgr" in *"=set"*) GLOBAL_BYPASS=1 ;; esac
    [ -n "$cfgr" ] && creasons+=("global[$(basename "$f")]:${cfgr# }")
    # ~git-Surfaces immutabel verlangen; /etc/gitconfig nur root-owned+nicht-writable (root-managed).
    reqimm=1; [ "$f" = "$SYSTEM_GITCONFIG" ] && reqimm=0
    r="$(path_secure "$f" "$reqimm")" || creasons+=("global-insecure:$(basename "$f"):$r")
  done
}
neutralize_global() {  # SOURCE des Global-Bypass entschaerfen — inkl. Include-Targets (Codex-R3-BLOCKER#1)
  local f
  for f in "${GLOBAL_CFGS[@]}"; do [ -e "$f" ] || continue; neutralize_keys_in_chain "$f"; done
}

finish() {  # gemeinsamer Exit mit Aggregat-Kuma
  if [ "$T_LOCKFAIL" -gt 0 ]; then kuma_push down "LOCKDOWN-FAILED lockfail=$T_LOCKFAIL violated=$T_VIOLATED total=$T_TOTAL — REPOS EVTL. OFFEN"; log err CONFIG "SWEEP lockdown-failed=$T_LOCKFAIL"; exit 4; fi
  if [ "$T_VIOLATED" -gt 0 ] || [ "$T_LOCKED" -gt 0 ]; then kuma_push down "flagged: violated=$T_VIOLATED locked=$T_LOCKED ok=$T_OK total=$T_TOTAL"; log err CONFIG "SWEEP flagged violated=$T_VIOLATED locked=$T_LOCKED ok=$T_OK total=$T_TOTAL"; exit 1; fi
  kuma_push up "ok: $T_OK/$T_TOTAL secret-repos clean"; log info CONFIG "SWEEP clean ok=$T_OK total=$T_TOTAL"; exit 0
}

main() {
  local config_fail=0 config_reasons=() r
  if r="$(path_secure "$GOLDEN_FILE" 1)"; then
    if [ -r "$GOLDEN_FILE" ]; then
      GOLDEN_SHA="$(tr -cd '0-9a-fA-F' < "$GOLDEN_FILE" | head -c 64)"
      [ "${#GOLDEN_SHA}" -eq 64 ] || { config_fail=1; config_reasons+=("golden-sha-kein-64-hex"); }
    else config_fail=1; config_reasons+=("golden-sha-unreadable"); fi
  else config_fail=1; config_reasons+=("golden-sha-insecure:$r"); fi
  r="$(path_secure "$SECRET_ORGS_FILE" 1)" || { config_fail=1; config_reasons+=("secret-orgs-insecure:$r"); }
  [ -d "$VIOL_DIR" ] || mkdir -p "$VIOL_DIR" 2>/dev/null
  r="$(path_secure "$VIOL_DIR")" || { config_fail=1; config_reasons+=("violations-dir-insecure:$r"); }

  check_global_git_config config_reasons
  # git-erreichbare unsichere/erzeugbare Global-Config = Race-Enabler (Codex-R2-HIGH + R3-BLOCKER#2)
  case " ${config_reasons[*]:-} " in *"insecure:"*|*"global-missing-creatable"*) config_fail=1 ;; esac

  if r="$(path_secure "$KUMA_URL_FILE")"; then
    [ -r "$KUMA_URL_FILE" ] && KUMA_URL="$(tr -d '[:space:]' < "$KUMA_URL_FILE")"
  else log warn KUMA "kuma-url-file fehlt/unsicher ($r) — journald+Marker bleiben aktiv"; fi

  # AKTIVER GLOBAL-BYPASS -> SOURCE neutralisieren + LOCK-ALL + exit 3 (bzw. 4 bei Lockdown-Fehler)
  if [ "$GLOBAL_BYPASS" = 1 ]; then
    log err CONFIG "AKTIVER GLOBAL-BYPASS -> neutralize+LOCK-ALL: ${config_reasons[*]}"
    neutralize_global; enumerate force_lock
    # Codex-R3-HIGH: Lockdown-Fehler nicht hinter exit3 maskieren -> exit4-Prioritaet wie finish().
    if [ "$T_LOCKFAIL" -gt 0 ]; then
      kuma_push down "GLOBAL-BYPASS + LOCKDOWN-FAILED lockfail=$T_LOCKFAIL violated=$T_VIOLATED total=$T_TOTAL — REPOS EVTL. OFFEN"; exit 4
    fi
    kuma_push down "GLOBAL-BYPASS lock-all violated=$T_VIOLATED total=$T_TOTAL"
    exit 3
  fi
  # WATCHER-CONFIG blind -> Alarm-only (kein Auto-Lockdown-ALL)
  if [ "$config_fail" = 1 ]; then
    log err CONFIG "watcher-config-integrity-failure: ${config_reasons[*]}"
    kuma_push down "config-integrity-failure: ${config_reasons[*]}"; exit 2
  fi

  enumerate check_repo
  finish
}
main "$@"
