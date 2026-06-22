# Forgejo-Secrets — LIVE-§7-Oracle Befunde (LXC 160 Canary, 2026-06-22)

Verifikation der Impl-Artefakte (pre-receive-Hook + SOPS-Validator) gegen Forgejos
ECHTEN Push-Pfad auf LXC 160 `forgejo-sec` (Forgejo 15.0.3). Canary-Repo `dvhub/canary-secrets`
(private, wird nach dem Drill gelöscht). KEIN echtes Secret — reversibler Bau, §8-Landing bleibt operator-gated.

## Methodik
- Artefakte nach `/usr/local/lib/forgejo-secrets/` deployt (md5 == lokal verifiziert), Hook pro
  Repo in `hooks/pre-receive.d/50-secrets`.
- **Env-Dump-Probe** (49-envdump, exit 0) vor dem scharfen Hook → Forgejos Hook-Env gemessen.
- Validator zusätzlich direkt (ohne Forgejo) gegen 3 `.allow`-Varianten + Klartext-Negativ.

## Gemessene Umgebungs-Fakten (Forgejo 15.0.3 pre-receive-Env)
| Variable | Wert | Konsequenz |
|---|---|---|
| `GIT_QUARANTINE_PATH` | `…/canary-secrets.git/objects/tmp_objdir-incoming-XXXX` (loose-OIDs) | ✅ `raw_presence`+PHYS_OIDS greifen |
| `GIT_ALTERNATE_OBJECT_DIRECTORIES` | `…/objects` (Main-Store) | ✅ `batch-all-objects`-Verzicht (R5/B1) war zwingend |
| `GITEA_REPO_USER_NAME` | `dvhub` | Owner-Quelle (NICHT `GITEA_REPO_OWNER_NAME`!) |
| `GITEA_REPO_OWNER_NAME` | **UNSET** | 🔴 BUG-2 |
| `GITEA_REPO_NAME` | `canary-secrets` | Repo-Quelle |
| `PWD` / git-dir | `…/dvhub/canary-secrets.git` | path-Ableitung möglich (env-robust) |
| systemd `PrivateTmp` | `yes` | Hook-`/tmp` ist privat (mein Hook nutzt kein /tmp → unkritisch) |

## Befunde

### 🔴 BUG-2 (Hook) — REPO_KEY aus falscher Env-Var → fail-closed REJECT auf JEDEN Push
- `pre-receive-secrets.sh` leitet `REPO_KEY` aus `GITEA_REPO_OWNER_NAME` ab — die existiert in Forgejo 15
  NICHT (nur `GITEA_REPO_USER_NAME`). Ergebnis: `REPO_KEY="/canary-secrets"` → `ALLOW_FILE` nicht gefunden
  → `reject "admin-Recipient-Policy fehlt"` für ALLE Pushes. Fail-closed (sicher), aber System nicht-funktional.
- **Severity:** CRITICAL für Funktion (kein Leak).
- **Fix:** REPO_KEY **path-primär** ableiten (`git rev-parse --absolute-git-dir` → `<owner>/<repo>`),
  env-naming-unabhängig. Begründung: ein Env-Var-Name-Assumption hat uns gerade gebissen; der physische
  bare-Repo-Pfad ist die robuste Quelle der Wahrheit, vom Pusher nicht beeinflussbar (Forgejo setzt cwd).
  Explizite `FORGEJO_SECRETS_REPO_KEY`-Override bleibt nur für Tests.

### 🔴 BUG-1 (Validator) — Recovery-Recipient auf `@recovery`-only-Zeile scheitert am Containment
- `.allow`-Parsing nimmt die `@recovery age1…`-Zeile MIT Prefix in `allowed` auf; Containment (Z.169)
  prüft den nackten `age1…` → der Recovery-Recipient ist nicht in `allowed` → REJECT „Containment verletzt".
- Spec (SSOT §Z.65) + README dokumentieren Recovery als EINE `@recovery age1…`-Zeile, und Recovery ist
  **Pflicht für jede Datei** (Z.34). Folgt der Admin dem dokumentierten Format → JEDER legitime Push wird
  fail-closed abgelehnt. Empirisch bestätigt:
  - V1 (Recovery plain + `@recovery`) → ACCEPT
  - **V2 (Recovery nur `@recovery`) → REJECT „Containment verletzt"**
  - V3 (keine Recovery-Zeile) → ACCEPT · NEG (Klartext-Leaf) → REJECT ✓
