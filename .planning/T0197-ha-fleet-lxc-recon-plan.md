# T-0197 — Persistente Fleet als HA-LXC (pz1+pz3): Recon & Plan

**Datum:** 2026-06-12 · **Phase 1 = Recon (read-only) + Plan.** Kein Build/Cutover vor Hub+Christin-Review.
**Auftrag (Hub/Christin):** Fleet überlebt jeden Coder-/Node-Ausfall → Proxmox-LXC in HA auf pz1+pz3 (.240 TABU). 3 Bausteine: (1) persistentes Zuhause + systemd-Autostart, (2) Browser-Grid (tmux-Video-Wall via ttyd), (3) Cross-Host-Messaging (broker+hub auf LAN/WG).

## 1. IST-Topologie (empirisch verifiziert)

### Proxmox-Cluster
- **Cluster01, 5 Nodes, quorate.** PVE **9.2.3** (HA-Rules statt -Groups). HA aktiv, master=pz1, **lrm active auf pz1+pz3** (+proxmox), idle auf pve/pz2.
- HA managed bereits 5 Services über **ZFS-Replikation** (Muster bewährt): ct:127(pz1), vm:116(pz1), ct:102/105/115(pz3) — alle mit pvesr-Replication-Jobs 1-Min-Takt.

### 🔑 Storage = ZFS-Replikation, NICHT Shared-Storage (zentrale Architektur-Tatsache)
- **Kein Ceph, kein shared SAN.** Der gemeinsame Nenner ist `zfspool Samsung_1TB` — aber das ist ein **separater lokaler ZFS-Pool je Node** (pz1: 888G/774G frei · pz3: 928G/864G frei — unterschiedliche Größen = klar getrennte Pools), nicht ein geteiltes Volume.
- HA-Failover läuft also über **pve-zsync Replication-Jobs** (1-Min-Takt): bei Node-Ausfall **Restart auf dem Partner vom letzten Snapshot** → Datenverlust-Fenster **≤1 Min**. Genau das vom Hub gewünschte „Restart-Failover, kein Live-Migrate".
- **Konsequenz Fleet-LXC:** alles in den letzten ≤1 Min vor einem Crash ist nach Failover weg. Unkritisch, weil Fleet-State in Git (gepusht) liegt + systemd/spawner die Peers neu erzeugt. **Pflicht:** eigener Replication-Job pz3→pz1 (1-Min) + **Replication-Health-Monitoring**.
- ⚠️ **Pre-existing Problem (nicht meins, aber relevant):** Replication-Job `102-0` (homepage, pz3→pz1) ist seit **2026-05-19 kaputt** („No common base snapshot", FailCount 1158). Beweist: Replication-Jobs verrotten still → der Fleet-Job MUSS überwacht werden (Kuma/checkmk). An Hub/Owner gemeldet.

### 🔴 RAM-Headroom = der eigentliche Engpass (Hauptblocker)
| Node | RAM total | verfügbar | Load (4 Cores) | HA-Services drauf |
|---|---|---|---|---|
| **pz1** | 15 GiB | **nur 3,4 GiB** (11 used) | 1,6 | mqtt(512M), loxberry(4G) |
| **pz3** | 15 GiB | **7,3 GiB** (8 used) | 0,7 | homepage(512M), node-red(1G), HA-Main(4G) |

- **Live-Fleet-Ist: ~6,1 GiB RAM** (gemessen im laufenden Coding-Workspace), CPU ~66% von 4 Cores, **/home/dev = 33 GB**.
- Das Hub-Richtmaß 8-16 GB passt **so nicht**: pz3 (7,3 G frei) trägt eine ~8-GB-LXC knapp als Primary; pz1 (3,4 G frei) müsste im Failover ~6 G ON TOP stemmen = Overcommit in Swap. LXC-RAM ist NICHT hart reserviert (anders als VM) → Overcommit im kurzen Emergency-Failover überlebbar, aber degradiert.

## 2. Empfehlung / Plan

### 2a. Sizing + Placement (Design-Entscheidung)
- **LXC: 8 GiB RAM, 4 vCPU, 80 GB Disk auf `Samsung_1TB`** (33 G Ist + Wachstum; Pool hat >770 G frei, Disk ist NICHT der Engpass).
- **Primary = pz3** (mehr Headroom 7,3 G, niedrigere Load 0,7). **Failover = pz1** (eng, würde ~2-3 G in Swap overcommitten — bewusst akzeptiert für Emergency-Restart; Fleet degradiert kurz statt auszufallen). HA-Affinity-Rule (PVE9) preferred-node=pz3.
- **Tradeoff ehrlich:** beide Nodes nur 15 G total = strukturell knapp für „Fleet + bestehende HA-Last". Sauberer Langfrist-Fix = **+16 G RAM in pz1 UND pz3** (Hardware) → dann komfortables Failover. Das ist eine **Empfehlung an Christin, kein Blocker** — es geht auch jetzt (tight). *(verworfen: 16-GB-LXC — passt auf KEINEN Node ohne Hardware-Upgrade; 6-GB-LXC — zu eng am Ist-Verbrauch, kein Spawn-Headroom.)*

### 2b. Baustein 1 — Persistentes Zuhause + echte Persistenz (systemd statt bootstrap-only)
- Debian-13-LXC unprivileged + nesting=1 (für tmux/Node-Subprozesse), onboot=1, HA-enrolled, Replication-Job pz3→pz1 1-Min.
- Migrations-Payload: **~30 Repos** unter /home/dev (orchestrator + orchestrator-* + dvhub/netboard/BauRechnungScanner/GmbH-Verwaltung/Hetzner-Docker/vm-deployment-gui/…) + `.secrets` (7 Files) + Report/screenshots/backups + codex/ + tts-venv. 33 GB.
- **systemd-Units (alle `enabled`, WantedBy=multi-user.target — überleben Backup-Reboot UND HA-Failover-Restart):** `agent-master`(:7890), `claude-peers-broker`(:7899), `spawner`(:7901), **`wa-bridge`, `telegram-bridge`** (die fielen zuletzt aus → diesmal echte Units, nicht bootstrap-only), + Peer-tmux via spawnerd. Toolchain im LXC: node v22, claude 2.1.175, python3.12, git, tmux, expect (alle im Ist vorhanden) + **ttyd nachinstallieren** (fehlt, für Baustein 2).

### 2c. Baustein 2 — Browser-Grid (tmux-Video-Wall)
- Alle Peer-Panes gekachelt in 1 tmux-Fenster (synchronisiertes Layout) → **ttyd** exponiert es read-only im Browser (1 Link, wie Kamera-Grid). ttyd auf LAN/WG-Bind, FW-scoped. Read-only-Mode (`-R` aus, write-disable) damit Christin nur schaut.

### 2d. Baustein 3 — Cross-Host-Messaging (Netzwerk, mit Netzi)
- broker(:7899) + agent-master(:7890) binden aktuell **localhost** → auf **LAN/WG** umstellen, damit Christins Coder-Workspace @192.168.42.42 die Peers im LXC per send_message erreicht.
- **Security (R22/Schnüffi):** Bind-to-LAN = Exposure → FW fail-closed (nur LAN+WG, wie Dolibarr/Semaphore), kein 0.0.0.0-Leak. Broker/Hub haben keine Auth → MUSS netzseitig scoped sein. **Mit Netzi (dr8s8wtb):** WG-Route Coder-Host(.42er-VLAN) ↔ LXC(.20er), nötige Ports, ggf. Firewall-Regel. Schnüffi-R22 auf den Bind-Change.

### 2e. Migration / Cutover (Christin-GO + Wartungsfenster)
- Source = laufender Coding-Workspace (172.17.0.2 auf Coder-Host). Cutover: (1) LXC bauen + Toolchain + Repos rsyncen (Live, repeatable) → (2) systemd-Units einrichten + testen (Dienste hoch, Peers spawnen, send_message-Loop) → (3) **Wartungsfenster:** Coding-Fleet quiescen, finaler rsync-Delta, DNS/Bind-Umschaltung, Fleet im LXC scharf → (4) Verify (alle Dienste up, Cross-Host-Messaging vom Coder-Workspace, Browser-Grid) → (5) Coding-Workspace als Fallback behalten bis stabil.
- **R22:** Cutover-Plan + Bind-Change vor Ausführung Codex-Refute + Schnüffi. Cutover berührt die LIVE-Fleet (inkl. diese Session) → höchste Vorsicht, Rollback = zurück auf Coding-Workspace.

## 3. Offene Punkte / Gates
- **Hub/Christin-Review dieses Plans** (Phase 1 → Phase 2 Gate).
- **RAM-Entscheid:** 8-GB-LXC tight-aber-machbar JETZT, ODER erst +16G RAM pz1/pz3 (Hardware)? → Christin.
- **Netzi:** WG-Route + Bind-Scoping Coder↔LXC (Baustein 3).
- **Replication-Health-Monitoring** für den Fleet-Job (Kuma) — und der kaputte 102-0-Job (Owner homepage).
- Build (Phase 2) + Cutover NUR nach Review. Findings → Merkel.

**Status Phase 1: FERTIG** (read-only Recon + Plan). Live-Fleet unangetastet.
