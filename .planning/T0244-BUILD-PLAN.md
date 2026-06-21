# T-0244 — AVV-Zone BUILD-PLAN (GO-BUILD, revidierter Scope)

**Bau-Lead:** Infra-LEAD (`vm-deployment-gui`). **Stand:** 2026-06-21, GO-BUILD (Christin via f73n74ge). **Design-before-build** (Deliberate Mode, security-kritisch).
**Coordination:** Schnüffi (`9ux20vst`, Egress/Redaction/mTLS-Auth/Härtung) · Bizzi (DSFA) · Codex-Refute aufs Gate-Design VOR Bau (R22).
**Vorgänger-Design:** `.planning/T0244-ISOLATION-DESIGN.md` @ commit `d45e0da` (rev.3). Dieser Plan setzt den **revidierten, leichteren Scope** um.

## 0. Revidierter Scope (Christin-Entscheide, gegenüber dem Design geändert)
- **HOST = A′:** KVM-VM auf **pz2** (kein neuer Host/HW). Cluster-Admin-Härtung (getrennte Proxmox-API-User/Token + Datacenter-FW) = DSFA-Auflage.
- **PROVIDER:** Claude **Team-Plan + AVV**, KEIN EU-Hyperscaler. Christin minimiert an der Quelle (keine Mailinhalte/sensible Klartext-PII).
- **SECRETS:** **GLEICHER Fleet-1Password-Vault** (kein separater Zone-Store — REVIDIERT ggü. Design §4; Christin hat keine Kunden-Zugangsdaten).
- **MERKEL:** Zone DARF das geteilte Merkel (.81) nutzen — **NUR Nicht-PII** → HARTE Regel: keine Kunden-PII nach Merkel (Redaction-Gate am Egress, Schnüffi). (REVIDIERT ggü. Design „kein Merkel-Ingest".)
- **BEHALTEN aus Design:** eigenes VLAN/Context · at-rest-LUKS auf Zone-Disks · KEIN Fleet-Loki/journald · getrennter Zone-Audit-Log · Egress = default-DROP + FQDN/SNI-Allowlist · Output = PII-armer Kanal.
- **GO-LIVE (echte Daten) erst nach Bizzi-DSFA + Christin-Sign-off** → bis dahin **substrat-fertig** bauen.

## 1. Host / Kapazität (Stufenmeldung)
- **🔴 4c/8G passt NICHT sicher auf pz2** (verifiziert live): pz2 = 4 Cores, RAM avail 8952 MB → 8G ließe <1G Headroom; merkel-Co-Tenant spiked (whisper/e5). Disk ok (local-lvm 296G frei).
- **→ Right-sized: VM 2c / 4G / 80G** (sicher: ~4,8G Headroom; reicht vor GO-LIVE, Seats API-I/O-bound). **Flex-up Richtung GO-LIVE**; braucht der echte Bedarf >~6G → Host neu bewerten (repariertes .240: 32c/128G nach 2-DIMM-Fix, T-0247).
- **at-rest:** Zone-Disk LUKS-verschlüsselt; Bootstrap-Key TPM-sealed/operator-unlock (NICHT key-next-to-lock; Host-Key-in-vzdump beachten — Design §4).
- **Cluster-Admin-Härtung (DSFA-Auflage):** getrennter Proxmox-API-User/Token NUR für die Zone-VM (kein root@pam-Sharing) + Datacenter-FW-Regel, die den mgmt-Plane-Residual minimiert.

## 2. Netz-/Egress-Topologie (beantwortet Schnüffis 3 Fragen)
**Zone = im leichten A′-Scope EINE VM** → die „Zone-Grenze" ist VM-Interface + VLAN-Boundary, NICHT pz2-Host-nftables (pz2-Host ist GETEILT = falsche Trust-Boundary, dort KEINE Zone-FW-Logik).
- **(Q1) Enforcement-Punkte = 3-fach, defense-in-depth:**
  1. **UDM/VLAN-Boundary (Netzi):** eigenes Zone-VLAN, VLAN→überall default-DENY; nur die Broker-Egress-Pfade (Anthropic-FQDNs, .81) erlaubt; KEINE Route zu Mac :7890/:7899 / Fleet-/24.
  2. **In-VM netns-Isolation:** Seats laufen in einem **eigenen network-namespace** OHNE Default-Route außer einem veth zum Broker. Sie können NUR die Broker erreichen (kein direkter Außen-Pfad).
  3. **In-VM nftables (die VM EIGENE, nicht pz2):** owner/route-match — nur die Broker-Prozesse haben Egress; Seats→Broker only; default-deny.
- **(Q2) Wo laufen die 2 Broker:** als **gehärtete In-VM-Services** (eigene systemd-Units, dedizierte Unix-User, gebunden an das Zone-interne veth/Bridge) — KEINE separate Mini-VM (Kapazität 2c/4G). Sie sind die EINZIGEN egress-fähigen Prozesse (netns/nftables-erzwungen). Stärkere Isolation (Broker in eigener netns) optional als Härtung.
- **(Q3) DNS:** **zone-lokaler Resolver NUR an den Brokern** (unbound/dnsmasq, NUR Allowlist-FQDNs auflösend, **DoT upstream** — Design §3). Die **Seats haben KEINEN Resolver** (reden mit Brokern per fixer Adresse) → kein :53-Egress, Hostnamen leaken nicht.

## 3. Zwei-Broker-Gate (Schnüffis Modell — endorsed)
- **LLM-Broker:** hält die Team-Creds (aus Fleet-1Password gezogen), nimmt Seat-Prompts, **fail-closed PII-Gate** (Redaction/Block), forwardet app-layer zu `api.anthropic.com`. Seats trusten KEIN MITM-CA (Broker terminiert die Verbindung). **Kein TLS-MITM nötig.**
- **Merkel-Broker:** nimmt Ingest-Calls, **fail-closed PII-Block**, forwardet NUR PII-freies zu `192.168.20.81:8000` (Merkel ist Plaintext-HTTP → app-layer inspizierbar).
- **Erzwungen:** nftables/netns → Seats erreichen NUR die 2 Broker; NUR Broker erreichen außen. Kein Seat spricht direkt nach außen. = Christins „technisch erzwungen, nicht Bibliothek".
- **Egress-Allowlist (FQDN/SNI, kein CIDR — Schnüffi liefert):** `api.anthropic.com` + Auth (`console.anthropic.com`) + In-Scope-Quellen + `192.168.20.81` (Merkel) + DoT-Resolver + NTP. KEINE Telemetrie (M10).

## 4. Substrat (mein Kern, Design §4/§6)
- **Koordinator-Dienst + SQLite-Ledger (WAL)** mit **Epoch-Fencing** für Seat-Rotation (Tüftlis Continuity baut darauf; Claim/Lease/Epoch — Design §6). Zone-intern, kein Fleet-Broker.
- **Zone-Spawner** (verwaltet die 4 autonomen Seats), NICHT fleet-registriert (kein claude-peers-MCP/Broker/Hub-Registry).
- **Audit-Log:** zonen-lokal, GETRENNT von Fleet-Loki/journald (Design §8 Art. 30). FW-/Egress-/Broker-/Ingress-Logs.
- **1Password:** GLEICHER Fleet-Vault (revidiert) — nur fürs Team-Credential; Zugriff scoped.
- **KEINE eigene Vektor-Instanz** (revidiert: Merkel-Broker liefert Nicht-PII-Vektorsuche).

## 5. Interaktiver Seat (Addendum — ttyd-Browser-tmux, T-0197-Technik)
- **ttyd → `tmux new -A -s claude` → `claude`** läuft drin; detach/reattach aus dem Browser = persistente Claude-Session.
- **Security (Pflicht, Design §7 rev.3):** TLS/HTTPS + **starke Auth = mTLS-Client-Cert ODER Token (NICHT nur Source-IP** — LAN-spoofbar). Web-Terminal-Dienst gehärtet (eigene Angriffsfläche: aktuelle Version, minimale Exposition). Erreichbar NUR über den **kontrollierten Zone-Ingress** (source-gepinnt auf Christins Workstation + Auth). Schnüffi härtet die Auth.
- Optional **code-server** statt ttyd, falls Christin volle IDE will (Default = ttyd). Knüpft an geparktes **T-0197** (ttyd-Browser-Grid).

## 6. Build-Sequenz (substrat-fertig; GO-LIVE-gated)
1. **pz2-Kapazität** ✅ (geprüft) → VM 2c/4G/80G anlegen (Debian 13, cpu host, LUKS-Root).
2. **VLAN** mit Netzi (eigenes Zone-VLAN, default-DENY-Egress-Regelwerk).
3. **In-VM-Isolation:** netns für Seats + nftables (Seats→Broker→egress).
4. **2 Broker** (LLM + Merkel) als gehärtete Services + zone-Resolver (DoT) — Schnüffi liefert Gate-Logik/Allowlist.
5. **Substrat:** Koordinator + SQLite-Ledger (Epoch-Fencing) + Zone-Spawner + Audit-Log.
6. **Interaktiver Seat:** ttyd+tmux+claude, mTLS, zone-ingress.
7. **Cluster-Admin-Härtung:** scoped Proxmox-API-Token + Datacenter-FW.
8. **Verifikations-Oracle (Design §3):** aus der Zone → Mac :7890/:7899, Merkel direkt (.81 ohne Broker), Fleet-/24 = MÜSSEN gedroppt sein; Anthropic nur über Broker; PII-Test-String → Gate blockt fail-closed.
9. **STOP vor GO-LIVE** → Bizzi-DSFA + Christin-Sign-off.

## 7. Offene Punkte / Coordination
- **Schnüffi:** Gate-Logik (fail-closed PII-Detektion — Regeln + Kalibrierung, R31), Egress-Allowlist (FQDN/SNI), mTLS-Auth-Härtung, Codex-Refute aufs Gate VOR Bau.
- **Bizzi:** DSFA mit dem revidierten Scope (geteilter Vault + Merkel-für-Nicht-PII = neue Residuen); In-Scope-Egress-Quellen-Enumeration.
- **Netzi:** Zone-VLAN + default-DENY-Egress + Zone-Ingress-Pinhole (Christins Workstation→ttyd).
- **Tüftli:** Continuity-Logik auf dem Epoch-Fencing-Substrat.
- **Codex (R22):** Refute aufs Gate-/Isolations-Design vor dem ersten egress-fähigen Bau.
