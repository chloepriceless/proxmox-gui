# T-0244 AVV-Zone — DOC-AWARE KOMBI-REFUTE INPUT (self-contained, embedded)

**Zweck:** EIN self-contained Dokument für den **doc-aware R22-Codex-Refute** (Pre-Build-Gate, BUILD-PLAN §7). Es stitcht die DREI Teil-Designs zusammen, deren Inhalt VOLLSTÄNDIG hier eingebettet ist — damit ein adversarialer Reviewer (Codex/Qwen/Claude) das **echte** Design angreift, nicht eine generische Checkliste. Der v1-Standalone-Codex lief BLIND (bwrap konnte die Quell-Docs nicht lesen → generisch). Das hier behebt das.

**Bau-Lead:** Schraubi (`vm-deployment-gui`). **Mit-Designer:** Schnüffi (Gate/Security, `orchestrator-security`), Netzi (Netz, `orchestrator-network`).
**Klasse:** R22 (security-/PII-/architektur-kritisch) + R26 (Deliberate). **Default = BLOCK; Proceed nur bei Konsens.**

---

## 0. Christin-Entscheidungen (BINDEND — weichen bewusst vom Security-Maximal-Design ab)
| Achse | Maximal-Design (Schnüffi) | **Christin-Entscheidung (BINDEND)** |
|---|---|---|
| Host-Boundary | B (separater Host außerhalb Cluster01) | **A′ — KVM-VM auf pz2, in-cluster** |
| Provider | EU-Hyperscaler (Bedrock/Vertex-EU) für reale PII | **Anthropic Team-Plan + AVV, KEIN EU-Hyperscaler** + Datenminimierung an der Quelle |
| Secrets | zonen-eigener Vault | **geteilter Fleet-1Password-Vault** |
| Merkel | GAR KEIN Merkel-Ingest | **🔴 R3 RE-ESKALIERT an Christin (MC OFFEN)** — Security+Codex+Compliance einig: Architektur-Veto; Bizzi-DSFA Art-36-indiziert. Merkel-Broker hier = **KONDITIONAL auf R3=A** (Christin bestätigt Nicht-PII-Ingest). Bei **R3=B** (kein Zone→Merkel / dedizierter authn-TLS-Zone-Store) ändert sich NUR der Merkel-Broker-Teil. |
| Output | pseudonymisiert/aggregiert | **PII-armer Kanal** |
| Interaktiver Seat | offen | **ttyd-Browser-Terminal in der Zone-VM** |

**🔴 Kern-Konsequenz:** Merkel-Such-Endpoint (`192.168.20.81:8000`) liefert **unauthentisiert HTTP 200 OHNE Tenant-Scoping** [VERIFIED Live-Probe] → jeder Ingest ist fleet-weit durchsuchbar. Christin hebt das Merkel-Verbot für Nicht-PII auf ⇒ **das fail-closed Redaction-Gate ist ab jetzt die EINZIGE technische Kontrolle gegen Kunden-PII in einem fleet-weit unauth durchsuchbaren Store.** Ein Fail-open / PII-Miss = sofort fleet-weiter DSGVO-Verstoß (Art. 9/5/32). Das Gate MUSS fail-closed sein + hohen PII-Recall haben. **GO-LIVE (echte Daten) erst nach Bizzi-DSFA + Christin-Sign-off — bis dahin substrat-fertig bauen.**

