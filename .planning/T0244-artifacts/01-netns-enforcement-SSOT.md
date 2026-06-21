# T-0244 Artefakt 01 — netns/nftables Enforcement-SSOT (B1a/B1c/B1d)

**Owner:** Schraubi (`vm-deployment-gui`, Infra-LEAD) · **Stand:** 2026-06-21 · **Gate:** vor egress-fähigem Bau
**Schließt Verdikt-Blocker:** B1a (maschinenlesbare Policy), B1c (Seat-Cap-Drop/seccomp/userns), B1d (Boot-Ordering fail-closed).
**SYNC-PUNKT Schnüffi:** Dieses Dokument liefert die KONKRETE netns-Topologie (IPs/Ports/UIDs/Bridges). Schnüffis LLM-Broker-RPC-Spec (`orchestrator-security/.planning/T-0244-gate-artifacts-spec.md`) zieht ihre Listen-Adressen/Methoden GEGEN die hier fixierten Werte.

---

## 0. Design-Position + verworfene Alternativen (Deliberate Mode)

**Problem (B1, beide Refute-Lensen konvergent):** Die „Nur-Broker"-Sicherheit war BEHAUPTET, nicht als testbares Artefakt belegt. In EINER VM teilen Seats + Broker EINEN Kernel → netns allein ist gegen einen kompromittierten Seat mit `CAP_NET_ADMIN`/`CAP_SYS_ADMIN`/Privesc KEINE harte Grenze (er kann `nsenter` in die Broker-ns, als Broker-UID laufen, seine eigene netns umkonfigurieren). netns wird erst dann zu einer belastbaren Grenze, wenn der Seat die Capabilities zum Umgehen NICHT hat.

**Gewählter Ansatz — Layered-Enforcement, jede Schicht für sich getestet:**
1. **L4 UDM/VLAN** (separates Gerät = einzige echte Trust-Boundary): VLAN50 default-DENY, nur Broker-Egress-FQDNs. *(Netzi, Artefakt 03.)*
2. **L3 VM-root-netns nftables** owner-match: NUR Broker-UIDs egress eth0; forward-chain default-drop; `ip_forward=0` in der VM.
3. **L2 Seat-netns**: kein default-route, nur veth→Broker-Bridge; seat-ns nftables default-drop; IPv6 komplett drop.
4. **L1 Seat-Prozess-Härtung (macht L2 erst belastbar):** Drop `CAP_NET_ADMIN`+`CAP_SYS_ADMIN`+`CAP_NET_RAW`+`CAP_SYS_PTRACE`, `NoNewPrivileges`, seccomp-Blocklist (`setns`/`unshare`/`clone(CLONE_NEW*)`/`bpf`/`mount`), user-namespace-Map (Seat-UID ≠ Broker-UID, nicht-überlappend).

**Verworfen — Broker in separater Mini-VM (eigener Kernel):** härteste Variante, aber Kapazität pz2 (2c/4G) trägt keine zweite VM. → **Fallback, NICHT Default:** erst falls der L1-Härtungs-Beweis (Artefakt 02 Oracle + dieser Cap-Drop) nachweislich NICHT trägt, eskaliere ich Kapazität an Christin/proxmox (separate Broker-VM). Schnüffis RPC-Specs bleiben dabei identisch (nur Transport ändert sich VM-intern→VM-zu-VM).

**Verworfen — TLS-MITM/CA im Seat:** Seats würden eine MITM-CA trusten → größere Angriffsfläche, und ein kompromittierter Seat könnte die CA missbrauchen. Stattdessen terminiert der Broker die Verbindung app-layer (kein MITM nötig — Build-Plan §3).

**Verworfen — eine geteilte Seat-netns für alle 4 Seats:** ein kompromittierter Seat sähe L2-Nachbarn. → **Pro-Seat-netns** (seat0..seat3), je eigenes veth, untereinander L2-isoliert (kein gemeinsames Bridge-Segment zwischen Seats; nur Stern zum Broker-Bridge mit `isolated`-Ports).

---

## 1. Adress-/Identitäts-Plan (SSOT — alle anderen Artefakte referenzieren DIESE Werte)

### 1.1 Extern (VLAN50 — Netzi/Artefakt 03)
| Element | Wert |
|---|---|
| Zone-VLAN-Tag | **50** |
| Zone-Subnetz | **192.168.50.0/29** |
| Zone-VM IP (eth0, root-ns) | **192.168.50.2/29** |
| Gateway (UDM) | **192.168.50.1** |
| DHCP / IPv6 / RA | **AUS** (statisch, kein SLAAC) |

