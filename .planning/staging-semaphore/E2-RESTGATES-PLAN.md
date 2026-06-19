# T-0116/E2 Exec-Key — Restgates Design-before-Build-Plan (G3/G5/G2 b–e)

**Erstellt:** 2026-06-20 ~00:30 Berlin · **Autor:** vm-deployment-gui (Schraubi, Infra-LEAD)
**Status:** PLAN (nacht-sicher geschrieben) — Execution = WACHES TAGESFENSTER + Codex-Refute vor jedem prod-facing Schritt + Christin-Cutover-GO.
**Leitplanke:** Kein Midnight-Slam an Live-Patch-Infra (mit Frischi/Schnüffi abgestimmt, von Christin/Hub bestätigt). Dieser Plan ändert NICHTS prod-facing — er ist Recon + Sequenz.

## Kontext / Verdikt-Stand
- Schnüffi (R22, Codex-refuted) Final-Verdikt **GO-TO-BUILD**; host-reichender Deploy **BLOCK** bis alle Gates grün + Christin-GO. Review-Doc Forgejo 118f388.
- E2 = 2. repo-getriggerter Caller; E1 (.174, LXC 155@pz3) hat bereits identische root-äquiv. sudoers → keine NEUE Root-Reichweite, aber neuer Trigger-Pfad → muss eingezäunt werden.
- Peers: Schnüffi=069v6usj, Frischi=gt5924az/updates, Netzi=orchestrator-network, Hub=07lvalhu.

## Topologie (verifiziert 2026-06-20)
- **Semaphore:** LXC **150 @ pz3**, bind 192.168.20.176:3000, Docker, DB `/opt/semaphore/data/database.sqlite`. Image v2.18.12 (gepinnt), KEIN docker.sock-Mount, minimale Mounts (data+config). Zugang `pct exec 150` via pz3 .106 (orchestrator_ed25519).
- **Forgejo:** LXC 153 @ pz3, Service-IP **192.168.20.172:3000**. forgejo-runner = LXC 154 @ pz2.
- **ansible-control / E1:** LXC 155 @ pz3 (.174), nur sshd.
- **fleet-ansible Repo:** `http://192.168.20.172:3000/frischi/fleet-ansible.git`.

## ✅ G2(a) ERLEDIGT (2026-06-17, verifiziert)
Branch-Protection `main` auf frischi/fleet-ansible (Forgejo 153): enable_push=false (PR-only), required_approvals=1, block_on_rejected_reviews, dismiss_stale_approvals, protected_file_patterns=bootstrap*/sudoers*/inventory*/ansible.cfg/playbooks/roles. PR #1 (feat/e2-g7-wrapper-g1-keylist) läuft durchs Gate.

---

## G2(b) [HART] — Immutable SCM-Ref statt floating main
- **IST (verifiziert):** `project__repository` id=1 fleet-ansible, **git_branch = `main`** (floating, auto-pull) → JEDER gemergte main-Commit landet sofort im nächsten Lauf. Das ist genau das Risiko.
- **SOLL:** Semaphore zieht eine **immutable, approved Ref** (signierter/approved Tag, z.B. `approved-YYYYMMDD` oder Release-Tag), NICHT floating main. Pin-Bump nur via expliziten Approval-Schritt.
- **Steps (Tagesfenster, mit Frischi):**
  1. Frischi taggt den approved ansible-Stand (Tag-Konvention abstimmen; signiert bevorzugt).
  2. Semaphore-Repo umstellen: `project__repository.git_branch` → Tag (UI/API; NICHT roh in DB schreiben während Betrieb — über Semaphore-API/UI mit Re-Validate).
  3. Prozess: neuer approved Tag = bewusster Pin-Bump (kein Auto-Pull von main).
