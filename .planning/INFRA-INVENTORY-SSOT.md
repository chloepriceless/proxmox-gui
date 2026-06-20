# Fleet-Infra-Inventar (SSOT) — Cluster01

**Cluster:** Cluster01
**Nodes:** 5 (proxmox, pve, pz1, pz2, pz3)
**Guests gesamt:** 60 (LXC: 43 | VM: 17) — autoritativ gegen `/etc/pve` bestätigt (Tabelle = 60 Zeilen, vollständig)
**Stand:** 2026-06-20 ~22:45 CEST, read-only Recon-Snapshot (Multi-Agent-Workflow, 5/5 Nodes erreicht). Keine Mutationen. Werte = Momentaufnahme; fehlende Werte als "-".
**Provenance/Datenqualität:** privileged-Spalte unabhängig gegen `/etc/pve` re-verifiziert (2 Recon-Agent-Fehlklassifikationen korrigiert: 131 KI-Container, 158 protectbridge — beide privileged); Guest-Zählung ground-truth-bestätigt (43 LXC + 17 VM); übrige Felder (Cores/RAM/Disk/IP/onboot) per-Node-Recon, best-effort (DHCP-IPs = Snapshot-Stand). Bei security-relevanten Entscheidungen Einzelwerte am Live-System gegenprüfen.

## Gesamt-Tabelle aller Guests (sortiert nach Node, dann VMID)

