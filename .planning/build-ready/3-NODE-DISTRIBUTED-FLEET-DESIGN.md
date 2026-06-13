# T-0204 — Verteiltes Fleet-Cluster (pz1+pz2+pz3, +pve) — Recon & Architektur-Konzept

**Schraubi · 2026-06-13 · Phase: Recon+Konzept (read-only), KEIN Build/Cutover.**
Ersetzt das Single-HA-LXC-Modell aus T-0197. Alle Zahlen unten sind **live per SSH gemessen**
(orchestrator_ed25519), nicht aus Memory.

---

## 0. TL;DR (Kurzfazit)
- **Alle drei pz-Nodes sind IDENTISCH: Intel N150, 4 Cores, 16 GB RAM.** pz2 hat KEIN „mehr
  Total-RAM" — nur **mehr aktuell freies** (läuft leichter). Der einzige Node mit echtem
  RAM+CPU-Headroom ist **pve (.241): Ryzen 7 5700G, 16 Cores, 62 GB / 21 GB frei** — in der
  alten Recon zu Unrecht aussortiert.
- **Christins 2,5G-Richtung ist richtig:** live-NFS verworfen. **local-disk-per-node + git/Forgejo
  als universeller State-Layer + ZFS-Repl als schneller Zweitpfad (nur pz1↔pz3).**
- **🔴 Ehrlicher Catch:** **pz2 hat KEIN ZFS** (NVMe ist LVM, 5 TB davon UniFi-Protect). „ZFS-Repl
  wie gehabt" deckt pz2 NICHT ab. pz2-Failover läuft über **git** (oder man legt erst einen
  zpool auf der NVMe an = Provisionierungs-Schritt, nicht „wie gehabt").
- **RAM-Mathe pz-only ist machbar, aber mit ~0 Failover-Headroom** → ich empfehle **pve als
  Schwergewicht reinzunehmen** (trägt die CPU-schweren Peers + kann einen toten Small-Node
  absorbieren). Tabelle für beide Szenarien unten.

---

## 1. Gemessene Node-Landschaft (alle 5, 2026-06-13 ~04:34)

| Node | IP | CPU | Cores | RAM total | **RAM frei** | committed | swap | Disk (lokal schnell) | **ZFS?** | Load (von 4/16) |
|---|---|---|---|---|---|---|---|---|---|---|
| **pz1** | .68 | N150 | 4 | 16 G | **3,3 G** | **115 %(!)** | 0,3 G | SATA-SSD `Samsung_1TB` 773 G frei | ✅ ZFS | 1,08 |
| **pz2** | .42 | N150 | 4 | 16 G | **11 G** | 99 % | 2,4 G | **NVMe** (WD 7,68 T) 1,83 T frei | ❌ **LVM** | 1,97 |
| **pz3** | .106 | N150 | 4 | 16 G | **7,3 G** | 51 % | 0 G | SATA-SSD `Samsung_1TB` 864 G frei | ✅ ZFS | 0,29 |
| **pve** | .241 | Ryzen 5700G | **16** | **62 G** | **21 G** | — | 0,7 G | `Samsung_4TB` dir + local-lvm | ❌ | 7,26 |
| proxmox | .240 | — | — | — | — | — | — | TABU (chron. Crashes) | — | — |

- **Cluster01, 5 Nodes, quorate, PVE 9.2.3.** HA-Rules (nicht -Groups). master=pz1; **lrm aktiv
  nur auf pz1+pz3**; **pz2/pve/proxmox lrm idle** (= Cluster-Member, AKTUELL ohne HA-Resource →
  können HA-Node werden, sobald man ihnen eine Resource+Affinity-Rule gibt).
- **pz2 trägt schon 10 LXCs** (u.a. **146 merkel** + **147 agent-dashboard/.179** + checkmk 154
  forgejo-runner 157 semaphore) → die Fleet-Kern-Infra läuft teils schon dort. Darum „heavy node".
