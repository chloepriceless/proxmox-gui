# T-0244 AVV-Zone — DOC-AWARE KOMBI-REFUTE: VERDIKT (Pre-Build-Gate §7)

**Stand:** 2026-06-21 · **Bau-Lead:** Schraubi (`vm-deployment-gui`) · **Gate-Owner Security:** Schnüffi · **Netz:** Netzi
**Refute-Input:** `.planning/T0244-REFUTE-INPUT.md` @ `e9b3333` (self-contained, eingebetteter Inhalt — behebt den bwrap-blind-v1).

## Gate-Prozess (perspective-diverse, R22, Default=BLOCK)
| Lens | Lab | Status | Verdikt |
|---|---|---|---|
| Claude (fresh-context Subagent) | Anthropic | ✅ durch | NOT-BUILD-READY (Egress) |
| codex-worker (Schnüffi) | OpenAI GPT-5.5 | ✅ durch (`orchestrator-security/reviews/2026-06-21-T0244-combi-refute-codex-lens.md` @ a438c15) | NOT-BUILD-READY (Egress) |
| Qwen (Gateway klick:best/long-context) | Alibaba | ✗ klick-Backend down (`llm_failed`, kein Fallback griff) | — (entfällt; zwei konvergente Lensen genügen) |

**→ KONSENS-VERDIKT: NOT-BUILD-READY für egress-fähigen Bau.** Beide unabhängigen Lensen konvergieren auf denselben Kern-Blocker → hohe Konfidenz, die Befunde sind real (nicht Lab-Artefakt). **Foundation (VM/LUKS/netns-Substrat OHNE Egress, Koordinator/Ledger) ist von BEIDEN Lensen freigegeben** — bleibt aber Infra-gated auf Netzi-VLAN + Christin/Hub-Go (separat vom Refute).

---

## 1. KONVERGENTE BLOCKER (beide Lensen unabhängig — stärkstes Signal)

### B1 🔴 KERN — „Nur-Broker"-Enforcement ist BEHAUPTET, nicht bewiesen/getestet (R3-unabhängig)
- **GPT-codex:** Die „nur-Broker"-Sicherheit des Anthropic/Seat-Pfads hängt komplett an der In-VM-netns/nftables-Policy, die nur ASSERTED ist, nicht als maschinenlesbares testbares Build-Artefakt. §3.5-Oracle misst auf **VM-Ebene (.50.2)** + testet **POSITIV**, dass `api.anthropic.com:443` erreichbar ist — ein Seat darf Anthropic aber genau NICHT direkt erreichen, nur den LLM-Broker. → Oracle beweist die eigentliche Invariante nicht.
- **Claude:** „3-fach-Enforcement kollabiert auf ~1,5" — Seats + Broker teilen EINEN Kernel in EINER VM; netns ist keine harte Grenze gegen einen kompromittierten Seat mit CAP_NET_ADMIN/CAP_SYS_ADMIN/Privesc (nsenter in Broker-ns / als Broker-UID laufen → owner-match erfüllt). Nur die UDM (separates Gerät) ist eine echte Trust-Boundary. Plus Boot/Reboot-Race: Seat startet evtl. VOR nftables/netns → fail-open-Fenster.
- **Reconcile (Schraubi):** Die In-VM-Broker-Wahl (kapazitätsgetrieben 2c/4G) ist tragfähig NUR wenn die Enforcement als **konkretes, seat-perspektivisch-NEGATIV-getestetes Artefakt** vorliegt UND der Seat-Container hart entschärft ist (Drop CAP_NET_ADMIN/CAP_SYS_ADMIN, `no-new-privs`, seccomp, user-namespace-Map ≠ Broker-UID, kein Privesc-Pfad). Schafft das die Isolation nachweislich nicht → **Fallback: Broker in separater VM/Kernel** (= Kapazitäts-Eskalation an Christin/proxmox; erst wenn die In-VM-Härtung beweisbar scheitert).
- **Fix-Artefakte:** (a) netns/nftables-Policy als maschinenlesbares Build-Artefakt (SSOT); (b) Oracle neu aus **Seat-netns-Perspektive, NEGATIV** (Seat MUSS Anthropic/.81/LAN NICHT erreichen, NUR den Broker-veth); (c) Seat-Cap-Drop + seccomp + userns; (d) Boot-Ordering fail-closed (nftables vor Netz, Seats `BindsTo`/`After` netns-Unit, Boot-Self-Test gated). | **Gate: vor-egress-Bau**

