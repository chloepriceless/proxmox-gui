# HANDOVER — Proxmox-GUI Head / Infra-LEAD ("Schraubi")

**Updated:** 2026-06-13 ~04:25 · **Branch:** `master` @ `2587229` (pushed, clean tree, in sync).
**Operator:** Christin (von Perbandt) / Bikini Bottom Capital GmbH. **Peer-IDs (04:01-Respawn):** Hub=`07lvalhu` (orchestrator), Kuma=`zysoypfg`, Netzi=`2ile9o2c`, Frischi=`mlhwoeko`, Tapsi=`5tqeyy7g`. (Schnüffi/Patchi nicht in der 04:12-Liste — bei Bedarf `list_peers` + peer/notify.)

## State: Haupt-Strang T-0204 — alle DISKRETEN autonomen Einheiten ✅ DURCH inkl. R22-Codex-Gate. Cutover gated (Owner-Impl/Schnüffi/Netzi).
Durable Detail in repo-memory **`project-open-tasks.md`** (oberster Block SESSION-12 zuerst lesen).
Topologie GELÖST (R) · R22-Hardening-Spec (`build-ready/T0204-HARDENING-SPEC.md`, 05edd64) · **✅ echter cross-lab
Codex-Refute (gpt-5-codex) DURCH → Amendments A1–A11, commit 2587229; R22-Gate GESCHLOSSEN** · Roh-Evidenz
`T0204-HARDENING-SPEC-CODEX-REFUTE.md` · Merkel-Ingest 828c042b. `autonomous_open=0` · `blocked_open=6`.
Idle-Improvement-Loop ist Standing-Rule bei leerem Queue (Runde 1: 3 Merkel-Primärquellen HA-Fencing/ZFS-Repl/Synthese).

### ⭐ AKTUELLER HAUPT-STRANG: T-0204 verteiltes Fleet-Cluster (ersetzt T-0197)
Eine Session in der Nacht 2026-06-13 (~02:34–02:48) hat eine **tiefere Live-Recon** gefahren (alle 5
Nodes per SSH gemessen, nicht aus Memory) und **install-ready Build-Artefakte** geschrieben. Diese
Session (~03:15) hat sie **committed+gepusht** (`42662e4`) — vorher waren sie uncommitted und
verlust-gefährdet. Stand:
- **Recon+Konzept FERTIG** (read-only): `.planning/build-ready/3-NODE-DISTRIBUTED-FLEET-DESIGN.md`
  (+ `LXC-BUILD-PLAYBOOK.md`, `systemd/`, `ttyd/`, `INFLUX-FOR-BRETTLI.md`).
- **Kernbefunde:** pz1/pz2/pz3 identisch (N150/4c/16G); **pve (.241) Ryzen 16c/62G = einziger echter
  RAM+CPU-Headroom** (in alter T-0197-Recon zu Unrecht aussortiert). **pz2 hat KEIN ZFS** (NVMe=LVM)
  → git-only-Failover statt ZFS-Repl. State-Layer = git/Forgejo universell + ZFS-Repl nur pz1↔pz3.
- **✅ TOPOLOGIE-GATE GELÖST (Christin 2026-06-13 ~03:48, via orchestrator-Session gehandet, commit
  1fb9c37):** Topologie = **Szenario R (pve .241 rein)**; pz2-Failover = **git-only** (Owner-Call).
  Verteilung R: pve = CPU-schwer/aktiv + Failover-Absorber (16c/21G); pz3 Workhorse 6–8 + fleet-core-LXC;
  pz2 CPU-leicht 4–6 (NVMe, git-only); pz1 minimal 0–2.
- **🔴 VERBLEIBENDE Cutover-Gates (NICHT durch Topologie gedeckt):** die **4 R22-Cutover-Blocker**
  (Design-Doc §8, topologie-unabhängig + teils cross-component) + **echter cross-lab Codex-Refute** (der
  bisherige war same-model) + **Schnüffi** (LAN-Bind) + **Netzi** (host-nftables).