- **Severity:** HIGH (fail-closed, bricht den Pflicht-Recovery-Pfad / Doku-Code-Mismatch).
- **Fix:** beim Bauen von `allowed` den `@recovery `-Prefix strippen → eine Zeile gewährt UND markiert
  (matcht das dokumentierte Format). Keine Lockerung: der Recovery-Recipient IST by-design autorisiert.

### 🔴 BUG-3 (Deploy-Doc/Perms) — `.allow` muss git-LESBAR sein, sonst fail-closed-Reject auf JEDEN Push
- Erst-Lauf: `.allow` als root mit `chmod 600` angelegt → der Hook (+ Validator) laufen als User **git**
  (Forgejo receive-pack) → `[ -r "$ALLOW_FILE" ]` false → `reject "admin-Recipient-Policy fehlt"` für ALLE Pushes.
- Das README sagte „`.allow` (root-only)" → führte zu 600. Gemeint ist **root-only-WRITABLE** (konsument-nicht-
  beschreibbar); der Inhalt sind age-**Public**-Recipients (NICHT geheim) → korrekt: **root-owned, 0644** (oder
  0640 root:git). Dirs `/etc/forgejo-secrets-policy[/<org>]` müssen git-traversierbar sein (0755).
- **Severity:** HIGH (Deploy-Procedure; fail-closed, aber nicht-funktional). Reiner Doc/Perms-Fix — kein Code.
- **Test-Validitäts-Lehre:** bei unlesbarer Policy rejecten ALLE Pushes schon am Sanity-Check → REJECT-Tests
  „bestehen" SPURIOUS (falscher Grund). → Oracle assertiert jetzt den **spezifischen Reject-Grund** je Test
  und failt bei `admin-Recipient-Policy fehlt`. (R31: rejected wegen der Verletzung, nicht wegen Setup-Defekt.)

## Gemessene Live-Ergebnisse (8/8, reason-asserted, Forgejo echter Push-Pfad, 2026-06-22)
| Test | Erwartet | Gemessen | Reject-Grund (gemessen) |
|---|---|---|---|
| t1 valid SOPS JSON | ACCEPT | ✅ ACCEPT | — (beweist BUG-2+BUG-3-Fix: REPO_KEY=dvhub/canary-secrets + .allow lesbar) |
| t2 plaintext-secret | REJECT | ✅ REJECT | Blob kein konformer SOPS-Envelope (auch unreachable) |
| t3 README allowlist | ACCEPT | ✅ ACCEPT | — |
| t4 valid SOPS **YAML** | ACCEPT | ✅ ACCEPT | — (pyyaml-Pfad live verifiziert) |
| t5 missing-recovery | REJECT | ✅ REJECT | per-Tenant-Recovery-Recipient fehlt (BUG-1-Fix: dok. @recovery-Format ACCEPTet sonst) |
| t6 privkey-blob | REJECT | ✅ REJECT | Private-Key in Blob/Datei |
| t7 foreign-recipient | REJECT | ✅ REJECT | Containment verletzt (nicht in admin-Policy) |
| t8 push-option | REJECT | ✅ REJECT | push-options nicht erlaubt (GIT_PUSH_OPTION_COUNT>0) |

**Kein „Secret-Echo" in irgendeinem Reject** (grep AKIA/AGE-SECRET-KEY/BEGIN OPENSSH PRIVATE über alle Outputs == 0)
→ R2/HIGH-6 live bestätigt. **Lokal `oracle.sh` 22/22** bleibt grün mit dok. @recovery-Format (BUG-1-Fix bewiesen).

## Selbst-Refute der Fixes (vor Schnüffi-Cross-Refute)
- **REPO_KEY path-primär — kann der Pusher den Pfad/owner fälschen?** Nein: Forgejo setzt cwd/GIT_DIR
  server-seitig; der Pusher kontrolliert weder cwd noch GITEA_*-Env. Pfad = wo die Objekte real landen →
  korreliert zwingend mit dem zu ladenden `.allow`. Robuster als env (das gerade brach).
