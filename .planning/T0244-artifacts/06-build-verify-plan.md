# T-0244 Artefakt 06 — Gemeinsamer Build-Verify-Plan (Triple-Oracle-Gate)

**Owner:** Schraubi (netns/Prozess, GATE 1+2) + Schnüffi (Egress/Detektor, GATE 3). **Stand:** 2026-06-21, beide Schichten BUILD-READY (R22-grün).
**Zweck:** Die operative Checkliste, mit der die gebaute Zone-VM verifiziert wird, BEVOR der Spawner echte PII-Arbeit dispatcht. KEIN Deploy hier — Ausführung erst nach Netzi-VLAN50 + Christin/Hub-Go (+ R3-Merkel für den Merkel-Pfad).

## 0. Was dieser Plan abdeckt (und was NICHT)
- **Abgedeckt:** Build-Zeit-Static-Checks + Boot-Gate-Sequenz + die 3 Oracle-Akzeptanzkriterien + per-Start-Revalidierung. = der R22-Nachweis der Isolations-Foundation.
- **NICHT abgedeckt (separat gated):** der Upstream-Pin-Wert (V1: Anthropic vs EU-Hyperscaler, Christin/Bizzi), die Live-VLAN-Provisionierung (Netzi), die DSFA-Freigabe (Bizzi), R3-Merkel. Spec/Code bleiben identisch, nur der Pin-Wert wird am Deploy gesetzt.

## 1. Deploy-Pfade (SSOT)
| Artefakt | Pfad | Owner |
|---|---|---|
| `seat-negative-oracle.sh`, `seat-hardening-oracle.sh`, `zone-seat-probe.sh` | `/usr/local/sbin/` (root:root, 0755, **nicht group/world-writable** — von safe_canonical erzwungen) | Schraubi |
| `pii-detector.py`, `detector-recall-oracle.sh`, `broker-rpc-validator.py`, `broker-rpc-tightness-oracle.sh` | `/usr/local/lib/zone-broker/` | Schnüffi (commit e5c3a93) |
| `seed-pii-corpus.jsonl` | `/usr/local/lib/zone-broker/` (read-only, root) | Schnüffi |
| nft-Rulesets (`zone-root.nft`, `zone-seat.nft`), `zone-hardening.conf` | `/etc/zone/` | Schraubi |
| systemd-Units (zone-*) | `/etc/systemd/system/` | gemeinsam |

## 2. Build-Zeit Static-Checks (VOR dem ersten Boot der Zone-VM)
Alle müssen grün sein, sonst kein Boot-Versuch:
1. **systemd-Korrektheit:** `systemd-analyze verify zone-seat@seat0.service zone-seat-probe@... ` ⚠️ (Fixture entfällt) → `systemd-analyze verify zone-{netns-setup,root-nft,broker-llm,broker-merkel,resolver,nft-seat@seat0,seat@seat0,selftest-net,selftest-hardening,selftest-broker,spawner,coordinator}.service` → 0 Fehler.
2. **CanReload=no (R8-B2):** `systemctl show -p CanReload zone-root-nft zone-nft-seat@{seat0..seatI}` → **alle `no`** (kein Policy-Lockerungs-Reload-Pfad). *(Auch maschinell im seat-hardening-oracle asserted.)*
3. **Self-Proof-Script-Integrität (R8-B1):** `/usr/local/sbin/{zone-seat-probe.sh,seat-negative-oracle.sh}` = root-owned, `0755` (kein g/o-write), KEIN Symlink woanders hin (`readlink -e`==self). *(Auch im hardening-oracle-Preflight via safe_canonical.)*
4. **nft-Syntax:** `nft -c -f /etc/zone/zone-root.nft` + `nft -c -f /etc/zone/zone-seat.nft` → 0 Fehler; insb. `meta nfproto ipv6 drop` als 1. Regel JEDER Chain (R5-H1).
5. **nft-Idempotenz (R3-M1):** `zone-seat.nft` 2× `nft -f` nacheinander → beide exit 0 + identisches Ruleset (`destroy table`-Idiom gegen die GEPINNTE nft-Version).
6. **Boot-Enable (R5-M3):** `systemctl is-enabled` für ALLE zone-Units inkl. `*@seatI` → `enabled` (Backup-Reboot-Resilienz).
7. **Broker↔root-nft-Kopplung (R7-M3):** `systemctl show -p Requires,After zone-broker-{llm,merkel} zone-resolver` enthält je `zone-root-nft.service`.

