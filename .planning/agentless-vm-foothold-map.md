# Agentless-VM Foothold-Map (E1-Phase 2 Vorbereitung)

**Datum:** 2026-06-12 · **Zweck:** Für jede agentlose Linux-VM (kein qemu-guest-agent → kein `qm guest exec`, kein `pct exec`) den **Erst-Foothold-Kanal** für den ansible-Key-Rollout bestimmen. Read-only erhoben (Config + DHCP-Lease + harmloser SSH-Connect-Test mit Fleet-Key).

## Foothold-Kanäle (Möglichkeiten je VM)
1. **Fleet-Key root-SSH** (`orchestrator_ed25519`) — wenn die VM den Fleet-Pubkey schon trusted → bester Kanal, sofort nutzbar.
2. **Owner-/Appliance-Credential** — SSH läuft, aber Fleet-Key nicht hinterlegt → Owner muss Key hinterlegen ODER Erst-Login per bekanntem Passwort.
3. **cloud-init** — VM hat ein CI-Drive → Key-Injektion via CI-Regen + Reboot (Owner-Fenster, weil Reboot).
4. **Konsole (VNC) Keystroke-Injektion** — Last Resort, braucht OS-Login-Creds.

## Ergebnis

| VM (VMID@Node) | aufgelöste IP | qemu-agent | SSH:22 | Fleet-Key | **Foothold-Kanal** |
|---|---|---|---|---|---|
| **PBS** (106@proxmox) | .117 | nein | ✅ up | **✅ akzeptiert** (`OK:pbs`) | **(1) Fleet-Key root-SSH — SOFORT bereit** |
| mynode-btc (112@pve) | .101 | nein | ✅ up | ✗ denied | (2) myNode-Appliance-Cred (Owner) |
| docker (108@pz1) | .114 | nein | ✅ up | ✗ denied | (2) Owner-Cred / Key hinterlegen |
| ubuntu (130@pve) | — (keine ARP, idle/aus?) | nein | — | — | (3) cloud-init (hat CI-Drive) ODER erst Reachability klären |
| fileshare (118@proxmox) | .128 (net1 vmxnet3) | nein | ✗ timeout | — | (2/4) kein sshd erreichbar — Owner/Konsole (vmxnet3+queues → NAS-Appliance?) |
| debian (135@pz1) | .33 (DHCP) | nein | ✗ refused | — | (3/4) kein sshd — cloud-init/Konsole; IP .33 plausibel falsch |
| loxberry (116@pz1) | **.148 — KONFLIKT** (s.u.) | nein | (∗) | — | (2) Loxberry-Appliance-Cred — **erst IP-Konflikt lösen** |
| ~~debian (138@pve)~~ | — | n/a | n/a | n/a | **MIS-KLASSIFIZIERT: ist ein LXC**, kein agentless QEMU → `pct exec`-Foothold (Standard) |

## 🔴 Finding für Netzi/Patchi: IP-Konflikt .148 (unpoller ↔ loxberry)
- **LXC 148 „unpoller"** hat **statisch** `ip=192.168.20.148/24` (config, hwaddr BC:24:11:62:2F:CA), intern hostname `unpoller`, läuft.
- **VM 116 „loxberry"** (hwaddr BC:24:11:5D:AC:B8) hat eine **DHCP-Lease auf .148** (UDM `/data/udapi-config/dnsmasq.lease`: `bc:24:11:5d:ac:b8 192.168.20.148 loxberry`).
- → **Zwei Hosts beanspruchen .148.** ARP gewinnt aktuell die statische unpoller-LXC (E1-Verify lief korrekt gegen unpoller, expected_hostname-Gate=unpoller PASS — **E1 hat NICHT loxberry getroffen**, verifiziert). Loxberrys echte erreichbare IP ist damit unklar. **Netzi:** DHCP-Pool vs. statische .148 entzerren (statische .148 aus dem DHCP-Range nehmen oder loxberry feste IP geben). Verzahnt mit dem unpoller-Dekommission-Kandidaten (Kuma) — fällt unpoller weg, löst sich der Konflikt teilweise von selbst, aber die DHCP/Static-Überlappung bleibt ein Hygiene-Thema.

## Empfehlung für E1-Phase 2 (an Frischi)
- **Sofort machbar:** PBS (.117) — Fleet-Key trusted, gleiche Bootstrap-Mechanik wie ring_rest (Foothold steht, kein Temp-Key nötig). 1 Host, dann verifizieren.
- **Owner-Schritt nötig** (Key/Cred): mynode-btc, docker — Owner hinterlegt Fleet-Pubkey ODER gibt Erst-Login → dann Bootstrap.
- **Reachability/Reboot-Fenster nötig:** ubuntu (CI), debian-135, fileshare — erst Erreichbarkeit/Owner klären.
- **Vor loxberry:** IP-Konflikt .148 lösen (Netzi).
- **debian138 ist KEIN agentless-QEMU** → aus der agentless-Liste streichen (LXC, `pct exec`).

## ✅ UPDATE: .148-Konflikt GELÖST (2026-06-12 ~15:15)
Netzi-Live-Messung korrigiert meine Annahme: **.148 gehört LEGITIM loxberry** (UDM-DHCP-Reservierung `dhcp-host bc:24:11:5d:ac:b8→.148` + DNS-Record `loxberry.bikini.bottom.zone`). unpoller-LXC war der **Squatter** (statische .148 per IP=CT-ID-Konvention) und der Konflikt **flappte aktiv** (Netzi + Kumas Checkmk-CRIT belegt). unpoller dreifach als **dienst-tot** verifiziert (kein Prozess/systemd-Unit/Metrics-Port, nur ungenutztes Binary). → **LXC 148 GESTOPPT** (reversibel, `pct start 148` bringt zurück); `.148` löst jetzt eindeutig auf loxberry auf. **Permanenter Destroy = Go/No-Go an Christin/Hub** (irreversibel, real-benannter Host). Kuma stellt Checkmk auf einen sauberen „loxberry"-Host um. loxberrys echte Erreichbarkeit auf .148 damit wiederhergestellt → Foothold-Kanal loxberry = Appliance-Cred auf .148.

**Status:** Foothold-Kanäle bestimmt. Kein Bootstrap ausgeführt (Phase-2 braucht Owner-Schritte + Reboot-Fenster + Frischi-Playbook-Lauf). Nicht-Seed-Daten — Patchi reconciliert gegen Live-Scan.