- **pz1 ist faktisch voll:** Committed_AS 18,96 G > Limit 16,4 G (115 %), 2,1 G frei → praktisch
  KEIN sicherer Fleet-Headroom. Fällt als Failover-Ziel aus (Christins eigene >6,1G-Schranke
  bestätigt: pz1 raus).

### Fleet-Fußabdruck (live im Coding-Workspace gemessen)
- **~22 Peer-Sessions**, je **~430 MB** (claude ~350 MB + `claude-peers-mcp` bun ~78 MB).
- **Working-Set ~8 GB** (free: 8 G used). Infra winzig: agent-master 106 MB · broker 62 MB ·
  spawner 37 MB · wa-bridge 11 MB · telegram 9 MB = **~0,25 G** zusammen.
- CPU: ein Peer spitzt **~1 Core** während seines Turns; idle ~0. Der Hub shedded Idle-Peers →
  gleichzeitig aktiv real ~12–16, Peak ~20.

---

## 2. RAM + Disk Verteilungstabelle (Christins Auftrag #1)

**Sicher-Budget** = freier RAM minus Schutzpolster (kein Swap-Thrash), CPU als Zweitschranke.
Peer-Einheit ≈ 0,43 G.

### Szenario C — Christins pz-only (pz1+pz2+pz3)
| Node | Disk | sicher-RAM-Budget | CPU-Realität | zugewiesene Peers | Peer-Profil |
|---|---|---|---|---|---|
| **pz2** (.42) | NVMe | ~4 G (≈9 Peers) | **N150, schon load 2/4** → real ~6–8 | **6–8** | RAM-resident, **CPU-leicht** (research/market/fiskal/docs/merkel-curator) + Failover-Sammelpunkt |
| **pz3** (.106) | SATA-SSD ✅ZFS | ~4,5 G (≈10) | N150, load 0,29 → frei | **9–10** | **Workhorse**: aktive Dev-Peers (security/netboard/baurechnung/gmbh/bizzi …) |
| **pz1** (.68) | SATA-SSD ✅ZFS | ~1 G (≈2) | N150, load 1/4 | **0–2** | nur idle-meist (heartbeat/relay) — Node ist 115 % committed |
| **Σ** | | ~9,5 G | | **~18–20** | passt am Peak — **aber Failover-Absorption ≈ 0** |

> **🔴 Schwäche von C:** stirbt pz3, müssen seine ~10 Peers irgendwo hin — pz1 ist voll, pz2 ist
> voll. Geht nur, wenn die Fleet in **essential (immer)** vs **best-effort (bei Failover gedroppt)**
> partitioniert wird. Außerdem: pz2 = schwächste CPU trägt im Modell die meisten RAM-Peers — die
> CPU-schweren Peers gehören NICHT auf pz2.

### Szenario R — empfohlen: pve als Schwergewicht rein
| Node | Disk | sicher-RAM-Budget | zugewiesene Peers | Rolle |
|---|---|---|---|---|
| **pve** (.241) | Samsung_4TB | ~12–16 G | **10–12 (CPU-schwer/aktiv)** | 16 Cores fressen die Turn-Bursts; **Failover-Absorber** (13 G+ Reserve) |
| **pz3** (.106) | SATA-SSD ✅ZFS | ~4,5 G | **6–8 (mittel)** | Workhorse-Small-Node; trägt zusätzlich die fleet-core-LXC |
| **pz2** (.42) | NVMe | ~3 G | **4–6 (CPU-leicht)** | RAM-resident-aber-CPU-leise Peers (Merkel-Ingest/Research) |
| **pz1** (.68) | SATA-SSD ✅ZFS | ~0–1 G | **0–2** | minimal / leer (zu voll) |
| **Σ** | | | **~22** | **mit echter Failover-Reserve** (pve absorbiert toten Small-Node) |

