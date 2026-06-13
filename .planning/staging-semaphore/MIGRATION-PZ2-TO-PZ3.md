# Semaphore-Migration pz2(157) → pz3 — Design-vor-Build (R22/R26, Christin-GO via Hub 2026-06-13)

**Auftrag:** Christin-GO (Hub-routed): Semaphore VON pz2 WEGMIGRIEREN (pz2 = reserviert für persistente Flotte,
T-0204-Szenario-R-konsistent). KEIN Greenfield/Duplikat — **Verlagerung** der bestehenden LXC 157. Danach 157
stoppen (reversibel); 157-DESTROY = Go/No-Go an Christin (irreversibel). Live-Flotte/pz2-Reservierung unberührt.

## Ist-Zustand (gemessen 2026-06-13 ~21:45)
- **157 @ pz2/.42, IP .176, mem 3072, onboot, NICHT HA.** Semaphore `semaphoreui/semaphore:v2.18.12` (Docker).
- **Kompletter State in `/opt/semaphore/`:** `docker-compose.yml` (bind `192.168.20.176:3000`, vols `./data:/var/lib/
  semaphore` + `./config:/etc/semaphore`), `.env` (SEMAPHORE_ADMIN_PASSWORD + **SEMAPHORE_ACCESS_KEY_ENCRYPTION**),
  `config/config.json` (336B), **`data/database.sqlite` (598KB)** = Projekt fleet-patch(1) + 3 Templates + git-SCM
  (svc-ansible-Token, **verschlüsselt mit ACCESS_KEY_ENCRYPTION**) + admin.
- **DR-Backup:** ACCESS_KEY_ENCRYPTION in NetBoard (id 4aa367d1), Admin-Cred (id 2b6c45ae). Beide roundtrip-verifiziert.
- **pz3 (.106):** RAM avail 6957 MB, 4c, local-lvm 330G frei, nextid 150. Hält Forgejo 153 + ansible-control 155.

