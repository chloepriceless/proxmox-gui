# T-0244 Pre-Build-Artefakte — INDEX (Verdikt §3, Schraubi-Teil)

**Zweck:** Aus den Refute-REQUIREMENTS (`.planning/T0244-REFUTE-VERDICT.md` §3) konkrete, **seat-perspektivisch-NEGATIV-testbare** Artefakte machen — der neue Gate VOR egress-fähigem Bau (R22, Default=BLOCK).
**Owner:** Schraubi (`vm-deployment-gui`, Infra-LEAD). **Stand:** 2026-06-21. **Status: SPEC** (kein Live-Bau — gated auf Netzi-VLAN + Christin/Hub-Go).

## Blocker → Artefakt-Map (mein Teil)
| Verdikt-ID | Befund | Artefakt | Status |
|---|---|---|---|
| **B1a** | netns/nftables nur behauptet → maschinenlesbares SSOT | `01-netns-enforcement-SSOT.md` (Topologie+nft+UIDs) | SPEC ✅ |
| **B1b** | Oracle maß VM-Ebene+positiv → Seat-Perspektive, NEGATIV | `seat-negative-oracle.sh` v3 (false-PASS-Klassen zu, `bash -n` grün) | SPEC ✅ |
| **B1c** | Seat-Cap-Drop/seccomp/userns (macht netns belastbar) | `01-…` §4 (Shared-Include `/etc/zone/zone-hardening.conf`) + **`seat-hardening-oracle.sh`** (Driver) + **`zone-seat-probe.sh`** (Self-Proof-Fixture, gatet VOR dem echten Seat — Round-3 H1/H6) | SPEC ✅ |
| **B1d** | Boot-Ordering fail-closed | `01-…` §6 (systemd-Graph + selftest-Gate) | SPEC ✅ |
| **H1** | pz2/VM `ip_forward` L3-Bypass | `03-network-residuals.md` §H1 | SPEC ✅ |
| **H2** | IPv6-Residual | `03-…` §H2 + Oracle-Probe | SPEC ✅ |
| **H3** | vzdump hebelt LUKS/Map aus | `04-data-protection.md` §H3 | SPEC ✅ |
| **H6** | Pseudonym-Map-Datenvertrag + ttyd-mTLS | `04-…` §H6 | SPEC ✅ |
| **M1** | NTP-Exfil/Timing | `03-…` §M1 (KVM-PTP, kein Egress) | SPEC ✅ |
| **M2** | Fleet-Vault-Scoping | `04-…` §M2 | SPEC ✅ |
| **L1** | Trunk/untagged-Fallback | `03-…` §L1 (co-owned Netzi) | SPEC ✅ |

## Nicht mein Teil (Owner-Map — Querverweise)
- **Schnüffi:** LLM-Broker-RPC-Spec (B2), Detektor-positive-Allowlist (B3), Anhang-Handling (H4), FQDN/SNI/Cert-Pin (H5 app-layer), Detektor/Parser-Sandbox (M3) → `orchestrator-security/.planning/T-0244-gate-artifacts-spec.md`.
- **Netzi:** UDM-VLAN50-default-deny + networkgroup-Export + L2/Trunk/ARP-Review + Allowlist-Final-Hosts (H5) → `orchestrator-network/.planning/reports/T-0244-zone-vlan-design.md`.
- **Bizzi:** DSFA (revidierter Scope: geteilter Vault + Merkel-für-Nicht-PII = neue Residuen).

## SYNC-PUNKT Schnüffi
Artefakt 01 §1 fixiert die KONKRETE netns-Topologie (Broker-Listen-IPs/Ports `10.99.0.1:8443` LLM, `10.99.0.2:8500` Merkel; UID-Plan 8001-8003; Resolver `127.0.0.1:53` root-only). Schnüffis RPC-Methoden ziehen GEGEN diese Werte. Separate-Broker-VM-Fallback (B1) NUR falls der Cap-Drop-Isolationsbeweis (01 §4 + Oracle) nicht trägt — ihre Specs bleiben identisch.

