# T-0316 — AUFTRAG an Schraubi (vm-deployment-gui): Wegwerf-LXC für ai-beacon-Spike

**Vom:** Hub (Orchestrator) · **Datum:** 2026-07-23 · **Domäne:** Fleet-Infra
**Kontext:** Christin evaluiert eine neue Fleet-Control-Plane. Spike B testet
**ai-beacon** (manusa/ai-beacon) — ein Multi-Machine-Dashboard mit Browser-Attach
in Claude-Code-Sessions. Details/Design: `orchestrator/.planning/FLEET-CONTROL-PLANE-DESIGN.md`.

## Warum du das machst (nicht der Hub)
Der Hub hat **keinen** PVE-Zugang (SSH auf alle Nodes = permission denied, keine
PVE-Creds am Hub). LXC-Provisionierung ist deine Domäne. Christin-Entscheid:
„über Schraubi".

## ⚠️ Wichtig: ai-beacon ist closed-source Early-Access
Nur Binaries/Container, Source noch nicht publiziert (Solo-Dev). Deshalb **isoliert
in einem eigenen Wegwerf-LXC** betreiben — nicht auf einem Produktions-Host, nicht
neben anderen Diensten. Der LXC ist explizit **disposable** (nach Spike löschbar).

## Aufgabe
1. **Wegwerf-LXC anlegen** auf einem Node mit Headroom (Vorschlag: **proxmox .240**,
   ~80 GB frei; alt. pz3). Debian 12/13, **2 Cores / 2–3 GB RAM / 12 GB Disk**,
   **nesting=1** (für Docker), unprivileged bevorzugt. `onboot=false` (Wegwerf),
   in der Beschreibung als „ai-beacon-spike (disposable, T-0316)" markieren.
   Statische IP oder DHCP-IP notieren.
2. **Docker installieren** (oder Community-Docker-LXC-Script nutzen).
3. **ai-beacon-Dashboard starten:**
   ```bash
   docker volume create ai-beacon
   docker run -d --name ai-beacon --restart unless-stopped \
     -e AI_BEACON_AUTH_PASSWORD='<setz ein Passwort, an Hub melden>' \
     -p 8080:8080 -v ai-beacon:/data \
     ghcr.io/manusa/ai-beacon:latest
   ```
4. **Zurückmelden an den Hub** (Ledger T-0316 `set --result` + wenn möglich
   send_message; sonst reicht Ledger): 
   - LXC **VMID + Node + IP**,
   - **Dashboard-URL** `http://<ip>:8080` + gesetztes Passwort,
   - den **Agent-Token**: `docker exec ai-beacon cat /data/token`
     (den braucht der Hub, um eine Wegwerf-Claude-Session als Agent anzubinden).

## Leitplanken
- Additiv, **keine** bestehenden Guests anfassen/neustarten.
- Kein Produktions-Host. Nur der neue LXC.
- Alles dokumentieren (VMID, IP, Passwort-Ort), damit der LXC sauber löschbar ist.

## Danach (macht der Hub, nicht du)
Der Hub bindet eine Wegwerf-Claude-Session via `ai-beacon`-CLI + Token an das
Dashboard und testet Browser-Attach/Spawn. Reine Spike-Bewertung.
