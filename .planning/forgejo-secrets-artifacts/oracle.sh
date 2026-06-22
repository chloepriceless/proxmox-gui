#!/usr/bin/env bash
# ============================================================================
# §7-Verifikations-Oracle fuer den Forgejo-Secrets pre-receive-Hook.
# Spec: ../FORGEJO-SECRETS-SOPS-MODEL.md §7 (Schnueffi R8-Sign-off @ 48d16c7).
#
# Faehrt den ECHTEN Hook gegen ein lokales Bare-Repo via echtem `git push`
# (Gits Quarantine = GIT_QUARANTINE_PATH greift) + Direct-Invoke fuer die
# broken-enum/Non-Vacuity-Kanten, die per Normal-Push nicht injizierbar sind.
#
# Erfolgskriterium (R31, gegen unabhaengiges Signal): jeder Negativ-Fall -> REJECT,
# jeder legitime Fall -> ACCEPT. Ausgabe = gemessene REJECT/PASS-Zahlen je Sub-Test.
# ============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/pre-receive-secrets.sh"
VALIDATOR="$HERE/sops-envelope-validate.py"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
POLICY_DIR="$WORK/policy"; mkdir -p "$POLICY_DIR/test"
LIBDIR="$WORK/lib"; mkdir -p "$LIBDIR"; cp "$VALIDATOR" "$LIBDIR/sops-envelope-validate.py"

# admin out-of-band Policy fuer Repo "test/secrets": ein erlaubter + ein Recovery-Recipient
RCPT='age1validrecipientxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx0'
RECOV='age1recoveryxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1'
printf '%s\n@recovery %s\n%s\n' "$RCPT" "$RECOV" "$RECOV" > "$POLICY_DIR/test/secrets.allow"

# Bare-Target mit installiertem Hook (Wrapper exportiert Test-Env, ruft echten Hook)
BARE="$WORK/target.git"; git init -q --bare "$BARE"
mkdir -p "$BARE/hooks"
cat > "$BARE/hooks/pre-receive" <<EOF
#!/usr/bin/env bash
export FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR"
export FORGEJO_SECRETS_SCAN_DIR="$LIBDIR"
export FORGEJO_SECRETS_REPO_KEY="test/secrets"
exec "$HOOK"
EOF
chmod +x "$BARE/hooks/pre-receive"

# valider JSON-SOPS-Envelope (an erlaubten + Recovery-Recipient, voll-ENC[])
good_sops() {
  printf '{"data":"ENC[AES256_GCM,data:%s,iv:x,tag:y,type:str]","sops":{"mac":"x","lastmodified":"2026-01-01","version":"3.8.1","age":[{"recipient":"%s","enc":"x"},{"recipient":"%s","enc":"x"}]}}' "$1" "$RCPT" "$RECOV"
}

pass=0; fail=0; tn=0
declare -a RESULTS=()
# assert_push <label> <expect: REJECT|ACCEPT> -- baut Work-Repo, fuehrt $SETUP aus, pusht
# auf eine EINDEUTIGE Target-Branch je Test (sonst kollidieren unrelated Histories = non-ff).
run() { # $1 label  $2 expect  $3 setup-fn
  local label="$1" expect="$2" setup="$3"
  tn=$((tn+1)); local branch="t$tn"
  local W; W="$(mktemp -d)"
  ( set -e; cd "$W"; git init -q -b main; git config user.email t@t; git config user.name t
    "$setup" "$W" ) >/dev/null 2>&1
  local out rc
  out="$(cd "$W" && git push -q "$BARE" "HEAD:refs/heads/$branch" 2>&1)"; rc=$?
  rm -rf "$W"
  local got; [ $rc -eq 0 ] && got=ACCEPT || got=REJECT
  if [ "$got" = "$expect" ]; then pass=$((pass+1)); RESULTS+=("PASS  [$got] $label"); else fail=$((fail+1)); RESULTS+=("FAIL  [got=$got want=$expect] $label"); fi
}

