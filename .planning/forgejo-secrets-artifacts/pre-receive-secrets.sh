#!/usr/bin/env bash
# ============================================================================
# Forgejo-Secrets pre-receive-Hook (Tier-A default-encrypt-all)
# Spec/SSOT: .planning/FORGEJO-SECRETS-SOPS-MODEL.md §1.4 (R1-R7-gefoldet)
# Schnueffi R22-Co-Gate-Sign-off R8 @ 48d16c7 (Spec/Modell, gescoped).
# ============================================================================
# Installation: $repo.git/hooks/pre-receive.d/50-secrets   (DISABLE_GIT_HOOKS=true)
# Garantie G1: nur Ciphertext landet auf Disk. FAIL-CLOSED ueberall.
# REJECT-Messages echoen NIE den getroffenen Secret-Wert (R2/HIGH-6).
#
# DIES IST EIN DRAFT-ARTEFAKT — erst gegen den LIVE-§7-Oracle (Canary, LXC 160)
# zu verifizieren, BEVOR es scharf geht. Kein echtes Secret vor gruenem Oracle + §8.
# ============================================================================
set -euo pipefail

# --- Konfiguration (admin-gepflegt, konsument-nicht-beschreibbar) -----------
POLICY_DIR="${FORGEJO_SECRETS_POLICY_DIR:-/etc/forgejo-secrets-policy}"
SCAN_HELPER="${FORGEJO_SECRETS_SCAN_DIR:-/usr/local/lib/forgejo-secrets}"
SOPS_VALIDATE="$SCAN_HELPER/sops-envelope-validate.py"
MAX_OBJECTS="${FORGEJO_SECRETS_MAX_OBJECTS:-5000}"      # Perf-DoS (R5/HIGH-2), live kalibrieren
MAX_BLOB_BYTES="${FORGEJO_SECRETS_MAX_BLOB_BYTES:-1048576}"

# Allowlist nicht-geheimer Tier-A-Metadaten (alles andere MUSS SOPS-Envelope sein)
ALLOWLIST_RE='^(README\.md|LICENSE|\.sops\.yaml|recipients/[^/]+\.pub)$'

# Hochsignal-Secret-Pattern (Namen/Metadaten/Refnames). gitleaks bevorzugt, sonst built-in.
PRIVKEY_RE='AGE-SECRET-KEY-|-----BEGIN (OPENSSH|RSA|EC|DSA|PGP) PRIVATE KEY'
SECRET_RE='AGE-SECRET-KEY-|-----BEGIN .*PRIVATE KEY|(xox[baprs]-[0-9A-Za-z-]{10,})|(gh[pousr]_[0-9A-Za-z]{30,})|(AKIA[0-9A-Z]{16})|(eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.)'

ZERO='0000000000000000000000000000000000000000'

reject() {  # $1 = Grund (OHNE Secret-Wert)
  echo "==============================================================" >&2
  echo "  PUSH ABGELEHNT (Secrets-Forgejo pre-receive): $1" >&2
  echo "  Secrets muessen SOPS+age-verschluesselt sein (Tier-A)." >&2
  echo "==============================================================" >&2
  exit 1
}
# JEDER unerwartete Fehler/Abbruch -> fail-closed REJECT (nicht fail-open).
trap 'reject "interner Hook-Fehler (fail-closed)"' ERR
# EXIT-Trap entschaerft: ERR zuerst disarmen (sonst feuert ein benignes [ ]==1 im Trap
# selbst den ERR-Trap unter set -e) + if-Form statt && (das war die False-Reject-Ursache).
on_exit() { local rc=$?; trap - ERR; if [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ]; then reject "unerwarteter Exit $rc"; fi; }
trap on_exit EXIT