| VMID | Name | Node | Typ | Priv | Cores | RAM(MB) | Disk(GB) | Bridge/VLAN | IP | onboot | Status | Tags |
|------|------|------|-----|------|-------|---------|----------|-------------|-----|--------|--------|------|
| 104 | win11 | pve | VM | - | 8 | 16384 | 91 | vmbr0 | - | true | running | - |
| 103 | GameSrv01 | pve | LXC | false | 8 | 18432 | 100 | vmbr0 | 192.168.20.83 | true | running | - |
| 107 | plex | pve | LXC | false | 8 | 6144 | 125 | vmbr0/VLAN4 | 192.168.41.86 | true | running | proxmox-helper-scripts |
| 111 | backup02 | pve | VM | - | 4 | 8192 | 90 | vmbr0 | - | false | stopped | - |
| 112 | mynode-btc | pve | VM | - | 4 | 8192 | 1782580 | vmbr0 | - | true | running | - |
| 113 | fileflows | pve | LXC | false | 2 | 2048 | 8 | vmbr0 | 192.168.20.76 | true | running | automation;community-script;media |
| 117 | sonarr | pve | LXC | false | 2 | 1024 | 4 | vmbr0 | 192.168.20.160 | true | running | arr;community-script |
| 119 | win11-remote | pve | VM | - | 4 | 4096 | 150 | vmbr0/VLAN3 | - | true | running | - |
| 120 | notifiarr | pve | LXC | false | 1 | 512 | 2 | vmbr0 | 192.168.20.38 | true | running | arr;community-script |
| 121 | sabnzbd | pve | LXC | false | 2 | 2048 | 5 | vmbr0/VLAN6 | 192.168.30.135 | true | running | community-script;downloader |
| 122 | sonarr-anime | pve | LXC | false | 2 | 1024 | 4 | vmbr0 | 192.168.20.116 | true | running | arr;community-script;off |
| 123 | radarr | pve | LXC | false | 2 | 2048 | 9 | vmbr0 | 192.168.20.129 | true | running | arr;community-script |
| 124 | webanwendung | pve | LXC | false | 1 | 512 | 8 | vmbr0 | - | false | stopped | - |
| 130 | ubuntu | pve | VM | - | 2 | 2048 | 7 | vmbr0 | - | true | running | community-script |
| 131 | KI-Container | pve | LXC | true | 8 | 25600 | 150 | vmbr0 | - | false | stopped | - |
| 132 | WinEmbedd2013 | pve | VM | - | 1 | 2048 | 32 | vmbr0 | - | false | stopped | - |
| 134 | DVhub | pve | LXC | false | 2 | 8192 | 55 | vmbr0 | 192.168.20.66 | true | running | community-script;os |
| 138 | debian | pve | LXC | false | 2 | 4096 | 10 | vmbr0 | 192.168.20.54 | true | running | community-script;os |
| 139 | debian | pve | VM | - | 8 | 25600 | 200 | vmbr0 | - | true | running | community-script |
| 145 | tapsi | pve | LXC | true | 2 | 2048 | 12 | vmbr0 | 192.168.20.168 | true | running | - |
| 151 | dvhub-manual | pve | VM | - | 4 | 8192 | 60 | vmbr0 | 192.168.20.197 | false | running | - |
| 100 | grafana | pz1 | LXC | false | 2 | 2048 | 7 | vmbr0 | 192.168.20.153 | true | running | community-script;monitoring;visualization |
| 101 | HomeAssistant-USB | pz1 | VM | - | 2 | 4096 | 62 | vmbr0 | 192.168.20.22 | true | running | community-script |
| 108 | docker | pz1 | VM | - | 2 | 2048 | 108 | vmbr0 | - | true | running | community-script |
| 116 | loxberry | pz1 | VM | - | 2 | 4096 | 16 | vmbr0 | - | true | running | - |
| 126 | victoriametrics | pz1 | LXC | false | 2 | 2048 | 16 | vmbr0/VLAN42 | 192.168.20.163 | true | running | community-script;database |
| 127 | mqtt | pz1 | LXC | false | 1 | 512 | 2 | vmbr0 | 192.168.20.34 | true | running | community-script;mqtt |
| 135 | debian | pz1 | VM | - | 2 | 2048 | 8 | vmbr0 | - | true | running | community-script |
| 148 | unpoller | pz1 | LXC | false | 1 | 256 | 4 | vmbr0 | 192.168.20.148 | - | stopped | - |
| 200 | caddy-proxy | pz1 | LXC | false | 1 | 256 | 4 | vmbr0 | 192.168.20.200 | true | running | - |
| 109 | fileflows | pz2 | LXC | true | 2 | 2048 | 8 | vmbr0 | 192.168.20.127 | true | running | automation;community-script;media |
| 110 | iventoy | pz2 | LXC | true | 1 | 512 | 102 | vmbr0 | - | true | running | community-script;pxe-tool |
| 114 | archivebox | pz2 | LXC | false | 2 | 1024 | 8 | vmbr0 | 192.168.20.90 | true | running | archive;bookmark;community-script |
| 125 | nginxproxymanager | pz2 | LXC | false | 2 | 2048 | 8 | vmbr0/VLAN4 | 192.168.41.93 | true | running | community-script;proxy |
| 146 | merkel | pz2 | LXC | false | 4 | 6144 | 30 | vmbr0 | 192.168.20.81 | true | running | - |
| 147 | agent-dashboard | pz2 | LXC | false | 2 | 512 | 8 | vmbr0 | 192.168.20.179 | false | running | - |
| 149 | checkmk | pz2 | LXC | false | 2 | 4096 | 40 | vmbr0 | 192.168.20.169 | true | running | - |
| 154 | forgejo-runner | pz2 | LXC | true | 2 | 4096 | 30 | vmbr0 | 192.168.20.173 | true | running | infra |
| 156 | dolibarr | pz2 | LXC | false | 2 | 3072 | 20 | vmbr0 | 192.168.20.175 | true | running | dolibarr;infra |
| 157 | semaphore | pz2 | LXC | false | 2 | 3072 | 20 | vmbr0 | 192.168.20.176 | true | stopped | infra;semaphore |
| 158 | protectbridge | pz2 | LXC | true | 2 | 1024 | 8 | vmbr0 | 192.168.20.82 | true | running | - |
| 102 | homepage | pz3 | LXC | false | 2 | 512 | 6 | vmbr0 | 192.168.20.74 | true | running | community-script;dashboard |
| 105 | HomeAssistant-Main | pz3 | VM | - | 2 | 4096 | 62 | vmbr0 | 192.168.20.21 | true | running | community-script |
| 115 | node-red | pz3 | LXC | false | 1 | 1024 | 4 | vmbr0 | 192.168.20.57 | true | running | automation;community-script |
| 136 | influxdb3 | pz3 | LXC | false | 2 | 2048 | 8 | vmbr0 | 192.168.20.48 | true | running | community-script;database |
| 150 | semaphore | pz3 | LXC | false | 2 | 3072 | 20 | vmbr0 | 192.168.20.176 | true | running | infra;semaphore |
| 153 | forgejo | pz3 | LXC | false | 2 | 2048 | 40 | vmbr0 | 192.168.20.172 | true | running | - |
| 155 | ansible-control | pz3 | LXC | false | 2 | 2048 | 20 | vmbr0 | 192.168.20.174 | true | running | - |
| 128 | librenms | proxmox | LXC | false | 2 | 2048 | 8 | vmbr0 | 192.168.20.47 | true | running | community-script;monitoring |
| 129 | scanopy | proxmox | LXC | false | 2 | 3072 | 6 | vmbr0 | 192.168.20.170 | true | running | analytics;community-script |
| 133 | paperless | proxmox | LXC | false | 4 | 4096 | 15 | vmbr1 | 192.168.10.31 | true | stopped | - |
| 137 | debian | proxmox | LXC | false | 1 | 512 | 4 | vmbr0 | 192.168.20.165 | true | running | community-script;os |
| 140 | netboard | proxmox | LXC | false | 2 | 1024 | 8 | vmbr0 | 192.168.20.150 | true | running | - |
| 141 | op-connect | proxmox | LXC | false | 1 | 512 | 4 | vmbr0 | 192.168.20.99 | true | running | - |
| 143 | proxmox | proxmox | LXC | false | 2 | 2048 | 8 | vmbr0 | 192.168.20.171 | true | running | - |
| 144 | sammelmappe | proxmox | LXC | false | 2 | 1024 | 4 | vmbr0 | 192.168.20.126 | true | running | invoice;ocr;sammelmappe |
| 106 | ProxmoxBackupServer | proxmox | VM | - | 4 | 20480 | 50 | vmbr0 | 192.168.20.117 | true | running | - |
| 118 | fileshare | proxmox | VM | - | 4 | 4096 | 250 | vmbr0 | - | true | running | - |
| 142 | Coder | proxmox | VM | - | 8 | 16384 | 200 | vmbr0/VLAN42 | 192.168.42.42 | true | running | - |
| 152 | redroid-android-host | proxmox | VM | - | 4 | 6144 | 32 | vmbr0 | - | - | stopped | - |

