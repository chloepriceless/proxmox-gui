# T-0244 — AVV-Zone DEPLOY-RUNBOOK v2 (GO zum Provisionieren, R22-refuted)

**Bau-Lead:** Schraubi (`vm-deployment-gui`, Infra-LEAD). **Stand:** 2026-06-21, GO ZUM PROVISIONIEREN (f73n74ge, Christin hohe Prio).
**Ziel-Meilenstein (f73n74ge):** „Christin kommt per Browser in eine Claude-Session in der Zone." **⚠️ 2-stufig (s. §1): Stufe 1 (No-Egress-Foundation) jetzt; eine FUNKTIONIERENDE Claude-Session braucht Egress (über LLM-Broker) → Stufe 2, gated.** Echte Kundendaten erst nach Bizzi-DSFA.
**Refute-Stand:** v1 → R22-Refute (fresh-context Claude-Lens) fand 5 BLOCKER + 4 HIGH auf der Bau-MECHANIK (Design blieb intakt). **v2 = alle eingearbeitet** (Changelog §11). Netzi (fqj85asg) konvergiert: No-Egress-Foundation jetzt frei, NIC scharf erst nach UDM-VLAN50.
**Vorgänger:** `T0244-BUILD-PLAN.md` · `T0244-artifacts/06-build-verify-plan.md` · `00-INDEX.md`. Beide Isolations-Schichten R22-grün/BUILD-READY.

---

## 0. Fixe Werte (SSOT)
| Wert | Festlegung | Quelle |
|---|---|---|
| VMID | **159** | pvesh nextid |
| Host | **pz2** (.42), stabil | .240 ungeeignet (T-0247) |
| Spec | **2 vCPU / 4096 MB / 80 GB** | pz2 9124 MB avail; flex-up vor GO-LIVE |
| CPU-Typ | **`x86-64-v3`** (NICHT `host`) | H3: Seitenkanal-Reduktion auf geteiltem Node |
| Disk-Storage | **local-lvm** (lvmthin, 310 G frei) | + Thin-Pool-Monitor (M2) |
| OS-Image | `$IMG` = `/var/lib/vz/template/iso/debian-13-genericcloud-amd64.qcow2` (auf pz2 vorhanden) | **Checksum-Verify Pflicht (L2)** vor Nutzung |
| NIC-MAC | **`BC:24:11:5A:00:59`** (fest vorgegeben bei create) | L3: an Netzi VOR Start liefern |
| VLAN | **50**, **192.168.50.0/29**, VM-IP **.50.2**, GW (UDM) **.50.1**, DHCP/IPv6 AUS | Netzi |
| pz2-Attach | `bond0.50` + `vmbrZONE` | nicht-disruptiv (D3) |
| netns-Topo | LLM `10.99.0.1:8443` · Merkel `10.99.0.2:8500` · Resolver `127.0.0.1:53` | 01-SSOT §1 |
| UID-Plan | LLM 8001 · Merkel 8002 · Resolver 8003 | 01-SSOT §1 |
| Deploy-Kanal Stufe 1 | **serielle Konsole** (`--serial0`) + cloud-init `write_files` | B3/B5/L1: netz-loser Bau ohne `qm guest exec`-Abhängigkeit |

## 1. Stufen + Gating (KORRIGIERT nach Refute B5 + Netzi)
**Der Erstboot ist netz-los (B5):** beim ersten `qm start` existiert noch KEINE in-VM-nft → eine NIC am Zone-Netz wäre ein offenes Egress-Fenster, abgesichert nur durch die noch-nicht-fertige UDM-Seite. Darum:

### STUFE 1 — No-Egress-Foundation (JETZT, Netzi-freigegeben, reversibel)
P1 Image-Verify · P2 VM-Shell (NIC `link_down`, MAC fix) · P3 cloud-init `write_files` (Isolations-Artefakte lokal mitgeben) · P4 netz-loser Erstboot · P5 in-VM-Isolation installiert + `enabled` (netns/nft default-DROP/Boot-Gate-Units) · P6 Substrat (Koordinator/SQLite-Ledger/Spawner/Audit) · P7 LUKS-Daten-Disk (leer) · P8 ttyd installiert (noch kein Ingress). **= „substrat-fertig", VM bootet fail-closed, KEIN Egress.**

