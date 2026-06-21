# T-0244 — AVV-Zone DEPLOY-RUNBOOK (GO zum Provisionieren)

**Bau-Lead:** Schraubi (`vm-deployment-gui`, Infra-LEAD). **Stand:** 2026-06-21, GO ZUM PROVISIONIEREN (f73n74ge, Christin hohe Prio).
**Ziel-Meilenstein (f73n74ge-Wortlaut):** „Christin kommt per Browser in eine Claude-Session in der Zone." Substrat + Browser-Zugang JETZT fertig; **echte Kundendaten erst nach Bizzi-DSFA + Christin-Sign-off.**
**Vorgänger:** `T0244-BUILD-PLAN.md` (Master) · `T0244-artifacts/06-build-verify-plan.md` (Verify) · `T0244-artifacts/00-INDEX.md` (Blocker-Map). **Beide Isolations-Schichten R22-grün/BUILD-READY (9+19 Refute-Runden, beidseitig integriert-verifiziert).**
**Dieser Runbook = die operative Live-Bau-Mechanik** (VM-Erstellung, pz2-Bridge, Reihenfolge, Rollback). NEUE Fläche ggü. dem refuteten Design → Codex-Refute auf DIESEN Runbook (R22) VOR dem kritischen Bau.

---

## 0. Fixe Werte (SSOT für den Bau)
| Wert | Festlegung | Quelle |
|---|---|---|
| VMID | **159** | `pvesh get /cluster/nextid` auf pz2 |
| Host | **pz2** (.42), stabil | BUILD-PLAN §0 (A′). .240 ungeeignet (T-0247 IMC-Overload-Crash) |
| Spec | **2 vCPU / 4096 MB / 80 GB** | Live verifiziert: pz2 9124 MB avail; 8G → OOM-Risiko. Flex-up vor GO-LIVE |
| Disk-Storage | **local-lvm** (lvmthin, 310 G frei) | pz2 `pvesm status` |
| OS | Debian 13 (genericcloud, wie VM151) | cloud-init-fähig |
| VLAN | **50**, Subnetz **192.168.50.0/29**, VM-IP **.50.2**, GW (UDM) **.50.1**, DHCP/IPv6 AUS | Netzi (fqj85asg, bestätigt) |
| pz2-Attach | `bond0.50` (VLAN-Sub-IF) + `vmbrZONE` (dedizierte Bridge) | nicht-disruptiv; vmbr0 = plain, nicht VLAN-aware |
| netns-Topo | LLM-Broker `10.99.0.1:8443` · Merkel-Broker `10.99.0.2:8500` · Resolver `127.0.0.1:53` (root-only) | 01-SSOT §1 |
| UID-Plan | LLM 8001 · Merkel 8002 · Resolver 8003 | 01-SSOT §1 |
| Provider-Pin (V1) | **Anthropic Team-Plan + AVV** (kein EU-Hyperscaler — Christin-Entscheid BUILD-PLAN §0). *Hinweis: Schnüffi/Verdikt nennen Bedrock/Vertex als V1-Alternative → das ist eine NOCH offene Christin/Bizzi-Frage; Default = Anthropic direkt laut BUILD-PLAN.* | BUILD-PLAN §0 vs 06-Plan §0 |

## 1. Phasen-Übersicht + Gating (was JETZT, was extern-gated)
| Phase | Inhalt | Status |
|---|---|---|
| **P0** | Codex-Refute auf diesen Runbook (R22) | **PFLICHT vor P3+** |
| **P1** | Debian-13-Cloud-Image auf pz2 besorgen | JETZT (reversibel) |
| **P2** | VM 159 Shell anlegen (gestoppt, NIC noch nicht final) | JETZT (reversibel) |
| **P3** | pz2-Bridge: `bond0.50` + `vmbrZONE` | **gated: Netzi-Trunk VLAN50** (sonst totes IF) |
| **P4** | VM-NIC an `vmbrZONE`, statische .50.2, Boot, cloud-init | gated: P3 + Netzi-UDM-GW |
| **P5** | In-VM-Isolation: netns + nftables + Boot-Gate-Units | nach P4 (in-VM, reversibel via Snapshot) |
| **P6** | 2 Broker (LLM/Merkel) + zone-Resolver (DoT) | nach P5; Schnüffi liefert Gate-Logik/Allowlist |
| **P7** | Substrat: Koordinator + SQLite-Ledger (Epoch-Fencing) + Zone-Spawner + Audit-Log | nach P6 |
| **P8** | Interaktiver Seat: ttyd+tmux+claude, mTLS | gated: Netzi-Ingress-Pinhole (Christin→ttyd) |
| **P9** | Verifikations-Oracle (06-Plan: alle 3 Gates grün → Spawner) + Negativ-Tests | nach P8 |
| **STOP** | GO-LIVE (echte PII) | gated: Bizzi-DSFA + Christin-Sign-off |