- **Acceptance:** Semaphore git_branch != `main`; ein frischer Push/Merge auf main ändert NICHT, was der nächste Lauf ausführt (Negativprobe: main bewegen → Semaphore-Lauf nutzt weiter den gepinnten Tag).
- **Rollback:** git_branch zurück auf `main`.
- **Dep:** Frischi (Tagging). **Codex-Refute vor Umsetzung.**

## G2(c) [HART] — Trigger-Scope: nur non-admin frischi + Token
- **IST:** Recon-at-execution — `user`/`project__user`-Tabellen + Projekt-Rollen prüfen (aktuell 1 admin-User aus Migration). Noch KEIN scoped frischi-User.
- **SOLL:** scoped Semaphore-User `frischi` (Member von Projekt fleet-patch, **NICHT** admin) + API-Token (→ NetBoard). Nur diese Identität triggert die host-reichenden Templates. Transport via `pct exec 150` (localhost, KEIN FW-Aufweichen für Workspace-IP).
- **Steps (Tagesfenster):** User anlegen (non-admin), Projekt-Membership fleet-patch, API-Token erzeugen → NetBoard. Verknüpft mit Frischi-Zugang aus Migrations-Task.
- **Acceptance:** frischi-User ist non-admin (kann keine Templates/Keys/Repos global ändern), kann die fleet-patch-Templates triggern; admin-Token bleibt getrennt verwahrt.
- **Rollback:** User/Token deaktivieren.
- **Dep:** koordiniert mit Frischi-Zugang. Lege ich an, wenn Schnüffi Exec-Key GOt.

## G2(d) [HART] — Kein unattended Auto-Trigger
- **IST (verifiziert):** `project__schedule` = **LEER** (kein Cron), `project__integration` = **0** (kein Webhook). → **bereits erfüllt.**
- **SOLL:** Zustand HALTEN + sperren: kein Cron/Webhook auf host-reichende Templates ohne Human-Approval.
- **Steps:** Assertion dokumentieren; optional periodischer Audit-Check (schedule/integration count == 0 für host-reichende Templates) — ggf. an Kuma/Monitoring koppeln.
- **Acceptance:** schedule leer + integration 0 (monitorbar). Negativ: ein versehentlich angelegter Schedule wird sichtbar/alarmiert.
- **Rollback:** n/a (Zustand halten).

## G2(e) [HART] — requirements.yml pin + vendor
- **IST:** Recon-at-execution — prüfen ob fleet-ansible `requirements.yml` hat + ob roles/collections gepinnt sind (Versionen) oder floating. (Über Frischi/Forgejo-Token, Repo ist privat → anon 403.)
- **SOLL:** alle externen roles/collections auf Versionen pinnen + **vendoren** (in-repo), damit kein floating Galaxy-Pull zur Laufzeit. CI-Guard.
- **Steps (Tagesfenster, mit Frischi):** requirements.yml-Versionen pinnen, vendoren, CI-Check der Pins. Kein Inventory/Deps-Wechsel bis G2(e)+G6 grün.
- **Acceptance:** requirements.yml hat exakte Versions-Pins; Lauf zieht KEINE unkontrollierten Galaxy-Updates.
- **Dep:** Frischi (Repo-Owner). **Codex-Refute vor Umsetzung.**

---

## G3 [HART] — Literaler Source-IP-Capture (.176 am Canary)
- **IST:** Mechanismus verifiziert (d3bc19a): Container→MASQUERADE→eth0 .176, Ziel sieht .176. Akzeptanz fehlt noch: **echter Canary-Log zeigt .176** beim ersten echten Connect.
- **Steps (Tagesfenster):**
  1. Canary-Target bereitstellen (Wegwerf-LXC/VM, isoliert, sshd mit `LogLevel VERBOSE` + ggf. `tcpdump`-Mitschnitt). Canary-Provisioning ist NICHT-prod-facing (isolierte neue Box) → kann vorbereitet werden.
  2. Aus Semaphore eine **Dry-Task** gegen den Canary fahren (SSH-Connect), die Quelle am Canary mitschneiden.
  3. **Acceptance: Canary sshd-Log/tcpdump zeigt saddr .176.**
  4. Danach E2-Keypair minten (ed25519, Kommentar/from=.176), Pubkey an Frischi → er pinnt E1 .174 + E2 .176 in canary-group_vars.