> **Warum R besser ist (objektiv, nicht Präferenz):** Failover-Resilienz ist der GANZE Zweck des
> Designs. C liefert sie strukturell nicht (kein Absorber). R liefert sie, weil pve genug Reserve
> hat. pves fehlendes ZFS ist im local-disk+git-Modell **irrelevant** (git-State-Layer trägt pve).
> → **Topologie-Entscheidung gehört zu Christin** (siehe MC am Ende).

---

## 3. Shared/Storage — Christins Auftrag #2 (+ 2,5G-Constraint)

### ✅ BESTÄTIGT: local-disk-per-node + Replikation, live-NFS VERWORFEN
Christins Begründung ist technisch korrekt: **2,5G-Inter-Node** + git/Claude-Code = viele kleine
Files, **latenz/IOPS-gebunden**, nicht durchsatz. Live-NFS für `/home/dev` im Hot-Path = jeder
`git status`/Tool-Read über Netz-Roundtrips → unbrauchbar langsam. **Jeder Peer auf EINEM Node →
kein concurrent-multi-write → Shared-FS gar nicht nötig.** SATA-SSD (pz1/pz3) ist für den Workload
völlig ausreichend (nicht durchsatzgebunden) — kein Blocker, nur Platzierungskriterium.

### State-Layer (Failover) — Empfehlung mit Begründung
**Primär = git/Forgejo (universell), Sekundär = ZFS-Repl (nur pz1↔pz3, schneller).**

| Option | Spannt welche Nodes? | Bewertung |
|---|---|---|
| **git/Forgejo** (LXC153 live) | **ALLE** (pz1/pz2/pz3/pve, ZFS-agnostisch) | ✅ **Primär.** Genau wie die Fleet HEUTE schon persistiert (Handover/RESUME/PROGRESS-Commits). Failover = clone/pull + frische Session liest Handoff. Klein, auditierbar, schon da. |
| **ZFS-Repl** (pve-zsync 1-Min) | **nur pz1↔pz3** (beide ZFS) | ✅ **Sekundär**, schneller (sub-Minute working-tree-Recovery). Cluster macht das schon für 5 Services → Muster bewährt. **Deckt pz2/pve NICHT ab.** |
| **NFS pz2-NVMe** | — | ❌ **SPOF** — Storage hinge an EINEM schwachen Node; pz2 down = Home ALLER verteilten Peers weg → killt das Resilienz-Ziel. + live-NFS-Latenz (verworfen). |
| **NFS NAS .195** | — | ❌ **unverifiziert** (Synology DS-Rose01:5001; kein SSH/kein sichtbarer Export; NAS im Rebuild). + live-NFS-Latenz (verworfen). |

> **🔴 pz2-ZFS-Catch (muss Christin wissen):** „ZFS-Repl wie gehabt" gilt NUR pz1↔pz3. **pz2 hat
> kein ZFS.** Zwei Wege: **(a) empfohlen** — pz2 nutzt **git-only-Failover** (seine Peers sind die
> CPU-leichten, deren State ohnehin git-committet ist); **(b)** man legt erst einen **zpool auf der
> pz2-NVMe** an (1,83 T frei im VG → machbar, aber Provisionierungs-Schritt + ZFS-RAM-Overhead auf
> dem 16-G-Node). → Entscheidungspunkt.

### Auftrag #2-Quantifizierung: passt das `/home/dev`-Delta in die 1-Min-Replikation über 2,5G?
**Ja, trivial.** ZFS-Repl ist **inkrementell** (nur geänderte Blöcke seit letztem Snapshot),
**pro LXC-Dataset** (nicht pro Peer). Schreibrate eines Peer-Runner-LXC/Minute = git-Objekte +
Session/Memory-Writes + Log-Appends ≈ **einstellige MB/min** selbst unter Last. 2,5GbE ≈ 250 MB/s
real → ~15 GB/min Kapazität → Delta **≪ 1 %**. Der einzige große Transfer ist der **einmalige
33-GB-Initial-Seed** (≈2–3 min) — **vor** dem Cutover vorseeden, NICHT im Steady-Path. Cluster
fährt schon 5 Repl-Jobs auf diesem Netz ohne Sättigung → Headroom bewiesen. **Wichtig:** die
many-small-files-Latenz, die NFS killt, trifft ZFS-Repl NICHT (verschickt Blöcke, keine Files) —
Constraint und gewählter Mechanismus kollidieren also nicht.

