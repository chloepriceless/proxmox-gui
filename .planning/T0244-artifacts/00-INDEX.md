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
- **Round-4-Bestätigungs-Lens (Schnüffi):** ausstehend (gepingt). Iteration konvergiert (R1:7 → R2:9 → R3 fängt die strukturelle Design-Frage H1).
- **Egress-fähiger Bau:** BLOCKIERT bis Triple-Oracle grün + Re-Run-Lens + Konsens Schnüffi/Schraubi/Netzi.
- **Foundation-ohne-Egress:** refute-frei, aber infra-gated (Netzi-VLAN + Christin/Hub-Go).