## Gate-Status
- **Refute-Lens 1 (Claude, fresh context):** ✅ DURCH (2026-06-21). 3×HIGH + 4×MED gefunden + EINGEARBEITET (01 §9 Changelog): Broker-IP-Assignment, `make-shared /run/netns`, Oracle-false-PASS-Fix (refused≠blockiert + UDP/ICMP), `oif br-zone` eingeschränkt, `PartOf`+atomares `flush table`, selftest-`TimeoutStartSec`. **Kern-B1c-Konter HIELT** (Cap-Drop macht netns hart).
- **Refute-Lens 2 (Codex via Schnüffi):** ✅ DURCH (2026-06-21, konvergent). 4 NEUE HIGH (Build-Mechanik) + MEDs gefunden + EINGEARBEITET (01 §9): NEU `seat-hardening-oracle.sh` (B1c-Beweis, #5), `add table`+`flush table` (#1), netns-Idempotenz (#2), Seat-`After=`-Broker (#3), Oracle v3 Platzhalter/Tool-Fehler=FAIL (#4/#9), daddr-Pin (#8), conntrack-Reload (#7), `User=` raus (#6). Beide Lensen konvergieren: Cap-Drop-Konter gilt, ist jetzt auch BEWIESEN statt asserted.
- **Broker-Pivot-Restrisiko (MED-6/#10):** B1-Oracle beweist Seat-Netz-Isolation, NICHT das Egress-Gesamtrisiko (covert Exfil via erlaubtem Anthropic-Kanal). → Schnüffis positive-Allowlist-Detektor-Oracle = **CO-GATE**.
- **🔒 TRIPLE-ORACLE-GATE (Konsens Schraubi↔Schnüffi, 2026-06-21):** Der **Spawner ist erst build-ready, wenn ALLE drei Oracles grün sind** — mein **Seat-Negativ-Oracle** (Netz, B1b) + mein **seat-hardening-oracle** (Cap-Drop, B1c) + Schnüffis **Detektor-Recall-Oracle** (Seed-PII = 100 % Block). Beidseitig verankert.
- **Refute Round-2 (Bestätigungs-Lens, b8149bd):** NOT-YET → 9 Befunde (2 neue Bugs durch die Fixes + B1c-Oracle-Lücken) ALLE gefoldet (01 §9): daddr paarweise, `try_denied` false-PASS-Fix (nur EPERM/SIGSYS=OK), Hardening-Oracle ins Boot-Gate, uid_map alle Ranges, netns-Membership, Probe==Seat-Härtung, idempotentes Tabellen-Idiom, vollständiger Reconcile, conntrack -F kodiert, ping/dns-Exit-Code-Diskriminierung.
- **Refute Round-3 (Bestätigungs-Lens, 0c20a6a):** NOT-BUILD-READY → 6 HIGH + 4 MED + 3 proaktive Verstärkungen, ALLE gefoldet (01 §9): **H1** Boot-Gate-Redesign (beide Gates VOR den egress-fähigen Seats), **H3** 3. false-PASS (`rc>=128`→nur SIGSYS), **H4** IP-only TCP, **H5** Shared-Include als Struktur-Primärgarantie, **H6** `zone-seat-probe.sh` als echtes Fixture, H2 conntrack fail-closed, M1 `destroy table`, M2/M3/M4 + Layer-Split-Doku + UDS-Inert-Handshake.
- **Refute Round-4 (Bestätigungs-Lens, 0b5ec19):** NOT-BUILD-READY, **Durchbruch: false-PASS-Klasse erstmals NICHT zurück** (R1-R3 dreimal). 5 HIGH + 4 MED gefoldet: H1 Job-Graph-Widerspruch (Probe=Boot-Unit, Oracle liest nur), H3 `readlink -e` fail-closed, H4 Policy-FLOOR zusätzlich zur Gleichheit, H5 seatI voll ins Gate, M1-4 + RemainAfterExit-Semantik.
- **Refute Round-5 (Bestätigungs-Lens, 1e42084):** NOT-BUILD-READY (gewichtigste Runde: 2 echte Sicherheitslöcher). 5 HIGH + 4 MED gefoldet: **H1** echtes IPv6-Egress-Loch (`meta nfproto ipv6 drop` als 1. Regel jeder Chain), **H4** ExecStartPre-Self-Proof (per-Start statt boot-latch), **H3** echter Seat-netns geprüft, H2 Floor-Inhalt (Claim≠Code), H5 OnFailure-Stop, M1-3. **🟢 Schnüffi-Vereinfachung:** separate Probe-Fixture + probe==seat-Maschinerie gedroppt (ExecStartPre-Self-Proof macht sie redundant) → weniger Angriffsfläche.
- **Refute Round-6 (Bestätigungs-Lens, 5ee4feb):** NOT-BUILD-READY, **Architektur bestätigt sound** (codex: ExecStartPre erbt Confinement → Self-Proof autoritativ). 3 HIGH + 2 MED, nur noch Verifikations-Härtung: **H1** strukturierter ExecStartPreEx-Parse (Reset/`+`/`-`/Reorder hart, kein grep), **H2** @privileged in Config (Floor-Konsistenz), **H3** ExecReload raus → CanReload=no (struktureller Reload-Ausschluss), M2 Broker-Dep am Net-Gate, M3 Broker-Stubs eingebettet.
- **Refute Round-7 (Bestätigungs-Lens, b5f1fc9):** NOT-BUILD-READY, knapp. 3 HIGH + 1 M (reine Exaktheit): **H1a** exakte Vollpfade (kein /tmp-Stub), **H1b** argv/`--seat`-Instanz-Match (Cross-Instanz-Bypass), **H3** ExecReload auch aus zone-root-nft → CanReload=no, Broker-Stubs (Merkel/Resolver) komplett, M1 Präsenz-Check ehrlich gelabelt.
- **Refute Round-8 (Bestätigungs-Lens, 05be85c):** NOT-BUILD-READY, **codex bestätigte alle 5 Architektur-Achsen sound**. 2 Last-Mile-Blocker gefoldet: **B1** Symlink-Bypass (safe_canonical: readlink -e + root-owned + non-writable), **B2** CanReload=no maschinell asserted (root-nft + jede seat-nft). +3 Non-Blocker (--strict verdrahtet, Kommentare aufgeräumt).
- **🟢 Refute Round-9 (420f7f6): BUILD-READY abgezeichnet** (netns/Prozess-Schicht) nach 9 Cross-Lab-Runden. codex (Build-Ready-Mandat) findet KEINEN build-blockierenden Befund; alle 7 Prüfachsen OK; Schnüffi code-verifizierte die load-bearing `safe_canonical`-Stelle selbst. **Mein B1-Teil (netns-Netz + Cap-Floor + Self-Proof) ist R22-grün.**
- **🟢 Schnüffis GATE 3 ebenfalls BUILD-READY** (orchestrator-security commit e5c3a93, 19 Codex-Refute-Runden): Detektor-Recall-Oracle (Seed-PII 76/76), Broker-RPC-Tightness (23/23, Cert-Pin V2), `zone-selftest-broker.service`. Deploy `/usr/local/lib/zone-broker/`. **BEIDE Schichten BUILD-READY.**
- **3-Gate-Verdrahtung am Spawner FERTIG (§6):** `zone-spawner.service Requires= zone-selftest-{net,hardening,broker}` → kein PII-Dispatch ohne alle 3 Oracles grün. Gemeinsamer **Build-Verify-Plan = `06-build-verify-plan.md`** (Deploy-Pfade + Static-Checks + Boot-Sequenz + Oracle-Akzeptanzkriterien).
- **Verbleibend:** gemeinsamer Live-Build-Verify (beim ersten Bau) + Upstream-Pin-Wert (Christin/Bizzi) am Deploy; egress-Bau gated Netzi-VLAN50 + Christin/Hub-Go + R3-Merkel; Substrat-DDL final mit Tüftli.
- **Befund-Trend (9 Runden):** 7→9→10→9→8→6→3H+1M→2-Blocker→0. false-PASS-Klasse R1-R3 3× zurück, ab R4 gehalten (5×); R5 fing 2 echte Sicherheitslöcher.
- **Egress-fähiger Bau:** BLOCKIERT bis Triple-Oracle grün + Re-Run-Lens + Konsens Schnüffi/Schraubi/Netzi.
- **Foundation-ohne-Egress:** refute-frei, aber infra-gated (Netzi-VLAN + Christin/Hub-Go).