### STUFE 2 — Egress-scharf + Browser-Session (GATED)
Gates: **(G-Net)** Netzi UDM-VLAN50 + Trunk-L1-Check + Egress-Allowlist · **(G-Pin)** Provider-Pin (Christin/Bizzi: Anthropic-direkt vs Bedrock/Vertex) — **harter P-Broker-Vorbedingungs-Blocker (M4)** · **(G-Sec)** Schnüffi Broker-Deploy + Cert-Pin-Wert + mTLS · **(G-Merkel)** R3-Merkel.
Schritte: bond0.50+vmbrZONE (P-Bridge) → NIC scharf an vmbrZONE (`link_down=0`) → Broker+Resolver hoch → **3-Gate-Oracle-Lauf grün** (06-Plan §5) → ttyd-Ingress (Netzi ZBF-Pinhole, Christins Workstation-IP) → **Browser-Claude-Session live**.
**STOP vor GO-LIVE (echte PII):** Bizzi-DSFA + Christin-Sign-off.

> **An f73n74ge transparent:** Stufe 1 ist die fertige isolierte Maschine + Browser-Terminal-Infra. Eine im Browser *funktionierende* Claude-Session braucht Anthropic-Egress → Stufe 2 (G-Net + G-Pin + G-Sec). Foundation ohne Egress kann ich komplett jetzt bauen.

---

## 2. DESIGN-ENTSCHEIDUNGEN (Deliberate Mode)
- **D1 Spec 2c/4G/80G** statt 4c/8G: pz2 live 9124 MB avail; 8G → OOM-Risiko geteilter Node. Flex-up reversibel. *(Infra-Hoheit-Override, an f73n74ge gemeldet.)*
- **D2 LUKS-Timing:** separate LUKS-**Daten-Disk** (PII + Pseudonym-Map + Audit) vor GO-LIVE; Root jetzt unverschlüsselt. Begründung: bis DSFA KEINE echten PII; LUKS-Root im cloud-image teuer ohne Schutzgewinn. **Verschärft nach H2:** zwischen Bau und GO-LIVE dürfen KEINE Secrets/PII auf die unverschlüsselte Root → ttyd-mTLS-Keys + Team-Cred kommen auf die LUKS-Daten-Disk, nicht Root.
- **D3 Bridge-Attach** `bond0.50`+`vmbrZONE` (additiv, vmbr0/LXCs unberührt) statt vmbr0-VLAN-aware-Umbau. Mit Dead-Man-Rollback (H1).
- **D4 Foundation-vor-Egress, fail-closed ab Boot** — präzisiert (B5): gilt ab dem Boot, an dem die NIC scharf ist; der Erstboot ist netz-los, daher KEIN Egress-Fenster.
- **D5 ttyd-Ingress:** source-gepinnt (Christins Workstation-IP, NICHT /24 — Netzi least-priv) + mTLS, direkte ZBF-Allow (kein Jump). Netzi-Mechanik bestätigt.
- **D6 (NEU, H2) Zone-eigenes SSH-Keypair:** KEIN Fleet-Key in der PII-Zone (Cross-Zone-Key-Reuse = Isolationsbruch). Zone-Keypair, privater Teil nur bei Christin/Operator.

---

## 3. P1 — Image-Verify (JETZT, fail-stop L2)
```bash
# auf pz2, als root:
IMG=/var/lib/vz/template/iso/debian-13-genericcloud-amd64.qcow2
cd "$(dirname "$IMG")"
# signierte Summen holen + Hash hart prüfen (Mismatch → STOP):
wget -q https://cloud.debian.org/images/cloud/trixie/latest/SHA512SUMS -O /tmp/D13SHA
EXPECT=$(grep 'debian-13-genericcloud-amd64.qcow2$' /tmp/D13SHA | awk '{print $1}')
HAVE=$(sha512sum "$IMG" | awk '{print $1}')
[ -n "$EXPECT" ] && [ "$EXPECT" = "$HAVE" ] && echo "IMG-OK" || { echo "IMG-MISMATCH/STOP ($HAVE vs $EXPECT)"; }
```
**Fallback** (kein Internet von pz2 für SHA512SUMS): Summen-Datei via Mac/anderen Host ziehen + Hash manuell vergleichen; Image notfalls frisch von cloud.debian.org auf einen Host mit Netz + scp nach pz2 (SSOT-Pfad `$IMG`). **Akzeptanz: `IMG-OK`.** KEIN Bau bei Mismatch.