**Meilenstein „Christin im Browser" = P1→P8 grün** (autonomer PII-Dispatch via Spawner bleibt DSFA-gated, aber der interaktive Claude-Seat + Isolation + Broker stehen).

---

## 2. DESIGN-ENTSCHEIDUNGEN (Deliberate Mode — explizit, mit verworfenen Alternativen)

### D1 — VM-Spec: 2c/4G/80G statt 4c/8G (f73n74ge sagte 4c/8G)
**Entscheidung:** 2 vCPU / 4 GB / 80 GB. **Begründung:** pz2 hat live **9124 MB avail** bei 11 laufenden LXCs inkl. Merkel (whisper/e5-Spikes). Eine 8G-VM drückt avail auf ~930 MB → OOM-Risiko für den geteilten Node (Christin-Direktive: Proxmox nicht überbuchen). RAM ist der harte Constraint, nicht Cores (vCPU übercommitbar). **Verworfen:** 4c/8G auf pz2 (Node-OOM); .240 mit 4c/8G (Host crasht reproduzierbar unter Last, T-0247). **Reversibel:** `qm set 159 -memory` Flex-up vor GO-LIVE trivial. **→ transparent an f73n74ge gemeldet (Infra-Hoheit-Override mit Begründung).**

### D2 — LUKS-Timing: Daten-Disk-LUKS vor GO-LIVE, NICHT Root-LUKS jetzt
**Entscheidung:** Root-Disk jetzt unverschlüsselt (Debian-genericcloud-Standard); LUKS für eine **separate Daten-Disk** (PII-Arbeitsdaten + Pseudonym-Map) + Audit, eingerichtet VOR GO-LIVE. **Begründung:** (a) LUKS-Root in einem cloud-image ist aufwändig (Reinstall/Repartition) und bringt für den Browser-Meilenstein KEINEN Schutz, weil bis DSFA gar keine echten PII auf der Disk liegen; (b) at-rest-Schutz ist eine DSFA-Auflage für ECHTE Daten — diese kommen erst nach STOP. Eine leere Disk zu verschlüsseln, bevor Daten drauf sind, ist verschwendete Komplexität jetzt und trivial nachholbar, solange noch keine Daten da sind. **Verworfen:** LUKS-Root jetzt (Komplexität ohne Schutzgewinn vor DSFA). **Risiko-Caveat:** zwischen P-Bau und GO-LIVE dürfen KEINE echten PII auf die unverschlüsselte Disk — durch die DSFA-STOP-Schranke abgedeckt. **Bootstrap-Key:** operator-unlock/TPM-sealed, NICHT key-next-to-lock; Host-Key-in-vzdump (04-data-protection H3) → Zone aus PBS raus / separate Backup-Policy.

### D3 — Bridge-Attach: bond0.50 + vmbrZONE statt vmbr0-VLAN-aware-Umbau
**Entscheidung:** dediziertes `bond0.50` VLAN-Sub-Interface + neue `vmbrZONE`-Bridge. **Begründung:** vmbr0 ist plain (vlan_filtering=0) und trägt die 11 Live-LXCs + pz2-Mgmt-IP. vmbr0 auf VLAN-aware umbauen = disruptiv für alle LXCs + pz2-Erreichbarkeit. `bond0.50`+`vmbrZONE` ist rein additiv (rührt bond0/vmbr0 nicht an). **Verworfen:** vmbr0 VLAN-aware (disruptiv). **Risiko:** fehlerhafte `/etc/network/interfaces.d/`-Edit + `ifreload` kann pz2 vom Netz nehmen → **Mitigation:** Änderung NUR additiv in `interfaces.d/zone.cfg` (PVE source-directory), `ifreload -a` mit sofortigem Konnektivitäts-Selbsttest, Rollback-Datei bereit. **Bedingung:** UDM-Trunk zu pz2-bond0-Ports muss VLAN50 tagged durchlassen (Netzi) — sonst ist bond0.50 tot (kein Schaden, nur nutzlos).