### Auftrag #2/#3: Was MUSS minimal geteilt/zentral sein?
**Nur zwei NETZ-Dienste, KEIN Shared-FS** — und beide sind klein:
- **Broker (:7899)** — Message-Bus. EINE zentrale Instanz, alle Peers connecten per LAN. State =
  In-Memory-Routing. 62 MB.
- **agent-master Hub (:7890)** — Registry + Ledger + Activity-Reports + Open-Tasks. State =
  `data/`-Verzeichnis (JSON/kleine SQLite, MB-Skala). EINE Instanz.
- **Ledger** (`.planning/ledger/tickets.json` + `events.jsonl`) = klein, **schon git-getrackt** im
  orchestrator-Repo → git trägt es. **registry/llm-access.json** = Teil von agent-master `data/`.
→ Das gesamte „zentrale/geteilte" Surface = **2 kleine Netz-Services + ihr MB-State-Dir** — passt
locker in git/zentralen-Dienst, **braucht KEIN Shared-FS.** Bestätigt.

---

## 4. Cross-Host-Messaging — Christins Auftrag #3 → ✅ MACHBAR (bestätigt)
- Alle Nodes auf `192.168.20.0/24`. Recon (T-0197/Netzi): **42↔20 + WG(16)→20 schon offen**
  (LAN-Zone terminal ACCEPT, KEINE UDM-Änderung nötig). Nur die Host-Binds ändern.
- broker:7899 + agent-master:7890 binden heute `localhost` → auf **LAN binden**; davor
  **host-nftables-Allowlist** (src 42/20/16 → :7890/:7899, Rest DROP). Beide Dienste **auth-los**
  → nftables ist Pflicht VOR jedem LAN-Bind. Die nftables liegen **auf dem LXC** → wandern beim
  Failover mit (kein zweiter Pflegepunkt an der IP).
- Messaging ist **Netz, nicht FS** → die 2,5G-IOPS-Schwäche trifft es NICHT (sub-ms-LAN-Latenz,
  winzige JSON-Frames). **R22/Schnüffi auf den Bind-Change** vor Cutover.

---

## 5. Placement / Failover — Christins Auftrag #4 → Empfehlung: BEIDES, geschichtet
| Ebene | Mechanik | Wofür |
|---|---|---|
| **Proxmox-HA** | restartet ganze LXC auf Survivor (ZFS-Repl pz3↔pz1) | **nur die fleet-core-LXC** (broker+hub+bridges) — klein, ZFS, bewährtes Restart-Failover. Das EINE unersetzliche Stück. |
| **App-Controller (spawnerd)** | hält Peer→Node-Map, heartbeatet Nodes, respawnt bei Node-Down die **essential** Peers auf einem Survivor (git pull → frische Session liest RESUME) | **Peer-Ebene.** Genau die bestehende recycle/respawn-Mechanik, cross-node erweitert. Kein Shared-Storage nötig; shedded best-effort unter Druck. |

> **Warum nicht Proxmox-HA für Peers:** HA kennt nur LXC-Granularität — kann „diese Node-Peers
> woanders" nicht; und eine fette Peer-Runner-LXC auf einen vollen Node HA-restarten scheitert
> (kein RAM). Darum: **HA bewacht die kleine Kern-LXC, der Controller die elastische Peer-Fleet.**
> Einfachst+robust.

