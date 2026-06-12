# T-0196 — Coder-Host: Recon & Plan (Fleet-Container + AI-Workspace)

**Datum:** 2026-06-12 · **Phase 1 = Recon (read-only) + Plan.** Kein Build vor Hub-Review.
**Host:** `192.168.42.42` (`coder-host`), SSH `chrissi@` (Fleet-Pubkey hinterlegt, Key-Auth steht; Passwort nicht weiter rumgereicht). Secret in `.secrets/coder-host.env` (600, gitignored).

## 1. IST-Topologie (empirisch verifiziert)

**Host:** Debian 13 (trixie), Kernel 6.12, **8 Cores / 15 GiB RAM (9,2 GiB frei) / 123 GB Disk frei** → reichlich Headroom für 2 weitere Container. sudo für chrissi = **passwortpflichtig** (kein NOPASSWD). Mitglied der `docker`-Gruppe (Docker ohne sudo).

**Coder = docker-compose-Stack** (nicht nativ):
| Container | Image | Netz | Rolle |
|---|---|---|---|
| `coder` | ghcr.io/coder/coder:latest **v2.34.2** | coder_internal(172.20.0.2) + traefik_public(172.19.0.3) | Coder-Server, `CODER_ACCESS_URL=http://192.168.42.42:7080`, `0.0.0.0:7080` |
| `coder-db` | postgres:16 | coder_internal(172.20.0.3) | Coder-DB (healthy) |
| `traefik` | traefik:v3.6 | traefik_public(172.19.0.2) | terminiert `:80/:443/:8080` |

**Workspaces** (1 Template, 2 Workspaces):
| Workspace | Owner | Template | Status | Container | Netz |
|---|---|---|---|---|---|
| **Coding** | chloepriceless | ai-devbox | start | `coder-chloepriceless-Coding` | **bridge 172.17.0.2** |
| spacey | meintechblog | ai-devbox | exited (6 W.) | `coder-meintechblog-spacey` | bridge |

Users: `chloepriceless`, `meintechblog`, `prebuilds` (system).

**🔑 Schlüssel-Erkenntnis:** **Die laufende Fleet (diese Session) IST der `Coding`-Workspace** (172.17.0.2 = die IP, die der Hub nannte). Der Hub-Server läuft als `coder_app` auf `localhost:7890` IN diesem Container. Template `ai-devbox` baut per `docker_image.build{}` aus einem Dockerfile (daher `ai-devbox-<uuid>`-Images), mountet Host-Creds (`/srv/ai-creds/{codex,claude}` → ins Home) und setzt `host.docker.internal → host-gateway`. Workspaces hängen am **default `bridge`** (kein `networks_advanced`) → IP-erreichbar untereinander, aber keine DNS-Namensauflösung, geteiltes Default-Netz.

**Coder-CLI auf dem Host:** v2.32.0, **nicht eingeloggt** + Version-Mismatch zum Server (v2.34.2). Recon lief daher read-only über die `coder-db` (psql) + `docker inspect` — Coder/Workspaces unangetastet.

## 2. Ziel (Hub/Christin, T-0196)
- **(a) AI-Workspace** für Christins direkte Peer/Session-Aufrufe mit Fleet-Zugriff.
- **(b) Fleet-Container** für den Hub, in dem er eigene **Test-Container** starten kann.
- Beide + die laufende Fleet (`Coding`) gegenseitig erreichbar. Additiv, `Coding`/`spacey` NICHT anfassen/neustarten.

## 3. Plan (Vorschlag — Design-Entscheidung für den Hub markiert)

### 3a. Bau-Weg: NEUES Coder-Template, nicht Hand-Container
Beide neuen Container als **Coder-Workspaces aus einem neuen Template** `fleet-devbox` (Klon von `ai-devbox`, additiv) — damit Coder Lifecycle/Rebuild/Stop managed, konsistent mit der bestehenden Fleet. `ai-devbox` (Coding/spacey) bleibt unberührt. AI-Workspace = normaler ai-devbox-Klon. Fleet-Container = derselbe Klon + Docker-Capability + Extra-Netz (über Template-Parameter).

### 3b. 🔴 ENTSCHEIDUNG für den Hub — Docker-Capability des Fleet-Containers
Der Hub braucht im Fleet-Container Docker, um Test-Container zu starten. Drei Wege, scharf unterschiedliche Privilege-Surface (R22 — security/infra-kritisch, geht VOR Bau durch Codex-Refute + Schnüffi):

