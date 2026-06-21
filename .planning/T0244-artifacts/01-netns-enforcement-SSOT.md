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

# --- 0b. /run/netns als SHARED mount sichern (Refute HIGH-2) --------------
# named-netns + systemd NetworkNamespacePath braucht /run/netns als shared mount,
# sonst propagiert der ns-Pfad nicht in die private Mount-ns der Seat-Unit
# (systemd PrivateMounts) → Seat-Unit failed silent. Vor JEDEM ip-netns-add.
mkdir -p /run/netns
mountpoint -q /run/netns || mount --bind /run/netns /run/netns
mount --make-shared /run/netns

# --- 1. Broker-Bridge (root-ns) ------------------------------------------
ip link show "$BR" &>/dev/null || ip link add "$BR" type bridge
ip link set "$BR" up
# Broker-Bridge: KEINE Default-Route. Bridge-eigene Verwaltungsadresse:
ip addr replace 10.99.0.254/24 dev "$BR"
# Broker-Listen-IPs als SEKUNDÄR-Adressen AUF der Bridge (Refute HIGH-1):
# ohne diese binden die Broker auf 10.99.0.1/.2 mit EADDRNOTAVAIL und Seats
# bekommen keine local-delivery. local delivery ignoriert das isolated-Flag
# (Refute VERIFIED gg. Kernel 7d850ab) → Seats erreichen die Bridge-IPs, aber
# NICHT einander.
ip addr replace 10.99.0.1/24 dev "$BR"
ip addr replace 10.99.0.2/24 dev "$BR"
# L2-Isolation zwischen Seat-Ports (Stern, kein Seat<->Seat):
ip link set "$BR" type bridge ageing_time 0
echo 1 > /sys/class/net/$BR/bridge/no_linklocal_learn 2>/dev/null || true

# --- 2. Pro-Seat-netns + veth-Paar ---------------------------------------
for entry in "${SEATS[@]}"; do
  NS="${entry%%:*}"; rest="${entry#*:}"; OCT="${rest%%:*}"; VETH="${rest##*:}"
  # Idempotent (Lens-2 Befund 2: '||true' verdeckte Dup-/Move-Fehler beim 2. Lauf).
  # Reconcile: netns nur anlegen wenn fehlt; veth je Lauf NEU (billig; Löschen einer
  # veth-Seite entfernt beide Enden), Adressen mit 'replace' statt 'add'.
  ip netns list | grep -qw "$NS" || ip netns add "$NS"
  # Stale-Reste VOLLSTÄNDIG räumen (Lens-2-confirm #2: veth, evtl. zurückgebliebenes
  # p-veth in root-ns aus einem vor dem netns-move abgebrochenen Lauf, alte eth0):
  ip link del "v-$VETH" 2>/dev/null || true          # entfernt beide veth-Enden
  ip link del "p-$VETH" 2>/dev/null || true          # falls p-veth noch in root-ns hängt
  ip -n "$NS" link del "p-$VETH" 2>/dev/null || true # Round-3 M2: stale p-veth IN der ns (crash vor rename)
  ip -n "$NS" link del eth0 2>/dev/null || true
  ip -n "$NS" addr flush dev eth0 2>/dev/null || true
  ip link add "v-$VETH" type veth peer name "p-$VETH"
  ip link set "v-$VETH" master "$BR"
  ip link set "v-$VETH" type bridge_slave isolated on   # Seat<->Seat L2 blockiert
  ip link set "v-$VETH" up
  ip link set "p-$VETH" netns "$NS"
  ip -n "$NS" link set lo up
  ip -n "$NS" link set "p-$VETH" name eth0
  ip -n "$NS" addr replace "10.99.0.$OCT/24" dev eth0   # replace = idempotent
  ip -n "$NS" link set eth0 up
  ip -n "$NS" route flush default 2>/dev/null || true   # defensiv: GARANTIERT keine default-route (Lens-2-confirm #2)
  # KEIN default route in der Seat-ns. Nur on-link 10.99.0.0/24 (automatisch).
  # IPv6 in der Seat-ns komplett aus (H2):
  ip netns exec "$NS" sysctl -qw net.ipv6.conf.all.disable_ipv6=1
  ip netns exec "$NS" sysctl -qw net.ipv6.conf.default.disable_ipv6=1
  ip netns exec "$NS" sysctl -qw net.ipv4.ip_forward=0