### 1.2 VM-intern (Broker-Bridge — privat, NIE geroutet)
| Element | Wert | netns |
|---|---|---|
| Broker-Bridge `br-zone` | 10.99.0.254/24 | root |
| LLM-Broker listen | **10.99.0.1 : 8443** (TCP) | root, uid 8001 |
| Merkel-Broker listen | **10.99.0.2 : 8500** (TCP) | root, uid 8002 |
| zone-Resolver (DoT) | **127.0.0.1 : 53** (NUR root-ns/Broker) | root, uid 8003 |
| Seat0 veth (`s0`) | 10.99.0.10/24 | seat0 |
| Seat1 veth (`s1`) | 10.99.0.11/24 | seat1 |
| Seat2 veth (`s2`) | 10.99.0.12/24 | seat2 |
| Seat3 veth (`s3`) | 10.99.0.13/24 | seat3 |
| Interaktiver Seat veth (`si`) | 10.99.0.20/24 | seatI |

**Begründung Resolver auf 127.0.0.1 (nicht auf br-zone):** Seats sollen NIE DNS sprechen. Liegt der Resolver auf `127.0.0.1` der root-ns, ist `:53` für Seats topologisch unerreichbar (anderer netns, kein Loopback-Sharing). Die Seats erreichen die Broker per FIXER IP (10.99.0.1/.2) — kein Namens-Lookup, kein `:53`-Egress, kein Hostname-Leak. Nur die Broker (root-ns) nutzen den Resolver, um die Egress-Allowlist-FQDNs aufzulösen.

### 1.3 UID-Plan (owner-match-Basis)
| UID | Prozess | Egress erlaubt? |
|---|---|---|
| 8001 `zbroker-llm` | LLM-Broker | JA → Anthropic-FQDN-Set:443 (app-layer SNI/Pin = Schnüffi) |
| 8002 `zbroker-merkel` | Merkel-Broker | JA → 192.168.20.81:8000 |
| 8003 `zresolver` | DoT-Resolver | JA → DoT-Upstream-IP:853 NUR |
| 8004 `zntp` | zone-NTP (optional) | siehe Artefakt 03 §NTP (Default: KVM-PTP, kein Egress) |
| ≥20000 `seatN` (userns-gemappt) | Seats | **NEIN** (kein Egress eth0; nur veth→Broker) |
| 0 root | Init/Verifier | **NEIN egress eth0** (nur Verwaltung; Oracle läuft als root, prüft Seat-ns von außen) |

---

## 2. netns-Aufbau (maschinenlesbar — `zone-netns-setup.sh`)

> Idempotent, root-ns, läuft als systemd `oneshot` VOR den Seats (Artefakt §5 Boot-Ordering).
> KEIN Live-Touch — dies ist das Build-Artefakt; Ausführung erst nach Christin/Hub-Go in der gebauten VM.

```bash
#!/usr/bin/env bash
# T-0244 zone-netns-setup.sh — baut Broker-Bridge + pro-Seat-netns. Fail-closed.
set -euo pipefail
BR=br-zone
SEATS=(seat0:10:s0 seat1:11:s1 seat2:12:s2 seat3:13:s3 seatI:20:si)

# --- 0. Härtung des Forwardings (B1/H1 VM-intern) -------------------------
sysctl -w net.ipv4.ip_forward=0
sysctl -w net.ipv6.conf.all.forwarding=0
sysctl -w net.ipv4.conf.all.rp_filter=1

# --- 1. Broker-Bridge (root-ns) ------------------------------------------
ip link show "$BR" &>/dev/null || ip link add "$BR" type bridge
ip link set "$BR" up
# Broker-Bridge bekommt KEINE Default-Route, NUR die /24-Adresse:
ip addr replace 10.99.0.254/24 dev "$BR"
# L2-Isolation zwischen Seat-Ports (Stern, kein Seat<->Seat):
ip link set "$BR" type bridge ageing_time 0
echo 1 > /sys/class/net/$BR/bridge/no_linklocal_learn 2>/dev/null || true

# --- 2. Pro-Seat-netns + veth-Paar ---------------------------------------
for entry in "${SEATS[@]}"; do
  NS="${entry%%:*}"; rest="${entry#*:}"; OCT="${rest%%:*}"; VETH="${rest##*:}"
  ip netns add "$NS" 2>/dev/null || true
  # veth: host-Seite an br-zone, peer in die Seat-ns
  ip link add "v-$VETH" type veth peer name "p-$VETH" 2>/dev/null || true
  ip link set "v-$VETH" master "$BR"
  ip link set "v-$VETH" type bridge_slave isolated on   # Seat<->Seat L2 blockiert
  ip link set "v-$VETH" up
  ip link set "p-$VETH" netns "$NS"
  ip netns exec "$NS" ip link set lo up
  ip netns exec "$NS" ip link set "p-$VETH" name eth0
  ip netns exec "$NS" ip addr add "10.99.0.$OCT/24" dev eth0
  ip netns exec "$NS" ip link set eth0 up
  # KEIN default route in der Seat-ns. Nur on-link 10.99.0.0/24 (automatisch).
  # IPv6 in der Seat-ns komplett aus (H2):
  ip netns exec "$NS" sysctl -w net.ipv6.conf.all.disable_ipv6=1
  ip netns exec "$NS" sysctl -w net.ipv6.conf.default.disable_ipv6=1
  ip netns exec "$NS" sysctl -w net.ipv4.ip_forward=0
done
echo "[zone-netns-setup] OK"
```