- **▶ NÄCHSTE AUTONOME EINHEIT (jetzt unblockiert) — Deliberate-Mode Hardening-Spec für Szenario R:**
  die 4 R22-Blocker konkret ausarbeiten (Design-vor-Build) + mit Ownern koordinieren:
  (1) **Fencing/Lease gg. Split-Brain** → Broker-Epoch/Generation + STONITH `pct stop` via Cluster-API
  vor respawn — Owner Broker/claude-peers-mcp.
  (2) **spawnerd-Reconcile-Loop** (deklarative Peer→Node-Soll-Map in git; Anti-Affinity fleet-core ≠
  heavy-peer-Node) — Owner spawnerd/orchestrator.
  (3) **App-konsistente Snapshots fürs agent-master `data/`** (PVE-Repl gibt KEINE App-Konsistenz —
  pre-snapshot `wal_checkpoint(TRUNCATE)`/`.backup` + JSON atomic-rename) — Owner agent-master (Brettli).
  (4) **Repl-Health-Monitoring VOR Cutover** (Kuma: FailCount==0 + Snapshot-Alter + Alert-Test; toten
  102-0 vorher fixen) — Owner Kuma (zysoypfg).
  Primärquellen-Belege in Merkel (3 Entries: HA-Fencing · ZFS-Repl-Konsistenz · T-0204-Synthese).
- **INFLUX-Strang ✅ ZU** (orchestrator-Session erledigt): Netzi-Creds gitignored
  `/home/dev/.fleet-secrets/influx-brettli.env`, Brettli verifiziert (/usage+/llm+/matrix grün);
  `/skills`-Leere = CLAUDE_CONFIG_DIR-Pfad-Bug in Brettlis Code (Einzeiler, gated). Voller Stand:
  `orchestrator/.planning/SCHRAUBI-STATUS.md`.

### Diese Session erledigt (Session-10)
1. **Git-Korruption repariert** — Vorgänger-Session crashte nach T-0189-Commit → 4 leere Git-Objekte (`fatal: bad object HEAD`); via origin-Fetch behoben, kein Verlust (alles war gepusht). Leere Objekte liegen in `/tmp/git-corrupt-backup/`.
2. **T-0189-Closeout** — M3-Benchmark-Bericht + Hub-Meldung (Tiering + 2 Gateway-Fixes: minimax-Direct-Calls brauchen max_tokens≥1024-Guard; Non-Stream leakt `<think>`). Hub-Paket damit komplett.
3. **E1 ring_rest KOMPLETT** — 7/7 Hosts bootstrapped, 28/28 Oracles PASS, **Schnüffi-Final-Stempel**. Log: `.planning/E1-ring-rest-rollout-log.md`.
4. **T-0196 Phase 1** (Coder-Host Recon+Plan) — `.planning/T0196-coder-host-recon-plan.md`. An Hub: R22-Docker-Entscheid + Coder-Token nötig (s.u.).
5. **Agentless-VM Foothold-Map** — `.planning/agentless-vm-foothold-map.md`. PBS sofort bootstrap-bar, Rest braucht Owner/Reboot.
6. **`.148`-IP-Flap gelöst** — unpoller-LXC 148 (dienst-tot, 3× verifiziert) war Squatter auf loxberrys legitimer .148; **LXC 148 gestoppt** (reversibel). Netzi ARP-verifiziert sauber.
7. **Deploytest-Fixtures 150+151 destroyed** (--purge, ~36G frei auf .240). Kuma-Netdata-GO erteilt. Netzi-v6-default-deny + Wildcard-DNS-Findings geklärt.
8. **SSH-Topologie-Cleanup 7/7 LXCs** (Frischi-Übergabe) — ssh.socket masked, klassischer ssh.service single-mode; Codex-refuted + reboot-verifiziert (trixie+bookworm). Entblockt Frischis komplette SSH-Härtung. Doku `.planning/ssh-topology-cleanup-design.md`.