- **G4-Auflage:** Private-Key bleibt im Semaphore-Key-Store, **KEIN NetBoard-Cleartext-Backup** — regenerate-statt-backup.
- **Pin schützt NICHT gg. Runner-Compromise → dafür G5.**

## G5 [HART] — Runner-Egress-Allowlist
- **IST (verifiziert):** FW `semaphore-fw.service` (LXC 150) regelt **INGRESS** (DOCKER-USER: /24+WG→:3000 allow, sonst drop; INPUT: SSH LAN/WG allow, sonst drop; v6 off). **EGRESS ist aktuell UNRESTRICTED** (output/forward policy accept, keine Egress-Allowlist). Image v2.18.12 gepinnt ✓, kein docker.sock ✓, minimale Mounts ✓.
- **SOLL:** Egress des Semaphore-/Job-Containers auf **NUR** SCM (Forgejo 192.168.20.172:3000) + Ziel-Hosts (Canary/Fleet auf tcp/22) beschränken; alles andere drop. Verhindert Exfil/Lateral-Movement bei Runner-Compromise.
- **Steps (Tagesfenster, mit Netzi/host-nftables):** Egress-Allowlist in der FW (OUTPUT/FORWARD bzw. DOCKER-USER egress-Richtung): erlaube established/related, DNS (intern), Forgejo .172:3000, Ziel-Hosts:22; drop+log Rest. In `semaphore-fw.sh` IP-agnostisch ergänzen (Skript-Anker `.planning/staging-semaphore/semaphore-fw.sh`).
- **Acceptance:** aus einem Job heraus: Connect zu SCM+Ziel-Host = OK; Connect zu Off-List-Host (z.B. 1.1.1.1:443 / beliebige LAN-IP:80) = **gedroppt** (Negativprobe + FW-DROP-Log).
- **Rollback:** Egress-Regeln entfernen (zurück auf accept) — FW-Skript-Revert + reload.
- **Dep:** Netzi (host-nftables-Abstimmung). **Codex-Refute vor Umsetzung.**

---

## Execution-Reihenfolge (Tagesfenster)
1. **Codex-Refute auf DIESEN Plan** (R22, prozess-/sicherheitskritisch) — Refute-Prompt, Schwachstellen vor jeder prod-facing Aktion.
2. G3 Canary-Capture (.176) → E2-Keypair mint → Pubkey an Frischi → koordinierter Canary-Deploy (E1-Erhalt-Beweis + Negativproben) → Schnüffi approved PR #1.
3. G2(b) SCM-Pin + G2(c) scoped frischi-User + G2(e) requirements.yml-Pin (mit Frischi) + G2(d) Assertion/Monitor.
4. G5 Egress-Allowlist (mit Netzi) + Negativprobe.
5. **Christin-Cutover-GO** → host-reichender Exec-Key-Deploy + scoped User live.

## Backup vor prod-facing Schritten
- Vor FW-Änderung (G5): `nft list ruleset > /root/fw-backup-<ts>.nft` auf LXC 150.
- Vor Semaphore-DB/Config-Änderung (G2 b/c): Semaphore stop + `integrity_check` + tar /opt/semaphore (wie im Migrations-Cutover bewährt).
- Alles reversibel halten; Rollback je Gate oben dokumentiert.

## Offene Recon-at-execution (vor Umsetzung kurz prüfen)
- G2(c): Semaphore `user`/`project__user`-Rollen + ob scoped frischi-User schon existiert.
- G2(e): fleet-ansible requirements.yml Existenz + Pin-Zustand (Frischi/Forgejo-Token).