**Eigenschaften (testbar durch Artefakt 02):**
- Seat-ns hat GENAU EIN Interface (`eth0`=veth) + `lo`. Kein Pfad zu eth0-real (192.168.50.0/29) — anderer netns, keine Bridge dazwischen.
- Kein default-route → jedes Paket an eine Nicht-`10.99.0.0/24`-Adresse → `ENETUNREACH` (noch VOR nftables).
- `isolated on` → Seat0 sieht Seat1 nicht (L2).
- IPv6 disabled → kein link-local/SLAAC-Egress.

---

## 3. nftables — root-ns (owner-match, default-deny) — `zone-root.nft`

```nft
#!/usr/sbin/nft -f
# T-0244 zone-root.nft — VM-root-netns. NUR Broker-UIDs egress eth0. Fail-closed.
flush ruleset

define EXT_IF   = "eth0"          # 192.168.50.2 → UDM .50.1
define BR_IF    = "br-zone"
define UID_LLM    = 8001
define UID_MERKEL = 8002
define UID_RESOLV = 8003
define MERKEL_IP  = 192.168.20.81
define DOT_UPSTREAM = 192.168.50.1   # DoT via UDM-internen Resolver ODER gepinnte IP (Schnüffi/Netzi H5)

table inet zone_root {
  # ---- Egress über das EXTERNE Interface: owner-gematcht, sonst DROP ----
  chain output {
    type filter hook output priority 0; policy drop;
    oif "lo" accept
    oif $BR_IF accept                       # Broker<->Seat intern frei
    ct state established,related accept

    # LLM-Broker: nur 443 raus (IP-Allowlist grob; FQDN/SNI/Pin = Broker-app-layer/Schnüffi)
    oif $EXT_IF meta skuid $UID_LLM    tcp dport 443 accept
    # Merkel-Broker: nur .81:8000
    oif $EXT_IF meta skuid $UID_MERKEL ip daddr $MERKEL_IP tcp dport 8000 accept
    # DoT-Resolver: nur :853 zum gepinnten Upstream
    oif $EXT_IF meta skuid $UID_RESOLV ip daddr $DOT_UPSTREAM tcp dport 853 accept

    oif $EXT_IF log prefix "zone-root-egress-drop " drop   # alles andere raus = DROP+audit
    ip6 saddr ::/0 drop                                     # kein IPv6-Egress (H2)
  }

  # ---- Kein Transit: die VM routet NICHTS (H1 VM-intern, Belt+Suspenders zu ip_forward=0)
  chain forward {
    type filter hook forward priority 0; policy drop;
    log prefix "zone-root-forward-drop " drop
  }

  # ---- Ingress: nur etablierte Antworten + Broker-Listener von Seats ----
  chain input {
    type filter hook input priority 0; policy drop;
    iif "lo" accept
    ct state established,related accept
    iif $BR_IF tcp dport { 8443, 8500 } accept     # Seats → Broker-Listener
    iif $EXT_IF ct state new drop                   # keine unsolicited Verbindung von außen
    log prefix "zone-root-input-drop " drop
  }
}
```

