# T-0187 Host-Deploy LXC 100 @ pz1 (.153) — Schraubi 2026-06-12 ~01:30

## Stand: DEPLOYED + Oracle PASS (Country-Interim)
- LXC 100 gebumpt: 512M→2048M RAM, 1→2 Cores (pz1 hatte 3,8G avail).
- **Loki 3.7.2** (grafana-apt): enabled+active, Bind NUR 127.0.0.1:3100 (Alloy+Grafana lokal).
- **Alloy 1.16.3** (grafana-apt): enabled+active, TLS-Syslog-Listener 192.168.20.153:6514 (RFC5425).
- TLS: self-signed CN=monitoring.lan, key root:alloy 640 (Paket läuft als User alloy!).
- GeoIP **V1-INTERIM: GeoLite2-Country.mmdb von der UDM** (/usr/share/dpi/geoip/) — City-DB folgt
  mit MaxMind-Key (Christin) → dann config: db=City.mmdb, db_type=city, country_code-Label
  zurück auf geoip_country_iso_code.
- **KEIN VictoriaMetrics auf .153** (falsifiziert: kein Paket/Unit/Prozess) → prometheus.*-Blöcke
  entfernt (Loki-only v1 lt. Runbook). Kuma um echten remote_write-Endpoint gebeten.

## Abweichungen von Netzis assets/alloy-eve-pipeline.alloy (config.alloy hier = deployt)
1. `labels` in den `listener{}`-Block verschoben (Alloy 1.16: Komponenten-Ebene = Syntax-Error).
2. Listener auf 192.168.20.153:6514 gebunden (statt 0.0.0.0).
3. GeoIP Country-Interim (s.o.) + country_code-Label-Source geoip_country_code.
4. prometheus.exporter/scrape/remote_write entfernt (kein VM-Endpoint, s.o.).

## Oracle (Schritt 7, gemessen)
1 Sample-EVE-Zeile (TOR, src 85.130.157.152→dest .101) per TLS-RFC5425 →
1 Loki-Eintrag: Labels classification=tor_relay_inbound · ubnt_category=TOR · severity=medium ·
direction=external_src · country_code=IL · action=allowed; structured_metadata src_ip/signature/
geoip_country nicht-leer (LogQL-verifiziert). geoip_lat = PENDING City-DB (kein Blocker, Hub-ack).

## Test-Sender-Falle (für Re-Tests)
Syslog-Client muss nach dem Frame ~2s offen bleiben + graceful FIN (SHUT_WR) — abrupter Close
killt den Stream BEVOR Alloy parst („connection reset by peer", Event verloren).
Re-Test: `pct exec 100 -- python3 /root/t0187/test2.py` (liegt auf der Box).

## Rollback
systemctl disable --now alloy loki && rm -rf /etc/alloy /etc/loki (Grafana unberührt) + pct set 100 -memory 512 -cores 1.