> Hinweis: Node-Reihenfolge in dieser SSOT nach Recon-Reihenfolge (proxmox, pve, pz1, pz2, pz3); innerhalb der Tabelle ist je Node nach VMID sortiert. proxmox-Block steht am Ende der Tabelle.

---

## Node: proxmox (192.168.20.240)

- **pveversion:** pve-manager/9.2.3/d0fde103346cf89a (running kernel: 7.0.6-2-pve)
- **Host-RAM:** total 128697 MB / avail 80945 MB (used 47751 MB)
- **CPU:** 32 Cores · loadavg 5.70 4.52 2.84

| Storage | Typ | Total(GB) | Used(GB) | Avail(GB) |
|---------|-----|-----------|----------|-----------|
| PBS_BKUP1 | pbs | 14148.36 | 5179.83 | 8968.53 |
| PBS_BKUP1_5700 | pbs | 14148.36 | 5179.83 | 8968.53 |
| PBS_BKUP1_Root | pbs | 14148.36 | 5179.83 | 8968.53 |
| Samsung_1TB | zfspool | 3456.99 | 628.93 | 2828.05 |
| Samsung_4TB | dir | 0 | 0 | 0 |
| Samsung_4TB_2 | lvm | 0 | 0 | 0 |
| local | dir | 93.93 | 14.88 | 74.24 |
| local-lvm | lvmthin | 337.86 | 109.06 | 228.8 |
| nvme | lvm | 0 | 0 | 0 |

**Headroom:** 80945 MB avail RAM bei 14 running Guests (10 LXC + 4 VM laufend; redroid stopped). Reichlich Reserve, kein Engpass.

---

## Node: pve (192.168.20.241)

- **pveversion:** pve-manager/9.2.3/d0fde103346cf89a (kernel 6.14.11-4-pve)
- **Host-RAM:** total 63703 MB / avail 16555 MB (used 47148 MB)
- **CPU:** 16 Cores · loadavg 2.89 3.13 3.20

| Storage | Typ | Total(GB) | Used(GB) | Avail(GB) |
|---------|-----|-----------|----------|-----------|
| PBS_BKUP1 | pbs | 14152 | 5180 | 8969 |
| PBS_BKUP1_5700 | pbs | 14152 | 5180 | 8969 |
| PBS_BKUP1_Root | pbs | 14152 | 5180 | 8969 |
| Samsung_1TB | zfspool | 0 | 0 | 0 |
| Samsung_4TB | dir | 3575 | 1846 | 1729 |
| Samsung_4TB_2 | lvm | 3577 | 2245 | 1332 |
| local | dir | 94 | 52 | 37 |
| local-lvm | lvmthin | 600 | 9.6 | 590 |
| nvme | lvm | 894 | 575 | 319 |