## 4. P2 — VM 159 Shell (JETZT, gestoppt, NIC link_down, MAC fix)
```bash
# auf pz2, als root (IMG aus P1):
qm create 159 --name zone-avv --memory 4096 --cores 2 --cpu x86-64-v3 \
   --scsihw virtio-scsi-single --ostype l26 --agent enabled=1 --onboot 1 \
   --serial0 socket --vga serial0 \
   --net0 virtio=BC:24:11:5A:00:59,bridge=vmbr0,link_down=1
# Disk import (PVE8-Einzeiler, kein geratener Volume-Name — B4):
ionice -c3 qm set 159 --scsi0 local-lvm:0,import-from="$IMG"        # M3: ionice gg. IO-Spike
qm set 159 --boot order=scsi0
qm set 159 --ide2 local-lvm:cloudinit
qm disk resize 159 scsi0 80G
# MAC bestätigen (steht ab create fest — L3) → SOFORT an Netzi:
qm config 159 | grep -E 'net0|scsi0'
```
**vzdump-EXCLUDE als Bau-Schritt (H2/H3/M5) — VOR jedem Backup-Fenster:**
```bash
# Zone-VM aus allen Cluster-Backups ausschließen (cloud-init/Keys/PII nie auf geteiltes PBS):
# pro Backup-Job in /etc/pve/jobs.cfg: 'exclude 159' bzw. via UI/pvesh; verifizieren:
grep -n 159 /etc/pve/jobs.cfg || echo "kein Job referenziert 159 (gut, aber neue Jobs müssen excluden)"
```
**Rollback:** `qm stop 159; qm destroy 159 --purge` + PBS-Restpunkte prüfen (M5). **NICHT starten** vor P3.

## 5. P3 — cloud-init mit eingebetteten Isolations-Artefakten (JETZT)
Damit der Erstboot netz-los ist (B5) und kein `qm guest exec` braucht (L1), kommen die Isolations-Scripts/Units über cloud-init `write_files` mit. Snippet auf pz2-Snippet-Storage:
```yaml
# /mnt/.../snippets/zone-avv-user.yaml (cicustom)
#cloud-config
hostname: zone-avv
users:
  - name: chrissi
    sudo: 'ALL=(ALL) ALL'
    ssh_authorized_keys: [ "<ZONE-EIGENER-PUBKEY>" ]   # D6: NICHT Fleet-Key
ssh_pwauth: false
write_files:
  - { path: /etc/zone/zone-root.nft,    content: ... }   # aus T0244-artifacts
  - { path: /etc/zone/zone-seat.nft,    content: ... }
  - { path: /etc/zone/zone-hardening.conf, content: ... }
  - { path: /usr/local/sbin/seat-negative-oracle.sh, permissions: '0755', content: ... }
  - { path: /usr/local/sbin/seat-hardening-oracle.sh, permissions: '0755', content: ... }
  - { path: /usr/local/sbin/zone-seat-probe.sh,       permissions: '0755', content: ... }
  # systemd-Units zone-* nach /etc/systemd/system/
runcmd:
  - [ systemctl, daemon-reload ]
  - [ systemctl, enable, zone-netns-setup, zone-root-nft, zone-selftest-net, zone-selftest-hardening ]
  # KEIN Egress-Bringup; NIC ist eh link_down. Broker/Resolver/3.Gate = Stufe 2.
```
```bash
qm set 159 --cicustom "user=<snippet-storage>:snippets/zone-avv-user.yaml"
# DNS für Stufe 2 vorbereiten (H4): NICHT cloud-init-Default-Resolver; erst in Stufe 2 ipconfig0+nameserver=zone-resolver setzen
```
**Akzeptanz:** cicustom gesetzt; Pubkey ist Zone-eigen.

## 6. P4 — netz-loser Erstboot (JETZT)
```bash
qm start 159
# Konsole via serial (B3): qm terminal 159   (Escape: Ctrl-O)
# In der VM (über serial): cloud-init status --wait → 'done'; df -h (80G da? M1); ip a (eth0 DOWN/no-route)
```
**Akzeptanz:** Boot grün über serielle Konsole, cloud-init done, Root 80G, **kein Default-Route/Egress** (NIC link_down). Static-Checks (06 §2) laufen lassen (`systemd-analyze verify`, `CanReload=no`, `safe_canonical`, `nft -c`, `is-enabled`).