**Architektur-Skizze (Szenario R):**
```
            ┌─────────────────── LAN 192.168.20.0/24 (2×2,5G) ───────────────────┐
            │                                                                     │
   ┌────────┴─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────────┴┐
   │ pz3 (.106) ZFS   │   │ pz2 (.42)NVMe│   │ pz1 (.68) ZFS│   │ pve (.241) 16c   │
   │ ┌──────────────┐ │   │ ┌──────────┐ │   │ ┌──────────┐ │   │ ┌──────────────┐ │
   │ │ FLEET-CORE   │◄┼───┼─┤ peer-run │ │   │ │ peer-run │ │   │ │ peer-runner  │ │
   │ │ broker :7899 │ │   │ │ 4–6 CPU- │ │   │ │ 0–2 idle │ │   │ │ 10–12 schwer │ │
   │ │ hub   :7890  │ │   │ │ leichte  │ │   │ └──────────┘ │   │ │ (aktive Dev) │ │
   │ │ wa/tg bridge │ │   │ │ Peers    │ │   │   git-only   │   │ │ git-State    │ │
   │ │ spawnerd     │ │   │ └──────────┘ │   └──────────────┘   │ └──────────────┘ │
   │ └──────┬───────┘ │   │  git-only    │   Proxmox-HA: ───────► fleet-core-LXC    │
   │ peer-run 6–8     │   └──────────────┘   ZFS-Repl pz3↔pz1     (Restart-Failover)│
   │ ZFS-Repl ──────► pz1                                                           │
   └──────────────────┘   alle Peers ── send_message ──► EIN Broker @ fleet-core ───┘
   State-Layer: git/Forgejo (LXC153) universell · ZFS-Repl nur pz1↔pz3 als schneller Zweitpfad
```

---

## 6. Live-Migration — Christins Auftrag #5 → ✅ Klarstellung bestätigt
- **Laufenden Peer LIVE migrieren = NEIN.** Ein Peer = Prozess + flüchtiger Session-Kontext
  (claude-CLI `--continue`-State im RAM) → kein Prozess/State-Teleport möglich.
- **stop-hier / start-dort aus dem State-Layer = JA.** Was wandert ist der **durable State**
  (Repo + Memory + RESUME/Handover, git-committet). Auf dem neuen Node clont/pullt eine **FRISCHE**
  claude-Session und liest den Handoff → nahtlose Fortsetzung. Das ist exakt die bestehende
  recycle-Mechanik (das 50%-Kontext-Handover-Protokoll existiert genau dafür) — nur cross-node.
- Datenverlust-Fenster = ≤1 Min (ZFS-Repl pz1/pz3) bzw. letzter git-push (pz2/pve). Gebounded +
  unkritisch (State in git).

---

## 7. Offene Entscheidungen (gated → Christin) + nächste Schritte
1. **Topologie:** Szenario **R (pve rein, empfohlen)** vs **C (pz-only)**?
2. **pz2-Failover-State:** **git-only (empfohlen)** vs zpool-auf-NVMe-anlegen?
3. RAM-Grundsatz bleibt: pz1 ist 115 % committed → trägt ~0; das ist hardware-bedingt (kein
   RAM-Upgrade pz1/pz3 laut Christin) → pve-Einbezug ist der einzige echte Headroom-Hebel.

**Build/Cutover bleibt GATED** (Christins Topologie-Entscheid + R22-Refute + Schnüffi
Bind-Change + Netzi nftables-Regelset). systemd-Units (`build-ready/systemd/`) + ttyd-Grid
(`build-ready/ttyd/`) sind install-ready. Nichts Live-Berührendes ohne Go.

---

## 8. R22-Adversarial-Refute (2026-06-13, Schraubi)

**Methode-Ehrlichkeit (R31):** adversarialer Refute auf den **topologie-unabhängigen Architektur-Kern**
(State-Layer/Failover/Messaging/HA-Split) durch einen **same-model** Reviewer-Subagenten mit Refute-
Prompt — **NICHT** der echte cross-lab `codex-worker` (in diesem Harness nicht im Agent-Registry
verfügbar). Wert ist real (9 substantielle Findings), aber das cross-lab-4-Augen-Prinzip aus R22 ist
**noch offen** und MUSS vor Cutover mit echtem Codex nachgeholt werden. Fazit des Reviews: **Fundament
trägt** (Storage/Topologie-Analyse stark), aber die **Failover-Koordinationsschicht braucht Härtung** —
additiv, kein Redesign. **4 Cutover-Blocker**, sonst ist das verteilte System fragiler als das heutige
Single-Container-Setup (führt neue Split-Brain-/Korruptions-Pfade ein, die es heute nicht gibt).