### D4 — Reihenfolge: Foundation-vor-Egress, Egress-Default-DENY ab Boot
**Entscheidung:** netns+nftables+Boot-Gate-Units (P5) VOR den Brokern (P6) deployen; nft-Policy = default-DROP ab erstem Boot (fail-closed). Seats existieren erst, wenn alle 3 Gates grün (Spawner-Requires). **Begründung:** kein Egress-Fenster, in dem ein Seat ungefiltert raus könnte. **Verworfen:** Broker-first (Egress offen bevor Enforcement steht).

### D5 — ttyd-Ingress: source-gepinnt + mTLS, über Netzi-Pinhole
**Entscheidung:** ttyd hört in der Zone (.50.2), erreichbar NUR über ein UDM-Ingress-Pinhole (Christins Workstation-IP → .50.2:ttyd-port), Auth = mTLS-Client-Cert (NICHT nur Source-IP, LAN-spoofbar). **Begründung:** die Zone ist egress-default-deny, aber Christin muss INGRESS bekommen; der Pinhole ist die einzige LAN→Zone-Öffnung. **Offen (Netzi):** Pinhole-Mechanik (direkte FW-Regel vs Reverse-Proxy/Jump, „T-0197-Technik"). **Schnüffi:** mTLS-Auth-Härtung + ttyd-Version/Exposition.

---

## 3. P1 — Debian-Cloud-Image besorgen (JETZT)
```bash
# auf pz2 (.42), als root:
cd /var/lib/vz/template/iso/   # oder ein dir-storage
# Debian 13 (Trixie) genericcloud (qcow2):
wget -q https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2 \
     -O debian-13-genericcloud-amd64.qcow2
# Verify (Checksum gegen SHA512SUMS der latest/):
# wget -q https://cloud.debian.org/images/cloud/trixie/latest/SHA512SUMS -O - | grep genericcloud-amd64.qcow2
sha512sum debian-13-genericcloud-amd64.qcow2
```
**Rate-Limit-Caveat (geteilte Haus-IP):** 1 Download, kein paralleler Crawl. **Fallback:** Image von pve (.241) kopieren, falls VM151s Image dort noch liegt (`scp`). **Akzeptanz:** Checksum matcht SHA512SUMS.

## 4. P2 — VM 159 Shell anlegen (JETZT, gestoppt)
```bash
# auf pz2, als root:
qm create 159 --name zone-avv --memory 4096 --cores 2 --cpu host \
   --net0 virtio,bridge=vmbr0,link_down=1 \      # NIC erst link_down; final an vmbrZONE in P4
   --scsihw virtio-scsi-single --ostype l26 --agent enabled=1 --onboot 1
qm importdisk 159 /var/lib/vz/template/iso/debian-13-genericcloud-amd64.qcow2 local-lvm
qm set 159 --scsi0 local-lvm:vm-159-disk-0
qm set 159 --boot order=scsi0
qm disk resize 159 scsi0 80G
qm set 159 --ide2 local-lvm:cloudinit
# cloud-init: user chrissi (sudo) + Fleet-key für root-recovery; KEINE PII-Creds
qm set 159 --ciuser chrissi --sshkeys <fleet-pubkey> --ipconfig0 ip=192.168.50.2/29,gw=192.168.50.1
```
**Rollback:** `qm stop 159 && qm destroy 159 --purge`. **NICHT starten** bis P3/P4 (Netz steht).
**Cluster-Admin-Härtung (DSFA, BUILD-PLAN §1):** scoped Proxmox-API-Token nur für die Zone-VM statt root@pam — als eigener Schritt vor GO-LIVE (P7-nah), nicht blockierend für den Browser-Meilenstein.

## 5. P3 — pz2-Bridge (gated: Netzi-Trunk VLAN50)
```bash
# /etc/network/interfaces.d/zone.cfg (ADDITIV, rührt vmbr0 nicht an):
auto bond0.50
iface bond0.50 inet manual
        vlan-raw-device bond0

auto vmbrZONE
iface vmbrZONE inet manual
        bridge-ports bond0.50
        bridge-stp off
        bridge-fd 0
# Anwenden + SOFORT-Selbsttest (pz2-Erreichbarkeit darf NICHT brechen):
ifreload -a && ip -br link show vmbrZONE && ping -c1 192.168.20.1
```
**Rollback:** `rm /etc/network/interfaces.d/zone.cfg && ifreload -a`. **Akzeptanz:** vmbrZONE UP, pz2-Mgmt (.42) weiter erreichbar, bond0/vmbr0/LXCs unberührt.

## 6. P4 — VM ans Zone-Netz + Boot
```bash
qm set 159 --net0 virtio,bridge=vmbrZONE   # link_down weg, an Zone-Bridge
qm start 159
# MAC auslesen → an Netzi liefern (für UDM-Zuordnung/Reservierung):
qm config 159 | grep net0
```
**Akzeptanz:** VM bootet, cloud-init done, .50.2 erreichbar NUR aus der Zone/über UDM-GW; KEINE LAN-Route (Netzi default-deny). **Liefere MAC an Netzi.**

## 7. P5-P9 — In-VM (siehe 06-build-verify-plan)
- **P5 Isolation:** `/etc/zone/{zone-root.nft,zone-seat.nft,zone-hardening.conf}` + Scripts nach `/usr/local/sbin/` (root:root 0755) + systemd-Units. **Build-Zeit-Static-Checks (06 §2) alle grün** vor erstem Boot der Units: `systemd-analyze verify`, `CanReload=no`, `safe_canonical`, `nft -c`, 2×-Reload-Idempotenz, `is-enabled`, Broker↔root-nft-Kopplung. nft-Policy default-DROP, `meta nfproto ipv6 drop` 1. Regel jeder Chain (R5-H1).
- **P6 Broker:** Schnüffis Artefakte nach `/usr/local/lib/zone-broker/` (commit e5c3a93) + zone-Resolver (DoT). Egress-Allowlist (FQDN/SNI) = Schnüffi-Final.
- **P7 Substrat:** Koordinator + SQLite-WAL-Ledger (Epoch-Fencing, 05-substrate) + Zone-Spawner (NICHT fleet-registriert) + zonen-lokaler Audit-Log (getrennt von Fleet-Loki).
- **P8 ttyd:** ttyd → `tmux new -A -s claude` → `claude`; mTLS; Ingress-Pinhole (Netzi).
- **P9 Verify (06 §5):** `systemctl is-active zone-selftest-{net,hardening,broker}` alle active → `zone-spawner` active NUR dann. Negativ-Tests (06 §6): aus Seat-netns Anthropic/.81/LAN = NOROUTE; Gate künstlich failen → Spawner startet nicht.

## 8. Stufenmeldungen an f73n74ge (Pflicht)
- (a) **VM läuft** (nach P4): VMID 159, .50.2, MAC, Spec.
- (b) **ttyd erreichbar** (nach P8): URL + Login-Weg (mTLS-Cert-Übergabe).

## 9. Offene Koordinationspunkte (non-blocking, parallel)
- **Netzi (fqj85asg):** VLAN50-UDM-Status, Trunk-zu-pz2, Ingress-Pinhole (Christin→ttyd). [gepingt]
- **Schnüffi (per6ezmd/9ux20vst):** Broker-Artefakt-Deploy beim Live-Bau, Cert-Pin-Wert, mTLS-Härtung, Egress-Allowlist-Final.
- **Christin/Bizzi:** Provider-Pin V1 (Anthropic-direkt vs Bedrock/Vertex — BUILD-PLAN §0 sagt Anthropic, Verdikt nennt Bedrock/Vertex → klären VOR Broker-Egress-Konfiguration).
- **Bizzi:** DSFA = STOP-Schranke vor GO-LIVE.
- **Tüftli (offline):** Continuity-Logik auf dem Epoch-Fencing-Ledger.