**Headroom:** nur 16555 MB avail RAM bei vielen running Guests (am dichtesten belegter Node der Flotte gemessen an avail-RAM-Quote). Noch ueber dem 2-GB-Schwellwert, aber mit Abstand der heisseste Node — neue/groessere Guests hier vermeiden.

---

## Node: pz1 (192.168.20.68)

- **pveversion:** pve-manager/9.2.3/d0fde103346cf89a (running kernel: 7.0.6-2-pve)
- **Host-RAM:** total 15736 MB / avail 4415 MB (used 11320 MB)
- **CPU:** 4 Cores · loadavg 0.84 1.13 1.12

| Storage | Typ | Total(GB) | Used(GB) | Avail(GB) |
|---------|-----|-----------|----------|-----------|
| PBS_BKUP1 | pbs | 14152.4 | 5181.6 | 8970.8 |
| PBS_BKUP1_5700 | pbs | 14152.4 | 5181.6 | 8970.8 |
| PBS_BKUP1_Root | pbs | 14152.4 | 5181.6 | 8970.8 |
| Samsung_1TB | zfspool | 860.6 | 735.8 | 124.7 |
| Samsung_4TB | dir | 0 | 0 | 0 |
| Samsung_4TB_2 | lvm | 0 | 0 | 0 |
| local | dir | 93.9 | 14 | 75.1 |
| local-lvm | lvmthin | 319.6 | 3.6 | 316 |
| nvme | lvm | 0 | 0 | 0 |

**Headroom:** 4415 MB avail RAM bei 8 running Guests (4 LXC + 4 VM laufend; unpoller stopped). Knapp fuer einen 16-GB-Node; ueber dem 2-GB-Schwellwert, aber wenig Luft fuer weitere Guests. Samsung_1TB zu ~86% voll (124.7 GB frei) — beobachten.

---

## Node: pz2 (192.168.20.42)

- **pveversion:** pve-manager/9.2.3/d0fde103346cf89a (running kernel: 6.17.4-2-pve)
- **Host-RAM:** total 15738 MB / avail 8936 MB (used 6802 MB)
- **CPU:** 4 Cores · loadavg 2.77 2.21 1.88

| Storage | Typ | Total(GB) | Used(GB) | Avail(GB) |
|---------|-----|-----------|----------|-----------|
| PBS_BKUP1 | pbs | 14144 | 5179.4 | 8967.8 |
| PBS_BKUP1_5700 | pbs | 14144 | 5179.4 | 8967.8 |
| PBS_BKUP1_Root | pbs | 14144 | 5179.4 | 8967.8 |
| Samsung_1TB | zfspool | 0 | 0 | 0 |
| Samsung_4TB | dir | 0 | 0 | 0 |
| Samsung_4TB_2 | lvm | 0 | 0 | 0 |
| local | dir | 93.93 | 11.36 | 77.76 |
| local-lvm | lvmthin | 319.61 | 23.01 | 296.6 |
| nvme | lvm | 7154 | 5276 | 1878 |

**Headroom:** 8936 MB avail RAM bei 11 running Guests (semaphore 157 stopped). Komfortabel ueber dem Schwellwert. Traegt die Infra-Dienste (merkel, forgejo-runner, checkmk, dolibarr, protectbridge). nvme zu ~74% belegt (1878 GB frei).

---

## Node: pz3 (192.168.20.106)

- **pveversion:** pve-manager/9.2.3/d0fde103346cf89a (running kernel: 7.0.6-2-pve)
- **Host-RAM:** total 15736 MB / avail 6595 MB (used 9141 MB)
- **CPU:** 4 Cores · loadavg 0.44 0.45 0.59

| Storage | Typ | Total(GB) | Used(GB) | Avail(GB) |
|---------|-----|-----------|----------|-----------|
| PBS_BKUP1 | pbs | 14148 | 5179.7 | 8968.3 |
| PBS_BKUP1_5700 | pbs | 14148 | 5179.7 | 8968.3 |
| PBS_BKUP1_Root | pbs | 14148 | 5179.7 | 8968.3 |
| Samsung_1TB | zfspool | 899.2 | 347.5 | 551.7 |
| Samsung_4TB | dir | 0 | 0 | 0 |
| Samsung_4TB_2 | lvm | 0 | 0 | 0 |
| local | dir | 93.9 | 14 | 75.1 |
| local-lvm | lvmthin | 319.6 | 7.3 | 312.3 |
| nvme | lvm | 0 | 0 | 0 |