# --- 0. Sanity: Tooling + Policy vorhanden (fail-closed) ---------------------
command -v git >/dev/null     || reject "git fehlt"
command -v python3 >/dev/null || reject "python3 fehlt (strikter SOPS-Parser)"
[ -r "$SOPS_VALIDATE" ]       || reject "SOPS-Validator fehlt: $SOPS_VALIDATE"
[ -d "$POLICY_DIR" ]          || reject "admin-Policy-Dir fehlt: $POLICY_DIR"

# Repo-Identitaet fuer die out-of-band-Policy (NICHT vom Pusher beeinflussbar).
# PATH-PRIMAER (env-naming-ROBUST): der physische bare-Repo-Pfad (.../<owner>/<repo>.git),
# den Forgejo als cwd/GIT_DIR server-seitig setzt, ist die Quelle der Wahrheit.
# (Forgejo 15 setzt GITEA_REPO_USER_NAME, NICHT GITEA_REPO_OWNER_NAME — Pfad vermeidet die
#  env-var-Name-Brittleness ganz; live am Canary LXC 160 verifiziert, LIVE-ORACLE-FINDINGS.md.)
# env-Override NUR im expliziten Test-Modus (P0-3, Schnueffi-Refute 544bba3) — sonst Policy-Confusion.
if [ "${FORGEJO_SECRETS_TEST_MODE:-0}" = "1" ] && [ -n "${FORGEJO_SECRETS_REPO_KEY:-}" ]; then
  REPO_KEY="$FORGEJO_SECRETS_REPO_KEY"
else
  _repo_dir="$(git rev-parse --absolute-git-dir 2>/dev/null || echo "${PWD:-}")"
  [ -n "$_repo_dir" ] || reject "Repo-Pfad nicht aufloesbar (fail-closed)"
  REPO_KEY="$(basename "$(dirname "$_repo_dir")")/$(basename "$_repo_dir" .git)"
fi
# REPO_KEY traversal-sicher: EXAKT 2 Segmente, Segment != '.'/'..' , safe-charset (P0-2 — '.'-im-
# Regex-Charset-Loch geschlossen: '..' als ganzes Segment explizit verboten, nicht per Charset).
IFS='/' read -r _k_owner _k_repo _k_extra <<EOF
$REPO_KEY
EOF
{ [ -n "$_k_owner" ] && [ -n "$_k_repo" ] && [ -z "${_k_extra:-}" ]; } || reject "REPO_KEY nicht exakt owner/repo (fail-closed)"
for _seg in "$_k_owner" "$_k_repo"; do
  case "$_seg" in .|..) reject "REPO_KEY-Segment '.'/'..' (Traversal, fail-closed)" ;; esac
  printf '%s' "$_seg" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]*$' || reject "REPO_KEY-Segment unsicheres Zeichen (fail-closed)"
done
REPO_KEY="$_k_owner/$_k_repo"
ALLOW_FILE="$POLICY_DIR/${REPO_KEY}.allow"

# Policy-INTEGRITAET (P1-6): kein Symlink, root-owned, NICHT group/other-writable — sonst koennte
# der git-User (Hook-Kontext) die Recipient-Liste selbst setzen = Self-Authorization-Bypass (haebelt R1/B3 aus).
# if-Form (NICHT '[ ] && reject' — das feuert unter set -e+ERR-Trap im Gut-Fall einen False-Reject, s. Z.41).
if [ -L "$ALLOW_FILE" ]; then reject "Policy ist Symlink (verboten, fail-closed)"; fi
[ -f "$ALLOW_FILE" ] || reject "admin-Recipient-Policy fehlt fuer Repo (out-of-band): ${REPO_KEY}"
[ -r "$ALLOW_FILE" ] || reject "admin-Recipient-Policy nicht lesbar: ${REPO_KEY}"
# root-owned nur im PROD-Pfad erzwingen (im Test-Modus kann der non-root-Harness nicht chown'en;
# die root-owned-Eigenschaft wird live als root authoritativ getestet). Writability/Symlink bleiben IMMER.
if [ "${FORGEJO_SECRETS_TEST_MODE:-0}" != "1" ]; then
  [ "$(stat -c '%u' "$ALLOW_FILE" 2>/dev/null)" = "0" ] || reject "Policy nicht root-owned (fail-closed)"