### B2 LLM-Broker = offener Internet-Tunnel, wenn HTTP-Forwarder
- **Beide:** Ein HTTP-Forward-Broker macht den Seat zu einem offenen Anthropic-Proxy (Vollduplex-Kanal nach außen; PII-Gate filtert Muster, nicht koverten Exfil). → **Fix:** LLM-Broker als **enge RPC-Spec** (fixe Operationen, Prompt-Schema-Validierung, Response-Filtering, per-Seat-Token/Größen-Budgets, Quota-Circuit-Breaker), KEIN generischer Forward. **Owner: Schnüffi.** | **Gate: vor-egress-Bau / vor-GO-LIVE**

### B3 PII-Detektor fail-OPEN am Anthropic-Pfad
- **Beide:** „redact bei Treffer" setzt „detected" voraus; der regex-primäre Detektor (2c/4G, kein fettes ML) verfehlt obfuskierte/ausländische/gesplittete/Freitext-PII + opaque Anhänge. → **Fix:** Default umdrehen auf **positive Allowlist** — nur strikt bekannte, kanonische, PII-arme Payload-Formate dürfen raus; opaque/Anhänge → DENY bis Parser/OCR positiv validiert. Recall-Oracle MUSS adversariale Obfuskations-Fälle enthalten. Primärgarantie auf **Schicht-A-Pseudonymisierung** (PII gelangt gar nicht erst in die VM); Egress-Gate = Defense-in-Depth, NICHT alleinige Primärkontrolle. **Owner: Schnüffi.** | **Gate: vor-GO-LIVE**

---

## 2. WEITERE BLOCKER/HIGH (eine Lens, übernommen)

| ID | Sev | Teil | Befund | Fix | Owner | Gate |
|---|---|---|---|---|---|---|
| H1 | HIGH | A/C | „pz2 bridged nur, routet nicht" = Annahme, nicht erzwungen. `ip_forward=1` (Proxmox-default) o. LXC-Router → L3-Pfad vmbrZONE↔/24 umgeht UDM | Build-Verify `net.ipv4.ip_forward=0` auf pz2; vmbrZONE ohne L3-Adresse; Negativ-Test Zone↔/24 | Schraubi | vor-egress |
| H2 | HIGH | A/C | IPv6-Residual trotz „IPv6 AUS" (UDM-seitig aus, aber VM behält link-local/SLAAC; nftables §3.3 nur IPv4) | `disable_ipv6=1` auf allen VM-IFs+veth + `ip6 filter` default-drop; v6-Egress-Test im Oracle | Schraubi/Netzi | vor-egress |
| H3 | HIGH | A | vzdump/Backup-Snapshot hebelt LUKS-at-rest + Pseudonym-Map aus (Backup = RAM/Disk-State auf geteiltem PBS) | Zone-VM aus Cluster-vzdump/PBS HART ausschließen ODER zone-eigener verschl. Backup-Key; Pseudonym-Map separat envelope-enc, Key NICHT im VM-Backup | Schraubi | vor-GO-LIVE |
| H4 | HIGH | B | Schicht-A umgehbar via Anhänge: Seat SIEHT Roh-PII im Attachment (PDF/Bild), auch wenn Egress blockt → PII schon im Seat-Kontext/History/Disk | Ingest-Gateway droppt/OCR+tokenisiert Anhänge VOR dem Seat; opaque nie roh in Seat | Schnüffi | vor-GO-LIVE |
| H5 | HIGH | B/C | DNS-Drift Anthropic/CDN bricht FQDN-Allowlist (IP-Rotation; Resolver-Kompromiss → Exfil-IP, UDM CIDR-blind) | Broker erzwingt TLS-SNI + Cert-Pinning/CT-Check (nicht nur A-Record); DoT-Upstream gepinnt | Schnüffi/Schraubi | vor-egress |
| H6 | HIGH | A | ttyd-mTLS = PFLICHT (nicht Token-Alt); Seat-ttyd im Seat-netns OHNE direkten Egress; Pseudonym-Map-Datenvertrag | mTLS-Client-Cert (hw-gebunden), short-TTL, Clipboard/Download aus wo erzwingbar, CSP, Session-Audit nicht-abschaltbar | Schraubi/Schnüffi | vor-GO-LIVE |
| M1 | MED | B | NTP als low-bw-Exfil/Timing-Kanal (1 externer Server, WAN offen) | NTP nur zone-lokal/UDM-intern o. KVM-PTP; kein externer NTP-Egress | Schraubi | vor-egress |
| M2 | MED | A/B | Geteilter Fleet-Vault: Team-Cred fleet-weit ziehbar | Team-Cred eigenes Vault-Item, ACL nur Broker-SA, Audit, rotierbar | Schraubi/Schnüffi | vor-GO-LIVE |
| M3 | MED | B | Detektor/Parser-RCE-Fläche + OOM-Restart-fail-open | Detektor/Parser sandboxed (seccomp/no-net/kill-timeout); Broker-OOM-Score; Restart erzwingt Regel-Reload-Gate | Schnüffi | vor-egress |
| L1 | LOW | C | Switch-Trunk „vermutlich All-Trunk" unbestätigt; untagged-Fallback = LAN! | Trunk beider bond0-Ports am Build read-only verifizieren; Negativ-Test untagged-Fallback ≠ LAN | Netzi/Schraubi | vor-egress |
| L2 | LOW | B | Telemetrie-Env-Vars sind Komfort, kein Enforcement | Netz-Allowlist als Primär (statsig/sentry NICHT drin), Env-Vars sekundär | Schnüffi | vor-egress |