done
echo "[zone-netns-setup] OK"
# Re-Run-Test (Build-Verify): Skript 2× nacheinander → 2. Lauf exit 0, Topologie
# identisch (kein Dup, kein set-e-Abbruch). Teil des Boot-Self-Tests.
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
    # Round-5 H1 (ECHTES IPv6-Egress-Loch): in `table inet` matcht `tcp dport 443`
    # v4 UND v6 — die v6-saddr-drop-Regel am Ende kam ZU SPÄT (nach den Accepts).
    # Deshalb v6 UNBEDINGT als ALLERERSTE Regel killen, vor jedem Accept:
    meta nfproto ipv6 drop
    oif "lo" accept
    ct state established,related accept
    # Broker→Seat (intern): NUR Broker-UIDs neu auf br-zone (Refute MED-4):
    oif $BR_IF meta skuid { $UID_LLM, $UID_MERKEL, $UID_RESOLV } meta nfproto ipv4 accept

    # LLM-Broker: 443 raus. KEIN `ip daddr` (Anthropic-IPs rotieren, nicht pinbar) →
    # die Ziel-Restriktion MUSS der LLM-Broker-RPC-App-Layer tragen (SNI/Cert-Pin, Schnüffi).
    # nft trägt hier nur owner+proto+port; nfproto ipv4 explizit:
    oif $EXT_IF meta skuid $UID_LLM    meta nfproto ipv4 tcp dport 443 accept
    # Merkel-Broker: nur .81:8000
    oif $EXT_IF meta skuid $UID_MERKEL ip daddr $MERKEL_IP tcp dport 8000 accept
    # DoT-Resolver: nur :853 zum gepinnten Upstream
    oif $EXT_IF meta skuid $UID_RESOLV ip daddr $DOT_UPSTREAM tcp dport 853 accept

    oif $EXT_IF log prefix "zone-root-egress-drop " drop   # alles andere raus = DROP+audit
  }

  # ---- Kein Transit: die VM routet NICHTS (H1 VM-intern, Belt+Suspenders zu ip_forward=0)
  chain forward {
    type filter hook forward priority 0; policy drop;
    meta nfproto ipv6 drop
    log prefix "zone-root-forward-drop " drop
  }

  # ---- Ingress: nur etablierte Antworten + Broker-Listener von Seats ----
  chain input {
    type filter hook input priority 0; policy drop;
    meta nfproto ipv6 drop
    iif "lo" accept
    ct state established,related accept
    # Broker-Listener von Seats — PAARWEISE gepinnt (Lens-2-confirm: ein
    # {set} auf beiden Seiten = kartesisch = 4 Kombis inkl. .1:8500/.2:8443;
    # zwei separate Regeln = genau die 2 zulässigen Paare):
    iif $BR_IF ip daddr 10.99.0.1 tcp dport 8443 accept   # LLM-Broker
    iif $BR_IF ip daddr 10.99.0.2 tcp dport 8500 accept   # Merkel-Broker
    iif $EXT_IF ct state new drop                   # keine unsolicited Verbindung von außen
    log prefix "zone-root-input-drop " drop
  }
}
```

**Reload-Hinweis (Lens-2 Befund 7) — jetzt KODIERT, nicht nur Prosa:** `ct state established,related accept` steht UID-unabhängig VOR den Owner-Regeln → bei einem Ruleset-RELOAD könnten offene Fremd-Flows überleben. Die anwendende Unit erzwingt `conntrack -F` bei JEDEM (Re-)Apply, damit bestehende Flows neu bewertet werden:
```ini
# /etc/systemd/system/zone-root-nft.service
[Unit]
Description=T-0244 root-ns nftables (owner-match, fail-closed)
After=zone-netns-setup.service
BindsTo=zone-netns-setup.service
Before=zone-broker-llm.service zone-broker-merkel.service zone-resolver.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/zone/zone-root.nft
# Round-3 H2: KEIN führendes '-' → ein conntrack-Fehler failt die Unit (fail-closed).
# conntrack-tools ist harte Build-Dependency (sonst überleben Fremd-Flows den Reload):
ExecStartPost=/usr/sbin/conntrack -F           # Flow-Reset bei jedem Apply (#7)
ExecReload=/usr/sbin/nft -f /etc/zone/zone-root.nft
ExecReload=/usr/sbin/conntrack -F              # auch bei `systemctl reload`, fail-closed
[Install]
WantedBy=multi-user.target
```
(Beim Boot mit frischem Stack flusht `conntrack -F` eine leere Tabelle → exit 0; nur beim Live-Reload trägt es. **Build-Dep: `conntrack` MUSS installiert sein**, sonst failt die Unit absichtlich.)
**M4 (Round-3) + M3 (Round-6): Broker-Unit-Stubs (eingebettet, damit die Broker↔root-nft-Kopplung prüfbar ist).** Die Broker laufen als gehärtete In-VM-Dienste mit dedizierten UIDs; die App-Logik (RPC-Spec/PII-Gate/SNI-Pin) liefert Schnüffi. Hier nur die fail-closed-Verdrahtung:
```ini
# /etc/systemd/system/zone-broker-llm.service  (analog zone-broker-merkel / zone-resolver)
[Unit]
Description=T-0244 LLM-Broker (uid 8001, einziger egress-fähiger Anthropic-Pfad)
After=zone-netns-setup.service zone-root-nft.service
Requires=zone-root-nft.service          # M4: kein Broker-Egress, bevor owner-match-nft steht
BindsTo=zone-root-nft.service           # fällt root-nft → Broker stoppt (fail-closed)
[Service]
User=zbroker-llm                        # uid 8001 (statisch, im owner-match referenziert)
# Härtung analog Seat (kein DynamicUser — UID muss fix für skuid-Match sein):
CapabilityBoundingSet=
NoNewPrivileges=yes
RestrictAddressFamilies=AF_UNIX AF_INET
ProtectSystem=strict
SystemCallArchitectures=native
ExecStart=/usr/local/bin/zone-broker-llm   # RPC-Spec/PII-Gate/SNI-Pin = Schnüffi
Restart=on-failure
[Install]
WantedBy=multi-user.target
```
→ ein Broker startet NICHT, wenn der owner-match-nft fehlschlug; fällt root-nft zur Laufzeit, stoppt der Broker (BindsTo). **Build-Verify:** `systemctl show -p Requires,After zone-broker-llm` enthält `zone-root-nft.service`.

**Warum owner-match die Kern-Invariante trägt:** Selbst wenn ein Prozess in root-ns eine Route nach außen hätte, lässt die `output`-policy NUR `skuid ∈ {8001,8002,8003}` mit exakt einem Ziel-Port raus. Ein als root oder als Seat-UID laufender Prozess in root-ns → DROP+Log. Die einzige Möglichkeit, das zu umgehen, wäre, ALS Broker-UID zu laufen — was der Seat-Cap-Drop (§4) verhindert (kein `setuid` ohne Privileg, userns-Map disjunkt, `NoNewPrivileges`).

---

## 4. Seat-Härtung (B1c) — Härtungs-Include + `zone-seat@` mit ExecStartPre-Self-Proof

**Round-5-Vereinfachung (Schnüffi): kein separates Probe-Fixture, kein „probe==seat"-Beweis mehr.** Der echte Seat beweist seine Härtung SELBST per `ExecStartPre=zone-seat-probe.sh` (ohne `+` → läuft unter der EIGENEN Confinement, frisch pro Start). Damit entfällt die ganze Transitivitäts-Maschinerie (separate `zone-seat-probe@`-Unit + Shared-Include-Gleichheits-Beweis + HARDEN_PROPS-Drift) — die R4-H5/R5-H3-Befundklasse („ist die Probe wirklich identisch zum Seat?") fällt komplett weg. **Weniger Code = kleinere Angriffsfläche (R12).** Das Shared-Include bleibt als saubere Single-Source der Seat-Härtung; der boot-zeitliche `seat-hardening-oracle.sh` ist jetzt ein STATISCHER Policy-Floor-Check am echten `zone-seat@` (gatet den Spawner), die DYNAMISCHE Garantie liefert der ExecStartPre-Self-Proof pro Start.

```ini
# /etc/zone/zone-hardening.conf — Single-Source der Seat-Härtung (Include für zone-seat@)
[Service]
CapabilityBoundingSet=        # leer = ALLE Caps weg (CAP_NET_ADMIN/SYS_ADMIN/SETUID/...)
AmbientCapabilities=
NoNewPrivileges=yes
PrivateUsers=yes
DynamicUser=yes               # ephemerer hoher UID-Bereich (≥61184), nie 8001-8003, nie 0
SystemCallFilter=~@privileged @mount @swap @reboot @raw-io @cpu-emulation @obsolete   # R6-H2: @privileged ergänzt
SystemCallFilter=~setns unshare clone3 bpf pivot_root mount_setattr open_tree move_mount
SystemCallArchitectures=native
RestrictNamespaces=yes        # blockt clone(CLONE_NEW*) hart
RestrictAddressFamilies=AF_UNIX AF_INET   # Round-5 M2: kein AF_NETLINK (Route/nft) / AF_PACKET (raw)
LockPersonality=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectProc=invisible         # Round-5 M2: kein Einblick in fremde PIDs
ProtectClock=yes              # Round-5 M2
RestrictRealtime=yes          # Round-5 M2
RestrictSUIDSGID=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
MemoryDenyWriteExecute=no     # Node/Claude-CLI braucht JIT → via seccomp-@raw-io abgedeckt