| Weg | Isolation | Surface | Bewertung |
|---|---|---|---|
| **`/var/run/docker.sock`-Mount** (docker-out-of-docker) | KEINE | Fleet-Container = **Host-Root**: kann privilegierte Container starten, `/` mounten, **alle anderen Workspace-Volumes lesen** (chloepriceless-/Christin-Creds!) | **ABGERATEN** — exakt der Blast-Radius, den wir sonst vermeiden |
| **`--privileged` DinD** | innerer Daemon getrennt | privileged = Host-Devices/Kernel-Zugriff, Host-Escape-Risiko, aber kein direkter Host-Daemon | Mittel — Test-Container nested/isoliert, aber privileged bleibt scharf |
| **Rootless DinD** (eigener dockerd im User-NS, fuse-overlayfs) | stark (User-Namespace) | KEIN Host-Privileg, Test-Container voll im User-NS gekapselt | **EMPFEHLUNG** — sicherste Variante, deckt „Hub startet Test-Container" voll ab |
| *(sysbox-runc)* | sehr stark, ohne privileged | braucht Host-Install von sysbox (additive Host-Änderung, eigenes GO) | Upgrade-Pfad, falls rootless zu limitiert |

**Meine Empfehlung: Rootless DinD** als Default, sysbox als Upgrade falls nötig. **Klar GEGEN docker.sock-Mount** (hands Host-Root an den Fleet-Container). — Das ist die eine Stelle, wo ich vor dem Bau ein Hub-Go/Schnüffi-Review brauche.

### 3c. Networking — alle drei gegenseitig erreichbar
- Neues user-defined bridge-Netz **`fleet_net`** → die zwei NEUEN Container joinen es → **DNS-Namensauflösung** untereinander (fleet ↔ ai-workspace).
- Die laufende **`Coding`** hängt am default `bridge`. Zwei Optionen, sie einzubinden:
  - **Zero-Risk (Default):** neue Container ZUSÄTZLICH an `bridge` hängen → IP-Reach zu `Coding` (172.17.0.2) **ohne `Coding` anzufassen**.
  - **Komfort (DNS zu Coding):** `docker network connect fleet_net coder-chloepriceless-Coding` — additiv, **kein Restart**, aber berührt den Live-Container → **nur mit Hub-GO** (Guardrail). Default = Zero-Risk, Komfort später im Fenster.
- `host.docker.internal → host-gateway` (wie ai-devbox) bleibt für LAN-Zugriff (192.168.20.x via Host-NAT).

### 3d. Reihenfolge (alles additiv, Phase 2 erst nach Hub-Review)
1. `fleet_net` anlegen (`docker network create`, berührt nichts Bestehendes).
2. `fleet-devbox`-Template als ai-devbox-Klon + Template-Parameter (`enable_docker`, `docker_mode=rootless|privileged`, `extra_network=fleet_net`) → `coder templates push` (neues Template, additiv).
3. AI-Workspace provisionieren (chrissi/Christin-Owner, kein Docker).
4. Fleet-Workspace provisionieren (Hub-Owner, Docker nach 3b-Entscheid).
5. Verify-Oracles: (i) beide Container laufen, (ii) `fleet → ai-workspace` ping-by-name, (iii) `fleet → 172.17.0.2 (Coding)` erreichbar, (iv) `fleet`: `docker run hello-world` im eigenen Daemon OK, (v) Host-Escape-Negativtest (Fleet-Container darf NICHT die `Coding`-Volume-Mounts sehen).

## 4. Offene Punkte / Gates
- **3b Docker-Capability** = R22-Entscheidung → Hub-GO + Codex-Refute + Schnüffi VOR Bau.
- **Coder-CLI-Login:** für `templates push`/`workspace create` brauche ich entweder einen Coder-Admin-Token (Christin/Hub mintet in der Coder-UI :7080) ODER ich provisioniere die Container „roh" per Docker (dann aber NICHT Coder-managed — schlechter). **Sauber: Coder-Token.** → an Hub: Token besorgen.
- **Owner-Frage:** Fleet-Workspace unter welchem Coder-User (neuer `hub`-User vs `chloepriceless`)? AI-Workspace unter `chrissi`/neuer `christin`-User?
- Findings nach Merkel (Host-Topologie) — kein Secret.

**Status Phase 1: FERTIG (read-only Recon + Plan).** Warte auf Hub-Review von 3b + Coder-Token, dann Phase 2 (additive Builds).
