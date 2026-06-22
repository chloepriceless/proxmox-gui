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

## Was die Live-Oracle BEWIESEN hat (Integrations-Schicht, die das lokale oracle.sh NICHT abdeckt)
- Forgejo 15 INVOKED den `pre-receive.d/50-secrets`-Hook tatsächlich (Dispatcher iteriert .d/*) ✓
- `GIT_QUARANTINE_PATH` wird im Forgejo-Push-Pfad gesetzt → `raw_presence`/PHYS_OIDS greifen ✓
- `GIT_ALTERNATE_OBJECT_DIRECTORIES` ist gesetzt → `batch-all-objects`-Verzicht (R5/B1) war zwingend ✓
- REPO_KEY-Pfadableitung (BUG-2-Fix) löst korrekt auf `dvhub/<repo>` ✓
- YAML-Tier (pyyaml) funktioniert live ✓ · push-options werden von Forgejo advertised UND vom Hook geblockt ✓
- kein Secret-Echo in Rejects (R2/HIGH-6) ✓