# zone-seat@ zieht es per drop-in-SYMLINK:
#   /etc/systemd/system/zone-seat@.service.d/10-hardening.conf -> /etc/zone/zone-hardening.conf
# Pflicht-Verify am Build: `systemd-analyze verify zone-seat@seat0.service` +
#   `systemctl is-enabled zone-{netns-setup,root-nft,nft-seat@seatI,seat@seatI,...}` (R5-M3).
```

```ini
# /etc/systemd/system/zone-seat@.service — der ECHTE Seat (nur Instanz-Spezifika; Härtung kommt aus dem Include)
[Unit]
Description=T-0244 zone seat %i (hardened, netns-confined)
# Round-3 H1: der Seat startet erst NACH den Boot-Aggregat-Gates (Netz + Static-Floor).
# Der DYNAMISCHE Cap-Drop-Beweis ist der ExecStartPre-Self-Proof unten (kein separates Fixture mehr):
After=zone-netns-setup.service zone-nft-seat@%i.service zone-selftest-net.service zone-selftest-hardening.service zone-broker-llm.service zone-broker-merkel.service
Requires=zone-selftest-net.service zone-selftest-hardening.service zone-broker-llm.service zone-broker-merkel.service
BindsTo=zone-netns-setup.service zone-nft-seat@%i.service   # B1d: kein Seat ohne netns+nft
[Service]
NetworkNamespacePath=/var/run/netns/%i
ReadWritePaths=/var/lib/zone/seats/%i    # instanz-spezifisch (NICHT im Drift-Vergleich)
# PrivateTmp + ZONE_HUB_HOST aus Shared-Include/Build; Env für die ExecStartPre-Netz-Probe:
Environment=ZONE_HUB_HOST=192.168.20.<MAC-IP-AM-BUILD-SETZEN>
# Round-5 H3+H4: der ECHTE Seat beweist sich FRISCH bei JEDEM (Re-)Start, fail-closed —
# nicht boot-gelatcht (RemainAfterExit der Gates re-evaluiert bei `restart` NICHT).
#  (1) zone-seat-probe.sh OHNE '+' → läuft unter der EIGENEN Seat-Härtung+netns
#      (ExecStartPre erbt CapBounding/seccomp/NetworkNamespacePath) → self-proof Cap-Drop.
#  (2) seat-negative-oracle MIT '+' → root (für `ip netns exec`), prüft Netz-Layer frisch.
# Ein Non-Zero in einer ExecStartPre → Seat startet NICHT (fail-closed gg. geänderte Realität).
ExecStartPre=/usr/local/sbin/zone-seat-probe.sh
ExecStartPre=+/usr/local/sbin/seat-negative-oracle.sh --seat %i --strict
# INERT bis Spawner-Handshake (Schnüffi-Verstärkung 3): der Entrypoint macht KEIN Netz,
# bis der Spawner ihn über einen ÜBERGEBENEN UDS/FD freigibt — KEIN TCP/localhost-Handshake
# (der wäre selbst das Egress-Loch, das die netns-Drop-Policy umgeht):
ExecStart=/usr/local/bin/zone-seat-entrypoint %i
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
```

*(Das separate `zone-seat-probe@.service`-Fixture aus Round-3/4 ist mit der Round-5-Vereinfachung ENTFALLEN — `zone-seat-probe.sh` läuft jetzt als `ExecStartPre` im echten `zone-seat@` selbst, frisch pro Start unter der echten Confinement.)*

**Begründung gegen den B1-Einwand „nsenter in Broker-ns / als Broker-UID laufen":**
- `RestrictNamespaces=yes` + seccomp-`~setns,unshare,clone3` → der Seat kann KEINE netns wechseln/erzeugen.
- `PrivateUsers=yes`/`DynamicUser` → Seat-UID im ephemeren Hoch-Bereich, disjunkt gemappt; `CAP_SETUID` weg + `NoNewPrivileges` → er kann NICHT zu UID 8001/8002 werden.
- `CapabilityBoundingSet=` leer → `CAP_NET_ADMIN` weg → keine Route/nft/veth-Änderung in der eigenen netns.
- **Bewiesen statt behauptet, FRISCH pro Start:** der `ExecStartPre=zone-seat-probe.sh` (unter der echten Seat-Confinement, ohne `+`) inspiziert sich selbst + versucht all das, BEVOR `claude` startet → Non-Zero = Seat startet nicht.

### Layer-Split — die Oracles sind NICHT redundant (Schnüffi-Verstärkung 2, NICHT wegoptimieren)
- **`seat-negative-oracle.sh`** (root, `ip netns exec %i`) → AUSSCHLIESSLICH die **Netz-Schicht** (keine Route/Egress aus netns %i, nur die 2 Broker). Sagt NICHTS über die Prozess-Härtung. Läuft als Boot-Gate UND als `ExecStartPre=+…` pro Seat-Start.
- **`zone-seat-probe.sh`** (als `ExecStartPre`, confined) → AUSSCHLIESSLICH die **Prozess/Cap-Schicht** (CapEff=0, seccomp, userns, denied-Ops), frisch pro Start. **`seat-hardening-oracle.sh`** ist der boot-zeitliche STATISCHE Policy-Floor-Check derselben Schicht (am echten `zone-seat@`).
- **Keiner ersetzt den anderen.** Netz + Cap + Schnüffis Detektor-Recall = Triple-Oracle-Gate. Wer einen „weil der andere deckt's ab" entfernt, reißt eine Schicht auf.

---

## 5. nftables — Seat-ns (default-drop, NUR Broker) — `zone-nft-seat@.service` + `zone-seat.nft`

```nft
#!/usr/sbin/nft -f
# zone-seat.nft — IN der Seat-netns appliziert. Default-drop, NUR Broker-Ziele.
# `nft -f` lädt die ganze Datei als EINE atomare Transaktion → kein default-accept-
# Mikrofenster bei (Re-)Load (MED-5: scoped statt 'flush ruleset').
define LLM    = 10.99.0.1
define MERKEL = 10.99.0.2
# Idempotente atomare Tabellen-Ersetzung (Round-3 M1): 'destroy table' = delete-if-
# exists OHNE Fehler wenn fehlend (nft ≥ 1.0.2, Debian 13 ✓) → dann frisch neu, alles
# in DERSELBEN atomaren nft -f-Transaktion. PFLICHT-Build-Test: 2× `nft -f` nacheinander
# muss beide Male exit 0 + identisches Ruleset ergeben (per-Reload nicht durch Lesen
# entscheidbar — gegen die GEPINNTE nft-Version verifizieren).
destroy table inet zone_seat   # idempotent: weg falls da, kein Fehler falls nicht
table inet zone_seat {         # frisch neu aufbauen:
  chain output {
    type filter hook output priority 0; policy drop;
    meta nfproto ipv6 drop                 # Round-5 H1: v6 unbedingt zuerst (vor Accepts)
    oif "lo" accept
    ct state established,related accept
    # v4-qualifiziert (ip daddr matcht nur IPv4) — Broker-Ziele:
    ip daddr $LLM    tcp dport 8443 accept
    ip daddr $MERKEL tcp dport 8500 accept
    log prefix "zone-seat-egress-drop " drop
  }
  chain input  { type filter hook input  priority 0; policy drop;
                 meta nfproto ipv6 drop; iif "lo" accept; ct state established,related accept; }
  chain forward{ type filter hook forward priority 0; policy drop; meta nfproto ipv6 drop; }
}
```

```ini
# /etc/systemd/system/zone-nft-seat@.service
[Unit]
Description=T-0244 seat-ns nftables for %i (fail-closed)
After=zone-netns-setup.service
BindsTo=zone-netns-setup.service
PartOf=zone-seat@%i.service           # Refute MED-5: Laufzeit-restart der nft-Unit
                                       # zieht den Seat mit (nicht nur Boot-Kopplung)