## 7. P5-P8 (Stufe 1 Rest, in-VM, reversibel via Snapshot)
- **P5 Isolation:** Units `enabled` (s. P3 runcmd); nft default-DROP, `meta nfproto ipv6 drop` 1. Regel jeder Chain (R5-H1). GATE-1/2-Oracles laufbereit (GATE-3 = Stufe 2, braucht Broker).
- **P6 Substrat:** Koordinator + SQLite-WAL-Ledger (Epoch-Fencing, 05-substrate) + Zone-Spawner (NICHT fleet-registriert) + zonen-lokaler Audit-Log.
- **P7 LUKS-Daten-Disk:** 2. Disk anlegen, LUKS (operator-unlock/TPM-sealed, NICHT key-next-to-lock), leer; ttyd-mTLS-Keys + (später) Team-Cred + Pseudonym-Map kommen HIERHIN (D2/H2).
- **P8 ttyd:** installieren (aktuelle Version, minimal exponiert) → `tmux new -A -s claude` → `claude`; mTLS-Server-Cert auf LUKS-Disk. **Noch kein Ingress** (Stufe 2).

## 8. Stufe 2 (GATED) — Egress + Browser-Session
- **P-Bridge (H1 Dead-Man-Rollback):**
```bash
# /etc/network/interfaces.d/zone.cfg (additiv): bond0.50 (vlan-raw-device bond0) + vmbrZONE (bridge-ports bond0.50)
ifquery --check -a   # dry/dep-check zuerst
cp -a /etc/network/interfaces.d/zone.cfg /root/zone.cfg.bak 2>/dev/null || true
( sleep 120; rm -f /etc/network/interfaces.d/zone.cfg; ifreload -a ) & DEADMAN=$!   # Lockout-Schutz
ifreload -a && ip -br link show vmbrZONE && ping -c1 192.168.20.1 && kill $DEADMAN
```
(Idealerweise in `tmux` auf pz2 ODER über Proxmox-Host-Konsole, nicht über die zu ändernde SSH-Strecke.)
- **NIC scharf:** `qm set 159 --net0 virtio=BC:24:11:5A:00:59,bridge=vmbrZONE` + `--ipconfig0 ip=192.168.50.2/29,gw=192.168.50.1` + `--nameserver 127.0.0.1` (H4) → reboot → fail-closed mit aktiven Gates.
- **P-Broker (gated G-Pin!):** Schnüffis Artefakte nach `/usr/local/lib/zone-broker/` (e5c3a93) + zone-Resolver (DoT) + Egress-Allowlist mit dem **entschiedenen Provider-Pin**. M4: Pin VOR Broker-Bau.
- **P9 Verify (06 §5):** alle 3 Gates `active` → `zone-spawner` active; Negativ-Tests (06 §6): Seat-netns → Anthropic/.81/LAN = NOROUTE.
- **ttyd-Ingress:** Netzi ZBF-Allow (Christins Workstation-IP → .50.2:ttyd-port).

## 9. Stufenmeldungen an f73n74ge
- (a) **VM läuft** (nach P4): VMID 159, netz-los, MAC, Spec, Foundation-Stand. — *Stufe 1.*
- (b) **ttyd erreichbar** (nach Stufe-2-Ingress): URL + mTLS-Login-Weg. — *Stufe 2.*

## 10. Koordination (non-blocking, parallel)
- **Netzi:** UDM-VLAN50 (no-egress jetzt, Egress-Allowlist später), Trunk-L1, Ingress-Pinhole. MAC geliefert. [synced]
- **Schnüffi:** Broker-Deploy + Cert-Pin + mTLS beim Stufe-2-Bau. [synced, beide BUILD-READY]
- **Christin/Bizzi:** **Provider-Pin V1 (Anthropic-direkt vs Bedrock/Vertex)** = G-Pin, harter Stufe-2-Blocker. + Christins Workstation-IP für ttyd-Ingress. + DSFA = GO-LIVE-STOP.
- **Tüftli (offline):** Continuity auf Epoch-Fencing-Ledger.

