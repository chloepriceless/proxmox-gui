# T-0244 — Kundendaten-Isolations-Architektur (Infra-LEAD-Teil)

**Autor:** Proxmox-GUI Head / Infra-LEAD („Schraubi", Hub-Key `vm-deployment-gui`)
**Stand:** 2026-06-21 (rev.2: §9 right-sized 4c/8G, §2 A′-Option + .240-Defekt-Gate, §8 ZDR-Faktenkorrektur + per-Subjekt-Löschung + Art.28/32(1)(b)/5(1)(c), §3 DNS/NTP-Vorbedingung, §7 Polar-Webhook-Ingress · rev.3 Schnüffi-R22-Refute: §3 SNI/FQDN-Egress+DoT statt IP-nach-DNS + konkrete Oracle-Ziele, §4 PBS-Client-Encryption + Bootstrap-Key-Provisioning, §7 mTLS-Auth + GUI-Mac-DSFA-Restrisiko). **Status:** Design-only, KEIN Bau (gated).
**Co-Owner:** Schnüffi = Security/Synthesizer (`733y8dgt`) · Bizzi = Compliance/GDPR (`43sds8sq`) · Tüftli = Continuity-Logik (`6enyhavb`) · Netzi = Netz/VLAN (`o7a9xw7h`).
**Auftrag (Christin via Orchestrator):** EINE hart isolierte Umgebung NUR für Kundendaten, vollständig getrennt vom Peer-Netz/Rest der Flotte. 5 Claude-**Teams**-Seats (AVV/DPA, **nicht** Pro/Consumer): 4 autonome Kundendaten-Agents + 1 operator-gesteuerter Agent. Verarbeiten ausschließlich Kunden-PII (Lizenzverwaltung, Shop/polar.sh, Kunden-Mail, Rechnungen, DVhub-Prod-Kundendaten).

> **Dieses Dokument** liefert den **technischen Host-/Infra-/Substrat-Teil**. Die Security-Synthese (Schnüffi) konsolidiert daraus die EINE Christin-MC (A vs B); die GDPR-Map (Bizzi) hängt an den Traceability-Ankern unten; Tüftli baut die Continuity-Logik auf dem Substrat in §6.

---

## 0. KERNREGEL (nicht verhandelbar)
**KEIN Cross-Talk der Zone zum Fleet-Broker `:7899` (bun, 0.0.0.0 auf der Mac) / Hub `:7890` (node, 0.0.0.0 auf der Mac).** Die Zone darf diese Ports **nicht einmal routen können**. Kein claude-peers-MCP, keine Fleet-Registry, kein Merkel-Ingest, kein Spawner-Anschluss an die Fleet. Die Isolation ist **die** Anforderung — alles andere ordnet sich unter.

---

## 1. Entscheidung: VM, NICHT LXC (entschieden mit Schnüffi)
**Wahl: KVM-VM.** Begründung:
- LXC auf Proxmox teilt den **Host-Kernel**. Für PII ist ein Shared-Kernel-Container eine unvertretbare Blast-Radius: ein Kernel-Escape (oder bei privilegiertem LXC ein Container-Escape) landet **direkt auf dem Host**, der den Rest der Flotte mitträgt → PII-Exfiltration über die Host-Ebene.
- Eine VM hat hardware-virtualisierte Isolation (eigener Kernel, eigener Speicher, KVM-Boundary). Deutlich stärkere Trennung gegen Mit-Mieter auf demselben Blech.
- Mehrkosten (VM- vs LXC-Overhead) sind gegenüber dem PII-Risiko vernachlässigbar (R12: keine Aufwands-Disproportion).
- **Konsistent mit der Fleet-Lesson** aus dem Inventar-SSOT: 6 privilegierte LXC sind bereits als erhöhte Host-Escape-Fläche markiert; PII gehört nicht in dieselbe Klasse.

---

## 2. Entscheidung: Host-Boundary — A vs B = **Christin-MC** (Schnüffi trägt sie in die Synthese)
Die VM-Wahl steht; **wo** die VM lebt, ist die eine echte Christin-Entscheidung (HW-Spend vs. Isolationsstärke — irreversibel/teuer/Präferenz nach DRIVE-TO-GOAL).

### Variante A — In-Cluster-VM auf `proxmox`/.240 (sofort baubar)
- **Kapazität verifiziert (Inventar-SSOT, read-only):** `proxmox`/.240 = 128 GB / 32 Cores, **80.945 MB avail RAM**, `local-lvm` lvmthin **228,8 GB frei**, `Samsung_1TB` zfspool 2.828 GB frei. → right-sized PII-VM (§9: **4c / 8 GB / 80 GB**, da Seats API-I/O-bound) passt mit großem Abstand; .240 hätte sogar Reserve für eine großzügigere Auslegung.
- **Netz:** eigenes VLAN (Netzi) statt vmbr0-untagged-/24 + default-deny-FW (§3).
- **🔴 Residual-Risiko (dokumentpflichtig für Bizzis DSFA):** Die VM liegt **innerhalb Cluster01** → geteilte **Management-Plane**: corosync, `/etc/pve` (pmxcfs cluster-weit synchronisiert), `root@pam`. Ein **Cluster01-Admin-Compromise** ODER ein kompromittierter anderer Node (→ cluster-weites pmxcfs) ist ein **realer Residual-Pfad** zur PII-VM: `qm`-Zugriff, Konsole, Disk-Snapshot-Exfil, Live-Migration. Die Netz-Isolation schützt **nicht** gegen die Hypervisor-/Cluster-Admin-Ebene.
- **Fazit A:** stärkste *Netz-/Workload*-Isolation sofort verfügbar, aber **geteilte Vertrauensbasis auf Hypervisor-Ebene** bleibt.

### Variante B — Separater Host AUSSERHALB Cluster01 (härteste Trennung)
- **Eigene Management-Plane** → kein geteiltes pmxcfs/corosync/root@pam. Der Residual-Pfad aus A entfällt vollständig.
- **🔴 Christin-Procurement-Gate:** kein sauberer in-Cluster-Pfad zu einem dedizierten Host ohne neue HW oder Disruption — pz1/pz2/pz3 sind 16-GB-Nodes (4,4 / 8,9 / 6,6 GB frei, zu klein), `.240`/`pve` tragen kritische Guests. → braucht **~32 GB Mini-PC/NUC** ODER **disruptives Node-Repurpose + Migration** der dortigen Guests.
- **Fazit B:** maximale Isolation (auch gegen die Hypervisor-Admin-Ebene), Preis = HW-Beschaffung/Disruption.

### 🔴 NEU (2026-06-21): .240 ist defekt-blockiert (T-0247) → A nicht mehr „sofort"
Node `.240` **crasht reproduzierbar hart** im 02:00-Backup-Fenster (3× in Folge, T-0247, ich übernehme die HW-RCA). Ein Headroom-Node, der reproduzierbar resettet, ist **kein PII-Host**. → **Variante A geht von „sofort baubar" auf „gesperrt bis T-0247-RCA durch + Fix verifiziert + Stabilitäts-Burn-in".** Das öffnet einen dritten Pfad:

### Variante A′ — right-sized VM auf einem ANDEREN In-Cluster-Node (Stopgap, ohne Procurement)
- Da die Last API-I/O-bound ist (§9: ~4c/8 GB), trägt sie auch **pz2** (8.936 MB avail) oder **pz3** (6.595 MB avail) right-sized — eng, konkurriert mit dem Infra-Ring (merkel/forgejo-runner/checkmk bzw. semaphore/forgejo/ansible).
- **ABER: identische Mgmt-Plane-Residual wie A** (alle in Cluster01) + **kein Isolationsgewinn** ggü. A. = „A auf anderem Host". Nur sinnvoll als Stopgap, falls die .240-RCA zieht UND Christin B nicht beschaffen will.
- **Kein In-Cluster-Pfad entfernt die Residual** — pve/pz1/pz2/pz3 teilen ALLE corosync/pmxcfs/root@pam. **Nur B** (außerhalb Cluster01) bricht die Mgmt-Plane-Compromise-Kette.

### Empfehlung (Infra-LEAD) — drei Optionen mit Gates
- **Security-Default = B** (einziger Pfad ohne Mgmt-Plane-Residual; vollständige Trennung der Vertrauensbasis ist bei Kunden-PII der saubere Weg). Christin-Procurement-Gate.
- **A (.240)** = beste Kapazität, aber **defekt-blockiert** bis T-0247-RCA + Burn-in.
- **A′ (pz2/pz3, right-sized)** = ohne Procurement sofort möglich, ABER Mgmt-Plane-Residual + enge Kapazität, kein Isolationsgewinn → degradierter Stopgap.
- **→ Schnüffi konsolidiert A / A′ / B als die eine Christin-MC** (HW-Spend vs. Isolationsstärke = Christins Entscheidung). Ich feuere selbst KEINE Christin-MC (Synthese-Owner = Schnüffi).

---

## 3. Netz-Design (zwingend für BEIDE Varianten) — Netzi provisioniert
- **Eigenes VLAN / dediziertes L2-Segment.** Kein Bridging auf die Fleet-`192.168.20.0/24` und auf KEINE der bestehenden VLANs (3/4/6/42…). Eigener Tag, eigenes Subnetz.
- **Default-deny INGRESS + EGRESS** an der Zone-Grenze.
- **Egress-Allowlist (Zweckbindung Art. 5 auf Netz-Ebene):**
  - Anthropic-API: **minimaler Pfad = `api.anthropic.com` + Auth (`console.anthropic.com` bei OAuth/Seat)** — **das ist der einzige „Internet"-Pfad**. **KEINE Telemetrie-/Error-Reporting-Endpoints** auf der Allowlist: M10 schaltet Telemetrie/Error-Reporting per ENV ab (`DISABLE_TELEMETRY`/`DISABLE_ERROR_REPORTING`, Schnüffi) → wird gar nicht gesendet, also auch nicht erlaubt = weniger Angriffsfläche (Bizzi-Hinweis, mit Schnüffi abgestimmt).
- **🔴 Durchsetzungs-Mechanismus = SNI/FQDN, NICHT IP-nach-DNS (Schnüffi-R22-Refute §3):** Eine `DNS-resolve→IP-nftables-Allowlist` ist **fragil** — Anthropic-Endpunkte liegen in geteilten Cloudflare/CDN-Ranges, die „without notice" rotieren → die IP-Allowlist driftet (bricht ODER eine **co-tenant-CDN-IP wird erreichbar**). **Robust = egress-Filterung auf TLS-ClientHello-SNI / FQDN** (z.B. egress-Proxy mit SNI-Inspektion), nicht IP-Pinning. + **DNS-Query-Privacy: DoT zum gepinnten Resolver, nicht plaintext `:53`** — die abgefragten Hostnamen würden sonst die PII-Quellen verraten.
  - die **konkret benannten Kundendaten-Quellen**, die die Seats erreichen MÜSSEN (Shop/polar.sh-API, Kunden-Mailserver, Lizenz-/Rechnungssystem, DVhub-Prod-Kundendaten-Endpoint). **Enumeration mit Bizzi je Zweck** — nichts „auf Vorrat".
  - **sonst NICHTS.**
- **2 minimale Infra-Vorbedingungen (Bizzi-Hinweis, je gepinnt, NICHT offen):** (i) **gepinnter DNS-Resolver** — die hostbasierte Allowlist (`api.anthropic.com` etc.) braucht Auflösung, aber **kein offenes `:53`** nach außen: ein definierter Resolver (zonen-lokal oder ein gepinnter Upstream), nur die Allowlist-Hosts auflösend. (ii) **gepinnter NTP** — TLS-Cert-Validität braucht korrekte Zeit; ein definierter NTP-Peer, nicht offenes NTP. Beide stehen in Bizzis Enumeration (`orchestrator-bizzi/.planning/t0244-egress-allowlist-enumeration.md`).
- **Kein Pfad zur Mac** `:7890`/`:7899` (kein Inter-VLAN-Routing zum Mac-Segment). Das ist die Netz-Durchsetzung der Kernregel §0.
- **Ingress: GENAU EINE kontrollierte Ausnahme** — der Erreichbarkeitspfad des interaktiven Seats (§7), auditiert. Sonst default-deny.
- **Verifikations-Oracle (vor GO) — konkrete Fleet-Ziele enumerieren (Schnüffi-R22):** aus der Zone heraus `curl`/`nc` auf JEDES dieser Ziele → **muss timeouten/gedroppt** sein: Broker `192.168.20.x:7899`, Hub `:7890`, **Merkel `192.168.20.81:8000`/`:6333`/`:8080`**, **Loki `.153`**, **Coder-VM (.42/VLAN42)**, beliebiger Fleet-/24-Host. Positiv: `api.anthropic.com:443` → erreichbar (über SNI-Filter); eine nicht-allowlisted externe FQDN/IP → gedroppt. Egal welche Variante.

---

## 4. Substrat — eigener Spawner, KEIN Fleet-Anschluss (mein Kern-Teil)
- **Eigener Spawner-Daemon ON dem isolierten Host/der VM**, der die 4 autonomen Seats verwaltet (Start/Stop/Respawn) **vollständig zonen-intern**. Analog zur Fleet-`spawnerd`, aber **luftdicht von der Fleet getrennt**: kein claude-peers-MCP, keine Hub-Registry, kein Broker-Socket, kein `peer/notify`. Die Zone taucht in keinem Fleet-Dashboard auf.
- **Separater Credential-Store** für das/die Teams-API-Credential(s). **NICHT** das Fleet-1Password/op-connect (LXC 141 lebt auf der Fleet). Zonen-lokaler Secret-Store (verschlüsselte Datei / `age` / zonen-lokaler Vault), damit das Teams-Credential **nie die Fleet transitiert**.
  - **🔴 Bootstrap-Key-Provisioning explizit spezifizieren (Schnüffi-R22-Refute §4):** Beim unattended-Reboot-Autostart muss der Store entschlüsselt werden — **wo liegt der Entschlüsselungs-Key?** Liegt er **plaintext neben dem Store**, ist `age` wertlos und nur LUKS schützt real (= „key-next-to-lock", der NetBoard-Diff-2-Fall). → Bootstrap-Key via **TPM-sealed** (an den VM-/Host-Zustand gebunden) ODER **operator-unlock beim Boot** ODER **`systemd-creds`** — und dann **Host-Key-in-`vzdump` beachten** (der Backup-Pfad darf den Entsiegelungs-Key nicht mitsichern). Default-Empfehlung: TPM-sealed + LUKS-Root, operator-unlock nur wenn 24/7-unattended nicht zwingend.
- **Getrennte Datasets/Backups:** zonen-lokaler Storage; Backup auf **separates Ziel** (NICHT der geteilte Fleet-PBS) **ODER** separater PBS-Namespace/-Datastore. **🔴 Nur mit CLIENT-seitiger Verschlüsselung + zone-gehaltenem Key (Schnüffi-R22-Refute §4):** ein separater PBS-Namespace isoliert PII NUR, wenn der **Client zonen-seitig verschlüsselt** und der **PBS-Server ausschließlich Ciphertext** speichert (der Key bleibt in der Zone). Sonst leakt die **Fleet-PBS-Trust-Boundary** in die Zone — ein PBS-Admin-/Server-Compromise liest namespace-übergreifend = dasselbe geteilte-Vertrauensbasis-Thema wie A/A′ vs. B, nur auf der **Backup-Ebene**. → hält das Art-17-Löschkonzept sauber + verhindert PII-Sickern in Fleet-Backups. **Entscheidungspunkt:** dediziertes Backup-Ziel vs. separierter PBS-Namespace **mit zone-gehaltenem Client-Encryption-Key** (Default = letzteres, wenn PBS-Kapazität reicht).
- **KEIN PII-Ingest ins Fleet-Merkel** (LXC 146). Brauchen die Seats Vektorsuche → **isolierte eigene Instanz auf isoliertem Storage** in der Zone.

---

## 5. Reboot-/Backup-Resilienz + frugaler Idle (Infra-Härtung)
- **Alle Zone-Service-Units `enabled`** (`WantedBy=multi-user.target` + `systemctl enable`): Spawner, Koord-Dienst, Seat-Runner, ggf. lokale Vektor-Instanz. Sonst kommt die Zone nach einem stop-mode-Backup-Reboot nicht von selbst hoch (Fleet-Lesson POLICY-BACKUP-REBOOT-RESILIENT).
- **Stabile IP** in der Zone (keine DHCP-Lease, die über einen Reboot wandert — Fleet-Lesson aus merkel/.81 & protectbridge/.82).
- **Frugaler Idle:** die Seats dürfen im Leerlauf **nicht** das 5h-Rolling-Limit verbrennen (kein nutzloses Loop-Polling gegen die Anthropic-API). Idle = günstig schlafen, durch den Koord-Dienst (§6) geweckt, nicht durch Busy-Wait.
- **Variante A zusätzlich:** onboot=true setzen (im Gegensatz zu den Cold-Standby-Findings 151/147); die PII-VM muss bewusst nach Wartungs-Reboot zurückkommen.

---

## 6. Seat-Rotation-State — Epoch-Fencing (Substrat für Tüftlis Continuity)
**Problem:** 5 Seats teilen sich einen Teams-Plan mit begrenzter Parallelität / 5h-Rolling-Limit. Ein erschöpfter Seat muss an einen frischen übergeben; der **zurückkehrende erschöpfte Seat darf NICHT mit veraltetem Stand weiterschreiben** (Split-Brain / Doppelverarbeitung von Kundendatensätzen).

**Mein Substrat-Teil (WO/WIE):**
- **Persistenter, transaktionssicherer State-Store ON dem isolierten Host:** zonen-internes **SQLite-Ledger** (WAL) + **authoritativer Koordinations-Dienst** (= das T-0214-Fix-Muster). Single-Writer-Koordinator vor dem Ledger; die Seats reden NUR mit dem Koord-Dienst, nie direkt mit der DB-Datei nebenläufig.
- **Claim/Lease-Modell mit Epoch:** jedes Work-Item (Kundendatensatz/Aufgabe) wird unter einem **Lease mit monotoner Epoch** (Generations-Zähler) geclaimt. Erschöpft ein Seat und wird ersetzt, **bumpt der Koordinator die Epoch** und re-leased. Wacht der erschöpfte Seat später mit **alter Epoch** auf → seine Schreibversuche werden **gefenced** (Epoch-Mismatch → reject). Kein Doppel-Write, keine verlorene Übergabe.
- **Reboot-fest:** Ledger + Epoch überleben Reboot (durable auf zonen-lokalem Storage, kein in-memory-only State). Nach Reboot rekonstruiert der Koord-Dienst die offenen Leases + die höchste Epoch aus dem Ledger.
- **Erreichbarkeit OHNE Fleet-Broker:** der Koord-Dienst ist **zonen-intern** (kein :7899/:7890). Die Seats erreichen ihn über localhost/Zone-intern, nicht über die Fleet.

**Tüftli baut darauf:** die Continuity-Logik (genaue Claim/Lease/Fencing-Semantik, Übergabe-Protokoll, Retry/Backoff). Ich liefere das Substrat (Store-Ort, Transaktionssicherheit, Reboot-/Backup-Resilienz, frugaler Idle). **Schnittstelle an Tüftli:** Koord-Dienst-API (claim/renew/release/heartbeat) + Epoch-Contract — Detail-Abstimmung mit ihm.

---

## 7. Erreichbarkeit des interaktiven Seats — OHNE Fleet-Broker
Der 1 operator-gesteuerte Seat muss von Christin erreichbar sein, **ohne** über Hub/Broker zu gehen (das bräche die Isolation).
- **GENAU EINE kontrollierte Ingress-Ausnahme** zur default-deny-Grenze: ein **zonen-lokales Web-Terminal / SSH-Jump**, erreichbar nur von **Christins Workstation-IP** (FW-Pinhole Source-pinned), **TLS**, **vollständig auditiert** (Art. 30/32).
- **🔴 Starke AUTH, NICHT nur Source-IP-Pin (Schnüffi-R22-Refute §7):** Source-IP allein ist **LAN-spoofbar** (kein L2-Anti-Spoofing per se) → **Client-Cert / SSH-Key Pflicht** (mTLS), nicht nur IP. Der **Web-Terminal-/Jump-Dienst selbst wird gehärtet** (eigene Angriffsfläche: aktuelle Version, minimale Exposition, kein zusätzlicher Pfad).
- **🔴 Restrisiko in die DSFA (Schnüffi-R22-Refute §7):** Der Source-Pin koppelt den EINEN Zone-Ingress an den **24/7-ENTSPERRTEN GUI-Mac** (`HOST-MAC-NO-SCREENLOCK`) = exponiertester Fleet-Host → **„kompromittierter GUI-Mac = PII-Ingress-Pfad"** ist ein dokumentpflichtiges Restrisiko (Art. 35 DSFA, mit Bizzi/Schnüffi). Mitigation: mTLS (s.o.) macht reinen Mac-Zugriff ohne Client-Key wertlos.
- **NICHT** über das Fleet-Hub-Dashboard, **NICHT** über den Broker. Eine eigene, minimale, authentifizierte Tür.
- Jede interaktive Session wird im Zone-Audit-Log (§ GDPR Art. 30) protokolliert.
- **Polar-Webhooks (falls genutzt) = INGRESS, nicht Egress (Bizzi):** kommen sie zum Einsatz, sind sie ein zweiter kontrollierter Ingress-Pfad (Source-gepinnt auf Polars Webhook-IPs, signaturgeprüft, auditiert) — NICHT über die Egress-Allowlist abgedeckt. Mit Völtchen klären, ob Polar-Webhooks überhaupt gebraucht werden; wenn ja, eigenen §7-Pinhole spezifizieren.

---

## 8. GDPR-Traceability — je Design-Entscheidung gemappt (Bizzi-Anker)
| GDPR | Anforderung | Technische Durchsetzung in diesem Design |
|------|-------------|-------------------------------------------|
| **Art. 5 (Zweckbindung)** | Daten nur für benannte Zwecke | Egress-Allowlist (§3) erlaubt NUR die zweckgebundenen Quellen; Seats können physisch nichts anderes erreichen. Zone verarbeitet ausschließlich die 5 benannten PII-Kategorien. |
| **Art. 32 (Zugriffskontrolle / Need-to-know / Risikoreduktion)** | Stand der Technik, Zugriff minimiert | VM-HW-Isolation (§1) + eigenes VLAN + default-deny (§3) + separater Credential-Store (§4) + kein Fleet-Broker (§0). **Residual (Variante A):** geteilte Mgmt-Plane — dokumentiert (§2). |
| **Art. 17 + 5(1e) (Löschkonzept / Speicherbegrenzung)** | Löschbarkeit (per Subjekt UND Zone), inkl. Anthropic-seitig | **(a) Zone-/Dataset-Ebene:** getrennte Datasets/Backups (§4) → PII als Einheit löschbar (Zone-Teardown / Dataset-Wipe), ohne geteilten Fleet-Storage. **(b) Per-Subjekt-Löschpfad (eigener Punkt, ≠ Whole-Dataset-Wipe — Bizzi):** Art. 17 verlangt Löschung EINES Betroffenen auf Anfrage über alle Systeme, OHNE alles zu wipen → Daten-/App-Ebene-Löschpfad nötig (= Schnüffis Per-System-Retention-Design). **(c) Anthropic-Seite [🔴 Bizzi-Faktenkorrektur, VERIFIED]:** Claude **TEAM bietet KEIN ZDR** (Zero-Data-Retention nur API/Enterprise via Anthropic-Sales). End-zu-Ende-Löschung stützt sich daher NICHT auf ZDR-auf-Team, sondern auf **Backend-Purge ≤30 T nach Löschung + Input-Minimierung (Christin-Default E1-A)** ODER **sensibelste Teilmenge auf API/Enterprise mit ZDR (E1-B)** = Christins offene Entscheidung **E1**. |
| **Art. 30 + 5(2) (Auditierbarkeit / Rechenschaft)** | Nachweisbarkeit | Zonen-lokales Audit-Log: SQLite-Ledger (§6) + Koord-Dienst-Log + FW-/Egress-Logs + interaktiver Ingress-Log (§7). **Getrennt** von Fleet-Logs. Jeder Kundendaten-Zugriff nachvollziehbar. |
| **Art. 33/34 (Datenpannen)** | Erkennung + Meldung | **Eigener Breach-Pfad für die Zone** (separat vom Fleet-Incident-Flow, da luftdicht): Detektion über Egress-Anomalien / FW-deny-Spikes / Auth-Fehler im Koord-Dienst; definierte Melde-Kette. **Owner-Klärung mit Bizzi:** wer überwacht die Zone, wie wird eine Panne erkannt/eskaliert. |
| **Art. 32(1)(b) (Verfügbarkeit + Integrität)** | belastbare, verfügbare Verarbeitung | **🔴 T-0247-Bezug (Bizzi):** ein Host, der reproduzierbar hart resettet (.240 im 02:00-Backup-Fenster), ist ein Verfügbarkeits-/Integritäts-Restrisiko bei PII-Verarbeitung → Variante A erst nach T-0247-RCA-Fix + Burn-in; verschiebt das Pendel Richtung B. Wird als DSFA-Restrisiko geführt. |
| **Art. 28 (AVV / Auftragsverarbeitung)** | Rechtsgrundlage | Infra SETZT VORAUS, dass der AVV existiert: Anthropic-DPA (auto via Team) + polar.sh eigener AV-Strang (Bizzi/Völtchen). Kein Bau ohne diese Rechtsgrundlage. |
| **Art. 5(1)(c) (Datenminimierung)** | nur notwendige Daten | Ingest-Gateway / Input-Minimierung (Schnüffi): den Seats wird nur das zweckmäßige Minimum an PII zugeführt; verzahnt mit E1-A (Input-Minimierung als ZDR-Ersatz auf Team). |

---

## 9. Konkreter baubarer Spec (right-sized; Variante A/.240 ODER A′/pz2/pz3 ODER B/separates Blech)
**Right-Sizing (ehrlicher Bedarf, ersetzt die früheren großzügigen 24G):** Die Last = 5 Claude-Teams-Seats (4 autonom + 1 interaktiv) + Koordinator + SQLite-Ledger + ggf. kleine Vektor-Instanz. Claude-Code-Seats sind **API-I/O-bound** (Calls an Anthropic), lokal CPU-leicht. → **Baseline 4 vCPU · 8192 MB · 80 GB**; flex auf **12 GB**, falls Seats + lokale Vektor-Instanz mehr brauchen. Passt damit auf **.240** (riesig Reserve), **pz2** (8.936 MB avail, eng) oder **pz3** (6.595 MB avail, eng) — nicht nur auf .240.
- **VM-Stack:** `cpu host` · Debian 13 Trixie (Fleet-Baseline) · `local-lvm`.
- **Netz:** dediziertes VLAN (Netzi-Tag) statt vmbr0-untagged-/24; statische IP.
- **In der VM (systemd, alle `enabled`):** Zone-Spawner-Daemon · Koord-Dienst + SQLite-Ledger (WAL) · zonen-lokaler Credential-Store · 4 autonome Seat-Runner (Seat-Pool) · 1 interaktiver Seat hinter dem kontrollierten Ingress (§7) · optional isolierte Vektor-Instanz.
- **FW:** default-deny in+out; Egress-Allowlist = Anthropic-API + enumerierte Kundendaten-Quellen; Ingress = ein auditierter interaktiver Pfad; KEIN Route zu Mac `:7890`/`:7899`.
- **Backup:** separates Ziel / separater PBS-Namespace mit **client-seitiger Verschlüsselung + zone-gehaltenem Key** (§4). **Bootstrap-Key** TPM-sealed/operator-unlock (§4), nicht key-next-to-lock.
- **Egress-Enforcement:** SNI/FQDN-Filter (egress-Proxy) + DoT-Resolver (§3), nicht IP-nach-DNS.
- **Ingress:** ein mTLS-Web-Terminal/Jump (Client-Cert), source-gepinnt, gehärtet, auditiert (§7).

---

## 10. Offene Entscheidungen / Blocker (NICHT autonom)
1. **🔴 Host-Boundary A / A′ / B** — Christin-MC, **Schnüffi trägt sie in die Synthese** (Security-Default B; A=defekt-blockiert bis T-0247-RCA+Burn-in; A′=ohne Procurement aber Mgmt-Plane-Residual+eng). Bis dahin **kein Bau**.
2. **Anthropic AVV / ZDR / Enterprise + Datenresidenz** — Bizzi+Christin klären den Vertrags-/Retention-Stand mit Anthropic (Art. 17/5(1e)-Ende-zu-Ende). Downstream, blockt das Design nicht.
3. **Egress-Allowlist-Enumeration** — exakte Endpoints der Kundendaten-Quellen, Zweck-gemappt mit Bizzi. Konkretisierung vor Bau.
4. **Backup-Variante** — dediziertes Ziel vs. separater PBS-Namespace (Infra-Detail, entscheide ich beim Bau nach PBS-Kapazität; Default = separater Namespace + eigener Key).
5. **Koord-Dienst-API-Contract** — Detail-Abstimmung mit Tüftli (claim/renew/release/heartbeat + Epoch-Semantik).

---

## 11. Handoff
- **Schnüffi (`733y8dgt`):** Security-Synthese — A-vs-B als EINE Christin-MC konsolidieren; Residual-Risiko Variante A (geteilte Mgmt-Plane) in die Bewertung; §1/§3/§4/§7 security-reviewen (R22-Refute willkommen).
- **Bizzi (`43sds8sq`):** GDPR-Map gegen §8 verifizieren; Anker Art. 5/32/17+5(1e)/30/33-34; Egress-Endpoint-Enumeration (Zweckbindung); Anthropic-AVV/ZDR-Klärung anstoßen.
- **Tüftli (`6enyhavb`):** Continuity-Logik auf dem Substrat §6 (Claim/Lease/Epoch-Fencing); Koord-Dienst-API-Contract mit mir abstimmen.
- **Netzi (`o7a9xw7h`):** VLAN-Provisionierung + default-deny-FW-Regelwerk (§3), wenn die Boundary entschieden ist.
- **Hub:** Doc-Stand melden; Tätigkeitsbericht.
