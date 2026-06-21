# T-0244 Artefakt 03 — Netz-Residuen: ip_forward-Beweis, IPv6-Drop, NTP, Trunk (H1/H2/M1/L1)

**Owner:** Schraubi (`vm-deployment-gui`) · L1/H5-Allowlist co-owned **Netzi** · **Gate:** vor egress-Bau
**Schließt:** H1 (pz2/VM-`ip_forward`), H2 (IPv6-Residual), M1 (NTP-Exfil), L1 (Trunk/untagged-Fallback).

---

## H1 — `ip_forward=0`-Beweis (pz2-Host UND Zone-VM)

**Befund (Refute):** „pz2 bridged nur, routet nicht" war eine ANNAHME. `net.ipv4.ip_forward=1` (Proxmox-Default!) ODER eine routende LXC ⇒ L3-Pfad `vmbrZONE ↔ 192.168.20.0/24` umgeht die UDM komplett. Zwei Ebenen sind betroffen: der **pz2-Host** (könnte zwischen vmbrZONE und vmbr0 routen) und die **Zone-VM-root-ns** (könnte zwischen br-zone/Seats und eth0 routen).

### H1-a pz2-Host (read-only Beweis-Plan — KEIN Live-Change ohne Go)
```bash
# 1. Ist-Stand auslesen (read-only):
ssh -i ~/.ssh/orchestrator_ed25519 root@192.168.20.42 \
  'sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding; \
   ip -o addr show vmbrZONE 2>/dev/null; \
   ip route | grep -E "192.168.50|vmbrZONE"'
# ERWARTUNG (Oracle): ip_forward=0  UND  vmbrZONE hat KEINE L3-Adresse (nur L2-Bridge)
#                     UND keine Route 192.168.50.0/29 auf dem pz2-Host.
```
- **Falls `ip_forward=1`:** das ist Proxmox-weit/Cluster-relevant (andere Gäste könnten drauf bauen) → **NICHT blind auf 0 setzen.** Stattdessen die Zone gegen Forwarding härten, ohne globales Toggle: per-Interface `net.ipv4.conf.vmbrZONE.forwarding=0` + nftables-`forward`-Drop am Host für vmbrZONE-Quell/Ziel. Globale Änderung = Christin/proxmox-Koordination (separater Change).
- **vmbrZONE OHNE L3-Adresse:** die Zone-Bridge darf am Host KEINE IP tragen (kein Host-seitiges Gateway) → der einzige L3-Ausgang aus dem Zone-Subnetz ist die UDM `.50.1`.

### H1-b Zone-VM-root-ns (Teil von Artefakt 01 `zone-netns-setup.sh`)
```
net.ipv4.ip_forward=0  +  net.ipv6.conf.all.forwarding=0   (gesetzt in setup.sh)
+ nftables table inet zone_root chain forward { policy drop; }  (Artefakt 01 §3)
```
→ Selbst wenn ein Seat eine Route zu eth0 hätte (hat er nicht), würde die VM den Transit nicht ausführen.

### H1-c Negativ-Test (im Oracle/Build-Verify)
```bash
# Von einem Fleet-/24-Host (z.B. pz3) versuchen, ins Zone-Subnetz zu routen:
ip route get 192.168.50.2     # MUSS via UDM .1 gehen, NICHT direkt via pz2-Bridge
traceroute -n 192.168.50.2    # MUSS über die UDM laufen (1 Hop = UDM), nie pz2 als L3-Hop
# Aus der Zone-VM root-ns: forward-Pfad br-zone→eth0 für Fremd-Quell-IP:
#   gespooftes Quell-Paket 10.99.0.10 → 192.168.20.1  MUSS am forward-drop sterben (Log).
```

---

## H2 — IPv6-Residual hart schließen

**Befund:** „IPv6 AUS" galt nur UDM-seitig. Eine Linux-VM behält ohne explizites Disable link-local (`fe80::`) + akzeptiert evtl. RA/SLAAC; die nftables in Artefakt 01 §3.x decken IPv4 + einen v6-saddr-Drop ab — hier die vollständige v6-Stilllegung als eigenes, testbares Stück.