*(R3-abhängig, separat bei R3=A: Merkel-Broker fail-closed + opaque→block. Bei R3=B isoliert neu-refuten.)*

---

## 3. KONSENS-AUFGABE vor egress-fähigem Bau (Schnüffi-Vorschlag, akzeptiert)
**Aus den REQUIREMENTS oben konkrete, seat-perspektivisch-NEGATIV-testbare ARTEFAKTE machen.** Erst dann ist der egress-fähige Bau vertretbar. Arbeitsteilung:
- **Schnüffi:** LLM-Broker-RPC-Spec (B2) · Detektor-positive-Allowlist (B3) · Anhang-Handling (H4) · Detektor/Parser-Sandbox (M3).
- **Schraubi (ich):** netns/nftables als maschinenlesbares SSOT-Artefakt (B1a) · **Seat-perspektivisches NEGATIV-Oracle** (B1b — Seat-netns: MUSS NUR Broker-veth erreichen) · Seat-Cap-Drop/seccomp/userns (B1c) · Boot-Ordering-fail-closed (B1d) · pz2-`ip_forward`-Beweis (H1) · IPv6-VM-Drop (H2) · vzdump/Backup-Policy (H3) · Pseudonym-Map-Datenvertrag+Substrat (H6) · NTP (M1) · Vault-Scoping (M2).
- **Netzi:** VLAN50/networkgroup als exportiertes Artefakt + L2/ARP-Review (H2/L1) · Egress-Allowlist offene Christin-Host-Platzhalter (H5/Allowlist-Final).

## 4. Gate-Entscheidung (R22)
- **BLOCK egress-fähiger Bau** (Broker/Egress-Rules/Anthropic-Pfad) bis die §3-Artefakte vorliegen + seat-perspektivisch NEGATIV getestet sind + Konsens Schnüffi/Schraubi/Netzi.
- **Foundation-ohne-Egress** (VM-Anlage, LUKS, netns-Gerüst, Koordinator+SQLite-Epoch-Fencing-Ledger, Audit-Log, Pseudonym-Map-Substrat — alles OHNE jeden Egress-Pfad) ist refute-seitig freigegeben; bleibt infra-gated auf **Netzi-VLAN-Provisionierung + Christin/Hub-Go** (Live-pz2/UDM-Touch).
- **GO-LIVE (echte Daten)** weiterhin gated auf Bizzi-DSFA + Christin-Sign-off + R3-Entscheidung (Merkel).