**Headroom:** 6595 MB avail RAM bei 7 running Guests (6 LXC + 1 VM). Gesunde Reserve, niedrigste loadavg der Flotte. Traegt den Infra-Ring (semaphore 150, forgejo 153, ansible-control 155 — KEIN Auto-Reboot).

---

## Bekannte Deltas / Migrationsspuren

| # | Erwarteter Zustand | Befund in Recon | Status |
|---|--------------------|-----------------|--------|
| a | LXC 150 "semaphore" @pz3 running, IP .176 | vmid 150, node pz3, name semaphore, status running, ip 192.168.20.176, onboot true | **MATCH** |
| b | LXC 157 @pz2 = pending-destroy, sollte STOPPED sein (Rollback-Sicherung) | vmid 157, node pz2, name semaphore, status stopped, ip .176 (aus config), onboot true | **MATCH** (status stopped wie erwartet; "pending-destroy"-Label nicht in Recon-Daten, aber Stopped-Zustand bestaetigt) |
| c | VM 151 "dvhub-manual" @pve, .197, HOLD | vmid 151, node pve, kind vm, name dvhub-manual, status running, ip 192.168.20.197, onboot false | **MATCH** (Identitaet/IP bestaetigt; "HOLD" nicht als Datenfeld vorhanden, onboot=false passt zum Hold-Charakter) |
| d | LXC 158 "protectbridge" @pz2 privileged, .82 DHCP | vmid 158, node pz2, name protectbridge, status running, ip 192.168.20.82, ip=dhcp; **privileged=true** (autoritativ via /etc/pve: keine `unprivileged:`-Zeile = privileged) | **MATCH** (IP .82 + DHCP + privileged bestätigt; Recon-Agent hatte privileged fälschlich auf false gesetzt, korrigiert) |
| e | LXC 146 "merkel" @pz2 jetzt 6144 MB | vmid 146, node pz2, name merkel, mem_mb 6144 | **MATCH** |

> Punkt (d) AUFGELÖST (trust-but-verify): 158 IST privilegiert — Ground-Truth `pct config 158` und `/etc/pve` zeigen keine `unprivileged:`-Zeile → Proxmox-Default = privileged. Der Recon-Agent meldete privileged für 158 (und 131) fälschlich als `false`; daher wurde die privileged-Spalte cluster-weit autoritativ gegen `/etc/pve` re-verifiziert (siehe Anomalien-Sektion).

---

## Anomalien & Empfehlungen