### Maßnahmen (idempotent, Build-Artefakt)
```bash
# 1. VM-weit per sysctl (alle aktuellen + künftigen Interfaces):
cat >/etc/sysctl.d/60-zone-noipv6.conf <<'EOF'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
net.ipv6.conf.lo.disable_ipv6=0
net.ipv6.conf.all.accept_ra=0
net.ipv6.conf.default.accept_ra=0
net.ipv6.conf.all.autoconf=0
EOF
sysctl --system
# 2. In JEDER Seat-ns (bereits in zone-netns-setup.sh §2 pro Seat gesetzt).
# 3. nftables ip6-Default-Drop EXPLIZIT (root-ns + jede Seat-ns):
#    table inet ... chain output { ... ip6 saddr ::/0 drop }  (Artefakt 01)
#    zusätzlich harte ip6-Tabelle als Gürtel:
nft add table ip6 zone_v6drop 2>/dev/null || true
nft 'add chain ip6 zone_v6drop out { type filter hook output priority -10; policy drop; }'
nft 'add chain ip6 zone_v6drop in  { type filter hook input  priority -10; policy drop; }'
nft 'add chain ip6 zone_v6drop fwd { type filter hook forward priority -10; policy drop; }'
```
### Oracle-Probe (in `seat-negative-oracle.sh`, Zeile `IPv6-Egress`)
- `ip netns exec seatN ip -6 addr` → KEINE globale v6-Adresse (höchstens `lo`); idealerweise gar keine.
- TCP6-Probe an `2606:4700:4700::1111:443` → MUSS fehlschlagen (no-route/disabled).

---

## M1 — NTP: kein externer Zeit-Exfil/Timing-Kanal

**Befund:** 1 externer NTP-Server bei offenem WAN = low-bandwidth-Exfil/Timing-Kanal.
**Entscheidung (Default):** **KVM-PTP (`ptp_kvm`)** — die VM zieht die Zeit vom Host-Hypervisor über den paravirtualisierten PTP-Clock, **null Netz-Egress**.
```bash
# chrony mit KVM-PTP als einziger Quelle, KEIN pool/server-Egress:
cat >/etc/chrony/conf.d/zone-ptp.conf <<'EOF'
refclock PHC /dev/ptp_kvm poll 2 dpoll -2 offset 0
# KEINE 'pool'/'server'-Zeile → kein NTP-Egress (123/udp bleibt im nft-default-drop)
makestep 1.0 3
EOF
# Modul laden: ptp_kvm
```
- **Fallback (nur falls ptp_kvm am Host nicht verfügbar):** NTP NUR gegen die UDM (`192.168.50.1:123`, zone-intern) — KEIN Internet-NTP. Dann eine explizite owner-match-Egress-Regel für uid `zntp` → `.50.1:123` (Artefakt 01 §3, sonst bleibt 123/udp im Default-Drop).
- Oracle: aus Seat-ns `udp 123` an einen externen Server → MUSS fehlschlagen (Seats brauchen ohnehin keine Zeit-Sync; nur root-ns/Host).

---

## L1 — Trunk / untagged-Fallback (co-owned Netzi)

**Befund:** „bond0-Switch-Ports trunken alle VLANs" war unbestätigt. Wenn der Zone-Tag (50) auf dem Switch-Port NICHT getrunkt ist, fällt der Traffic ggf. ins **untagged Native-VLAN = LAN** → kompletter Isolationsbruch.

### Read-only-Verify am Build (Netzi führt, ich verifiziere VM-Seite)
1. **Switch (Netzi):** beide `bond0`-Member-Ports → VLAN 50 explizit im Trunk-Allow-Set; Native/untagged-VLAN ≠ 50, idealerweise ein totes Discard-VLAN (nicht 1/LAN).
2. **VM-Seite (ich):** `bond0.50` + `vmbrZONE` korrekt getaggt; ein Paket OHNE Tag aus der Zone-VM darf NICHT im LAN landen.
3. **Negativ-Test:** Zone-VM eth0 temporär ohne VLAN-Tag senden → am Switch im Discard-VLAN sterben, NICHT im LAN sichtbar. (Gated, mit Netzi, read-only-Sniff am Uplink.)

**Owner-Map:** Switch/Trunk + UDM-networkgroup + Allowlist-Final-Hosts (H5) = **Netzi-Artefakt** (`orchestrator-network/.planning/reports/T-0244-zone-vlan-design.md`). Ich liefere VMID/MAC + die VM-seitige Tag-Konfig + den Negativ-Test.

---

## Status (R31)
SPEC — verifiziert wird beim Bau: H1-c/H2/M1-Proben sind in `seat-negative-oracle.sh` bzw. dem Build-Verify-Plan kodiert. Kein Live-Touch erfolgt (Christin/Hub-Go + Netzi-VLAN stehen aus).