### OFFEN — alle extern-geblockt (resume hier)
- **T-0197 (löst/erweitert T-0196) — HA-Fleet-LXC auf pz1+pz3:** Phase-1-Recon+Plan FERTIG (`.planning/T0197-ha-fleet-lxc-recon-plan.md`, be3632f). **Wartet auf Hub/Christin-Review + 1 Christin-Entscheid (8G-LXC tight jetzt vs +16G RAM Hardware in pz1+pz3).** Kernfakten: HA hier = ZFS-Replikation (kein Shared-Storage) → Restart-Failover <1min-Verlust; RAM knapp (pz1 3,4G/pz3 7,3G frei, Fleet braucht 6,1G); Migration-Source = Coding-Workspace. Build+Cutover = gated + Codex-Refute + Schnüffi (Bind-to-LAN) + Netzi (Baustein 3). **Das ist jetzt der Haupt-Strang; T-0196-Coder-Plan ist die Migrations-Quelle.**
- **T-0196 Phase 2 (BAU):** durch T-0197 abgelöst (Recon-Fakt bleibt: Fleet = Coder-Workspace `coder-chloepriceless-Coding`). Ex-Blocker (Hub-Docker-Entscheid/Coder-Token) nur noch relevant falls Christin doch Coder-Container statt HA-LXC will — unwahrscheinlich nach T-0197. (a) Docker-Capability des Fleet-Containers: **rootless DinD empfohlen** vs privileged vs docker.sock (abgeraten); (b) **Coder-Admin-Token** (Christin/Hub mintet in Coder-UI http://192.168.42.42:7080); (c) Owner-User-Frage. Plan steht. Secret: `.secrets/coder-host.env` (600, gitignored). Recon-Kern: Fleet = Coder-Workspace `coder-chloepriceless-Coding` (172.17.0.2), Hub=coder_app :7890, Template `ai-devbox`, Host 8C/15G/123G frei. **Coder-CLI auf dem Host NICHT eingeloggt** → Recon lief read-only über `docker exec coder-db psql`.
- **E1 Phase 2:** Frischi fährt; PBS (106/.117) sofort (Fleet-Key trusted, `bootstrap.yml -l PBS -e ansible_user=root`), Rest Owner/Reboot. ⚠️ Frischis Canary-Fund: ring_rest nutzt **socket-aktiviertes SSH** (`ssh.socket ListenStream=22` = v6-Quelle) → v6-Hardening muss die Socket treffen, NICHT sshd `AddressFamily inet`.
- **E2 Semaphore-Key:** nach Frischis SSH-Hardening → separater Key (from=.176) + **Codex-Refute auf E2-Diff VOR Deploy** (Schnüffi: eigenes Gate).
- **Christin-Gates (awaiting_joerg im Ledger):** LXC148-Destroy (gestoppt, Go/No-Go), Git-Reroute (Forgejo↔GitHub-Mirror), MaxMind-City-Key, Wildcard-`*.bikini.bottom.zone`-Löschung (Netzi leitet).

## Resume-Instruktionen
- Nach Respawn/"weiter": `project-open-tasks.md` CLOSEOUT-Block + dieses HANDOVER lesen. **Keine unblockierte autonome Arbeit übrig** — wenn Hub den Docker-Weg+Token liefert → T-0196 Phase 2 (additiv: `fleet_net` anlegen, `fleet-devbox`-Template als ai-devbox-Klon pushen, 2 Workspaces). Peer-Messages wecken die Session.
- **Zugänge:** Nodes `ssh -i ~/.ssh/orchestrator_ed25519 root@<node-ip>` (pz1=.68, pz2=.42, pz3=.106, pve=.241, proxmox=.240 TABU außer read/stop). LXC-intern `pct exec <id>`. ansible-control = LXC 155 @ pz3 (.174-Key, Repo /root/fleet-ansible). Semaphore = LXC 157 @ pz2/.176 (API nur LAN/WG → via pct exec curlen). NetBoard-Creds `curl -ks https://192.168.20.150/api/credentials[/<id>]`. Coder-Host `chrissi@192.168.42.42` (Key-Auth steht). Merkel-Ingest `POST http://192.168.20.81:8000/ingest`.
- **GUI-Repo selbst:** v0.6.2 live auf .171, v0.6.3 committed-nicht-deployed (T-0061-Dashboard-Fix war der alte offene Punkt, S6-Handover). Frontend-Build-Trap + prod-deploy-Prozedur: repo-memory `prod-deployment` + `frontend-build-node-modules-trap`. STATE/ROADMAP-Handler parsen dies Repo nicht → direkt editieren.
- Ledger `POST localhost:7890/api/agent-open-tasks`. Tätigkeitsberichte `POST /api/activity-reports`.