**Warum owner-match die Kern-Invariante trägt:** Selbst wenn ein Prozess in root-ns eine Route nach außen hätte, lässt die `output`-policy NUR `skuid ∈ {8001,8002,8003}` mit exakt einem Ziel-Port raus. Ein als root oder als Seat-UID laufender Prozess in root-ns → DROP+Log. Die einzige Möglichkeit, das zu umgehen, wäre, ALS Broker-UID zu laufen — was der Seat-Cap-Drop (§4) verhindert (kein `setuid` ohne Privileg, userns-Map disjunkt, `NoNewPrivileges`).

---

## 4. Seat-Härtung (B1c) — `zone-seat@.service` (systemd, je Seat)

```ini
# /etc/systemd/system/zone-seat@.service  (instanziiert: zone-seat@seat0 ...)
[Unit]
Description=T-0244 zone seat %i (hardened, netns-confined)
After=zone-netns-setup.service zone-nft-seat@%i.service
BindsTo=zone-netns-setup.service zone-nft-seat@%i.service   # B1d: kein Seat ohne netns+nft
Requires=zone-broker-llm.service zone-broker-merkel.service

[Service]
# --- in die vorbereitete Seat-netns (NICHT PrivateNetwork: die ns ist persistent gebaut) ---
NetworkNamespacePath=/var/run/netns/%i

# --- B1c Capability-Drop: KEINE der netns-/privesc-relevanten Caps ---
CapabilityBoundingSet=
AmbientCapabilities=
NoNewPrivileges=yes
# explizit die gefährlichen verbieten (CapabilityBoundingSet= leert ohnehin alles):
# CAP_NET_ADMIN CAP_SYS_ADMIN CAP_NET_RAW CAP_SYS_PTRACE CAP_SETUID CAP_SETGID CAP_BPF

# --- B1c user-namespace-Map: Seat-UID disjunkt von Broker-UIDs (8001-8003) ---
PrivateUsers=yes
DynamicUser=yes            # ephemerer hoher UID-Bereich (≥61184), nie 8001-8003, nie 0
User=                      # von DynamicUser gesetzt

# --- B1c seccomp: netns-/mount-/bpf-Syscalls blocken ---
SystemCallFilter=~@mount @swap @reboot @raw-io @cpu-emulation @obsolete
SystemCallFilter=~setns unshare clone3 bpf pivot_root mount_setattr open_tree move_mount
SystemCallArchitectures=native
RestrictNamespaces=yes     # blockt clone(CLONE_NEW*) hart
LockPersonality=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
MemoryDenyWriteExecute=no  # Node/Claude-CLI braucht JIT → NICHT setzen; via seccomp-@raw-io abgedeckt

# --- FS: kein Schreibzugriff außer Seat-Workdir; Pseudonym-Map NICHT gemountet (Artefakt 04) ---
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/zone/seats/%i
PrivateTmp=yes

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Begründung gegen den B1-Einwand „nsenter in Broker-ns / als Broker-UID laufen":**
- `RestrictNamespaces=yes` + seccomp-`~setns,unshare,clone3` → der Seat kann KEINE netns wechseln/erzeugen.
- `PrivateUsers=yes`/`DynamicUser` → Seat-UID liegt im ephemeren Hoch-Bereich, in der root-ns auf `nobody`/disjunkt gemappt; `CAP_SETUID` weg + `NoNewPrivileges` → er kann NICHT zu UID 8001/8002 werden.
- `CapabilityBoundingSet=` leer → `CAP_NET_ADMIN` weg → er kann seine eigene Seat-ns nicht umkonfigurieren (keine Route hinzufügen, keine nft-Regel ändern, kein neues veth).
- → netns wird damit zur belastbaren Grenze; der owner-match (§3) ist nicht umgehbar.

---

## 5. nftables — Seat-ns (default-drop, NUR Broker) — `zone-nft-seat@.service` + `zone-seat.nft`

```nft
#!/usr/sbin/nft -f
# zone-seat.nft — IN der Seat-netns appliziert. Default-drop, NUR Broker-Ziele.
flush ruleset
define LLM    = 10.99.0.1
define MERKEL = 10.99.0.2
table inet zone_seat {
  chain output {
    type filter hook output priority 0; policy drop;
    oif "lo" accept
    ct state established,related accept
    ip daddr $LLM    tcp dport 8443 accept
    ip daddr $MERKEL tcp dport 8500 accept
    ip6 saddr ::/0 drop
    log prefix "zone-seat-egress-drop " drop
  }
  chain input  { type filter hook input  priority 0; policy drop;
                 iif "lo" accept; ct state established,related accept; }
  chain forward{ type filter hook forward priority 0; policy drop; }
}
```

```ini
# /etc/systemd/system/zone-nft-seat@.service
[Unit]
Description=T-0244 seat-ns nftables for %i (fail-closed)
After=zone-netns-setup.service
BindsTo=zone-netns-setup.service
Before=zone-seat@%i.service           # B1d: nft VOR dem Seat
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/ip netns exec %i /usr/sbin/nft -f /etc/zone/zone-seat.nft
# fail-closed: schlägt nft fehl → Unit failed → BindsTo bricht zone-seat@%i ab
[Install]
WantedBy=multi-user.target
```

---

## 6. Boot-Ordering fail-closed (B1d) — Abhängigkeitsgraph

```
sysctl(ip_forward=0)  ─┐
                       ▼
