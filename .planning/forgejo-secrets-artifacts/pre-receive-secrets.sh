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
on_exit() { local rc=$?; [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ] && reject "unerwarteter Exit $rc"; }
trap on_exit EXIT

# --- 0. Sanity: Tooling + Policy vorhanden (fail-closed) ---------------------
command -v git >/dev/null     || reject "git fehlt"
command -v python3 >/dev/null || reject "python3 fehlt (strikter SOPS-Parser)"
[ -r "$SOPS_VALIDATE" ]       || reject "SOPS-Validator fehlt: $SOPS_VALIDATE"
[ -d "$POLICY_DIR" ]          || reject "admin-Policy-Dir fehlt: $POLICY_DIR"

# Repo-Identitaet fuer die out-of-band-Policy (NICHT aus dem Push ableitbar).
REPO_KEY="${FORGEJO_SECRETS_REPO_KEY:-${GITEA_REPO_OWNER_NAME:-}/${GITEA_REPO_NAME:-}}"
ALLOW_FILE="$POLICY_DIR/${REPO_KEY}.allow"
[ -r "$ALLOW_FILE" ] || reject "admin-Recipient-Policy fehlt fuer Repo (out-of-band): ${REPO_KEY}"

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
  [ "$new" != "$ZERO" ] && NEW_TIPS+=("$new")
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
add_oid() { local o="$1"; [ -z "${SEEN[$o]:-}" ] && { SEEN[$o]=1; PHYS_OIDS+=("$o"); }; }

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
  while read -r o; do [ -n "$o" ] && add_oid "$o"; done <<< "$oids"
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

# --- 5. jedes physische Objekt nach Typ scannen (R4/B1+B2, NUL-sicher) -------
GIT_PUSH_CERT="${GIT_PUSH_CERT:-}"
cert_seen=false

scan_text_for_secret() {  # $1=Kontext-Label (kein Secret), stdin=Inhalt
  if grep -Eq "$SECRET_RE"; then reject "Secret-Pattern in $1"; fi
}

for oid in "${PHYS_OIDS[@]}"; do
  typ="$(git cat-file -t "$oid" 2>/dev/null)" || reject "Objekt-Typ nicht lesbar (fail-closed)"
  case "$typ" in
    commit|tag)
      # komplettes rohes Objekt: Header/tagger/gpgsig/mergetag/Message/Identity
      git cat-file -p "$oid" 2>/dev/null | scan_text_for_secret "Commit/Tag-Objekt"
      [ "$typ" = tag ] && [ "$oid" = "$GIT_PUSH_CERT" ] && cert_seen=true
      ;;
    tree)
      # Tree-Namen/Gitlink-Pfade/.gitmodules (R4/B1), NUL-getrennt
      git ls-tree -r -z "$oid" 2>/dev/null \
        | tr '\0' '\n' \
        | awk '{ $1=$2=$3=""; sub(/^   /,""); print }' \
        | scan_text_for_secret "Tree-Pfad/Name"
      ;;
    blob)
      sz="$(git cat-file -s "$oid" 2>/dev/null)" || reject "Blob-Groesse nicht lesbar"
      [ "$sz" -gt "$MAX_BLOB_BYTES" ] && reject "Blob zu gross (>$MAX_BLOB_BYTES) — Perf-Limit"
      content="$(git cat-file -p "$oid" 2>/dev/null)" || reject "Blob nicht lesbar"
      # 5a. Privkey-Detektor ueber JEDEN Blob, inkl. spaeter Allowlist (R1/M2)
      if printf '%s' "$content" | grep -Eq "$PRIVKEY_RE"; then
        reject "Private-Key in Blob/Datei"
      fi
      # push-cert-Blob mitscannen (R4/B2)
      [ -n "$GIT_PUSH_CERT" ] && [ "$oid" = "$GIT_PUSH_CERT" ] && cert_seen=true
      ;;
    *) reject "unbekannter Objekt-Typ: $typ" ;;
  esac
done

# --- 6. Pfad/Inhalt-Policy je Datei im NEUEN Tree (Tier-A default-encrypt-all)
# Fuer jeden erreichbaren neuen Commit-Tip: jede Datei = Allowlist ODER SOPS-Envelope.
for tip in "${NEW_TIPS[@]:-}"; do
  [ -z "$tip" ] && continue
  ttyp="$(git cat-file -t "$tip" 2>/dev/null || true)"
  [ "$ttyp" = commit ] || continue
  while IFS= read -r -d '' path; do
    # Pfad-Allowlist?
    if printf '%s' "$path" | grep -Eq "$ALLOWLIST_RE"; then
      # recipients/*.pub MUSS age-Pubkey sein, KEIN Privkey (R1/M2)
      case "$path" in
        recipients/*.pub)
          pub="$(git cat-file -p "$tip:$path" 2>/dev/null || true)"
          printf '%s' "$pub" | grep -Eq 'AGE-SECRET-KEY-' && reject "Privkey in recipients/*.pub"
          printf '%s' "$pub" | grep -Eq '(^|[^A-Za-z0-9])age1[0-9a-z]{20,}' \
            || reject "recipients/*.pub kein age-Pubkey"
          ;;
      esac
      continue   # allowlisted Metadaten — kein SOPS-Zwang
    fi
    # sonst: MUSS gueltiger SOPS-Envelope an erlaubte Recipients sein
    if ! git cat-file -p "$tip:$path" 2>/dev/null \
         | python3 "$SOPS_VALIDATE" "$ALLOW_FILE"; then
      reject "Datei ist kein konformer SOPS-Envelope (Tier-A): ${path}"
    fi
  done < <(git ls-tree -r -z --name-only "$tip" 2>/dev/null)
done

# --- 7. signed-push: GIT_PUSH_CERT MUSS in PHYS_OIDS sein + gescannt (R4/B2) -
if [ -n "$GIT_PUSH_CERT" ] && [ "$GIT_PUSH_CERT" != "$ZERO" ] && [ "$cert_seen" = false ]; then
  reject "GIT_PUSH_CERT nicht in physischer Quarantine-Menge (fail-closed)"
fi

# Alles bestanden — nur Ciphertext + erlaubte Recipients + keine Privkeys.
exit 0
