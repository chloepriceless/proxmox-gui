# T-0116/1 — Semaphore-Deploy LXC 157 (Design-Position, R26)

**Ziel:** Ansible-UI (Semaphore) als Patch-Rollout-Runner für E1/E2 (Frischis
`fleet-ansible` aus Forgejo), LAN-only, fail-closed. Christin-GO 2026-06-12 ~00:22,
Hub-Freigabe für LXC 157 @ pz2 liegt vor.

## Entscheidungen

| Punkt | Entscheidung | Begründung / verworfene Alternative |
|---|---|---|
| Platzierung | **LXC 157 @ pz2/.42**, IP **192.168.20.176** (Patchi-reserviert) | pz2 gemessen ruhigster Node (mem 30%/cpu 19%); proxmox/.240 TABU. nextid=157 bestätigt, .176 ping-frei. |
| Container | Debian-12 **unprivileged** + nesting=1,keyctl=1, 2c/3G/20G local-lvm, onboot, tags infra;semaphore | Identisch zum bewährten Dolibarr-156-Pattern (gleicher Node, gleiches Template). |
| App-Runtime | **Docker** `semaphoreui/semaphore` (offizielle Distribution) | Alternativen verworfen: Snap (kein Snap in LXC sinnvoll), Binär+systemd (mehr Pflege, kein offizielles apt-Repo für Debian 12). |
| DB | **SQLite embedded** (`SEMAPHORE_DB_DIALECT=sqlite`) — Änderung nach R22-Refute | Gleicher Geist wie BoltDB (embedded, eine Datei, Hub-abgenickt), ABER: v2.19 entfernt den bolt-Dialect (Refute-verifiziert im develop-Wrapper) → sqlite ist die designierte Nachfolge, übersteht das nächste Image-Upgrade. MariaDB weiterhin verworfen (Mehrwert erst bei HA). |
| Exposure | HTTP :3000 **nur auf 192.168.20.176 gebunden** (nie 0.0.0.0) + LXC-FW | Wie Dolibarr. TLS intern verworfen (LAN-only-Admin-Tool, konsistent mit Fleet-Praxis; Upgrade-Pfad Caddy tls internal dokumentiert in staging-dolibarr). |
| FW | **dolibarr-fw-Pattern v2 adaptiert**: DOCKER-USER-Allowlist (LAN 192.168.20.0/24 + WG 192.168.16.0/24 → tcp/3000), INPUT-DROP (SSH LAN+WG), IPv6 aus, Unit `Before=docker.service` + Docker-Drop-in | Pattern ist R22-refuted (Boot-fail-open + IPv6-Bypass gefixt) und reboot-probe-PASS auf 156. Kein AG-IP-Eintrag (kein externer Zugang). |
| Secrets | `/opt/semaphore/.env` (600): Admin-PW + `SEMAPHORE_ACCESS_KEY_ENCRYPTION` (openssl rand -base64 32) | Creds → NetBoard (`semaphore-admin`) + clipboard-Tile (T-0188), NICHT Chat/Git. |
| Playbook-Quelle | Git-SCM = Forgejo `frischi/fleet-ansible` (Verdrahtung = E2-Schritt, b1d0386: ring_canary/ring_rest) | Semaphore zieht selbst; kein Repo-Klon im Container nötig. |
| Ansible-SSH-Key | Kommt erst bei E2-Verdrahtung in den Semaphore Key Store (ansible_ed25519) | Nicht Teil des Container-Builds; least-privilege: Key bleibt bis dahin nur auf 155. |

## R22-Refute (general-purpose, 2026-06-12 ~00:40) — BLOCK → gefixt → PROCEED
- **HIGH-1 gefixt:** Image läuft als UID 1001 → Bind-Mounts via `install -d -o 1001 -g 0 -m 770` (sonst Crash-Loop).
- **HIGH-2 gefixt:** Tag `v2` existiert nicht (Fallback wäre still :latest gewesen) → hart gepinnt `v2.18.12`, Fallback gestrichen; Dialect bolt→sqlite (v2.19 killt bolt).
- **MED-1 gefixt:** Deploy-Script verifiziert hart (`/api/ping`=="pong" sonst exit 1 + Logs; 0.0.0.0-Listen = Abbruch).
- **MED-2 gefixt:** `./config:/etc/semaphore` zusätzlich gemountet (sonst first-run bei jedem Recreate; `SEMAPHORE_ACCESS_KEY_ENCRYPTION` = DR-kritisch → NetBoard).
- **MED-3 gefixt:** `install-fw.sh` (skriptierter FW-Install, Drop-in mit `Requires=` statt `Wants=`).
- **LOW-2 beachtet:** Runbook-Reihenfolge FW VOR erstem `compose up`.
- **LOW-1 zur Kenntnis:** iptables-LOG in unpriv LXC ist No-op (galt auch auf 156) — Forensik-Logs nicht erwartbar.
- Env-Namen + Datenpfad + FW-Logik + Boot-Ordering vom Refuter explizit als korrekt verifiziert (v2.18.x).

## Risiken / Gegenchecks
- **Env-Namen des Images** (SEMAPHORE_ADMIN*, _DB_DIALECT, _ACCESS_KEY_ENCRYPTION) werden
  beim R31-Verify hart geprüft (Login-Seite + `/api/ping` + Admin-Login via API) —
  falsche Env-Namen fallen dort auf (Dolibarr-Lehre: stiller Teilerfolg).
- **Patch-Ring:** infra (patch_ring=none, reboot_allowed=false) → an Patchi melden.
- **Backup-Reboot-Resilienz:** onboot=1 + fw-Unit enabled + docker enabled + restart
  unless-stopped (Reboot-Probe wie bei 156 nach Deploy).