zone-netns-setup.service (oneshot, baut br-zone + alle Seat-ns, IPv6-off)
   │  Before= alle nft + Broker + Seats
   ├─► zone-root-nft.service (nft -f zone-root.nft; owner-match aktiv)
   │        │ Before= Broker
   │        ├─► zone-broker-llm.service     (uid 8001) ─┐
   │        ├─► zone-broker-merkel.service  (uid 8002)  ├─ egress-fähig, NACH nft
   │        └─► zone-resolver.service        (uid 8003) ─┘
   └─► zone-nft-seat@seatN.service (je Seat, nft in Seat-ns)
            │ Before= zone-seat@seatN
            └─► zone-seat@seatN.service  (BindsTo netns+nft+Broker)
```

**Fail-closed-Garantien:**
1. **Kein Seat startet vor seiner Seat-ns + Seat-nft:** `BindsTo=zone-netns-setup zone-nft-seat@%i` + `After=`. Fällt eine der beiden aus → Seat startet NICHT (kein fail-open-Fenster).
2. **Kein Broker egress-fähig vor root-nft:** `zone-root-nft` `Before=` alle Broker; bis nft steht, lässt die default-policy (drop) ohnehin nichts raus.
3. **Boot-Self-Test-Gate:** `zone-selftest.service` (`After=` alle Seats, `Before=zone-spawner.service`) ruft Artefakt 02 (Negativ-Oracle) auf; **non-zero → `zone-spawner` startet NICHT** → keine Seat-Arbeit ohne bestandenen Isolations-Beweis. Das ist der maschinelle Riegel gegen „deployt aber Enforcement still kaputt".

```ini
# /etc/systemd/system/zone-selftest.service
[Unit]
Description=T-0244 boot self-test — seat-negative-oracle (gate for spawner)
After=zone-seat@seat0.service zone-seat@seat1.service zone-seat@seat2.service zone-seat@seat3.service
Before=zone-spawner.service
Requires=zone-netns-setup.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/seat-negative-oracle.sh --all-seats --strict
# exit!=0 → diese Unit failed → zone-spawner (Requires=zone-selftest) startet nicht
[Install]
WantedBy=multi-user.target
```

---

## 7. Was dieses Artefakt NICHT abdeckt (Abgrenzung — Owner-Map)
- **FQDN/SNI/Cert-Pinning + DoT-Upstream-Pin (H5), LLM-Broker-RPC-Methoden (B2), PII-Detektor/positive-Allowlist (B3), Anhang-Handling (H4):** Schnüffi (app-layer, `T-0244-gate-artifacts-spec.md`). Mein nftables ist die GROBE IP/Port/owner-Schicht darunter.
- **UDM-VLAN-default-deny + L2/Trunk/ARP-Review + Allowlist-Final-Hosts (H5/L1):** Netzi (Artefakt 03 referenziert).
- **vzdump/Pseudonym-Map/Vault (H3/H6/M2):** mein Artefakt 04.
- **ip_forward-pz2-Host-Beweis (H1) + IPv6-Egress-Test (H2) + NTP (M1):** mein Artefakt 03.
- **Negativ-Oracle-Implementierung (B1b):** mein Artefakt 02 (separat, weil = der Test, der DIESE Policy beweist).

## 8. Verifikations-Hooks (R31 — was beweist „fertig")
Dieses Artefakt ist erst „build-ready", wenn Artefakt 02 (Negativ-Oracle) in der gebauten VM grün läuft: ALLE Negativ-Proben FAIL + ALLE Positiv-Proben SUCCEED. Bis dahin: **SPEC, nicht verifiziert** (kein Live-Bau erfolgt — Christin/Hub-Go + Netzi-VLAN stehen aus).