fi
if [ -n "$(find "$ALLOW_FILE" -maxdepth 0 -perm /022 2>/dev/null)" ]; then reject "Policy group/other-writable (Self-Auth-Bypass, fail-closed)"; fi
# Policy-DIR-KETTE (POLICY_DIR + <owner>-Zwischen-Dir) muss ebenfalls integer sein
# (Schnueffi-Rest-Befund, Invariante-#6-Klasse): ein git-OWNED Dir ist fuer git schreibbar TROTZ
# -perm /022 (owner-write zaehlt nicht in /022) -> git koennte die root-owned .allow loeschen+ersetzen.
# Daher Dir-OWNERSHIP (root, prod) + Symlink-Verbot + group/other-writable je Dir der Kette pruefen.
_owner_dir="$(dirname "$ALLOW_FILE")"
for _d in "$POLICY_DIR" "$_owner_dir"; do
  if [ -L "$_d" ]; then reject "Policy-Dir ist Symlink (verboten, fail-closed)"; fi
  [ -d "$_d" ] || reject "Policy-Dir fehlt: $_d (fail-closed)"
  if [ "${FORGEJO_SECRETS_TEST_MODE:-0}" != "1" ]; then
    [ "$(stat -c '%u' "$_d" 2>/dev/null)" = "0" ] || reject "Policy-Dir nicht root-owned (fail-closed)"
  fi
  if [ -n "$(find "$_d" -maxdepth 0 -perm /022 2>/dev/null)" ]; then reject "Policy-Dir group/other-writable (fail-closed)"; fi
done

# --- 1. IMMER: push-options sperren (R4/HIGH-2, Log-Leak) --------------------
if [ "${GIT_PUSH_OPTION_COUNT:-0}" != "0" ]; then
  reject "push-options nicht erlaubt (GIT_PUSH_OPTION_COUNT>0)"   # Wert NICHT echoen
fi

