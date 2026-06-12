# HANDOVER — Proxmox-GUI Head / Infra-LEAD ("Schraubi")

**Updated:** 2026-06-12 ~15:20 · **Branch:** `master` @ `d726b0d` (pushed, clean tree, in sync).
**Operator:** Christin (von Perbandt) / Bikini Bottom Capital GmbH. **Peer-IDs (Fleet-Restart 13:57):** Hub=`07lvalhu`, Schnüffi=`8hc8vpgk`, Frischi=`7kmn9ddq`, Netzi=`dr8s8wtb`, Kuma=`zysoypfg`, Patchi=`328j1uc0`.

## State: `autonomous_open=0` — alles autonom Machbare ist durch. 5 Punkte extern-geblockt.
Durable Detail in repo-memory **`project-open-tasks.md`** (CLOSEOUT-Block ~15:10 zuerst lesen).

### Diese Session erledigt (Session-10)
1. **Git-Korruption repariert** — Vorgänger-Session crashte nach T-0189-Commit → 4 leere Git-Objekte (`fatal: bad object HEAD`); via origin-Fetch behoben, kein Verlust (alles war gepusht). Leere Objekte liegen in `/tmp/git-corrupt-backup/`.
2. **T-0189-Closeout** — M3-Benchmark-Bericht + Hub-Meldung (Tiering + 2 Gateway-Fixes: minimax-Direct-Calls brauchen max_tokens≥1024-Guard; Non-Stream leakt `<think>`). Hub-Paket damit komplett.
3. **E1 ring_rest KOMPLETT** — 7/7 Hosts bootstrapped, 28/28 Oracles PASS, **Schnüffi-Final-Stempel**. Log: `.planning/E1-ring-rest-rollout-log.md`.
4. **T-0196 Phase 1** (Coder-Host Recon+Plan) — `.planning/T0196-coder-host-recon-plan.md`. An Hub: R22-Docker-Entscheid + Coder-Token nötig (s.u.).
5. **Agentless-VM Foothold-Map** — `.planning/agentless-vm-foothold-map.md`. PBS sofort bootstrap-bar, Rest braucht Owner/Reboot.
6. **`.148`-IP-Flap gelöst** — unpoller-LXC 148 (dienst-tot, 3× verifiziert) war Squatter auf loxberrys legitimer .148; **LXC 148 gestoppt** (reversibel). Netzi ARP-verifiziert sauber.
7. **Deploytest-Fixtures 150+151 destroyed** (--purge, ~36G frei auf .240). Kuma-Netdata-GO erteilt. Netzi-v6-default-deny + Wildcard-DNS-Findings geklärt.

### OFFEN — alle extern-geblockt (resume hier)
- **T-0196 Phase 2 (BAU):** wartet auf Hub. (a) Docker-Capability des Fleet-Containers: **rootless DinD empfohlen** vs privileged vs docker.sock (abgeraten); (b) **Coder-Admin-Token** (Christin/Hub mintet in Coder-UI http://192.168.42.42:7080); (c) Owner-User-Frage. Plan steht. Secret: `.secrets/coder-host.env` (600, gitignored). Recon-Kern: Fleet = Coder-Workspace `coder-chloepriceless-Coding` (172.17.0.2), Hub=coder_app :7890, Template `ai-devbox`, Host 8C/15G/123G frei. **Coder-CLI auf dem Host NICHT eingeloggt** → Recon lief read-only über `docker exec coder-db psql`.
- **E1 Phase 2:** Frischi fährt; PBS (106/.117) sofort (Fleet-Key trusted, `bootstrap.yml -l PBS -e ansible_user=root`), Rest Owner/Reboot. ⚠️ Frischis Canary-Fund: ring_rest nutzt **socket-aktiviertes SSH** (`ssh.socket ListenStream=22` = v6-Quelle) → v6-Hardening muss die Socket treffen, NICHT sshd `AddressFamily inet`.
- **E2 Semaphore-Key:** nach Frischis SSH-Hardening → separater Key (from=.176) + **Codex-Refute auf E2-Diff VOR Deploy** (Schnüffi: eigenes Gate).
- **Christin-Gates (awaiting_joerg im Ledger):** LXC148-Destroy (gestoppt, Go/No-Go), Git-Reroute (Forgejo↔GitHub-Mirror), MaxMind-City-Key, Wildcard-`*.bikini.bottom.zone`-Löschung (Netzi leitet).

## Resume-Instruktionen
- Nach Respawn/"weiter": `project-open-tasks.md` CLOSEOUT-Block + dieses HANDOVER lesen. **Keine unblockierte autonome Arbeit übrig** — wenn Hub den Docker-Weg+Token liefert → T-0196 Phase 2 (additiv: `fleet_net` anlegen, `fleet-devbox`-Template als ai-devbox-Klon pushen, 2 Workspaces). Peer-Messages wecken die Session.
- **Zugänge:** Nodes `ssh -i ~/.ssh/orchestrator_ed25519 root@<node-ip>` (pz1=.68, pz2=.42, pz3=.106, pve=.241, proxmox=.240 TABU außer read/stop). LXC-intern `pct exec <id>`. ansible-control = LXC 155 @ pz3 (.174-Key, Repo /root/fleet-ansible). Semaphore = LXC 157 @ pz2/.176 (API nur LAN/WG → via pct exec curlen). NetBoard-Creds `curl -ks https://192.168.20.150/api/credentials[/<id>]`. Coder-Host `chrissi@192.168.42.42` (Key-Auth steht). Merkel-Ingest `POST http://192.168.20.81:8000/ingest`.
- **GUI-Repo selbst:** v0.6.2 live auf .171, v0.6.3 committed-nicht-deployed (T-0061-Dashboard-Fix war der alte offene Punkt, S6-Handover). Frontend-Build-Trap + prod-deploy-Prozedur: repo-memory `prod-deployment` + `frontend-build-node-modules-trap`. STATE/ROADMAP-Handler parsen dies Repo nicht → direkt editieren.
- Ledger `POST localhost:7890/api/agent-open-tasks`. Tätigkeitsberichte `POST /api/activity-reports`.