Before=zone-seat@%i.service           # B1d: nft VOR dem Seat
# Round-6 H3 (STRUKTURELL statt behavioral): KEIN ExecReload= für die nft-Policy. Ein
# fehlgeschlagenes ExecReload geht bei systemd NICHT zuverlässig in 'failed' → OnFailure
# feuert nicht garantiert (der gefährliche Pfad „nft lädt gelockert, conntrack -F scheitert,
# Seat läuft weiter"). Ohne ExecReload ist CanReload=no → eine Config-Änderung MUSS
# `systemctl restart` sein (propagiert via BindsTo/PartOf → Seat wird re-gated).
# Build-Gate: `systemctl show -p CanReload zone-nft-seat@seat0` MUSS 'no' liefern.
# OnFailure bleibt für ExecStart/ExecStartPost-Fehler (belt+suspenders).
OnFailure=zone-seat-stop@%i.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/ip netns exec %i /usr/sbin/nft -f /etc/zone/zone-seat.nft
ExecStartPost=/usr/bin/ip netns exec %i /usr/sbin/conntrack -F   # Round-4 M3: auch Seat-ns
# KEIN ExecReload → CanReload=no (Round-6 H3). Flow-Reset passiert bei jedem (Re)Start via ExecStartPost.
# fail-closed: schlägt nft/conntrack beim Start fehl → Unit failed → OnFailure + BindsTo stoppen zone-seat@%i
[Install]
WantedBy=multi-user.target

# /etc/systemd/system/zone-seat-stop@.service — Stop-Handler (Round-5 H5)
[Unit]
Description=T-0244 fail-closed stop of zone-seat@%i
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl stop zone-seat@%i.service
```

---

## 6. Boot-Ordering fail-closed (B1d, Round-3 H1) — Gates VOR den echten Seats

**Redesign (Round-3 H1 + Round-5-Vereinfachung):** Zwei BOOT-Aggregat-Gates laufen VOR jedem egress-fähigen Seat (kein Seat-Prozess nötig); die DYNAMISCHE Cap-Schicht beweist jeder Seat per `ExecStartPre`-Self-Proof bei JEDEM Start selbst (kein separates Probe-Fixture mehr).

```
sysctl(ip_forward=0) → zone-netns-setup.service (br-zone + alle Seat-ns + IPv6-off + make-shared /run/netns)
   ├─► zone-root-nft.service (owner-match) ──► zone-broker-llm/merkel/resolver  (Requires/After root-nft; M4)
   └─► zone-nft-seat@%i.service (nft in Seat-ns, Before zone-selftest-net)
            │
            ▼  GATE 1 (Netz-Schicht, dynamisch, KEIN Seat nötig)
   zone-selftest-net.service  → seat-negative-oracle.sh --strict   (Requires/After nft-seat, Before seat)
            │  exit!=0 → failed → kein Seat
            ▼  GATE 2 (Cap-Schicht, STATISCHER Config-Floor am echten zone-seat@)
   zone-selftest-hardening.service → seat-hardening-oracle.sh      (After net, Before seat)
            │  exit!=0 → failed → kein Seat
            ▼
   zone-seat@%i.service (ECHTE claude-Seats):
       ExecStartPre=zone-seat-probe.sh        ← DYNAMISCHER Cap-Self-Proof (confined, fresh/Start)
       ExecStartPre=+seat-negative-oracle %i  ← Netz-Layer fresh/Start (root)
       ExecStart=zone-seat-entrypoint (INERT bis Spawner-UDS-Handshake)
            │
            ▼
   zone-spawner.service (After alle Seats, Requires beide Gates)