## Design-Position (gewählt): Lift-and-Shift des /opt/semaphore-Trees + SELBE .env, IP .176 am Cutover erhalten
| Punkt | Entscheidung | Begründung / verworfen |
|---|---|---|
| Migrate vs. fresh-connect | **Migrate** (ganzes `/opt/semaphore/` kopieren) | State ist self-contained (compose+env+config+sqlite). Selbe Image-Version v2.18.12 + selbe ACCESS_KEY_ENCRYPTION → verschlüsselte Secrets (svc-ansible-Token, Keys) bleiben decryptbar. Erhält Frischis Projekt/Templates 1:1 (kein Re-Setup). Fresh-connect = Fallback nur falls Migration scheitert. |
| Verschlüsselung | **SELBE `SEMAPHORE_ACCESS_KEY_ENCRYPTION`** mitnehmen (aus 157-`.env`, NetBoard als Quelle der Wahrheit) | Anderer Key ⇒ alle DB-Secrets unentschlüsselbar (git-SCM-Token tot, Keys tot). DR-kritisch. |
| Node | **pz3** (vorgegeben) | bündelt CI-Infra (Forgejo 153 + ansible-control 155), 6,9G Headroom (pz1 nur 3G). |
| IP | **.176 BEHALTEN**, am Cutover auf neue LXC umziehen | hält Frischis E2 from=.176-Pin + FW-Allowlist + ACL + NetBoard-Tile stabil → minimaler Blast-Radius, keine Pin-/FW-Re-Verdrahtung. Während Build/Verify **temp-IP** (kein .176-Konflikt mit laufender 157). |
| Verify-Phase-Bind | compose temporär **127.0.0.1:3000** (loopback) auf neuer LXC | verifiziert App+DB+Migration via `pct exec curl 127.0.0.1` OHNE LAN-Exposure/IP-Konflikt, BEVOR 157 angefasst wird (verify-before-disrupt). |
| vmid | nextid **150** (vorher ping/Status-Check; war alte Deploytest-Fixture, destroyed) | atomar-Check gegen VMID-Race (PITFALLS #6). |
| Container | Debian-12 unpriv + nesting=1,keyctl=1, 2c/**3G**/20G local-lvm, onboot, tags infra;semaphore | identisch zum bewährten 157/DESIGN.md-Pattern, nur Node=pz3. 3G = Ist von 157. |
| FW | semaphore-fw-Pattern (DOCKER-USER LAN+WG:3000, INPUT-DROP, IPv6 aus, Before=docker.service) auf .176 am Cutover | identisch zu 157; R22-refuted Pattern. |

## Sequenz (reversibel bis „157 stoppen")
1. **Provision** LXC 150 @ pz3, temp-IP (ping-frei), Docker (offizielles apt-repo, hello-world-R31).
2. **Migrate**: `/opt/semaphore/` von 157 → neue LXC (tar via pz2-host → scp pz3-host → `pct push` → extrahieren; Secrets
   nur über Fleet-Netz/Key, NIE git/chat). Owner/Perms erhalten (data/config = uid 1001).
3. **Bring-up Verify-Phase**: compose-bind temporär 127.0.0.1, `docker compose up -d`.
4. **Verify (R31, Migration-Oracle):** login (admin/NetBoard) → `/api/projects`==fleet-patch · `/api/project/1/templates`==3
   · **git-SCM-Token decrypt-Test**: dry-check-Task klont fleet-ansible (beweist ACCESS_KEY_ENCRYPTION-Migration ok;
   scheitert NUR am Exec-Key wie auf 157 = identisches Verhalten). Oracle VOR dem Cutover.
5. **CUTOVER** (kurze Semaphore-Downtime, ok — kein Live-Patch läuft): 157 **stoppen** (`pct stop 157`, reversibel, IP .176
   frei) → neue LXC IP→.176 (`pct set 150 -net0 ...,ip=192.168.20.176/24`) + compose-bind→.176 → **FW deployen** → restart
   → **Verify auf .176 von LAN** (HTTP-Login + ss-Bind-Check nicht 0.0.0.0 + Negativ-Source).
6. **Melde** Node/IP/Login/Status an Hub. Frischi verdrahtet E2 auf der finalen .176-Instanz (unverändert).
7. **157-DESTROY**: NICHT autonom. Go/No-Go-MC an Christin (irreversibel). Bis dahin 157 gestoppt = reversibler Rollback.

## Rollback je Phase
- Vor Cutover: neue LXC einfach löschen (157 läuft durch, null Impact).
- Cutover scheitert (Verify-FAIL auf .176): neue LXC IP weg/stop → `pct start 157` (zurück auf alte .176-Instanz),
  Migration debuggen. 157 bleibt der lebende Fallback, bis Christins Destroy-GO.

## Cross-Lab Codex-Refute (gpt-5-codex, 2026-06-13) — Amendments M-A1..M-A11
Roh-Evidenz: `MIGRATION-CODEX-REFUTE.md`. 11 Findings; härten v.a. die Verify-Oracles + den Cutover. Eingearbeitet:

**M-A1 [CRITICAL] SQLite-WAL-Konsistenz.** `docker compose stop` allein beweist KEINEN WAL-Checkpoint — SQLite im
WAL-Modus hält jüngste Commits in `database.sqlite-wal`; nur `database.sqlite` kopieren = Datenverlust. → Nach
sauberem Container-Stop: `sqlite3 data/database.sqlite 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA integrity_check;'`,
dann das GANZE `data/` (inkl. evtl. `database.sqlite-wal/-shm`) mit `tar --numeric-owner` archivieren; **nach Restore
`PRAGMA integrity_check` == ok + erwartete Row-Counts prüfen VOR App-Boot.**
**M-A2 [CRITICAL] Decryption-Beweis härten.** „Clone klappt, scheitert nur am Host-Connect" beweist die Token-
Entschlüsselung NUR, wenn der Clone AUTHENTIFIZIERT war (privates Repo, kein anon/cache). → **VORHER prüfen, dass
`frischi/fleet-ansible` PRIVATE ist** (sonst klont's anonym = kein Beweis); dann beweist der erfolgreiche git-Fetch
im dry-check-Task-Log (authentifiziert via svc-ansible-Token) die Migration. + **Laufzeit-Check:** der Container sieht
wirklich den erwarteten ACCESS_KEY_ENCRYPTION-Wert (env im laufenden Container == NetBoard), nicht nur „.env existiert".
**M-A3 [HIGH] Admin-Re-Bootstrap.** Neue Instanz bootet mit SEMAPHORE_ADMIN_PASSWORD-env + migrierter DB (admin schon
drin) → evtl. PW-Reset/Duplikat/Re-Init. → **Pre/Post-Vergleich:** user-/project-/template-Counts vor (157) und nach
(150) Migration identisch; admin-Login klappt. (PW ist identisch aus selber .env → Reset wäre harmlos, aber Re-Init/
Count-Drift NICHT.)
**M-A4 [HIGH] FW/Boot-Order-Race am Cutover.** Docker startet evtl. vor der FW-Unit → :3000 kurz offen, ODER FW vor
Docker-Chains → kaputte Allowlist. → **FW schon auf der temp-IP installieren+enablen + Persistenz prüfen, DOCKER-USER
existiert, dann Cutover; Reboot-Probe der LXC150 VOR „done"** (Allow+Deny nach Cold-Boot messen, wie 157/Dolibarr).
**M-A5 [HIGH] ARP/MAC-Cutover.** .176 wandert auf neue MAC → stale ARP auf Gateway/Peers/Forgejo/Monitoring. →
**Gratuitous ARP** (`arping -U -I eth0 192.168.20.176`) nach Cutover (+ bei Rollback); Erreichbarkeit von LAN/WG/
Forgejo/ansible-control/Kuma gegenprüfen.
**M-A6 [HIGH] Bind-to-.176 Boot-Race.** compose-bind .176 wenn Docker vor Adress-Config startet → bind-fail/restart-
loop. → onboot-Ordering + **Reboot-Probe mit finaler .176** (deckt sich mit M-A4).
**M-A7 [MED] uid/gid-Preservation.** `tar --numeric-owner` (sonst Name-Mapping → falsche uids im anderen unpriv-LXC) +
nach Restore `stat -c '%u:%g %a %n'` auf .env/config.json/data/database.sqlite* + App-Write-Test (Task/Setting speichern).
**M-A8 [MED] Forgejo-Reachability ab pz3.** Vor Cutover **aus LXC150**: TCP + authentifizierter git-Zugriff auf
192.168.20.172:3000 (nicht nur lokaler Login). Bridge-FW/Subnet-Kollision (Docker 172.x) ausschließen.
**M-A9 [MED] Hidden host/IP-state.** `config/config.json` + DB auf `192.168.20.42`/`.176`/`pz2`/`157`/webhook/base_url/
runner-Pfade grepen; entscheiden was .176 bleibt vs. geändert werden muss.
**M-A10 [MED] Decommission-Refs.** Hub-Meldung ≠ SSOT-Update. **Post-Cutover-Checkliste:** NetBoard-Tile (hostIp bleibt
.176, aber node/vmid-Metadaten ändern), Kuma-Monitoring-Target, Tapsi-Backup-Target (157→150/pz3), Inventar; 157 als
„stopped fallback, destroy-hold" markieren.
**M-A11 [LOW] Verify-Phase-Duplikation entschärft:** 157-Container wird VOR dem Copy `docker compose stop` (M-A1) →
Semaphore auf 157 ist während Build/Verify DOWN → KEINE Doppel-Scheduler/Poll/Notify. (157-LXC läuft noch = Rollback.)

**Bewertung:** Kein Dissens am Migrationsweg (Lift-and-Shift + .176-erhalten bleibt richtig). Die Amendments sind
Verify-/Cutover-HÄRTUNG — v.a. M-A1 (WAL) + M-A2 (echter Decryption-Beweis) sind Pflicht, sonst „grün" trotz stiller
Daten-/Token-Korruption. Reihenfolge der Sequenz oben bleibt; M-A* sind eingewoben.