> **🧊 MERKEL-BROKER EINGEFROREN (Schnüffi 2026-06-21):** R3 (Merkel-für-Nicht-PII) ist als MC an Christin RE-ESKALIERT (Security+Codex+Compliance einig Architektur-Veto, Art-36-indiziert) und NOCH NICHT bestätigt. **Refute-Konsequenz:** Der **Merkel-Broker-Teil (§2.1 Merkel-Pfad, §2.3 Merkel-Allowlist, §2.4 #5) ist KONDITIONAL auf R3=A** und wird bei R3=B isoliert neu-refuted. **R3-UNABHÄNGIG (= Haupt-Refute-Fokus JETZT, ~90% wiederverwendbar egal wie R3 fällt):** LLM-/Anthropic-Broker-Pfad + netns/nftables + ttyd-Härtung + PII-Detektor + Egress-Allowlist + Netz-Isolation (Teil C). Diese Achsen voll angreifen; den Merkel-Broker als bedingt behandeln.

---

## 1. TEIL A — Topologie / Isolation (Schraubi, BUILD-PLAN)

### 1.1 Host/Kapazität
- VM auf **pz2** (4 Cores, RAM avail 8952 MB live, local-lvm 296G frei). 8G ließe <1G Headroom + merkel-Co-Tenant (whisper/e5) spiked → **right-sized: 2c / 4G / 80G** (~4,8G Headroom). Flex-up Richtung GO-LIVE; >~6G Bedarf → Host neu bewerten (repariertes .240 nach T-0247-Fix: 32c/128G).
- **Kapazitäts-Folge für den Detektor:** 2c/4G → KEIN fettes ML-PII-Modell im Broker. Regex/Heuristik-fail-closed-primär; kleines Modell nur wenn RAM reicht.
- **at-rest:** Zone-Disk LUKS/dm-crypt; Bootstrap-Key TPM-sealed/operator-unlock (NICHT key-next-to-lock; Host-Key-in-vzdump beachten).
- **Cluster-Admin-Härtung (DSFA-Auflage):** getrennter Proxmox-API-User/Token NUR für die Zone-VM (kein root@pam-Sharing) + Datacenter-FW-Regel, die mgmt-Plane-Residual minimiert.

### 1.2 Enforcement = 3-fach defense-in-depth (NICHT pz2-Host-nftables — pz2-Host ist GETEILT = falsche Trust-Boundary)
1. **UDM/VLAN-Boundary (Netzi, Teil C):** eigenes Zone-VLAN, VLAN→überall default-DENY; nur Broker-Egress-Pfade; KEINE Route zu Mac :7890/:7899 / Fleet-/24.
2. **In-VM netns-Isolation:** Seats laufen in eigenem network-namespace OHNE Default-Route außer veth zum Broker → erreichen NUR die Broker (kein direkter Außen-Pfad).
3. **In-VM nftables (VM-EIGENE, nicht pz2):** owner/route-match — nur Broker-Prozess-Identitäten haben Egress; Seats→Broker only; default-deny.

### 1.3 Broker-Platzierung + DNS
- 2 Broker = **gehärtete In-VM-systemd-Services** (dedizierte Unix-User, ans Zone-veth gebunden), KEINE separate Mini-VM (Kapazität). Sie sind die EINZIGEN egress-fähigen Prozesse (netns/nftables-erzwungen). Optional: Broker in eigener netns.
- **DNS = zone-lokaler Resolver NUR an den Brokern** (unbound/dnsmasq, nur Allowlist-FQDNs, DoT upstream). **Seats haben KEINEN Resolver** → reden per fixer Adresse mit den Brokern → kein :53-Egress, Hostnamen leaken nicht (schließt DNS-Exfil).

### 1.4 Interaktiver Seat (ttyd)
- ttyd → `tmux new -A -s claude` → `claude` (persistente Browser-Session, detach/reattach). Optional code-server.
- **Auth (Pflicht):** TLS + **mTLS-Client-Cert ODER starkes Token — NICHT nur Source-IP** (LAN-spoofbar). Eigener Zone-OS-User, kein geteiltes `~/.claude`/Home mit Fleet. Erreichbar NUR über kontrollierten Zone-Ingress (source-gepinnt auf Christins Workstation + Auth). Gehärtet (aktuelle Version/CVE, idle-timeout, kein `--allow-origin *`, Session-Audit).

### 1.5 Substrat (Schraubi-Kern)
- **Koordinator + SQLite-Ledger (WAL) mit Epoch-Fencing** für Seat-Rotation (Claim/Lease/Epoch; Tüftlis Continuity baut darauf). Zone-intern, KEIN Fleet-Broker.
- **Zone-Spawner** (4 autonome Seats), NICHT fleet-registriert (kein claude-peers-MCP/Hub-Registry).
- **Zone-Audit-Log:** zonen-lokal, GETRENNT von Fleet-Loki/journald, append-only, at-rest-verschlüsselt, authentisierte Identität.
- **Pseudonym-Map (Token→Klarname) = hochkritische PII** (bleibt personenbezogen, KEINE Art-32-Anonymisierung): eigenes streng-isoliertes Secret-System, eigene ACLs, Envelope-Encryption, KEINE Logs, eigene Backup-Policy (NICHT mit den Daten/dem Ledger zusammen gebackupt), Zugriff nur über service-bound Workflow, Löschpfad. Lebt NUR in der Zone.

---

## 2. TEIL B — Redaction-Gate / Zwei-Broker (Schnüffi)

### 2.1 Zwei zone-interne Egress-Broker (technisch erzwungen, KEIN TLS-MITM)
```
[Seats/ttyd] --(zone-net only)--> [LLM-Broker]   --PII-Gate(fail-closed)--> api.anthropic.com
             \--(zone-net only)--> [Merkel-Broker]--PII-Gate(fail-closed)--> 192.168.20.81:8000
nftables default-deny: Seats erreichen NUR die 2 Broker; NUR Broker erreichen außen.
```
- **LLM-Broker:** hält Team-Creds (Seats kennen sie nie), terminiert app-layer (KEIN TLS-MITM/CA nötig), fail-closed PII-Gate auf Prompt, forwardet zu Anthropic. Setzt Telemetrie-Disable-Env + No-Training-Account-Settings als Vorbedingung durch.
- **Merkel-Broker [🧊 KONDITIONAL auf R3=A]:** fail-closed PII-Block, forwardet nur PII-freies zu `.81:8000` (Merkel ist Plaintext-HTTP → app-layer voll inspizierbar). *(Bei R3=B entfällt dieser Pfad bzw. wird durch dedizierten authn/TLS-Zone-Store ersetzt — dann isoliert neu zu refuten.)*

### 2.2 Zwei-Schichten-PII-Kontrolle
- **Schicht A (Quelle):** Pull-Ingest-Gateway pro In-Scope-System ersetzt direkt-identifizierende PII (Name/Adresse/Mail/Steuernr/Lizenzschlüssel/Konto) durch stabile **Tokens**, BEVOR Daten den Seat/Prompt erreichen. Agent arbeitet auf Tokens; Rück-Expansion NUR zone-intern beim finalen Output (z.B. Mail-Reply via zonen-eigenem SMTP).
- **Schicht B (Egress, fail-closed, belt-and-suspenders):** Merkel-Pfad = ZERO-Toleranz (jeder PII-Treffer ODER Detektor-Unsicherheit → BLOCK 403 + Audit). Anthropic-Pfad = verifiziert, dass keine Roh-PII durchrutscht (Treffer → block/redact); pseudonymisierte Tokens erlaubt.
- **PII-Detektor (Hybrid R32):** deterministisch zuerst — Regex/Format (E-Mail, IBAN, Steuer-IdNr/USt-IdNr, Telefon, Lizenzschlüssel-Format, PLZ+Adresse), Listen-Match bekannter Kundennamen aus in-zone Lizenz-DB. NER nur für unstrukturierten Freitext. **Fail-closed-Invariante: im Zweifel BLOCK (Merkel)/redact (Anthropic), nie durchlassen.** Kalibrierung gegen Stichprobe mit bekanntem Soll (Recall-Oracle) VOR Go.

### 2.3 Egress-Allowlist (FINAL, FQDN/SNI — kein CIDR)
- **Anthropic (LLM-Broker):** `api.anthropic.com` (Kern). Web-Auth falls nötig: `claude.ai`, `console.anthropic.com`, `platform.claude.com` (lösen alle in `160.79.104.0/23`). Installer/Update-Hosts (`downloads.claude.ai`, `storage.googleapis.com`, `raw.githubusercontent.com`, `*.claudeusercontent.com`) **vermeiden** via gepinnte selbst-verwaltete Binary → entfallen.
- **HART AUS (NICHT in Allowlist):** `statsig.anthropic.com`, `*.sentry.io`, Release-Notes → via `DISABLE_TELEMETRY=1`, `DISABLE_ERROR_REPORTING=1`, `DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` [VERIFIED code.claude.com/docs].
- **In-Scope-Quellen (Ingest, read-only):** polar.sh-API, Zone-Mailserver (IMAP/SMTP), Lizenzverwaltung, DVhub-Prod-Read-Replica. Je Quelle exakter FQDN, kein Wildcard. *(Konkrete Hosts noch Christin-Input — Allowlist final erst dann.)*
- **Merkel:** `192.168.20.81:8000` NUR + NUR Gate-freigegebener Nicht-PII-Content.
- **Infra:** Zone-DNS-Resolver (nur Allowlist-FQDNs) + NTP (1 gepinnter Server). Alles andere DROP.

### 2.4 8 Härtungs-Requirements (aus v1-Codex, verbindlich)
1. **Fail-closed HART — Failure-Mode→DENY-Tabelle (Broker-intern):** Detector-Exception, Timeout, OOM, Parser-Fehler, Unsupported/opaque MIME, Oversize, Backpressure/Queue-Saturation, Dependency-Ausfall → ALLE BLOCK. Im Code erzwungen + getestet (kill -9, latency-injection, detector-panic, malformed payload, queue-saturation).
2. **Opaque/unsupported Content → DENY, nie forwarden (KERN-LÜCKE):** Mail/Rechnungen haben Anhänge (PDF/Bild/Base64), die der Text-Detektor nicht sieht. Merkel: jeder nicht-positiv-PII-frei-bestätigte/opake Content → BLOCK. Anthropic: Anhänge extrahieren/OCR/scannen ODER blocken; nur minimierte freigegebene Formen.
3. **Broker-SSRF-Härtung:** KEINE user-kontrollierten Upstream-URLs (fixe Upstreams api.anthropic.com/.81 only). ICMP blocken. In-Scope-Dienste dürfen keine generische Proxy-/Fetch-/Webhook-Funktion bieten (sonst Tunnel).
4. **LLM-Broker Cred-/Capability-Boundary:** Team-Cred minimal-scoped (KEINE Admin/Account-Mgmt), per-Seat-Rate-Limits, Prompt-Schema-Validierung, Response-Filtering, Quota-Circuit-Breaker. Kompromittierter Seat ≠ offener Anthropic-Proxy.
5. **🔴 MERKEL-DISSENT (Schärfstes akzeptiertes Residual):** geteilter, unauth, fleet-weit durchsuchbarer Plaintext-Vektorstore ist auch für "Nicht-PII" riskant (Embeddings tragen sensible Rückschlüsse). Christin hat Merkel-für-Nicht-PII ENTSCHIEDEN (Controller-Call, nicht überstimmt). Mitigation: fail-closed Merkel-Broker + opaque→block + konservativ. Bessere Alt. falls Christin umentscheidet: dedizierter authn/TLS-Zone-Store.
6. **Pseudonym-Map = hochkritische PII** (s. §1.5 — eigenes Secret-System, Envelope-Enc, keine Logs, getrenntes Backup).
7. **ttyd = inhärenter Exfil-Kanal:** Copy/Paste/Screenshot/Download/Session-Hijack = Rückkanal trotz dichtem Netz. Härtung: mTLS + ggf. MFA, short-lived Sessions, Clipboard/Download wo möglich aus, strict CSP, gehärteter Reverse-Proxy, Session-Audit, aktuelle ttyd-Version. Inhärentes Residual: der autorisierte Mensch (Christin) SIEHT PII per Design — Zweck, auditiert.
8. **"Zwei Broker" beweist nicht "einziger Egress":** vollständige Egress-Inventarisierung + aktiver Test. Übersehene Pfade: Update-/Package-Mirror, NTP, PBS/Backup-Plane, Monitoring, Mail, Resolver, Ingress-Callbacks (ttyd), Admin-Plane. Verifikation: maschinenlesbare Netzpolicy als SSOT + **aktiver Egress-Test aus kompromittierter Seat-Perspektive** (packet-capture, deny-by-default-Beweis) VOR Go.

### 2.5 Akzeptierte Residuen (→ Bizzi-DSFA Art. 35)
1. Geteiltes Mgmt-Plane (A′ in-cluster pz2): Cluster-Admin = Pfad in die PII-Zone → Mitigation Cluster-Admin-Härtung.
2. Team-für-PII (kein ZDR auf Team-Web, kein EU-Residenz): stützt auf Commercial-Terms-No-Training-Default + Quell-Minimierung + Redaction-Gate. ZDR-Lücke im Homelab technisch nicht schließbar.
3. Geteilter Fleet-Vault: Fleet-Vault-Compromise erreicht Zone-Secrets → least-privilege je Cred + Team-Cred nur im LLM-Broker.
4. Merkel-für-Nicht-PII (s. Härtung #5).

---

## 3. TEIL C — Netz / VLAN / default-DENY-Egress (Netzi)

### 3.1 Gemessene UDM-Topologie (read-only 2026-06-21)
- Bestehende Netze: Default(20, **untagged**, 192.168.20.0/24) · Mgmt(vlan3,.10) · DMZ(vlan4,.41) · ipv6(vlan5,.6) · VPN_Mullvad(vlan6,.30) · No-Internet(vlan8,.99) · SmartMeterGW(vlan20,.168) · DEV(vlan42,.42) · Installationsmaterial(vlan2). **Belegte Tags: 2,3,4,5,6,8,20,42. Belegte Subnetze 192.168.x: 6,10,16,20,30,41,42,99,168.**
- **🔑 Kritischer Isolations-Befund:** ALLE corporate-Netze tragen `networkgroup:"LAN"` → in `UBIOS4LAN_subnets`, routen untereinander über `UBIOS_LAN_LAN_USER`-Chain mit **terminal ACCEPT**. **Läge die AVV-Zone in der LAN-networkgroup, erreichte sie automatisch das gesamte Fleet (inkl. Mac, .81).** → Die Zone MUSS einer **anderen, isolierten Zone/networkgroup** zugewiesen werden. Das ist der zentrale Isolations-Hebel, nicht nur einzelne Block-Regeln.

### 3.2 Entscheidungen
| Achse | Wahl | Begründung |
|---|---|---|
| VLAN-Tag | **50** | frei, special-purpose |
| Subnetz | **192.168.50.0/29** (.1 GW, .2 VM, 6 nutzbar) | Zone = 1 VM → min Adressraum = min Blast-Radius; /28 falls Ingress-Proxy+Spare |
| Zonen-Zuweisung | **eigene isolierte Zone** (NICHT LAN-networkgroup) | sauberste explizite Isolation; DMZ-Reuse vermischt Trust-Boundaries |
| DHCP | **AUS** (statische VM-IP .2) | kontrolliertes Interface |
| IPv6 | **AUS** | kein zweiter Egress-Pfad/RA-Leak |
| Gateway | **UDM .50.1** | NUR wenn UDM L3-GW ist, kann sie Egress filtern; pz2 darf NICHT routen |

### 3.3 default-DENY-Egress-Firewall (explizit, Priorität = Reihenfolge)
```
# AVV-Zone 192.168.50.0/29 als SRC:
1. DROP   AVV-Zone → 192.168.0.0/16          # ALLE internen 192.168-Netze (Mac, Fleet-/24, .81, alle VLANs)
2. DROP   AVV-Zone → 10.0.0.0/8              # VPN/RFC1918
3. DROP   AVV-Zone → 172.16.0.0/12           # RFC1918-Vollständigkeit
4. DROP   AVV-Zone → 192.168.20.x :7890,:7899 # Mac-Hub explizit (redundant zu #1, auditierbar)
5. ALLOW  AVV-Zone → WAN (Internet)          # grob für Broker→Anthropic (in-VM auf FQDN beschränkt)
6. (Default der Zone = DROP)
# AVV-Zone NICHT in UBIOS4LAN_subnets → kein LAN_LAN-ACCEPT.
# Ingress: default-DENY von außen IN die Zone (nur späteres source-gepinntes Pinhole für ttyd).
SPÄTER (über #1 eingefügt, nach Schnüffi-Gate): ALLOW AVV-Zone → 192.168.20.81:8000 (+DoT/NTP).
```
- **Warum #5 WAN-allow trotz default-deny:** UDM kann Anthropic nicht per FQDN/SNI von beliebigem Internet trennen (kein L7). Der in-VM-Broker ist der FQDN-Enforcer. UDM = grob "intern dicht, Internet offen"; die feine Anthropic-only-Beschränkung macht der Broker. Bewusste Arbeitsteilung, kein Loch.

### 3.4 L2/Trunk (mit Schraubi geklärt)
- pz2 = 192.168.20.42, Uplink **bond0** (LAG 2 Member), vmbr0 = plain-Bridge (`vlan_filtering 0`), GW UDM .20.1, 10 LXCs untagged auf flacher /24.
- **Nicht-disruptiver Attach (Schraubi):** `bond0.50` (VLAN-Sub-IF) + dedizierte Bridge `vmbrZONE`, Zone-VM dort dran — rührt vmbr0/die 10 Live-LXCs NICHT an. Zone-VM bekommt UDM-Zone-VLAN-IF als EINZIGES Gateway → pz2 bridged nur, routet nicht → UDM enforced default-deny.
- **Switch-Trunk:** beide bond0-Member-Switch-Ports müssen VLAN50 trunken. Recon: pz2-LAG-Ports fahren vermutlich Default-"All"-Trunk → VLAN50 erschiene automatisch beim Netz-Anlegen (am Build read-only verifizieren; sonst explizit hinzufügen).

### 3.5 Verifikations-Oracle (nach Provisionierung, R31 — gemessen, nicht behauptet)
Aus der Zone-VM (.50.2): `→ :7890/:7899` MUSS DROP/timeout · `→ .81:8000 direkt (ohne Broker)` MUSS DROP · `→ 192.168.20.0/24 + andere VLANs` MUSS DROP · `→ api.anthropic.com:443` erreichbar · von außen `→ .50.2` MUSS DROP (außer Pinhole). Methode: `nc -vz`/`curl --max-time` + tcpdump auf der UDM; Negativ-Beweis (timeout/RST), nicht nur "kein Output".

---

## 4. REFUTE-AUFTRAG (an den adversarialen Reviewer)

**Default = BLOCK. Du sollst dieses kombinierte Design WIDERLEGEN, nicht bestätigen.** Finde die schwerwiegendsten Gründe, warum dieses Design NICHT build-ready ist — bevor irgendetwas auf Live-Infra (pz2 + UDM) provisioniert wird. Bestätige NICHT reflexhaft.

**Scope-Hinweis (R3-Freeze):** Der **Merkel-Broker-Pfad ist konditional auf R3=A** (Christin-MC offen, s. §0-Callout) — bewerte ihn als bedingt, lege deinen Hauptfokus auf die **R3-unabhängigen Achsen** (LLM-/Anthropic-Pfad, netns/nftables, ttyd, Detektor, Allowlist, Netz-Isolation). Diese müssen unabhängig von R3 build-ready sein.

**Refute-Fokus (mindestens diese Achsen, gern darüber hinaus):**
1. **Fail-open-Pfade im PII-Gate** — wo kann PII trotz fail-closed-Anspruch durchrutschen (Schicht A Pseudonymisierung umgangen, Schicht B Detektor-Miss, opaque Content, Encoding/Obfuskation, Detektor-Recall-Lücke, Timing/Race)?
2. **Egress-Bypass** — kann ein kompromittierter Seat trotz 3-fach-Enforcement (UDM-VLAN + netns + nftables) nach außen (DNS, ICMP, IPv6-Residual, NTP, Broker-SSRF, ttyd-Rückkanal, Ingest-Gateway-Missbrauch, Mgmt-Plane, ein übersehener Pfad)?
3. **Netz-Isolation** — bricht die "isolierte Zone ≠ LAN-networkgroup"-Annahme irgendwo (Zonen-Mechanik der UDBIOS4-FW, Inter-VLAN-Leak, pz2-bridged-aber-routet-doch, Trunk-Fehlkonfiguration, Asymmetrie Ingress/Egress)?
4. **Broker-Härtung** — Cred-Exposure, offener-Proxy-Missbrauch, Rate-Limit-Umgehung, Quota-Erschöpfung, Parser-Angriffsfläche.
5. **Trust-Boundary-Fehler** — A′ in-cluster auf geteiltem pz2 (Mgmt-Plane), geteilter Vault, geteiltes Merkel, Pseudonym-Map-Schutz.
6. **ttyd-Auth/Exfil** — mTLS-Schwäche, Source-IP-Annahmen, Session-Hijack, Browser-Rückkanal.
7. **Übersehene Annahmen** — was setzt das Design implizit voraus, das in der Realität nicht hält (DNS-Drift Cloudflare/CDN, Backup/vzdump-Key-Leak, onboot/Backup-Reboot-Resilienz, Detektor-Kalibrierung)?

**Output-Format:** Pro Befund: Severity (BLOCKER/HIGH/MEDIUM/LOW), betroffene(r) Teil (A/B/C), präzise Schwachstelle, konkrete Härtung. Nenne die SCHWERWIEGENDSTE Schwachstelle zuerst ODER begründe explizit, warum kein BLOCKER existiert. Unterscheide "muss vor Foundation-Bau gefixt" vs. "muss vor egress-fähigem Bau gefixt" vs. "muss vor GO-LIVE (echte Daten) gefixt".