### Privilegierte LXC (Host-Escape-Flaeche)
**Autoritativ verifiziert gegen `/etc/pve/nodes/*/lxc/*.conf` (Ground-Truth; korrigiert 2 Recon-Agent-Fehlklassifikationen): 6 privilegierte LXC:**
- **145 tapsi @pve** (privileged, LTO-Tape-Passthrough /dev/st0 etc.) — Passthrough rechtfertigt Priv teilweise; AppArmor-Profil pruefen, Zugriff minimieren.
- **109 fileflows @pz2** (privileged, ip=dhcp) — pruefen, ob Priv noetig ist; Gegenstueck 113 fileflows @pve laeuft unprivilegiert mit GPU-Passthrough -> Vorbild fuer Umstellung.
- **110 iventoy @pz2** (privileged, USB/tty-Passthrough) — Passthrough rechtfertigt Priv teilweise; abschotten.
- **154 forgejo-runner @pz2** (privileged, nesting+keyctl) — CI-Runner als privileged ist erhoehte Angriffsflaeche; falls moeglich auf unprivileged + nesting umstellen.
- **158 protectbridge @pz2** (privileged, nesting=1, .82 DHCP) — **vom Recon als false fehlklassifiziert**; UniFi-Protect-Bridge. unprivileged-Migration prüfen (separates ProtectBridge-Vorbereitungspaket, Artefakt #3 → Schnüffi-R22-Review). Eigentümer-Peer = ProtectBridge.
- **131 KI-Container @pve** (privileged, stopped) — **vom Recon als false fehlklassifiziert**; aktuell Cold-Standby. Vor Wieder-Inbetriebnahme Priv-Begründung klären.
> Empfehlung: Jede priv-LXC dokumentiert begruenden; wo kein Passthrough zwingend ist (109, 154, 158), Migration auf unprivileged planen.
> **Methodik/Provenance:** Die privileged-Spalte ist die EINZIGE, die unabhängig gegen `/etc/pve` re-verifiziert wurde (security-kritisch). Übrige Felder (Cores/RAM/Disk/IP/onboot) stammen aus per-Node-Recon (read-only, best-effort; DHCP-IPs = Snapshot-Stand). Bei sicherheitsrelevanten Entscheidungen Einzelwerte am Live-System gegenprüfen.

### Running, aber onboot=false (ueberlebt Backup-/Wartungs-Reboot NICHT)
- **151 dvhub-manual @pve** — running, onboot false (HOLD). Erwartet, aber: nach Reboot weg. Falls Daten/Dienst gebraucht: vorher sichern oder onboot bewusst setzen.
- **147 agent-dashboard @pz2** — running, onboot false (staging). Ueberlebt Reboot nicht; falls produktiv genutzt, onboot=true setzen.
> Empfehlung: Vor jedem stop-mode-Backup-Reboot diese Guests explizit beruecksichtigen — sie kommen nicht von selbst zurueck.

### DHCP-IPs bei Infra-/relevanten Diensten (instabil ueber stop-mode-Backup-Reboot)
DHCP-Leases koennen ueber einen Reboot wechseln; bei Diensten mit fester Erwartung problematisch:
- **146 merkel @pz2** (.81, DHCP) — zentrale Wissens-/Vektor-DB, von der ganzen Flotte adressiert. IP-Wechsel waere kritisch. **Statische IP dringend empfohlen.**
- **158 protectbridge @pz2** (.82, DHCP) — sollte stabil sein; statisch setzen.
- **109 fileflows @pz2** (.127, DHCP), **114 archivebox @pz2** (.90, DHCP), **125 nginxproxymanager @pz2** (.93/VLAN4, DHCP), **102 homepage @pz3** (.74), **115 node-red @pz3** (.57), **136 influxdb3 @pz3** (.48) — DHCP; bei Reverse-Proxy (125) und Dashboards besonders auf stabile IP achten.
> Empfehlung: Mindestens merkel (146), protectbridge (158) und nginxproxymanager (125) auf statische IP oder DHCP-Reservation umstellen.

### Knapper Node-Headroom (<2 GB avail RAM)
- Kein Node faellt aktuell unter 2 GB avail RAM. **Knappster: pz1 mit 4415 MB avail** (16-GB-Node, 4 VMs + 4 LXC laufend) — Warnschwelle naht; keine neuen Guests auf pz1.
- **pve** hat zwar 16555 MB avail, ist aber gemessen an seiner Last der heisseste Node — neue Workloads bevorzugt auf pz2 (8936 MB) oder pz3 (6595 MB).
> Empfehlung: pz1 als nahezu voll behandeln; Storage Samsung_1TB @pz1 (124.7 GB frei, ~86% voll) ebenfalls beobachten.

### EOL / auffaellige Versionen & Sonstiges
- **Alle Nodes:** pve-manager/9.2.3 (einheitlich) — kein Versions-Drift, gut.
- **Kernel-Heterogenitaet:** proxmox/pz1/pz3 auf 7.0.6-2-pve, pve auf 6.14.11-4-pve, pz2 auf 6.17.4-2-pve. Drei verschiedene Kernel-Linien in einer Flotte — Reboot auf einheitlichen Kernel beim naechsten Wartungsfenster erwaegen (besonders pve auf aelterer 6.14-Linie).
- **132 WinEmbedd2013 @pve** — Windows Embedded Compact 2013, EOL-Betriebssystem (Microsoft-Support beendet). Stopped; falls reaktiviert, isolieren (kein direkter Netzzugang).
- **112 mynode-btc @pve** — disk_gb-Wert 1782580 (≈1740 GB scsi1 auf Samsung_4TB), kein Tippfehler sondern grosse Daten-Disk; balloon off, kein guest-agent. Backup-Strategie fuer diese Disk pruefen.
- **Mehrere VMs ohne aufgeloeste IP** (104, 108, 116, 118, 130, 132, 135, 139, 111, 119 etc.): teils kein/fehlkonfigurierter guest-agent. Monitoring-Sichtbarkeit eingeschraenkt — guest-agent nachziehen, wo sinnvoll.
- **152 redroid-android-host @proxmox** & **111 backup02 @pve** & **131 KI-Container @pve**: stopped + onboot false/none — bewusste Cold-Standbys; ok, aber dokumentieren, dass sie nach Reboot bewusst aus bleiben.