# --- 1b. ref-Tripel lesen, refnames + ref-Typen validieren (R1/H3) ----------
declare -a NEW_TIPS=()
while read -r old new ref; do
  case "$ref" in
    refs/heads/*|refs/tags/*) : ;;
    refs/notes/*) reject "refs/notes/* nicht erlaubt (Klartext-Kanal)" ;;
    *) reject "unbekannter ref-Namespace: ${ref%%/*}/... (default-deny)" ;;
  esac
  # Refname selbst auf Secret-Pattern (Refnames sind Klartext, R2/B1)
  if printf '%s' "$ref" | grep -Eq "$SECRET_RE"; then
    reject "Secret-Pattern im Refname"
  fi
  if [ "$new" != "$ZERO" ]; then NEW_TIPS+=("$new"); fi
done

# --- 2. raw_presence: rohe physische Datei-Praesenz, UNABHAENGIG vom OID-Parse
#        (R7/BLOCKER — verhindert zirkulaeren fail-open) ----------------------
QUAR="${GIT_QUARANTINE_PATH:-}"
raw_presence=false
if [ -n "$QUAR" ] && [ -d "$QUAR" ]; then
  # loose: $QUAR/[0-9a-f][0-9a-f]/*   ODER  pack: $QUAR/pack/*.pack
  if compgen -G "$QUAR"/[0-9a-f][0-9a-f]/* >/dev/null 2>&1 \
     || compgen -G "$QUAR"/pack/*.pack    >/dev/null 2>&1; then
    raw_presence=true
  fi
fi

# --- 3. reine Ref-Operation (raw_presence==false): zulassen ------------------
# (Branch-Create auf existierendes Commit / Lightweight-Tag / Ref-Delete)
# refname-/push-option-/ref-Typ-Regeln sind oben bereits durchgesetzt.
if [ "$raw_presence" = false ]; then
  exit 0   # nichts objektseitig zu scannen — legitimer Null-Objekt-Push
fi

# --- 4. objekttragend: PHYS_OIDS bilden (loose ∪ pack-idx), NIE batch-all-objects
#        (R5/B1 — Alternates wuerden Main-Store over-includen) ----------------
declare -A SEEN=()
PHYS_OIDS=()
add_oid() { local o="$1"; if [ -z "${SEEN[$o]:-}" ]; then SEEN[$o]=1; PHYS_OIDS+=("$o"); fi; }

# loose: Verzeichnis-Prefix (2) + Dateiname (38) = OID
shopt -s nullglob
for f in "$QUAR"/[0-9a-f][0-9a-f]/*; do
  d="$(basename "$(dirname "$f")")"; b="$(basename "$f")"
  add_oid "${d}${b}"
done
# packed: pro *.idx via show-index die enthaltenen OIDs
for idx in "$QUAR"/pack/*.idx; do
  # .idx muss zur .pack passen; show-index-Fehler -> REJECT (Schnueffi: .idx fehlt/korrupt)
  if ! oids="$(git show-index < "$idx" 2>/dev/null | awk '{print $2}')"; then
    reject "pack-idx nicht lesbar (Enumeration kaputt, fail-closed)"
  fi
  while read -r o; do if [ -n "$o" ]; then add_oid "$o"; fi; done <<< "$oids"
done
# Realistischer broken-enum-Fall: .pack ohne (lesbare) .idx -> Enumeration unvollstaendig
for p in "$QUAR"/pack/*.pack; do
  i="${p%.pack}.idx"
  [ -r "$i" ] || reject "pack ohne lesbares .idx (Enumeration kaputt, fail-closed)"
done
shopt -u nullglob

# --- 4b. NON-VACUITY: raw_presence==true aber count==0 -> REJECT (R7/BLOCKER)-
if [ "${#PHYS_OIDS[@]}" -eq 0 ]; then
  reject "Objekte physisch present, aber OID-Enumeration leer (broken-enum, fail-closed)"
fi
# Perf-DoS (R5/HIGH-2)
if [ "${#PHYS_OIDS[@]}" -gt "$MAX_OBJECTS" ]; then
  reject "zu viele Objekte (>$MAX_OBJECTS) — Perf-Limit"
fi

scan_text_for_secret() {  # $1=Kontext-Label (kein Secret), stdin=Inhalt
  if grep -Eq "$SECRET_RE"; then reject "Secret-Pattern in $1"; fi
}

# --- 5. Reachable-Tree-Walk: allowlisted Blob-OIDs SAMMELN + pub-Format (R1/M2)
# Die Pfad-Allowlist ist die EINZIGE Ausnahme von der Blob-SOPS-Pflicht (Section 6).
# Pfadbasiert (nur reachable); alles andere (inkl. UNREACHABLE) faellt in Section 6.
declare -A ALLOW_BLOBS=()
for tip in "${NEW_TIPS[@]:-}"; do
  if [ -z "$tip" ]; then continue; fi
  ttyp="$(git cat-file -t "$tip" 2>/dev/null || true)"
  if [ "$ttyp" != commit ]; then continue; fi
  while IFS= read -r -d '' line; do
    boid="${line%%$'\t'*}"; boid="${boid##* }"   # "<mode> <type> <oid>\t<path>"
    path="${line#*$'\t'}"
    if printf '%s' "$path" | grep -Eq "$ALLOWLIST_RE"; then
      ALLOW_BLOBS["$boid"]=1
      case "$path" in
        recipients/*.pub)
          pub="$(git cat-file -p "$boid" 2>/dev/null || true)"
          if printf '%s' "$pub" | grep -Eq 'AGE-SECRET-KEY-'; then reject "Privkey in recipients/*.pub"; fi
          if ! printf '%s' "$pub" | grep -Eq '(^|[^A-Za-z0-9])age1[0-9a-z]{20,}'; then reject "recipients/*.pub kein age-Pubkey"; fi
          ;;
      esac
    fi
  done < <(git ls-tree -r -z "$tip" 2>/dev/null)
done

# --- 6. JEDES physische Objekt nach Typ scannen (R4/B1+B2 + R5-Review-7b) -----
# Blob-Pflicht ist PFAD-UNABHAENGIG: jeder Blob = allowlisted-Metadaten ODER SOPS-Envelope.
# Schliesst den unreachable-Plaintext-Blob (7b): kein Pfad -> nicht allowlisted -> SOPS-Pflicht.
GIT_PUSH_CERT="${GIT_PUSH_CERT:-}"
cert_seen=false
for oid in "${PHYS_OIDS[@]}"; do
  typ="$(git cat-file -t "$oid" 2>/dev/null)" || reject "Objekt-Typ nicht lesbar (fail-closed)"
  case "$typ" in
    commit|tag)
      git cat-file -p "$oid" 2>/dev/null | scan_text_for_secret "Commit/Tag-Objekt"
      if [ "$typ" = tag ] && [ -n "$GIT_PUSH_CERT" ] && [ "$oid" = "$GIT_PUSH_CERT" ]; then cert_seen=true; fi
      ;;
    tree)
      git ls-tree -r -z "$oid" 2>/dev/null \
        | tr '\0' '\n' | awk '{ $1=$2=$3=""; sub(/^   /,""); print }' \
        | scan_text_for_secret "Tree-Pfad/Name"
      ;;
    blob)
      sz="$(git cat-file -s "$oid" 2>/dev/null)" || reject "Blob-Groesse nicht lesbar"
      if [ "$sz" -gt "$MAX_BLOB_BYTES" ]; then reject "Blob zu gross (>$MAX_BLOB_BYTES) — Perf-Limit"; fi
      content="$(git cat-file -p "$oid" 2>/dev/null)" || reject "Blob nicht lesbar"
      if printf '%s' "$content" | grep -Eq "$PRIVKEY_RE"; then reject "Private-Key in Blob/Datei"; fi
      if [ -n "$GIT_PUSH_CERT" ] && [ "$oid" = "$GIT_PUSH_CERT" ]; then
        cert_seen=true
        # push-cert: secret-scan, aber kein SOPS-Zwang (ist kein Inhalt-Blob)
        if printf '%s' "$content" | grep -Eq "$SECRET_RE"; then reject "Secret-Pattern im push-cert"; fi
      elif [ -n "${ALLOW_BLOBS[$oid]:-}" ]; then
        # allowlisted Metadaten: kein SOPS-Zwang, aber kein Secret-Pattern drin
        if printf '%s' "$content" | grep -Eq "$SECRET_RE"; then reject "Secret-Pattern in allowlisted Metadaten"; fi
      else
        # nicht-allowlisted (reachable-Secret ODER UNREACHABLE) -> MUSS SOPS-Envelope (7b)
        if ! printf '%s' "$content" | python3 "$SOPS_VALIDATE" "$ALLOW_FILE"; then
          reject "Blob kein konformer SOPS-Envelope (auch unreachable) — fail-closed"
        fi
      fi
      ;;
    *) reject "unbekannter Objekt-Typ: $typ" ;;
  esac
done

# --- 7. signed-push: GIT_PUSH_CERT MUSS in PHYS_OIDS sein + gescannt (R4/B2) -
if [ -n "$GIT_PUSH_CERT" ] && [ "$GIT_PUSH_CERT" != "$ZERO" ] && [ "$cert_seen" = false ]; then
  reject "GIT_PUSH_CERT nicht in physischer Quarantine-Menge (fail-closed)"
fi

# Alles bestanden — nur Ciphertext + erlaubte Recipients + keine Privkeys.
exit 0