- **Strippen von `@recovery ` — weitet es die erlaubte Menge auf?** Nein: der Recovery-Recipient ist
  laut Spec Pflicht-Recipient JEDER Datei → er GEHÖRT in `allowed`. Strippen stellt nur her, was die Doku
  ohnehin meint. Die `recovery`-Presence-Prüfung bleibt unabhängig (separater Re-Read der `@recovery`-Zeilen).
- **Offene Frage für Schnüffi:** path vs. env als Primärquelle für REPO_KEY — soll der Hook zusätzlich
  path-gegen-env CROSS-CHECKEN und bei Divergenz fail-closed rejecten (defense-in-depth)? Aktuell: path-primär,
  env nur via Test-Override. Bei Sign-off festnageln.

## Status / Nächste Schritte
- [x] Beide Code-Fixes (BUG-1 Validator, BUG-2 Hook) + BUG-3 (Deploy-Perms) eingearbeitet.
- [x] Lokal re-verify: `oracle.sh` **22/22** grün (mit dok. @recovery-Format) — keine Regression, BUG-1 bewiesen.
- [x] Fixierte Artefakte auf LXC 160 deployt (md5 == lokal verifiziert).
- [x] **Live-Forgejo-Accept/Reject-Oracle 8/8** (reason-asserted) durch Forgejos echten Push-Pfad.
- [x] Canary-Repo + Probe-Hooks + Test-Policy aufgeräumt (HTTP 204; `planning`-Repo unberührt, null Residue).
- [ ] **Gebündelt an Schnüffi (per6ezmd): R22/R31-Cross-Refute der 3 Befunde + Fix-Diffs VOR Scharf-Schalten**
      (ich self-approve security-kritisch NICHT). + offene Frage path-vs-env-CrossCheck für REPO_KEY.
- [ ] Nach Schnüffi-Sign-off der Fixes: `hook-integrity-watch` systemd-Timer (§1.4-B4/HIGH-5) + Config-Lockdown
      (mirror/lfs/web-editor aus, procReceiveRefs absent) live verifizieren + Perf-Limits live kalibrieren.
- [ ] **§8-Landing (Operator/proxmox-master)** bleibt Gate fürs ERSTE echte Secret: op-connect weg .240,
      m-of-n Shamir-Recovery gedrillt, DVhub-Split (Brettli).

## Config-Lockdown (LXC 160, angewendet 2026-06-22, app.ini.bak-pre-lockdown gesichert)
Forgejo nach Änderung sauber neugestartet (`is-active=active`, API antwortet). Gesetzt:
| Setting | Wert | Warum |
|---|---|---|
| `[mirror] ENABLED` | `false` | 🔴 Pull-Mirror umgeht pre-receive (R1/B1) — war default-an, jetzt aus |
| `[server] LFS_START_SERVER` | `false` | LFS = Nicht-git-Content-Pfad (H1-Bypass) |
| `[security] DISABLE_GIT_HOOKS` | `true` | keine user-definierten Git-Hooks (könnten 50-secrets umgehen) |
| `[packages] ENABLED` | `false` | Package-Registry = Nicht-git-Secret-Store |
| `[attachment] ENABLED` | `false` | Attachments = Nicht-git-Content mit Secrets |
| `[repository] DISABLED_REPO_UNITS` | issues,ext_issues,wiki,ext_wiki,projects,packages,actions,releases | Nicht-Code-Units (Klartext-Kanäle) aus; Code/pulls bleiben |
- **agit/proc-receive:** `proc-receive.d/gitea` vorhanden; `refs/for/*` wird vom Hook per default-deny REJECTed
  (ref-Namespace-Check), und Objekte laufen ohnehin durch Quarantine+pre-receive VOR proc-receive → kein Bypass.
- **Offen (R6/R7-MED):** `receive.procReceiveRefs` explizit absent verifizieren je Secret-Repo (durch hook-integrity-watch
  mit abdecken). **TLS/COOKIE_SECURE** = separate Härtung (LAN/Zone, später). **Migration/Mirror-erzeugte Repos ohne
  Hook** → vom hook-integrity-watch-Backstop (HIGH-5) abgefangen (read-only bis Hook present).