```

**Fail-closed-Garantien:**
1. **Boot-Aggregat-Gates VOR jedem Seat** (H1): `zone-seat@` `Requires=/After= zone-selftest-net zone-selftest-hardening`. Failt ein Gate → KEIN Seat.
2. **Per-Start-Self-Proof** (R5 H3/H4): `ExecStartPre` re-prüft Cap-Schicht (confined) + Netz-Schicht (`+`root) FRISCH bei jedem (Re-)Start → kein Boot-Latch, fail-closed gg. geänderte Config.
3. **Kein Broker egress-fähig vor root-nft:** Broker `Requires=/After= zone-root-nft` (M4).
4. **Inert-Seat:** selbst nach allem macht der Seat kein Netz bis Spawner-UDS-Handshake.

```ini
# /etc/systemd/system/zone-selftest-net.service  — GATE 1 (Netz-Isolation, dynamisch)
[Unit]
Description=T-0244 GATE 1: seat-negative-oracle (Netz-Schicht, kein Seat nötig)
# H5: seatI mitgegatet. M1: Requires= (nicht nur After=) der nft-seat-Units (fail-closed).
# R6-M2: AUCH die Broker (Requires/After) — die Positiv-Proben testen Seat→Broker-Erreichbarkeit,
# also müssen die Broker oben sein, sonst failt das Gate nur deshalb = nicht grün-bootbar.
After=zone-netns-setup.service zone-nft-seat@seat0.service zone-nft-seat@seat1.service zone-nft-seat@seat2.service zone-nft-seat@seat3.service zone-nft-seat@seatI.service zone-broker-llm.service zone-broker-merkel.service
Requires=zone-netns-setup.service zone-nft-seat@seat0.service zone-nft-seat@seat1.service zone-nft-seat@seat2.service zone-nft-seat@seat3.service zone-nft-seat@seatI.service zone-broker-llm.service zone-broker-merkel.service
Before=zone-seat@seat0.service zone-seat@seat1.service zone-seat@seat2.service zone-seat@seat3.service zone-seat@seatI.service
[Service]
Type=oneshot
RemainAfterExit=yes
Environment=ZONE_HUB_HOST=192.168.20.<MAC-IP-AM-BUILD-SETZEN>
ExecStart=/usr/local/sbin/seat-negative-oracle.sh --all-seats --strict
TimeoutStartSec=120
[Install]
WantedBy=multi-user.target

