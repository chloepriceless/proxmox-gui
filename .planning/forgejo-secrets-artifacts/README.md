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
- admin out-of-band Policy → `/etc/forgejo-secrets-policy/<org>/<repo>.allow` (root-only, eine `age1…`-Zeile je erlaubtem Recipient; Recovery-Zeile mit Prefix `@recovery `).
- `[security] DISABLE_GIT_HOOKS=true`, `[mirror] ENABLED=false`, `[lfs] ENABLED=false`, Issues/Wiki/Attachments/Packages/Web-Editor aus, **`receive.procReceiveRefs` absent verifizieren** (R6/R7-MED).

## Noch zu bauen (nächste Schritte)
1. **`hook-integrity-watch`** (systemd-Timer, §1.4-B4): minütlich sha256+exec-bit des Hooks + Haupt-`pre-receive` je Secret-Repo; Drift → Repo/Instanz read-only + Alarm; **neue/umbenannte Repos ohne Hook** read-only (HIGH-5-Backstop). + **real auslösen** nach `forgejo admin regenerate hooks`/Upgrade (R7-MED).
2. **Oracle-Harness** (`oracle.sh`) — §7, 7 Kriterien + **20-Punkt-Negativ-Matrix a–t**, mit echten Fixtures (`git pack-objects`+`receive-pack`):
   - Krit.7 load-bearing: (a) objekttragend count>0, (b) **Positiv-Kontrolle** unreachable-bad-blob+push-cert in PHYS_OIDS→REJECT, (c) legit Null-Objekt-Push passt + Secret-Refname geblockt, (d) **broken-enum** — BEIDE Fälle: Glob künstlich 0 UND realistisch `.pack` present/`.idx` fehlt-korrupt → raw_presence=true + REJECT (Schnüffi-Hint).
   - G1-Vollplatten-grep (journald/WAL/swap/coredump/`cat-file --batch-all-objects`), G2/G3/B4-Vault-403/Break-Glass-Drill (m-of-n-Rekonstruktion).
3. **Deploy auf LXC 160 + LIVE-Oracle mit Canary-FAKE-Secret** → gemessene REJECT/PASS-Zahlen je Sub-Test an Schnüffi (per6ezmd/l3hcyv1x) zum R31-Review, BEVOR ein echtes Secret landet.
4. **Perf-Limits live kalibrieren** am echten LXC-160-Durchsatz (R7-MED).

## §8 (Operator/proxmox-master — blockt nur das ERSTE echte Secret, nicht den Bau)
- op-connect **weg von .240** (T-0247-Flaky-Node) — stabiler Node / 2. Connect-Instanz.
- Recovery-Custody **m-of-n Shamir** konkret (Medium+Custodians+Schwelle) + **Rekonstruktion gedrillt**.
- DVhub Tier-A-`dvhub/secrets`-Split-Entscheid (Brettli).