# ---- Setup-Funktionen (Inhalt im Work-Repo) --------------------------------
s_good()        { echo "$(good_sops aaa)" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_plaintext()   { echo "TOPSECRET=hunter2"   > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_partial()     { printf '{"data":"ENC[AES256_GCM,data:a]","leak":"PLAINTEXTHERE","sops":{"mac":"x","lastmodified":"2026","age":[{"recipient":"%s","enc":"x"},{"recipient":"%s","enc":"x"}]}}' "$RCPT" "$RECOV" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_pgp()         { printf '{"data":"ENC[AES256_GCM,data:a]","sops":{"mac":"x","lastmodified":"2026","pgp":[{"fp":"AA"}],"age":[{"recipient":"%s","enc":"x"},{"recipient":"%s","enc":"x"}]}}' "$RCPT" "$RECOV" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_keygroups()   { printf '{"data":"ENC[AES256_GCM,data:a]","sops":{"mac":"x","lastmodified":"2026","key_groups":[{"age":[]}],"age":[{"recipient":"%s","enc":"x"},{"recipient":"%s","enc":"x"}]}}' "$RCPT" "$RECOV" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_attacker()    { printf '{"data":"ENC[AES256_GCM,data:a]","sops":{"mac":"x","lastmodified":"2026","age":[{"recipient":"age1ATTACKERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx9","enc":"x"}]}}' > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_norecovery()  { printf '{"data":"ENC[AES256_GCM,data:a]","sops":{"mac":"x","lastmodified":"2026","age":[{"recipient":"%s","enc":"x"}]}}' "$RCPT" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_privkey()     { echo "$(good_sops aaa)" > "$1/secret.json"; echo "AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ" > "$1/leak.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_secretname()  { echo "$(good_sops aaa)" > "$1/AKIAIOSFODNN7EXAMPLE.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_treesecret()  { mkdir -p "$1/ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; echo "$(good_sops aaa)" > "$1/ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/s.json"; git -C "$1" add -A; git -C "$1" commit -qm x; }
s_commitmsgsec(){ echo "$(good_sops aaa)" > "$1/secret.json"; git -C "$1" add -A; git -C "$1" commit -qm "fix AKIAIOSFODNN7EXAMPLE leak"; }
s_emptyok()     { echo "# nur erlaubte Metadaten" > "$1/README.md"; git -C "$1" add -A; git -C "$1" commit -qm x; }

# ---- Real-Push-Matrix ------------------------------------------------------
run "valider SOPS-Envelope (ACCEPT)"        ACCEPT s_good
run "(a) Klartext-Datei"                    REJECT s_plaintext
run "(c) partial-encryption (Klartext-Leaf)" REJECT s_partial
run "(j) Zusatz-Backend pgp"                REJECT s_pgp
run "(n/r) key_groups"                      REJECT s_keygroups
run "(b) fremder Recipient (Containment)"   REJECT s_attacker
run "Recovery-Recipient fehlt"              REJECT s_norecovery
run "(g) Privkey in Blob"                   REJECT s_privkey
run "(i) Secret im Dateinamen"              REJECT s_secretname
run "(o) Secret im TREE-Pfad/Verzeichnis"   REJECT s_treesecret
run "(m) Secret in Commit-Message"          REJECT s_commitmsgsec
run "Tier-A README-only (Metadaten, ACCEPT)" ACCEPT s_emptyok

# ---- Ref-Op + push-options (Direct-Invoke gegen den Hook) ------------------
# (q) push-option vorhanden -> REJECT
echo "0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 refs/heads/main" \
  | env GIT_PUSH_OPTION_COUNT=1 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (q) push-option gesetzt"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (q) push-option gesetzt"); }

# (7c) reine Ref-Op ohne Quarantine (Ref-Delete) -> ACCEPT (kein GIT_QUARANTINE_PATH)
echo "1111111111111111111111111111111111111111 0000000000000000000000000000000000000000 refs/heads/old" \
  | env -u GIT_QUARANTINE_PATH GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = ACCEPT ] && { pass=$((pass+1)); RESULTS+=("PASS  [ACCEPT] (7c) legit Null-Objekt Ref-Delete"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=ACCEPT] (7c) legit Ref-Delete"); }

# (7c') Secret-Refname trotz Ref-Op -> REJECT
echo "0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 refs/heads/ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
  | env -u GIT_QUARANTINE_PATH GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (7c') Secret im Refname trotz Ref-Op"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (7c') Secret-Refname"); }

# (7d) broken-enum: raw_presence=true (loose-Datei present) aber Enum kaputt -> REJECT
Qd="$WORK/qbroken"; mkdir -p "$Qd/ab"; : > "$Qd/ab/cdef0000000000000000000000000000000000"   # rohe loose-Datei
# kuenstlich: setze QUARANTINE auf einen Pfad mit pack/ ohne .idx
mkdir -p "$Qd/pack"; : > "$Qd/pack/pack-deadbeef.pack"   # .pack ohne .idx -> Enumeration kaputt
echo "0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 refs/heads/main" \
  | env GIT_QUARANTINE_PATH="$Qd" GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (7d) broken-enum .pack ohne .idx"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (7d) broken-enum"); }

# ---- R5-Review-Schaerfungen (Schnueffi) ------------------------------------
# (B3 self-auth) gepushte .sops.yaml behauptet Attacker-Recipient erlaubt -> admin-Policy
# ist die Autoritaet (Validator liest $ALLOW_FILE, NICHT die gepushte .sops.yaml) -> REJECT
s_selfauth() {
  printf '%s\n' 'creation_rules:' '  - age: age1ATTACKERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx9' > "$1/.sops.yaml"
  printf '{"data":"ENC[AES256_GCM,data:a]","sops":{"mac":"x","lastmodified":"2026","age":[{"recipient":"age1ATTACKERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx9","enc":"x"}]}}' > "$1/secret.json"
  git -C "$1" add -A; git -C "$1" commit -qm x
}
run "(B3) self-authored .sops.yaml mit Attacker-Recipient" REJECT s_selfauth

# (m) annotated-Tag mit Secret in der Tag-MESSAGE -> REJECT (Roh-Objekt-Scan)
W="$(mktemp -d)"; ( set -e; cd "$W"; git init -q -b main; git config user.email t@t; git config user.name t
  echo "$(good_sops aaa)" > secret.json; git add -A; git commit -qm x
  git tag -a -m "leak AKIAIOSFODNN7EXAMPLE" v1 ) >/dev/null 2>&1
( cd "$W" && git push -q "$BARE" v1:refs/tags/v1 ) >/dev/null 2>&1 && r=ACCEPT || r=REJECT; rm -rf "$W"
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (m) annotated-Tag Secret in Message"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (m) Tag-Message-Secret"); }

# (e) refs/notes/* -> REJECT (default-deny ref-Namespace, Klartext-Kanal)
echo "0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 refs/notes/commits" \
  | env -u GIT_QUARANTINE_PATH GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (e) refs/notes/* default-deny"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (e) refs/notes"); }

# (10) fail-closed-on-tool-error: Validator fehlt (leerer SCAN_DIR) -> REJECT, NICHT skip
EMPTY="$(mktemp -d)"
echo "0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 refs/heads/main" \
  | env -u GIT_QUARANTINE_PATH GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$EMPTY" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (10) Validator fehlt = fail-closed"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (10) tool-error fail-closed"); }

# (7b) UNREACHABLE-bad-blob im Pack -> Non-Vacuity-VOLLBEWEIS (Enum erfasst nicht-ref-erreichbare Objekte)
SC="$(mktemp -d)"; git -C "$SC" init -q; git -C "$SC" config user.email t@t; git -C "$SC" config user.name t
echo "$(good_sops zzz)" > "$SC/secret.json"; git -C "$SC" add -A; git -C "$SC" commit -qm clean
COMMIT="$(git -C "$SC" rev-parse HEAD)"
BAD="$(printf 'plaintext-leak AKIAIOSFODNN7EXAMPLE' | git -C "$SC" hash-object -w --stdin)"   # NICHT von Ref erreichbar
QP="$(mktemp -d)"; mkdir -p "$QP/pack"
( cd "$SC" && { git rev-list --objects "$COMMIT" | awk '{print $1}'; echo "$BAD"; } | git pack-objects "$QP/pack/pack" ) >/dev/null 2>&1
( cd "$SC" && echo "0000000000000000000000000000000000000000 $COMMIT refs/heads/main" \
  | env GIT_QUARANTINE_PATH="$QP" GIT_OBJECT_DIRECTORY="$QP" GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" ) >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (7b) UNREACHABLE-bad-blob im Pack (Vollbeweis)"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (7b) unreachable-bad-blob"); }

# (7d-loose) loose-Objekt present aber unlesbar/garbage -> REJECT (raw_presence=true, cat-file failt)
Ql="$(mktemp -d)"; mkdir -p "$Ql/ab"; printf 'garbage-no-git-object' > "$Ql/ab/cccccccccccccccccccccccccccccccccccccc"
echo "0000000000000000000000000000000000000000 abcccccccccccccccccccccccccccccccccccccc refs/heads/main" \
  | env GIT_QUARANTINE_PATH="$Ql" GIT_OBJECT_DIRECTORY="$Ql" GIT_PUSH_OPTION_COUNT=0 FORGEJO_SECRETS_POLICY_DIR="$POLICY_DIR" FORGEJO_SECRETS_SCAN_DIR="$LIBDIR" FORGEJO_SECRETS_REPO_KEY=test/secrets \
    bash "$HOOK" >/dev/null 2>&1 && r=ACCEPT || r=REJECT
[ "$r" = REJECT ] && { pass=$((pass+1)); RESULTS+=("PASS  [REJECT] (7d-loose) loose-Objekt unlesbar"); } || { fail=$((fail+1)); RESULTS+=("FAIL  [got=$r want=REJECT] (7d-loose) loose unlesbar"); }

# ---- Report ----------------------------------------------------------------
echo "=== §7-Oracle (lokal, echte git-push-Quarantine + Direct-Invoke) ==="
printf '%s\n' "${RESULTS[@]}"
echo "-------------------------------------------------------------------"
echo "PASS=$pass  FAIL=$fail  (gemessene REJECT/PASS-Evidenz, R31)"
[ "$fail" -eq 0 ] && echo "ORACLE: GRUEN" || echo "ORACLE: ROT"
exit "$fail"