# /etc/systemd/system/zone-selftest-hardening.service  — GATE 2 (STATISCHER Cap-Config-Floor)
[Unit]
Description=T-0244 GATE 2: seat-hardening-oracle (statischer Policy-Floor am echten zone-seat@)
# Liest die STATISCHE Config der zone-seat@-Units (vor deren Start lesbar) — kein Prozess/
# Fixture nötig. seatI dabei (H5). Die DYNAMISCHE Garantie = ExecStartPre-Self-Proof pro Seat.
After=zone-selftest-net.service
Requires=zone-selftest-net.service
Before=zone-seat@seat0.service zone-seat@seat1.service zone-seat@seat2.service zone-seat@seat3.service zone-seat@seatI.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/seat-hardening-oracle.sh
TimeoutStartSec=60
[Install]
WantedBy=multi-user.target
```
(`zone-seat@%i` `Requires=` beide Gates → exit!=0 ⇒ KEIN Seat; zusätzlich ExecStartPre-Self-Proof pro Start. `zone-spawner` `Requires=` beide Gates → doppelter Riegel. **seatI überall** — der interaktive Seat ist der sensibelste, voll vor-isoliert.)

---

## 7. Was dieses Artefakt NICHT abdeckt (Abgrenzung — Owner-Map)
- **FQDN/SNI/Cert-Pinning + DoT-Upstream-Pin (H5), LLM-Broker-RPC-Methoden (B2), PII-Detektor/positive-Allowlist (B3), Anhang-Handling (H4):** Schnüffi (app-layer, `T-0244-gate-artifacts-spec.md`). Mein nftables ist die GROBE IP/Port/owner-Schicht darunter.
- **UDM-VLAN-default-deny + L2/Trunk/ARP-Review + Allowlist-Final-Hosts (H5/L1):** Netzi (Artefakt 03 referenziert).
- **vzdump/Pseudonym-Map/Vault (H3/H6/M2):** mein Artefakt 04.
- **ip_forward-pz2-Host-Beweis (H1) + IPv6-Egress-Test (H2) + NTP (M1):** mein Artefakt 03.
- **Negativ-Oracle-Implementierung (B1b):** mein Artefakt 02 (separat, weil = der Test, der DIESE Policy beweist).

## 8. Verifikations-Hooks (R31 — was beweist „fertig")
Dieses Artefakt ist erst „build-ready", wenn Artefakt 02 (Negativ-Oracle) in der gebauten VM grün läuft: ALLE Negativ-Proben geblockt + die 2 Broker-Positiv-Proben CONNECTED. Bis dahin: **SPEC, nicht verifiziert** (kein Live-Bau erfolgt — Christin/Hub-Go + Netzi-VLAN stehen aus).

## 9. Refute-Lens v2 — eingearbeitete Befunde (2026-06-21, Claude-Lens, fresh context)
Adversarialer Refute auf dieses Artefakt + das Oracle. **Was HIELT** (aktiv zu brechen versucht, nicht gebrochen): der Kern-B1c-Konter — systemd joint die netns und dropt Caps/seccomp VOR dem Seat-exec → der Seat startet bereits ohne `CAP_NET_ADMIN`/`setns`/`unshare` → netns wird zur harten Grenze (B1 real geschlossen, sofern der Seat NUR über die gehärtete Unit startet). `isolated`-Flag blockt Seat↔Seat, lässt aber local-delivery an Bridge-IPs durch (Kernel 7d850ab). Routenlose Seat-ns = echte zweite Schicht. Resolver auf 127.0.0.1 für Seats topologisch unerreichbar. **EINGEARBEITET:**
| Befund | Sev | Fix in diesem Doc |
|---|---|---|
| Broker-IPs 10.99.0.1/.2 keinem IF zugewiesen → Bau bricht | HIGH | §2 setup.sh: `ip addr replace 10.99.0.1/.2/24 dev br-zone` |
| named-netns Mount-Propagation-Footgun (PrivateMounts) | HIGH | §2 setup.sh §0b: `mount --make-shared /run/netns` vor netns-add |
| Oracle wertete „refused"(=Host erreicht) wie geblockt = false-PASS | HIGH | Artefakt 02 v2: CONNECTED/REFUSED→Verletzung, +UDP/ICMP-Proben |
| `oif br-zone accept` blanket = breiter als Invariante | MED | §3: auf Broker-UIDs `{8001,8002,8003}` eingeschränkt |
| BindsTo deckt Laufzeit-restart nicht; flush-Mikrofenster | MED | §5: `PartOf=` + `flush table` (atomar) statt `flush ruleset` |
| selftest-Gate kann an hängendem Ziel hängen | MED | §6: `TimeoutStartSec=180` (Timeout=fail-closed) |
| Broker-Pivot (covert Exfil via erlaubtem Anthropic-Kanal) | MED | §7 + Oracle-Hinweis: B1-Oracle ≠ Egress-Gesamtrisiko → Schnüffis positive-Allowlist-Oracle = CO-GATE für den Spawner |
| skuid-Match bricht, falls Broker zu anderer UID forkt; DoT-Upstream Annahme | LOW | Broker dürfen NICHT UID-wechseln (fail-closed=DROP); DoT-Upstream-Pin = offen mit Netzi/Schnüffi (H5) |

### Refute-Lens 2 — Codex/GPT via Schnüffi (2026-06-21, konvergent, R22)
Verdikt NOT-BUILD-READY mit 4 NEUEN HIGH (Fokus BUILD-MECHANIK, die Lens-1 übersah) + MEDs — alle EINGEARBEITET (`orchestrator-security/reviews/2026-06-21-T0244-B1-netns-refute-codex-lens2.md`, 90d1c4f):
| Befund | Sev | Fix |
|---|---|---|
| **#5** Oracle beweist Cap-Drop NICHT (nur Netz-Reachability aus Root-Sicht) | HIGH | **NEU `seat-hardening-oracle.sh` (B1c-Beweis):** /proc/$PID/status CapEff/CapBnd=0 + NoNewPrivs=1 + Seccomp=2 + uid_map disjunkt + Probe-Dienst-Negativ-Ops |
| #1 `flush table` failt First-Boot (Tabelle fehlt) → Seats aus | HIGH | §5: `add table`(no-op)+`flush table` atomar |
| #2 `zone-netns-setup.sh` nicht idempotent (Dup unter set -e) | HIGH | §2: reconcile + `ip addr replace` + veth-Recreate + Re-Run-Test |
| #3 Seat `Requires=` Broker ohne `After=` → Seat vor Broker-Ready | HIGH | §4: Broker in `After=` + `systemd-analyze verify` |
| #4 Oracle: Platzhalter `HUBHOST`→OTHER als „OK" gewertet | HIGH | Oracle v3: Platzhalter=INVALID=FAIL; `ZONE_HUB_HOST` Pflicht |
| #7 `ct established` UID-unabhängig vor Owner-Regeln (Reload-Flows) | MED | §3 Reload-Hinweis: `conntrack -F` bei Reload |
| #8 Broker-Input ohne `ip daddr`-Pin | MED | §3: `ip daddr {10.99.0.1,.2}` gepinnt |
| #9 Oracle wertet Tool-/NSS-Fehler als „blockiert" | MED | Oracle v3: TOOLERR=FAIL (Tool-Check) |
| #6 leeres `User=` bei DynamicUser | MED | §4: entfernt + `systemd-analyze verify` |
| #10 Broker-Pivot außerhalb netns-Oracle (✅ bestätigt) | — | Schnüffis Detektor-Recall-Oracle = CO-GATE (Dual-Oracle) |

**KONVERGENZ beider Lensen:** B1-Kern-Konter (Cap-Drop macht netns hart) gilt — ABER war BIS Lens-2 unbewiesen (jetzt `seat-hardening-oracle.sh`). Beide Lensen bestätigen: Egress-Bau bleibt BLOCK bis BEIDE Oracles (Netz + Cap-Drop) + Schnüffis Detektor-Oracle grün.

### Refute Round-2 — Bestätigungs-Lens (Codex/Schnüffi, b8149bd) — 9 Befunde gefoldet
Verdikt NOT-YET. ✅ ZU bestätigt: #3 (After= Broker), #4 (Platzhalter=FAIL), #6 (User= raus). 2 NEUE Bugs, die meine Lens-2-Fixes selbst einführten, + Rest-Lücken im B1c-Oracle — ALLE gefoldet:
| # | Befund | Fix |
|---|---|---|
| 1 | daddr-Pin `{set} dport {set}` = 4 Kombis (kartesisch) statt 2 | §3: PAARWEISE — `daddr .1 dport 8443` / `daddr .2 dport 8500` (2 Regeln) |
| 2 | `try_denied(){ "$@" && bad=1; }` = JEDE Nicht-Null „verweigert" (false-PASS — exakt #5-Klasse, reintroduziert) | hardening-oracle: nur EPERM/EACCES/SIGSYS=OK; Tool-Preflight; sonst FAIL (lokal getestet) |
| 3/5b | Hardening-Oracle NICHT im Boot-Gate | §6: 2. ExecStart in `zone-selftest.service` |
| 4 | uid_map nur 1. Zeile/2. Spalte → keine Range-Disjunktheit | hardening-oracle: ALLE Zeilen als outer..outer+len-1 gg. {0,8001-8003} |
| 5a | kein netns-Membership-Check des PID | hardening-oracle: `ip netns identify $PID` == erwartete ns |
| 5c | Probe-Dienst nur Existenz, nicht Härtungs-GLEICHHEIT geprüft | hardening-oracle: `systemctl show` CapBnd/NNP/PrivateUsers/SyscallFilter/RestrictNS/DynamicUser Probe==Seat |
| 5d | `start \|\|true`+ExecMainStatus → Stale | hardening-oracle: reset-failed + frische InvocationID + Result=success |
| 6 | `add table` evtl. „File exists" beim Reload | §5: `table{}`+`delete table`+`table{...}` (kanonisch idempotent) |
| 7 | netns-Reconcile unvollständig (stale p-veth, addrs, default-route) | §2: `ip link del p-veth` + `addr flush` + `route flush default` |
| 8 | conntrack -F nur Prosa | §3: kodiert als `ExecStartPost=`/`ExecReload=` in `zone-root-nft.service` |
| 9 | Oracle ping/dns pauschal NOROUTE → NSS-Fehler als PASS | Oracle v3.1: ping-Exit 0/1/2 + getent 0/2/sonst diskriminiert |

**Schnüffi recycelte nach 4 Refute-Runden** (Lens-Rezept im durablen Memory) → frische Session fährt die nächste Lens.

### Refute Round-3 — Bestätigungs-Lens (Codex/Schnüffi, 0c20a6a) — 6 HIGH + 4 MED + 3 Verstärkungen gefoldet
Verdikt NOT-BUILD-READY. ✅ ZU: R2-#1 (daddr paarweise). Befunde — ALLE gefoldet:
| # | Sev | Befund | Fix |
|---|---|---|---|
| H1 | HIGH | Boot-Gate lief NACH Seat-Start → Fail-open-Fenster | §6 Redesign: beide Gates VOR `zone-seat@` (Negativ-Oracle braucht keinen Seat; Cap-Drop gegen Probe-Fixture); `Requires=/After=` |
| H3 | HIGH | `[ $rc -ge 128 ]` akzeptierte JEDES Signal (SIGKILL/SEGV) = 3. false-PASS | `zone-seat-probe.sh`: nur `rc -eq 159` (SIGSYS); lokal verifiziert |
| H4 | HIGH | Hostname-TCP-Test braucht DNS → korrektes System failt (nie grün) | Oracle: TCP-Negativtests nur gegen IPs; Name nur im dns-Test |
| H2 | HIGH | `conntrack -F` mit `-` = Fehler ignoriert (nicht fail-closed) | §3: `-` weg, conntrack harte Build-Dep |
| H5 | HIGH | Props-Liste driftet; Probe könnte in anderer netns „gleich" sein | §4: **Shared-Include-Symlink = STRUKTURELLE Primärgarantie**; Oracle prüft DropInPaths==Canon (Primär) + erweiterte Props (Drift-Detektor) + NetworkNamespacePath |
| H6 | HIGH | `zone-seat-probe.sh` nur auskommentiert (ungetestet) | NEU als echtes verdrahtetes Artefakt + `zone-seat-probe@.service` (§4) |
| M1 | MED | `table{};delete;table{}`-Idempotenz nicht belastbar | §5: `destroy table` (nft≥1.0.2) + Pflicht-2×-Reload-Build-Test |
| M2 | MED | reconcile ließ stale `p-veth` IN der ns | §2: `ip -n $NS link del p-$VETH` |
| M3 | MED | ping-Exit 1 (gesendet, keine Antwort) als „blockiert" gewertet | Oracle: nur exit 2 (no-route)=blockiert; exit 1=Leak/inconclusiv=FAIL |
| M4 | MED | Broker ohne `Requires=/After=zone-root-nft` | §3: Broker `Requires=/After= zone-root-nft` |

**Schnüffis 3 proaktive Verstärkungen (vor-Bau) — alle übernommen:** (1) Shared-Include als STRUKTUR-Primär (s. H5); (2) **Layer-Split-Block** (§4 Ende: netns-Oracle = nur Netz-Schicht, Probe = nur Cap-Schicht, nicht redundant, keiner ersetzt den anderen); (3) **Inert-Seat-Handshake = UDS/FD, NIE TCP/localhost** (§4, sonst ist der Handshake selbst das Egress-Loch).

### Refute Round-4 — Bestätigungs-Lens (Codex/Schnüffi, 0b5ec19) — 5 HIGH + 4 MED gefoldet
Verdikt NOT-BUILD-READY, **Durchbruch: die false-PASS-Klasse kam erstmals NICHT wieder** (R1-R3 dreimal). H2/H3/H4/H6 aus R3 + Layer-Split + UDS-Handshake bestätigt ZU. ALLE gefoldet:
| # | Sev | Befund | Fix |
|---|---|---|---|
| H1 | HIGH | Job-Graph-Widerspruch: Probe `Before=` Gate UND Oracle `systemctl start`et sie | Probe = echtes BOOT-Unit (`RemainAfterExit=yes`, Before Gate); Oracle LIEST nur Result; `zone-seat@ Requires=zone-seat-probe@%i` |
| H2 | HIGH | `systemctl start \|\|true` schluckt Start-Fehler (false-PASS neu) | entfällt mit H1; Result/ExecMainStatus/Boot-Timestamp hart |
| H3 | HIGH | `readlink -f` matcht auch kaputten Symlink/fehlendes Canonical | `readlink -e` + `test -f $CANON` + leer verboten |
| H4 | HIGH | Struktur-Gleichheit beweist probe==seat, nicht Policy-STÄRKE | Drift-Detektor PLUS absoluter Policy-FLOOR (14 harte Soll-Werte am Seat) |
| H5 | HIGH | seatI (interaktiv, sieht PII!) NICHT im Gate-Ordering | seatI voll in beide Gate-Units (After/Before/Requires) + Boot-Ziel |
| M1 | MED | zone-selftest-net nur `After=` nft-seat | `Requires=` nft-seat (alle Seats) |
| M2 | MED | Probe/Seat divergieren bei PrivateTmp | PrivateTmp ins Shared-Include + Drift-Props |
| M3 | MED | Seat-ns nft kein conntrack-F bei Reload | `zone-nft-seat@` ExecStartPost/ExecReload `conntrack -F` in der ns |
| M4 | MED | TCP-TIMEOUT pauschal=blockiert | layer-aware: route-lose Ziele MÜSSEN NOROUTE/UNREACH (verifiziert) |

**Schnüffi-Pre-Build-Flag (oneshot-ActiveState):** Oracle wertet NICHT `ActiveState=active` (oneshot→inactive(dead) nach Erfolg=false-FAIL), sondern Result+ExecMainStatus+Boot-Timestamp; `RemainAfterExit=yes` am Probe für saubere `Requires=`-Semantik. Übernommen.

### Refute Round-5 — Bestätigungs-Lens (Codex/Schnüffi, 1e42084) — 5 HIGH + 4 MED + Vereinfachung
Verdikt NOT-BUILD-READY, gewichtigste Runde: ZWEI echte Sicherheitslöcher + Claim≠Code. ALLE gefoldet:
| # | Sev | Befund | Fix |
|---|---|---|---|
| H1 | 🔴🔴 | **Echtes IPv6-Egress-Loch:** in `table inet` matcht `tcp dport 443` v4+v6, stand VOR `ip6 saddr ::/0 drop` → UID_LLM raus über v6 zu beliebigem :443 | `meta nfproto ipv6 drop` als ALLERERSTE Regel in JEDER Chain (output/input/forward) beider nft. daddr-loser LLM:443-Accept dokumentiert: Ziel-Restriktion = LLM-Broker-RPC-App-Layer (Schnüffi) |
| H2 | 🔴 | Claim≠Code: Floor enthielt NICHT SystemCallFilter/Architectures wie behauptet | `SystemCallArchitectures=native` in FLOOR + **semantische** SystemCallFilter-Prüfung (kritische Denials: setns/unshare/clone3/bpf/@mount/@privileged) |
| H3 | 🔴 | echter Seat-netns nie geprüft (nur Probe) → Override-Bypass | NetworkNamespacePath am ECHTEN `zone-seat@` geprüft (Floor-Oracle) + per-Start im ExecStartPre |
| H4 | 🔴 | Gates sind Boot-Latches (RemainAfterExit) → restart re-evaluiert nicht | **ExecStartPre-Self-Proof** am echten Seat: confined zone-seat-probe.sh + `+`root-netz-oracle, FRISCH pro (Re-)Start |
| H5 | 🔴 | failed conntrack-Reload stoppt laufenden Seat nicht (Reload-Fehler≠inactive) | `OnFailure=zone-seat-stop@%i` + Kanon: Config-Change=restart (nicht reload) |
| M1 | MED | CapBnd-Empty via `od` build-verifizieren | Build-Note |
| M2 | MED | Floor-Kandidaten | +RestrictAddressFamilies=AF_UNIX AF_INET (kein NETLINK/PACKET) +ProtectProc=invisible +RestrictRealtime +ProtectClock |
| M3 | MED | seatI Boot-Enable-Symlinks nicht beweisbar | Build-Note `systemctl is-enabled` + `systemd-analyze verify` |

**🟢 Schnüffi-Vereinfachung (vor-Bau, übernommen):** Der ExecStartPre-Self-Proof macht die separate `zone-seat-probe@`-Fixture + die ganze „probe==seat"-Identitäts-Maschinerie (Shared-Include-Gleichheit + HARDEN_PROPS-Drift) REDUNDANT → gedroppt. Die R4-H5/R5-H3-Befundklasse fällt komplett weg. `seat-hardening-oracle.sh` ist jetzt schlanker STATISCHER Floor-Check am echten Seat. **Weniger Maschinerie = kleinere Angriffsfläche (R12).** `+`-Asymmetrie load-bearing: Probe OHNE `+` (confined=gültiger Self-Proof), Netz-Oracle MIT `+` (root für ip-netns-exec).

### Refute Round-6 — Bestätigungs-Lens (Codex/Schnüffi, 5ee4feb) — 3 HIGH + 2 MED, sehr nah
Verdikt NOT-BUILD-READY, aber **Architektur bestätigt sound** (codex verifizierte systemd-semantisch: `ExecStartPre` ohne `+` erbt volle Confinement → Self-Proof autoritativ; nfproto-ipv6-drop in allen 6 Chains bestätigt). Nur noch Verifikations-Härtung, keine neuen strukturellen Löcher. ALLE gefoldet:
| # | Sev | Befund | Fix |
|---|---|---|---|
| H1 | HIGH | Self-Proof-Verriegelung zu schwach (`grep`) — leeres `ExecStartPre=`-Reset/Reorder unentdeckt; `-`/ignore-failure (Schnüffi) macht Probe wirkungslos | **STRUKTURIERTER `ExecStartPreEx`-Parse** (flags exponiert): genau 2 Cmds, Reihenfolge, Pfad-Suffix, [0]=probe OHNE privileged+OHNE ignore-failure, [1]=netz MIT privileged+OHNE ignore-failure. 4 Fälle lokal verifiziert |
| H2 | HIGH | Floor-Inkonsistenz: `@privileged` in REQUIRED_DENIES aber NICHT in der Config → Floor failt immer | `@privileged` in zone-hardening.conf SystemCallFilter ergänzt (stärker+konsistent; Denylist rein `~`) |
| H3 | HIGH | Reload-Pfad strukturell gefährlich: failed `ExecReload`≠`failed` → OnFailure feuert nicht garantiert | `ExecReload=` für nft KOMPLETT RAUS → `CanReload=no` → Config-Change=restart (struktureller Ausschluss); Build-Gate prüft CanReload=no |
| M2 | MED | zone-selftest-net ohne Broker-Dep → failt nur weil Broker noch nicht oben | Broker `Requires=/After=` (Positiv-Proben brauchen Broker) |
| M3 | MED | Broker↔root-nft-Kopplung nicht prüfbar (Stubs fehlten) | Broker-Unit-Stubs eingebettet (Requires/After/BindsTo zone-root-nft) |

**MED-6 (Schnüffis Revier, sie zieht nach sobald netns-Schicht grün):** der daddr-lose UID_LLM:443-Accept delegiert bewusst an den App-Layer → nur akzeptabel mit LLM-Broker-RPC-Spec (enges RPC, SNI/Cert-Pin, server-gepinntes Modell, per-Seat-authn) + Detektor-Recall-Oracle als echtes Co-Gate.

**Round-7-Lens: ausstehend (gepingt).** Trend FALLEND: R1:7 → R2:9 → R3:10 → R4:9 → R5:8 → R6:6. „Sehr nah" — keine strukturellen Löcher mehr, nur noch Verifikations-Härtung. Default=BLOCK bis grün.
