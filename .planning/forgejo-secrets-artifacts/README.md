# Forgejo-Secrets — Implementierungs-Artefakte (Bau-Runbook)

**Spec/SSOT:** `../FORGEJO-SECRETS-SOPS-MODEL.md` (R1–R7-gefoldet, **Schnüffi R8-SIGN-OFF @ 48d16c7**, gescoped: Spec/Modell, NICHT Landing).
**Base:** LXC 160 `forgejo-sec` @ pz3 (192.168.20.59:3000, SSH-clone :2222).
**Status:** REVERSIBLER Bau (Schnüffi-autorisiert). **Kein echtes Secret vor grünem LIVE-§7-Oracle + §8.**

## Gebaut (Static-Checks + Validator-Smoke grün)
- **`pre-receive-secrets.sh`** — Tier-A default-encrypt-all Hook. Kodiert §1.4: push-options-Block, ref-Typ-default-deny + Refname-Scan, **`raw_presence`** (rohe Datei-Präsenz, unabhängig vom OID-Parse — R7), konditionale Non-Vacuity (raw_presence && count==0 → REJECT), **PHYS_OIDS** aus loose `[0-9a-f][0-9a-f]/*` ∪ pack `*.idx` via `show-index` (NIE `batch-all-objects` — R5/B1), Typ-Scan commit/tag/tree(`ls-tree -rz`)/blob, Privkey-Detektor, push-cert-in-PHYS_OIDS, Perf-Limits, **fail-closed via `trap ERR`/`set -euo pipefail`**, REJECT-ohne-Secret-Echo. → `bash -n` OK.
  - **broken-enum (R7/Schnüffi):** `.pack` ohne lesbares `.idx` ODER `show-index`-Fehler → REJECT (Enumeration kaputt, nicht „Ref-only").
- **`sops-envelope-validate.py`** — strikter Parser (MED-7: JSON, oder yaml.safe_load mit duplicate-key/Anchor/Merge-REJECT). Erzwingt: Voll-ENC[] jeder Leaf (R1/B2), nur native age (pgp/kms/…/`key_groups` REJECT, `shamir_threshold` absent/0 — R2/B2+R4/B3), **rekursive Schema-Whitelist** (`sops.age[]` exakt `{recipient,enc}` — R5/HIGH-1), Recipient-Containment gegen admin-Policy + Recovery-Pflicht (R1/B3+M1). → `py_compile` OK; **9/9 Smoke-Fälle grün** (1 ACCEPT + 8 REJECT, JSON-Pfad).

## Deploy-Deps (LXC 160) — vor Live-Build
- **`python3-yaml` (pyyaml)** installieren (Hook fail-closed't sonst auf YAML-Dateien — by design, aber YAML-Tier-A braucht es). JSON-Pfad braucht es nicht.
- **`gitleaks`** für Tier-B-Entropy-Scan (Tier-A nutzt den strukturellen SOPS-Zwang; gitleaks optional härtend).
- Hook → `<repo>.git/hooks/pre-receive.d/50-secrets` (0755, root-owned); Validator → `/usr/local/lib/forgejo-secrets/`.
- admin out-of-band Policy → `/etc/forgejo-secrets-policy/<org>/<repo>.allow` — **root-owned, Mode `0644`** (oder `0640 root:git`) — der Hook+Validator laufen als User **git** und MÜSSEN sie LESEN; „root-only" meint nur root-WRITABLE (Inhalt = age-**Public**-Recipients, nicht geheim). Dirs `0755` (git-traversierbar). **`chmod 600` bricht JEDEN Push fail-closed** (BUG-3, LIVE-ORACLE-FINDINGS.md). Format: eine `age1…`-Zeile je erlaubtem Recipient; der Recovery-Recipient als EINE Zeile `@recovery age1…` (gewährt UND markiert — Validator strippt den Prefix).
- `[security] DISABLE_GIT_HOOKS=true`, `[mirror] ENABLED=false`, `[lfs] ENABLED=false`, Issues/Wiki/Attachments/Packages/Web-Editor aus, **`receive.procReceiveRefs` absent verifizieren** (R6/R7-MED).

## Gebaut — `hook-integrity-watch` (2026-06-22, Codex-R22 R1+R2 gefoldet, Oracle 31/31)
- **`hook-integrity-watch.sh`** (systemd oneshot `hook-integrity-watch.service` + 60s-`.timer`, beide
  enabled): Backstop-DETEKTOR + VERIFIER je Secret-Repo. Invarianten #1-#9: Dispatcher (exist/exec/
  iteriert-pre-receive.d/root-owned), 50-secrets (exist/exec/sha==golden/root-owned), Hook-DIRS +
  repo.git/config root-owned + **chattr-immutabel** (inv #9, Race-Schließung), `core.hooksPath` +
  `receive.procReceiveRefs` absent (inkl. `--includes`-Kette + Origin-Integrität), git-user-global config.
  Bei VIOLATION: **authoritativer** top-level deny-all (verifiziert) + Redirect-Neutralisierung + Marker +
  journald + Uptime-Kuma-Push. Global-Bypass → source-neutralize + LOCK-ALL (exit3). Lockdown-Fehlschlag
  → exit4 (Kuma "REPOS EVTL. OFFEN"). Config-Bruch → alarm-only (exit2). REJECT echoet NIE einen Secret-Wert.
- **`hook-integrity-watch-oracle.sh`** — 31/31 grün TEST_MODE. **Immutabilität/Root-Ownership/ACL = prod-only**
  (separater LIVE-Canary-Lauf als root auf LXC 160). Design+Arm-Gate: `HOOK-INTEGRITY-WATCH-DESIGN.md`.
- **OFFEN (Schnüffi R22-Arm-Gate):** Enforcement-Modell (A chattr [gewählt] vs. B git-Wrapper) + Forgejo-
  Immutabilitäts-Toleranz live verifizieren + Deploy-Runbook (chattr +i, regenerate-as-root, Kuma-Monitor).

## Noch zu bauen (nächste Schritte)
2. **Oracle-Harness** (`oracle.sh`) — §7, 7 Kriterien + **20-Punkt-Negativ-Matrix a–t**, mit echten Fixtures (`git pack-objects`+`receive-pack`):
   - Krit.7 load-bearing: (a) objekttragend count>0, (b) **Positiv-Kontrolle** unreachable-bad-blob+push-cert in PHYS_OIDS→REJECT, (c) legit Null-Objekt-Push passt + Secret-Refname geblockt, (d) **broken-enum** — BEIDE Fälle: Glob künstlich 0 UND realistisch `.pack` present/`.idx` fehlt-korrupt → raw_presence=true + REJECT (Schnüffi-Hint).
   - G1-Vollplatten-grep (journald/WAL/swap/coredump/`cat-file --batch-all-objects`), G2/G3/B4-Vault-403/Break-Glass-Drill (m-of-n-Rekonstruktion).
3. ✅ **Deploy auf LXC 160 + LIVE-Oracle mit Canary-FAKE-Secret** — DONE 2026-06-22: **8/8 reason-asserted** durch Forgejos echten Push-Pfad; fing 3 Integrations-Bugs (BUG-1 Recovery-Containment, BUG-2 REPO_KEY-env, BUG-3 .allow-Perms), alle gefixt. Gemessene Zahlen + Fix-Diffs → `LIVE-ORACLE-FINDINGS.md`. **Wartet auf Schnüffi R22/R31-Cross-Refute der Fixes VOR Scharf-Schalten.**
4. **Perf-Limits live kalibrieren** am echten LXC-160-Durchsatz (R7-MED).

## §8 (Operator/proxmox-master — blockt nur das ERSTE echte Secret, nicht den Bau)
- op-connect **weg von .240** (T-0247-Flaky-Node) — stabiler Node / 2. Connect-Instanz.
- Recovery-Custody **m-of-n Shamir** konkret (Medium+Custodians+Schwelle) + **Rekonstruktion gedrillt**.
- DVhub Tier-A-`dvhub/secrets`-Split-Entscheid (Brettli).
