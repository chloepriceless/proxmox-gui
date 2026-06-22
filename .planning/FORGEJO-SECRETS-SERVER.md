# Interner Forgejo Secrets-Git-Server (Fleet) — SSOT

**Owner:** vm-deployment-gui (Schraubi, Proxmox-LXC-Owner). **Auftrag:** Hub/Christin via dashboard (2026-06-22) — interner Git-Server für secret-behaftete Repos, die NICHT aufs öffentliche GitHub dürfen. **Konsumenten:** DVhub (.planning-Auslagerung), merkel-curator (Vault-Sync-Mirror), Fleet allgemein.

## Entscheidung (Deliberate, R21+R22)
- **DEDIZIERTE Instanz, getrennt vom existierenden Forgejo 153.** 153 (@pz3, .172) ist die **fleet-ansible-CI-Instanz** mit host-root-reichendem Runner (LXC 154). Secrets + Vault dort co-tenant = maximaler Blast-Radius (ein 153-Compromise ⇒ Secrets UND host-root-Ansible-Push). Brettli (dashboard) + Schnüffi (R22) beide STARK endorsed: Trennung ist zwingend, nicht optional. „EIN gemeinsamer" = EINE Secrets-Instanz für DVhub+Merkel+Fleet, sauber getrennt von der CI-Instanz.
- **Placement pz3** (6.8G frei, load 13%, Forgejo-Patterns vorhanden). `.240` (97G Headroom) AUSGESCHLOSSEN: HW-RCA (IMC-Overload, T-0247) ungelöst → instabil, kein Secrets-Server drauf.

## Base-Instanz (PROVISIONIERT + VERIFIZIERT, 2026-06-22)
- **LXC 160 `forgejo-sec` @ pz3**, unprivileged, 2c/2048M/512M-swap/20G (local-lvm), net0 vmbr0 **DHCP 192.168.20.59**, onboot=1, nesting=0.
- **Forgejo v15.0.3** (`+gitea-1.22.0` API-compat, go1.26.4). **sha256 == offizielle codeberg-Release** (`3218dc54…`, unabhängig verifiziert — AUTHENTIC, nicht zirkulär).
- **Web:** http://192.168.20.59:3000 · **SSH-clone-Port:** 2222 (Forgejo-built-in SSH, `ssh://git@192.168.20.59:2222/<org>/<repo>.git`).
- **Gehärtetes app.ini:** `DISABLE_REGISTRATION=true`, `REQUIRE_SIGNIN_VIEW=true`, `DEFAULT_PRIVATE=private`, `[actions] ENABLED=false` (kein CI auf der Secrets-Instanz — Schnüffis wichtigste Einzelkontrolle), `INSTALL_LOCK=true`, `MIN_PASSWORD_LENGTH=16`, alle SECRET-Felder gesetzt, OpenID aus, SQLite.
- **systemd `forgejo.service` enabled+active** (Backup-Reboot-Resilienz).
- **Admin `fleetadmin`** + API-Token: root-only auf pz3 (`/root/.forgejo160-admin-pw`, `/root/.forgejo160-admin-token`, chmod 600) — NICHT committed, NICHT im LXC. **Crown-Cred** → vor produktivem Einsatz: 2FA, keine stehende Session, Token rotieren.
- **Orgs angelegt (private):** `dvhub`, `merkel-vault` (isoliert, je eigene Schreibrechte). **Repo:** `dvhub/planning` (private, leer).

