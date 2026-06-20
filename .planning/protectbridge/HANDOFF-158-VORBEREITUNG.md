# ProtectBridge (LXC 158 @pz2) — Vorbereitungspaket / Handoff

**IST-Stand (read-only verifiziert):**
- **VMID/Node:** 158 @pz2, Name `protectbridge`, Status `running`, `onboot=1`
- **Typ:** LXC **privilegiert** (kein unprivileged-Flag), `features: nesting=1`
- **Specs:** 2 cores / 1 GB RAM / 8 GB Disk (local-lvm)
- **Netz:** net0 auf `vmbr0`, **untagged** (kein VLAN), DHCP — IP **192.168.20.82**, MAC **BC:24:11:B7:30:F3**
- **OS/Tags:** debian / keine Tags
- **Zweck:** UniFi-Protect-Kamera-Bridge (ONVIF + go2rtc + Web-UI :8888 + Loxone-Intercom), Repo `github.com/chloepriceless/protectbridge`
- **Headroom:** pz2 hatte ~9 GB avail zum Recon-Zeitpunkt

> **Hinweis Daten-Diskrepanz:** Der Recon-JSON-Block fuehrt `"privileged":false`, alle uebrigen verifizierten IST-Daten (kein unprivileged-Flag gesetzt) sprechen fuer **privilegiert**. In diesem Paket wird durchgaengig **privilegiert** angenommen — das ist genau der Grund fuer Artefakt 3 (Unprivileged-Review). Sollte sich beim Review herausstellen, dass der Container doch unprivileged laeuft, entfaellt Artefakt 3 bzw. wird zur Bestaetigung.

---

## 1) DHCP-Reservation-Request (an Netzi, Tagesfenster)

**Begruendung:** Ein Proxmox-**stop-mode-Backup** faehrt den Container herunter und startet ihn neu. Beim Reboot fragt der Container per DHCP eine Adresse an — ohne feste Reservation kann er eine **neue IP** bekommen. Folge: UniFi Protect verliert die adoptierte Bridge, Loxone-Intercom-Endpoint zeigt ins Leere, Re-Adoption noetig. Loesung: MAC fest an die aktuelle .82 binden.

**(a) Fertiger Ping-Text an Netzi:**

> Hi Netzi — brauche eine **feste DHCP-Reservation** im Netz 192.168.20.0/24 (untagged):
> **MAC `BC:24:11:B7:30:F3` → IP `192.168.20.82`**.
> Hintergrund: LXC 158 "protectbridge" (UniFi-Protect-Bridge) wird per stop-mode-Backup periodisch rebootet. Ohne feste Reservation kann DHCP eine neue IP vergeben → Protect-/Loxone-Adoption bricht und muss manuell neu gemacht werden.
> Bitte **.82 beibehalten** (die ist bereits adoptiert → keine Re-Adoption noetig), sofern .82 nicht im dynamischen DHCP-Pool liegt bzw. dort einen Konflikt erzeugt. Falls .82 im Pool-Bereich liegt: bitte eine **stabile Infra-IP ausserhalb des Pools** vergeben und mir die neue IP nennen (dann muss ich Protect/Loxone einmalig re-adoptieren). Tagesfenster reicht, nicht dringend-kritisch. Danke!

**(b) UniFi-Controller-Schritte (Stichpunkte):**
- Controller → **Client Devices** → Client mit MAC `BC:24:11:B7:30:F3` suchen (Name ggf. `protectbridge`)
- Client oeffnen → **Settings / Gear** → **Network / IP** Sektion
- **Use Fixed IP Address** aktivieren → Network = das LAN-Netz (192.168.20.0/24, untagged) → Fixed IP = `192.168.20.82`
- Speichern; pruefen, dass die Reservation als **Fixed IP** beim Client angezeigt wird
- Optional: gegen den **DHCP-Pool-Range** des LAN-Netzes (Settings → Networks → LAN → DHCP Range) gegenchecken, dass .82 reserviert/ausserhalb des dynamischen Vergabebereichs ist (kein Doppelvergabe-Risiko)

**Empfehlung:** **.82 beibehalten** — minimiert Re-Adoption-Aufwand (Bridge ist bereits unter .82 in Protect/Loxone eingebunden). Nur wenn .82 im dynamischen Pool liegt und nicht sauber reservierbar ist, auf eine stabile Infra-IP ausserhalb des Pools ausweichen.

---

## 2) Backup-Resilienz-Checkliste

**Problem:** Nach einem stop-mode-Backup-Reboot starten nur **enabled** systemd-Units automatisch. Ist eine Service-Unit nur `active`, aber nicht `enabled`, ist der Dienst nach dem Backup **unten** — Bridge/Streams/Intercom fallen still aus.

**Read-only Verifikation (im Container ausfuehren, nichts aendern):**

```bash
# Wahrscheinliche Units pruefen — Erwartungswert jeweils: enabled
systemctl is-enabled go2rtc
systemctl is-enabled protectbridge        # Bridge/Web-App-Unit (:8888); ggf. abweichender Name
systemctl is-enabled onvif                # falls als separate Unit vorhanden

# Falls Unit-Namen unbekannt: alle relevanten Units auflisten (read-only)
systemctl list-unit-files --type=service | grep -Ei 'go2rtc|protect|bridge|onvif'
systemctl list-units --type=service --state=running
```

**Erwartungswert:** jede Kern-Unit meldet `enabled`.

**Fix-Empfehlung an den ProtectBridge-Peer (NUR Empfehlung, hier keine Ausfuehrung):** Fuer jede Unit, die `disabled`/`static`/`generated` statt `enabled` meldet:

```bash
systemctl enable <unit>     # z.B. systemctl enable go2rtc
# Verifikation nach Fix:
systemctl is-enabled <unit>   # erwartet: enabled
```

Zusatz-Check vor dem ersten produktiven Backup: nach `systemctl enable` einmal kontrolliert per `reboot` testen und danach `systemctl is-active <unit>` fuer alle Kern-Units gegenchecken (alle `active`), damit der Backup-Reboot-Pfad real bewiesen ist.

---

## 3) Unprivileged-Review-Brief (an Schnueffi, R22)

**Auftrag-Brief:**

> **Betreff:** Review LXC 158 "protectbridge" @pz2 — privileged → unprivileged Migrationspruefung (R22)
>
> **Kontext:** LXC 158 laeuft aktuell **privilegiert** mit `features: nesting=1`. Privileged-Container teilen den UID-0-Mapping-Raum effektiv mit dem Host → erhoehte **Host-Escape-Flaeche**. Workload: go2rtc (RTSP/WebRTC-Restreaming), ONVIF, Web-UI :8888, Loxone-Intercom. Netz untagged auf vmbr0 / DHCP .82.
>
> **Zu pruefen:**
> 1. **Laeuft der Stack auch unprivileged?** Funktionieren go2rtc, ONVIF und RTSP/WebRTC-Streaming ohne privileged-Mode? Es ist kein Kernel-Modul-Laden / kein Hardware-/GPU-Passthrough erkennbar — Hypothese: unprivileged tragbar.
> 2. **Reicht `nesting=1` + ggf. gezielte Capabilities** statt voll-privileged? Pruefen, ob die Bridge spezielle Caps braucht (z.B. fuer Low-Ports < 1024, Multicast/ONVIF-Discovery via WS-Discovery auf UDP 3702, mDNS). Falls Low-Ports noetig: `:8888` ist unkritisch; ONVIF/RTSP-Standardports pruefen.
> 3. **ONVIF-Discovery (Multicast/Broadcast)** im unprivileged + untagged-Setup verifizieren — haeufigster Stolperstein.
>
> **Risiko-Einordnung:** privileged = hoechste Eskalations-Flaeche bei kompromittiertem Dienst (Kamera-Bridge ist netzwerk-exponiert auf flachem 192.168.20.0/24, untagged → kein VLAN-Schutz). Reduktion auf unprivileged senkt das Blast-Radius-Risiko deutlich; daher Prioritaet im Rahmen R22.
>
> **Vorgeschlagener Migrationspfad (nicht-disruptiv):**
> 1. **Test-Klon** von 158 als **unprivileged** anlegen (anderer Name/IP, gleiche features nesting=1), nicht .82.
> 2. **Verifizieren:** Kamera-Streams (go2rtc/RTSP/WebRTC), ONVIF-Discovery, Web-UI :8888, Loxone-Intercom am Klon.
> 3. Bei Erfolg: Wartungsfenster → Original 158 stilllegen, Klon auf .82/MAC umziehen **oder** 158 sauber neu unprivileged aufsetzen. Re-Adoption in Protect/Loxone einplanen, falls IP/MAC wechselt.
> 4. Bei Fehlschlag: dokumentieren, welche Faehigkeit privileged erzwingt (Beleg fuer bewusste Ausnahme).
>
> **Liefergegenstand:** Go/No-Go zu unprivileged + Liste benoetigter Caps/Features + dokumentierter Migrationspfad.

---

## 4) NetBoard-Eintrag-Content (an Patchi, SSOT)

```text
Asset:        LXC 158
Node:         pz2
Name:         protectbridge
Typ:          LXC privileged (nesting=1)
Specs:        2c / 1G / 8G (local-lvm)
Net:          vmbr0 untagged, DHCP
IP:           192.168.20.82
MAC:          BC:24:11:B7:30:F3
onboot:       yes
Zweck:        UniFi-Protect-Kamera-Bridge (ONVIF / go2rtc / Loxone-Intercom)
Web:          :8888
Repo:         github.com/chloepriceless/protectbridge
Owner-Peer:   ProtectBridge
Status:       running
OS:           debian
Hinweise:     pz2-nominale-T0204-Reservierung; DHCP-Reservation .82 pending (Netzi);
              privileged -> Unprivileged-Review R22 offen (Schnueffi)
```

**Tapsi-Backup-Hinweis:** LXC **158 ins Backup-Set aufnehmen** (stop-mode). Voraussetzung vor Aktivierung: Service-Units `enabled` (siehe Artefakt 2) **und** DHCP-Reservation .82 gesetzt (Artefakt 1), damit der Backup-Reboot weder Dienste noch Adoption bricht.

---

## Offene Entscheidung

**Einzige offene Frage:** Pinge **ICH** (Proxmox-GUI-Head) Netzi fuer die DHCP-Reservation an, oder macht der ProtectBridge-Peer das selbst?

**Empfohlene Default-Antwort:** **Ich (Proxmox-GUI-Head) uebernehme die Netzi-Koordination im Tagesfenster.**
**Begruendung:** DHCP-Reservation ist **Infra-/Netz-Domaene**, nicht Applikations-Domaene des ProtectBridge-Peers — single point of contact zu Netzi vermeidet Doppel-Pings und Pool-Konflikt-Missverstaendnisse. Ich halte ohnehin den IST-Stand (MAC/IP) und kann den Pool-Konflikt-Fall (.82 ggf. im dynamischen Range) direkt mit Netzi klaeren. Der ProtectBridge-Peer fokussiert parallel auf Artefakt 2 (Service-Units enabled) und steht fuer eine etwaige Re-Adoption bereit, falls Netzi auf eine andere Infra-IP ausweichen muss.