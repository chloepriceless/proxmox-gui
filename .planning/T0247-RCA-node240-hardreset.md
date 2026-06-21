# T-0247 — RCA: Node proxmox/.240 reproduzierbarer Hard-Reset im 02:00-Backup-Fenster

**Autor:** Infra-LEAD („Schraubi", `vm-deployment-gui`). **Stand:** 2026-06-21, read-only Recon durch.
**Auftraggeber:** Peer `f73n74ge` (@orchestrator). **Korroboration:** Tapsi (`eib2hvyt`, Backup), Kuma (`fz2arj59`, Monitoring).
**Leitplanke:** `.240` = TABU außer read/stop. Alle Befunde unten = read-only (SSH/ipmitool/journalctl). KEINE Mutation an .240.

---

## 1. Symptom
Node `proxmox`/.240 resettet **reproduzierbar hart** im nächtlichen 02:00-vzdump-Backup-Fenster. **3× in Folge**, aus der Boot-Historie des Nodes selbst verifiziert:

| Datum | Crash (Boot-Ende) | nächster Boot | im Backup-Fenster? |
|-------|-------------------|---------------|--------------------|
| 18.06. | 02:41:31 | 02:54:58 | ✅ |
| 20.06. | 02:12:01 | 22:17:05 | ✅ |
| 21.06. | 02:29:55 | 02:36:02 | ✅ |

Andere 4 Cluster-Nodes überstehen dieselbe Backup-Welle → **lokal auf .240**. `Power Restore Policy: always-on` → Auto-Recovery erklärt das Wiederhochkommen.

## 2. Hardware (verifiziert)
- **Board:** ASRock Rack **X470D4U2-2T** (Consumer-AM4, X470-Chipsatz, Dual-10G). System-DMI = „To Be Filled By O.E.M." (Whitebox).
- **CPU:** AMD Ryzen **APU** (Sensoren VCPU/VSOC/APU_VDDP/Tctl/Tccd1).
- **RAM:** 3× (mind.) Kingston FURY **KF3600C18D4/32GX** (DDR4-3600-rated), läuft auf **2400 MT/s / 1.2V JEDEC-Base** → **EXPO/XMP NICHT aktiv**.
- **BMC:** ASPEED / **ASRock Rack** (NICHT HPE-iLO → kein separates IML; IPMI-SEL = das HW-Ereignislog hier).
- **Storage-HBA:** Broadcom **LSI 9500-16i Tri-Mode** (SAS3816, FW 21.00) auf `0000:2b:00`, per **vfio-pci an PBS-VM106 durchgereicht**, treibt 5 SAS-SSDs (WD/HGST `0x5000cca087...`).
- **Backup-Architektur:** im 02:00-Fenster schreiben **alle Cluster-Nodes konzentriert über VM106** (PBS) auf diesen HBA.

## 3. Evidenz (alle read-only, ground-truth)
| Quelle | Befund | Bedeutung |
|--------|--------|-----------|
| **Host-Journal** (boot -1) | endet 02:29:55 **mitten im normalen Monitoring-Rauschen** (smartctl/check-mk/ipmitool-sensor/cron) — KEIN Panic/OOM/ATA-Reset/Hung-Task/Soft-Lockup/MCE | sauberer **instantaner Hard-Cut**, kein Software-/Thermik-Vorlauf |
| **VM106-Journal** (boot -1, .117) | starb 02:29:44 (mit dem Host); Kernel-Log zeigt VOR dem Cut **NICHTS** — nur Boot-Enum des HBA (22:18), dann Stille. **Kein mpt3sas/AER/SCSI-Reset/Abort** | 🔴 **der Gast, der den HBA besitzt, loggt KEINEN HBA-/PCIe-Fehler** → HBA-AER als Ursache **stark geschwächt** |
| **IPMI SEL** (1075 Einträge) | NUR benigne „Timestamp Clock Sync", **kein** Power-/Voltage-/Temp-/Watchdog-Assertion an den Crash-Zeiten | weder OS noch BMC erfassen die Ursache = silenter Freeze |
| **`ipmitool chassis status`** | **Last Power Event: `ac-failed`** | 🔴 heißester Lead: BMC interpretiert den Cut als AC/Power-Verlust |
| **rasdaemon** (`ras-mc-ctl`) | **0 Memory-Fehler (CE/UE)** über ~1 Monat Uptime, **0 PCIe-AER** | RAM- + PCIe-AER-These geschwächt |
| **dmidecode RAM** | EXPO/XMP **aus** (2400 statt 3600-rated) | „EXPO marginal"-These weitgehend widerlegt |
| **IPMI Rail-Spannungen (idle)** | 12V=12.10 · 5V=5.07 · 3.3V=3.22 · VCPU=1.12 · VCCM=1.19 — alle in-spec | gesund **at idle**; Last-Sag NICHT sichtbar (PSU-PMBus PIN/POUT/VIN = „No Reading") |
| **Disk** | smartctl-WARN = Rauschen auf IPMI-Virtual-Media (Kuma/Tapsi); echte ZFS-SSDs SMART PASSED/0 Reallocated; Host sieht Backup-SAS-SSDs nicht (HBA im Gast) | **Disk-Spur tot** |

## 4. Hypothesen-Ranking
1. **🥇 PSU-Sag / Brownout unter konzentrierter Backup-Last** (am wahrscheinlichsten). Consumer-Board + Whitebox-PSU + power-hungriger 9500-16i Tri-Mode-HBA + 5 SAS-SSDs + cluster-weite konzentrierte vzdump-Schreiblast → Peak-Power über die saubere PSU-Kapazität → Brownout → instantaner Reset. Passt zu: load-korreliert (nur im 02:00-Fenster, nur .240), instant ohne Spur (Host+Gast+BMC), „ac-failed"-Chassis-Event.
2. **🥈 Upstream-AC/PSU-Hardware-Defekt** (PSU sterbend, PDU/UPS, Wand-AC). Auch „ac-failed", auch instant. Unterscheidung von #1 nur über die Rail-Capture (siehe §5).
3. **🥉 VRM/Board-Fault unter Last** — möglich auf Consumer-Board, schwer remote zu belegen.
4. **RAM/CPU-SoC marginal** — geschwächt (0 MCE, 0 CE/UE, EXPO aus), aber memtest schließt es endgültig aus.
5. **HBA/PCIe-AER** — stark geschwächt (VM106-Gast loggt nichts, Host-AER clean).

## 5. Die entscheidende offene Messung
**`.241`-Rail-Voltage-Capture im NÄCHSTEN 02:00-Fenster** (f73n74ges `ship-sensors-240.service`, .240 shippt ~3s nach `pve:/var/log/node240-capture/sensors.log`). Startete erst 03:21 → hat den heutigen Crash verpasst, instrumentiert die nächste Messnacht. **Diagnose-Gabel (Kuma):**
- **Rails SACKEN ab, dann Cut** → Brownout/PSU-Sag unter Last (#1) → Fix-Pfad PSU.
- **Rails NORMAL bis zur letzten Sample, dann Stille** → instantaner Upstream-AC/PSU-Cut (#2) → Fix-Pfad PSU-HW/PDU/UPS/Wand-AC.
- **Optionale Tweaks** (koordiniert mit Collector-Owner f73n74ge): 1s-Intervall im Fenster 01:55–02:45 (Sag-Rampe besser fangen, Collector friert mit .240 ein → letzte Sample = ~Intervall vor Cut) + zusätzlich `ipmitool sensor` ~10s (BMC-PSU-Level/„ac-failed").

**Auswertungs-Oracle (Kuma, Schwellen aus Live-Baseline — für die Messnacht-Auswertung):**
- **12V** Baseline 12.10V → Abfall **<11.7V** ODER fallende Rampe in den letzten 1–3 Samples = **SAG** (ATX-Untergrenze 11.40V).
- **5V** Baseline 5.07V (Untergrenze 4.75V). **3VSB/5VSB** müssen bombenfest sein — dippen sie = tiefes Power-Problem.
- **Tctl** idle ~55°C; nur **>90°C** vor Cut wäre thermal (unwahrscheinlich bei instant).
- **Entscheidung:** fallende 12V/5V-Rampe vor Stille → Brownout/Sag unter Last → PSU tauschen/aufdimensionieren + Last entzerren. Rails bei Baseline DANN Stille → instant Upstream-Cut → PSU-HW/PDU/UPS/Wand-AC. Die `ipmi-sensors.log`-PSU-Status-Zeile entscheidet zusätzlich ac-input vs. rail-sag.

## 6. Empfohlene Schritte
### Bereits erledigt (Interim-Mitigation, Auftraggeber)
- **vzdump `bwlimit` 100→30 MiB/s** — senkt Peak-HBA/Disk/Power-Last → reduziert Brownout-Wahrscheinlichkeit. ✅ gute Sofort-Maßnahme.
- Rail-Capture-Collector aufgesetzt. ✅

### Autonom / non-disruptiv (read-only, jederzeit)
- Rail-Capture nach der nächsten Messnacht auswerten (Diagnose-Gabel §5).
- Collector-Tweaks (1s-Window + ipmitool) mit f73n74ge einbauen.

### Christin-gated (disruptiv / physisch / Wartungsfenster — NICHT nachts, .240-TABU)
- **PSU:** Test/Swap gegen ein dimensioniert-ausreichendes, gesundes Netzteil (stärkster Verdacht). Bei Single-ATX-Whitebox-PSU: Watt-Reserve + Alter prüfen.
- **BIOS-Power:** PBO / Auto-OC / cTDP aus, Spannungen auf Stock; ggf. BIOS-Update (AGESA).
- **Last entzerren:** Backup-Schedule staffeln, sodass nicht alle Nodes gleichzeitig über VM106s HBA auf .240 schreiben (bwlimit hilft schon; Staffelung senkt Peak weiter).
- **memtest86+** (schließt RAM endgültig aus; EXPO ist bereits aus).
- **SoL-Capture für Kernel-Panic:** `console=ttyS0,115200` in die Kernel-Cmdline (`/proc/cmdline` hat es NICHT) = GRUB-Change + **Reboot von .240** → erst dann fängt IPMI Serial-over-LAN einen evtl. Panic. Nur sinnvoll, falls die Rail-Capture „Rails normal" zeigt (= kein reiner Power-Cut, dann lohnt Panic-Capture).

## 7. 🔗 Cross-Link T-0244 (Kundendaten-Isolation)
Variante A wollte die isolierte PII-VM AUF .240 bauen (einziger Headroom-Node). **Ein reproduzierbar hart resettender Node ist kein PII-Host** (GDPR Art. 32(1)(b) Verfügbarkeit/Integrität). → A defekt-blockiert bis RCA-Fix + Burn-in; Gewicht Richtung B (separater Host). An Schnüffi (Synthese) + Bizzi (DSFA) geflaggt, im T0244-Design rev.2 verankert.