## Offene Verify-Frage (nächster Live-Test, braucht Hook scharf auf einem Repo)
- **Triggert ein Forgejo WEB-EDIT / API-Content-Create den `pre-receive.d/50-secrets`?** Wenn der interne
  Schreibpfad die on-disk-Hooks umginge, wäre das ein Klartext-Leak-Loch. Muss live geprüft werden (Canary,
  nach Schnüffi-Sign-off). Default-Annahme: Forgejo-interne Pushes laufen durch dieselbe receive-pack-Maschinerie
  (Hook greift) — aber NICHT angenommen lassen, MESSEN.

## Was die Live-Oracle BEWIESEN hat (Integrations-Schicht, die das lokale oracle.sh NICHT abdeckt)
- Forgejo 15 INVOKED den `pre-receive.d/50-secrets`-Hook tatsächlich (Dispatcher iteriert .d/*) ✓
- `GIT_QUARANTINE_PATH` wird im Forgejo-Push-Pfad gesetzt → `raw_presence`/PHYS_OIDS greifen ✓
- `GIT_ALTERNATE_OBJECT_DIRECTORIES` ist gesetzt → `batch-all-objects`-Verzicht (R5/B1) war zwingend ✓
- REPO_KEY-Pfadableitung (BUG-2-Fix) löst korrekt auf `dvhub/<repo>` ✓
- YAML-Tier (pyyaml) funktioniert live ✓ · push-options werden von Forgejo advertised UND vom Hook geblockt ✓
- kein Secret-Echo in Rejects (R2/HIGH-6) ✓

## Schnüffi R22/R31-Cross-Refute der Fix-Diffs → NOT-ARM-READY → GEFOLDET (2026-06-22, reviews/2026-06-22-forgejo-gate-armfix-r22-cross-refute.md @ 544bba3)
Schnüffi + GPT-codex konvergent: meine 3 Bug-Fixes hatten eine **fail-OPEN-Klasse**. Alle 5 P0 + 2 P1 gefoldet:
- **P0-1 (kritisch):** Recovery-Presence fiel fail-OPEN — Validator las die Policy 2× (TOCTOU), der 2. Read ohne
  strip() → eingerückte/inkonsistente `@recovery`-Zeile → recovery-Set leer → `if recovery and` übersprang die
  Pflicht → Datei OHNE Recovery-Recipient (Break-Glass §1.6/M1) wäre gelandet = gebricktes Secret.
  **Fix:** SINGLE-PASS-Parser (allowed+recovery aus 1 Read, konsistent strip), `if not recovery: reject` statt skip.
- **P0-2:** REPO_KEY nicht traversal-sicher → final-validiert: exakt 2 Segmente, Segment ∉ {`.`,`..`}, safe-charset
  (das `.`-im-Regex-Charset-Loch via Whole-Segment-Verbot geschlossen).
- **P0-3:** `FORGEJO_SECRETS_REPO_KEY`-Override nur noch bei `FORGEJO_SECRETS_TEST_MODE=1` (Prod = path-only).
- **P0-4:** TOCTOU (2× Policy-Read) → Single-Pass schließt es.
- **P0-5:** echte age-Regex `^age1[0-9a-z]{58}$` für Policy- UND sops.age[]-Recipients (statt `startswith`).
- **P1-6:** Policy-Integrität erzwungen: kein Symlink, root-owned (prod), NICHT group/other-writable (`find -perm /022`),
  POLICY_DIR dito — schließt git-writable-Policy = Self-Auth-Bypass (B3).
- **P1-7:** Tier-A verbietet partial-encryption-Felder (unencrypted_suffix/regex, encrypted_suffix/regex, mac_only_encrypted) present.
- **Selbst-Catch beim Bau:** `[ ] && reject` hätte unter set-e+ERR-Trap im Gut-Fall False-Reject gefeuert → auf if-Form umgestellt.

### Re-Verify GEMESSEN (nach Fold)
- **Lokal `oracle.sh` 28/28** (22 alt + 6 neue P0-Fold inkl. fail-open-Guard: eingerückte @recovery + Envelope OHNE Recovery → REJECT).
- **Live-Oracle v2 16/16** (Forgejo echter Push-Pfad + Root-only-Integrität):
  Part A (10): SOPS-JSON/YAML/README ACCEPT; plaintext/missing-recovery/privkey/foreign-recipient/push-option/**Tier-A-unencrypted_suffix**/**malformed-age** REJECT (Gründe asserted).
  Part B (6): `../evil`→REJECT (`..`-Segment), deep-traversal→REJECT, **non-root-owned Policy**→REJECT, **group-writable Policy**→REJECT, **Symlink-Policy**→REJECT, Restore→ACCEPT.
  Kein Secret-Echo. md5 deployed==repo (hook 53e1955c.., val f8dc6d29..). Canary gelöscht, planning unberührt.
### Schnüffi-RE-Review Rest-Befund (P1-6b, Dir-Ownership-Kette) → GEFOLDET + live-verifiziert
Schnüffi verifizierte die 7 Folds zeilenweise (alle korrekt), fand 1 Rest-Befund: P1-6 prüfte die `.allow`-Datei
+ POLICY_DIR nur via `-perm /022`, aber NICHT die Dir-OWNERSHIP noch das `<owner>`-Zwischen-Dir. Ein git-OWNED
Dir ist für git schreibbar TROTZ /022 (owner-write zählt nicht in /022) → git könnte die root-owned `.allow`
löschen+ersetzen (= Invariante-#6-Klasse, Self-Auth-Bypass). **Fix:** Hook prüft jetzt die DIR-KETTE
(POLICY_DIR + `<owner>`-Dir) auf root-owned (prod) + nicht-group/other-writable + kein-Symlink.
**GEMESSEN live (Forgejo echter Push, 6/6):** baseline ACCEPT; owner-dir git-owned/group-writable/Symlink → REJECT;
base-dir git-owned → REJECT; restore → ACCEPT. Hook-md5 deployed==repo (90b421cd..).
### Schnüffi RE-Review-Runde 2 (64e4b7c, NOT-YET) → 3 Befunde GEFOLDET + live-verifiziert
Codex-Pass fand 3 Arming-Blocker (P0-1/3/4/5 waren korrekt zu):
- **Befund 1 (kritisch, fail-OPEN):** mein P1-7-Fold `if v not in (None,"",False)` ließ `unencrypted_suffix:""`
  (matcht ALLE Keys = alles Klartext) + `:false`/`:null` DURCH. **Fix:** `if fld in sops: reject` (Präsenz allein).
- **Befund 2 (TOCTOU):** Dir-Ownership war schon in cddca68; offen war shell-stat→python-read-Fenster. **Fix:**
  Validator `os.open(O_NOFOLLOW)+fstat` auf DEMSELBEN fd (Check+Read auf identischer Inode, kein Fenster; Symlink-tot).
- **Befund 3 (P0-2):** heredoc-`read` las nur Zeile 1 → `owner/repo\njunk` normalisierte still. **Fix:** case-basiert
  (`*[!A-Za-z0-9/._-]*`→Newline/Control-REJECT, `*/*/*`→>2-Segmente-REJECT, leeres/`.`/`..`-Segment-REJECT).
**GEMESSEN:** lokal `oracle.sh` **31/31** (inkl. unencrypted_suffix:""→REJECT, :false→REJECT, REPO_KEY-Newline→REJECT)
+ **Live-Oracle v3 19/19** (Forgejo echter Push: t11/t12 unencrypted_suffix-fail-open→REJECT; Part B b6 REPO_KEY-Newline→REJECT,
b4/b4b Traversal→REJECT, non-root/writable/symlink-Policy→REJECT). hook-md5 deployed==repo (5fae5f05..).
- **Status:** Arm-Fix vollständig über 2 RE-Review-Runden (P0-1..5 + P1-6/6b/7 + 3 Codex-Befunde + TOCTOU). Wartet auf
  Schnüffis finalen Sign-off → DANN Scharf-Schalt-Freigabe. §8-Landing weiter operator-gated. Parallel: Watcher-Bau (GO).