### 🔴 Cutover-BLOCKER (vor Scharfschalten lösen)
1. **[KRITISCH] Kein Fencing/Lease → garantiertes Split-Brain.** Netz-Isolation (2,5G-Link-Flap,
   Switch-Port-Reset — häufiger als echter Crash) ohne Node-Tod: spawnerd respawnt essential-Peers
   auf Survivor, während der alte Peer auf der isolierten Node WEITERLÄUFT → zwei Instanzen am selben
   Broker, beide pushen dasselbe git-Repo, **beide bedienen externe Singleton-Kanäle doppelt**
   (wa-bridge Doppel-Login, telegram-bridge 409 — systemd/README:48-49 belegt das). **Fix:** Peer-Lease
   mit Epoch/Generation am Broker (neue Session bumpt Epoch, Broker DROPpt stale-Epoch-Frames) +
   STONITH-artig `pct stop` der verdächtigen Peer-Runner-LXC via Cluster-API (quorate, auch bei
   wackeligem Daten-Link) VOR respawn. = **stärkste Einzelschwäche.**
2. **[KRITISCH] spawnerd-Henne-Ei + RAM-Singleton.** Stirbt der fleet-core-Host, ist GLEICHZEITIG der
   Controller weg UND die Peers dort — im HA-Restart-Fenster (1–3 Min) respawnt NIEMAND. Peer→Node-Map
   im RAM = nach Restart weg → Discovery rät → Doppel-Spawns. **Fix:** Soll-Zustand (home+failover-Node
   pro Peer) **deklarativ in git**; spawnerd-Start = **reconcile-Loop** (IST=Broker-Registry vs SOLL=git,
   nur Differenz spawnen, nie blind respawn). **Anti-Affinity:** fleet-core NICHT auf eine Node mit
   schwerer Peer-Population (Playbook platziert aktuell fleet-core+peer-runner beide auf pz3 → ändern).
3. **[HOCH] ZFS-Repl der laufenden fleet-core-LXC = crash-, nicht app-konsistent.** agent-master `data/`
   (JSON/SQLite, §3 als NICHT-git-getrackt gelistet!) hängt allein an der 1-Min-ZFS-Repl. SQLite-WAL /
   nicht-atomar geschriebenes JSON im Snapshot → **korrupt** (schlimmer als „1 Min verloren" — blockiert
   evtl. Hub-Start / fehlrouting). Pauschales „Verlust unkritisch (State in git)" (§6) ist für `data/`
   FALSCH. **Fix:** pre-snapshot `PRAGMA wal_checkpoint(TRUNCATE)` bzw. `.backup`-Dump; JSON write-tmp+
   atomic-rename; Spawn-Befehle idempotent (Spawn-ID); „unkritisch" pro State-Klasse begründen.
4. **[HOCH] Reihenfolge-Inversion Repl-Monitoring.** Das Design stützt Failover auf ZFS-Repl, belegt aber
   selbst, dass Job 102-0 seit 19.05. still tot ist (FailCount 1158, fiel niemandem auf). Monitoring steht
   im Playbook als VERIFY-Schritt 8 = NACH Cutover. **Fix:** Repl-Health (Kuma: FailCount==0 +
   Snapshot-Alter<N) ist **PRE-Cutover-Gate** inkl. Alert-Test (bewusster Repl-Fail → alarmiert?); toten
   102-0 vorher fixen/löschen.