## 🔒 R22-GATE (Schnüffi, per6ezmd) — Secrets-Onboarding BLOCKIERT bis:
Volldoc: `orchestrator-security/reviews/2026-06-22-secrets-forgejo-hardening-lens.md` (commit bed6212). Reversible Basis ist endorsed; **VOR dem ersten Secret-Landing (irreversibel)** müssen stehen:
1. **🔴 SOPS+age at-rest (LOAD-BEARING).** PBS-Encryption schützt NUR das Backup; Live-Secrets liegen KLARTEXT auf der Forgejo-Disk (Git-Repos + DB) → Forgejo-RCE/Admin-Cred-Diebstahl/LXC-Escape liest sie direkt. → Secrets MÜSSEN content-level verschlüsselt sein, BEVOR sie die Disk treffen; Key off-host. **SOPS+age** (per-Recipient = least-privilege by construction; besser als git-crypt). Schichtung: SOPS at-rest (trägt) → Forgejo-ACL → PBS.
2. **🔴 Bootstrap-Credential-Rekursion.** Der Forgejo-Auth-Token UND jeder age-Privkey sind SELBST Secrets. Plaintext im Agent-Env/Repo = Sprawl nur verschoben. → **1Password-Runtime-Broker (T-0206) ODER Deploy-Zeit-Injektion, NIE committed.** Ohne das ist der Rest kosmetisch.
3. **Kombinierter Codex-Refute** aufs konsolidierte Modell + **Schnüffi-Sign-off**. Default=BLOCK bis dahin.

## Access-Modell (Design — Creds erst nach §1+§2)
- **Pro Konsument eigene Org + eigener Account/Deploy-Key**, least-privilege: DVhub schreibt nur `dvhub/*`, merkel-curator nur `merkel-vault/*`.
- **Auth:** scoped read-only PATs ODER besser **per-Repo Deploy-Keys** (kein account-weiter Token). Admin-Account = Krone (2FA, no standing session).
- **Vault-Sync (d):** merkel-curator verschlüsselt den Vault mit SOPS/age (recipients = Konsumenten-Pubkeys) VOR dem push → Klartext landet NIE auf Forgejo-Disk. Curator hält Klartext + Pubkeys (encrypt-only); Konsumenten halten ihren Privkey off-Forgejo.

## Offene Härtung (mit dem SOPS-Modell, dann Codex-Refute)
- **TLS auch im LAN** (LAN ist KEINE Trust-Boundary — Token/Ciphertext sonst sniffbar). Caddy/reverse-proxy oder Forgejo-TLS + interne CA.
- **LXC-Egress default-deny** (Forgejo-Server braucht ~0 outbound außer NTP/DNS → kein Exfil-Pivot).
- **Webhooks AUS** (SSRF/Exfil-Kanal), unused Features aus (Package-Reg/Web-Editor/Issues/OAuth), age-Key-Escrow getrennt (verlorener Key = Brick), Audit append-only.
- **DHCP → statische IP/Reservierung** (Netzi) — Server-Stabilität über Backup-Reboots (sonst brechen clone-URLs). Wie protectbridge-Advisory.
- **CVE/Threat-Watch:** Schnüffi nimmt die Secrets-Instanz in ihren CVE-Scan auf (Forgejo gepinnt+gepatcht halten).

## NÄCHSTE SCHRITTE (autonom, gating-Pfad)
1. ✅ **DONE (2026-06-22):** konsolidiertes SOPS+age-at-rest + Bootstrap-Cred-Modell → **`.planning/FORGEJO-SECRETS-SOPS-MODEL.md`**. Refute-Round-1 (R26 fresh-context Claude-Lens) gefoldet: 4 BLOCKER + 5 HIGH + 3 MED (Pull-Mirror umgeht Hook, SOPS-partial-encryption, self-authorizing Recipient-Policy, Hook-Survival, Non-Git-Speicher/LFS, op-connect-Flaky-Node u.a.) — alle eingearbeitet.
2. ⏳ **IN ARBEIT:** Schnüffis GPT-codex-Lens (2. konvergente Lens, R22) auf die R1-gefoldete Fassung → ihr Sign-off. Default=BLOCK bis dahin.
3. TLS + Egress-deny + Webhooks-off + Feature-Trim umsetzen (Härtung).
4. Per-Konsument Deploy-Keys/Org-ACL (nach Bootstrap-Cred-Modell).
5. Green-Light + SOPS-Workflow an Brettli/DVhub/merkel-curator → erste (SOPS-verschlüsselte) Secrets landen.
6. Statische IP via Netzi.

## Delivery-Status
- An Brettli/dashboard geliefert: Base-URL + clone-target + Orgs. **Klar gegated: KEINE Klartext-Secrets pushen bis SOPS-Workflow + Sign-off.**