## 3. Boot-Gate-Sequenz (was beim Boot in welcher Reihenfolge bewiesen wird)
```
zone-netns-setup → zone-root-nft → Broker(llm/merkel/resolver) ─┐
                 → zone-nft-seat@%i ──────────────────────────────┤
   GATE 1  zone-selftest-net      → seat-negative-oracle --all-seats --strict   (Netz B1b)
   GATE 2  zone-selftest-hardening→ seat-hardening-oracle.sh                      (Cap B1c)
   GATE 3  zone-selftest-broker   → detector-recall-oracle + broker-rpc-tightness (Detektor/RPC)
                 → zone-seat@%i (ExecStartPre: probe-self-proof + netz-revalidate, dann INERT)
                 → zone-coordinator (SQLite-Epoch-Fencing-Ledger, §05)
                 → zone-spawner  (Requires= alle 3 Gates → dispatcht NUR wenn alle grün)
```
Failt EIN Gate → die Unit ist `failed` → `zone-spawner` (Requires) startet NICHT → kein PII-Dispatch.

## 4. Oracle-Akzeptanzkriterien (R31 — Zahlen VOR dem Lauf fixiert)
| Gate | Oracle | PASS-Kriterium (exakt) |
|---|---|---|
| 1 | `seat-negative-oracle.sh --all-seats --strict` | je Seat: ALLE NEG-Proben geblockt (route-los→NOROUTE/UNREACH, on-link-Falschport→TIMEOUT) + BEIDE Broker-POS CONNECTED; KEIN refused/INVALID/TOOLERR/inconclusiv. exit 0 |
| 2 | `seat-hardening-oracle.sh` | je Seat: Policy-Floor (18 Soll-Werte) + SystemCallFilter-Denials präsent + RestrictAddressFamilies ohne NETLINK/PACKET + NetworkNamespacePath==/run/netns/%i + ExecStartPreEx exakt 2 Cmds (probe confined, netz +root --seat %i --strict, keine ignore-failure) + CanReload=no; Preflight safe_canonical + zone-root-nft CanReload=no. exit 0 |
| 3 | `detector-recall-oracle.sh` | Seed-PII-Korpus **76/76** (70 BLOCK korrekt + 6 PASS korrekt), positive-Allowlist fail-closed. exit 0 |
| 3 | `broker-rpc-tightness-oracle.sh` | **23/23** (enges RPC + Cert-Pin V2 + Capability-Boundary). exit 0 |
| — | per-Start (jeder Seat-(Re)Start) | `ExecStartPre=zone-seat-probe.sh` (confined self-proof) + `ExecStartPre=+seat-negative-oracle --seat %i --strict` grün → sonst Seat startet nicht |

## 5. Verifikations-Lauf (die EINE Akzeptanz: alle 3 grün → Spawner up)
```bash
# in der gebauten Zone-VM, nach Boot, als root:
systemctl is-active zone-selftest-net zone-selftest-hardening zone-selftest-broker   # alle 'active' (exited)
systemctl is-active zone-spawner                                                      # 'active' NUR wenn alle 3 Gates grün
journalctl -u zone-selftest-net -u zone-selftest-hardening -u zone-selftest-broker --no-pager | grep -E 'PASS|NO-GO'
```
**Oracle (R31):** `zone-spawner` ist `active` ⟺ alle 3 Gate-Units `active`/Result=success. Ist ein Gate `failed` → Spawner `inactive` (Requires nicht erfüllt) → **kein PII-Processing**. Das ist der maschinelle Gesamt-Riegel.

## 6. Negativ-Tests am gebauten System (Defense-in-depth-Beweis)
- Eine Gate-Unit künstlich auf `failed` setzen (z.B. zone-selftest-net stoppen) → `zone-spawner` darf NICHT starten (Requires).
- Ein Seat-Override mit `ExecStartPre=` (leer/Reset) → hardening-oracle ExecStartPreEx-Check muss FAIL liefern.
- Ein Symlink `/usr/local/sbin/zone-seat-probe.sh → /tmp/stub` → safe_canonical FAIL.
- Aus einem Seat-netns: `api.anthropic.com`/`.81`/LAN direkt → NOROUTE (negative-oracle reproduziert das im Gate).

## 7. Status (R31)
PLAN. Ausführbar erst nach Netzi-VLAN50 + Christin/Hub-Go (Live-Bau). Beide Isolations-Schichten sind BUILD-READY (R22-grün: meine 9 Runden + Schnüffis 19 Runden). **Nächster gemeinsamer Schritt mit Schnüffi:** diesen Plan beim ersten Live-Bau abarbeiten; Upstream-Pin-Wert (Christin/Bizzi) am Deploy setzen.