### 🟠 Vor Cutover adressieren (HOCH/MITTEL)
5. **[HOCH] Auth-loser Broker/Hub auf LAN, nur nftables.** Jede Peer-LXC liegt IM erlaubten Subnetz →
   nftables schützt gegen Externe, NICHT gegen einen kompromittierten/prompt-injizierten Peer (lateral).
   + **Bind-Fenster** beim HA-Restart: keine garantierte Ordnung „nftables aktiv VOR LAN-Bind". **Fix:**
   App-Layer-Auth (Shared-Secret/Token pro Peer im Broker-Handshake, HMAC auf Hub-Mutations-Endpunkten)
   — nftables ist Perimeter, nicht Authentisierung; nftables als `Before=`-Dependency der Dienst-Units /
   default-deny-bind. **→ Schnüffi-Gate inhaltlich füllen.**
6. **[HOCH] Forgejo (LXC153) = nicht-redundanter SPOF + Hot-Path-Bottleneck.** Der ganze Failover-pull
   hängt an EINER Forgejo-Instanz; Design nennt weder Node noch HA/Repl. Failt sie (oder ihre Node), ist
   der „universelle State-Layer" für ALLE weg = dieselbe SPOF-Eigenschaft, die §3 bei NFS korrekt als
   Killer verwirft. + Thundering-Herd bei Failover-Sturm (8–10 gleichzeitige pulls inkl. `.git/objects`).
   **Fix:** Forgejo unter Proxmox-HA+ZFS-Repl ODER zweiter git-Remote als push-Mirror; Anti-Affinity;
   Lastannahme messen.
7. **[MITTEL] Zwei Failover-Entscheider (PVE-HA + spawnerd) können divergieren** (App-Heartbeat vs
   Watchdog/Quorum). **lrm aktiv nur pz1+pz3** = NICHT auf der quorum-tragenden pve-Seite → plausible
   Partition kann fleet-core stranden. **Fix:** lrm auch auf einer Mehrheits-Node (Szenario R: pve);
   spawnerd respektiert HA für HA-Resourcen, respawnt erst nach bestätigtem Fence (koppelt an #1);
   Watchdog (softdog) explizit verifizieren — ohne ihn fenced PVE-HA nicht zuverlässig.
8. **[MITTEL] Cutover-Quiesce = einziger Doppelbetrieb-Schutz, fehleranfälligste Stelle.** Manuelles
   „quiescen → finaler rsync → scharf" ohne erzwungenes Interlock; unvollständig = zwei Broker/Bridges.
   rsync gegen lebendes `/home/dev` migriert evtl. halbe Commits. **Fix:** hartes verifiziertes Quiesce-
   Interlock (kein claude/bun/Bridge-PID mehr), finaler rsync gegen read-only-quiesctes Quell-FS,
   Singleton-Token (Telegram/WA) erst nach bestätigtem alten Stop übergeben (409 strukturell unmöglich).
9. **[NIEDRIG] GH_TOKEN-Degradation trifft genau den Failover-pull.** „recoverable, kein Blocker"
   (systemd/README:32) wird im Recovery-Moment zum Blocker, falls pulls gegen GitHub statt Forgejo laufen.
   **Fix:** Failover-pull ausschließlich gegen internen Forgejo-Remote festschreiben (kein GH_TOKEN im
   kritischen Pfad).

### Was der Review NICHT beanstandet (trägt)
Live-NFS-Verwerfung + git-State-Konzept · stop/start-statt-teleport · RAM-Mathe/pve-Absorber-Logik ·
ZFS-Repl-Durchsatz-Mathe. → Die Lücken sitzen ausnahmslos in der **Failover-Koordination**, nicht im
Fundament.

**Konsequenz für die Reihenfolge:** Christins Topologie-Entscheid (R/C) bleibt der erste Gate. Aber selbst
nach „Go" ist der Build **nicht** sofort scharfschaltbar — die 4 Blocker (#1–#4) + echter Codex-Refute
sind dem Cutover vorgelagert. Diese Härtungen sind topologie-unabhängig → können parallel zum Warten auf
den Topologie-Entscheid spezifiziert werden.