## 11. Changelog — Refute Round 1 (Runbook, fresh-context Claude-Lens, 2026-06-21)
5 BLOCKER + 4 HIGH + 5 MED + 3 LOW, ALLE gefoldet:
- **B1** Inline-Kommentare nach `\`-Continuation in qm create → entfernt (§4 clean).
- **B2** Image-Pfad-SSOT → `$IMG`-Variable durchgängig (§0/§3/§4).
- **B3** genericcloud nicht debuggbar ohne Konsole → `--serial0 socket --vga serial0` (Pflicht, = Deploy-Kanal Stufe 1).
- **B4** geratener Volume-Name `vm-159-disk-0` → PVE8 `--scsi0 local-lvm:0,import-from=$IMG`.
- **B5 (schwerster)** Egress-Leak-Fenster beim Erstboot → **Erstboot netz-los** (NIC link_down bis Gates stehen), Isolation via cloud-init `write_files` + serial; NIC scharf erst in Stufe 2. **D4 präzisiert.** Konvergiert mit Netzi (no-egress-Foundation).
- **H1** `ifreload`-Lockout geteilter Node → Dead-Man-Switch (sleep 120 rollback) + `ifquery --check` + tmux/Host-Konsole.
- **H2** Cross-Zone-Key-Reuse → **D6 Zone-eigenes Keypair**; cloud-init-Disk/Keys in Backups → **vzdump-Exclude als expliziter Bau-Schritt** (§4).
- **H3** `--cpu host` Seitenkanal → `x86-64-v3`.
- **H4** cloud-init setzt externen DNS in root-ns (:53-Egress) → `--nameserver 127.0.0.1` (zone-Resolver), erst in Stufe 2 mit Netz.
- **M1** Resize-Verify (df -h) in P4. **M2** Thin-Pool-Exhaustion-Monitor (`lvs data_percent` → Uptime-Kuma; kann ALLE Guests kippen). **M3** Import-IO-Spike → `ionice -c3`. **M4** Provider-Pin = harter P-Broker-Blocker (Stufe-2-Gate, nicht „parallel"). **M5** Rollback prüft PBS-Restpunkte.
- **L1** kein guest-agent im Image → serielle Konsole als Deploy-Pfad. **L2** Checksum fail-stop. **L3** MAC fix bei create → vorab an Netzi.

## 12. Bau-Log (Live-Ausführung)
**2026-06-21 ~20:20Z — STUFE 1 / P1+P2 DONE (netz-los):**
- **P1 Image L2-verifiziert:** `debian-13-genericcloud-amd64.qcow2` auf pz2, SHA512 == offizielle Debian-trixie-latest (`IMG-MATCH`, Hash `35337a6bcd9c...`). pz2 hat Internet (Verify lief).
- **`local`-Storage** um `snippets` erweitert (`pvesm set local --content vztmpl,snippets,iso`) für cicustom.
- **P2 VM 159 angelegt + läuft (netz-los):** 2c/4096M/80G, cpu `x86-64-v3`, `serial0 socket`/`vga serial0`, scsi0 import-from (rescan-synced auf 80G), ide2 cloudinit, **net0 MAC `BC:24:11:5A:00:59` bridge=vmbr0 link_down=1**, ciuser chrissi + zone-bootstrap-pubkey, onboot=1. `qm status`=running (~3min, idle). Alle Refute-Fixes (B1/B3/B4/H3/L3) verbaut.
- **Zone-Bootstrap-Privkey:** `~/.ssh/zone-avv-bootstrap_ed25519` (dev-vm, NICHT Repo/Zone) — vor GO-LIVE rotieren.
- **D7 (NEU) Deploy-Kanal:** genericcloud hat KEINEN qemu-guest-agent; cloud-init setzt KEIN Passwort → weder `qm guest exec` noch serial-Login. **Netz-loser Deploy = cicustom `write_files`** (Artefakte beim Boot, kein Login/Netz). Optional cipassword (Bootstrap) für serial-Verifikation, vor GO-LIVE raus.
- **MAC an Netzi geliefert; VLAN50-Anlage Netzi-seitig in flight (Hub-Methoden-Go).**

**NÄCHSTER SCHRITT (netz-los, reversibel):** cicustom-Snippet `local:snippets/zone-avv-user.yaml` mit allen `T0244-artifacts/`-Dateien (nft/Scripts/zone-*.service aus 01-SSOT §6) als `write_files` → `qm set 159 --cicustom` → cloud-init clean+reboot → Static-Checks (§ Verify-Plan §2). Dann ttyd. STUFE 2 (Egress) nach Netzi-VLAN50 + Provider-Pin.
