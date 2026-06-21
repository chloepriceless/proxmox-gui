#!/usr/bin/env python3
"""
T-0244 Artefakt-Extraktions-Skript
Slict Code-Fences programmatisch aus 01-netns-enforcement-SSOT.md
und assembliert alle Deploy-Artefakte.
"""

import base64
import hashlib
import os
import re
import subprocess
import sys
import textwrap

REPO_ROOT = "/home/dev/vm-deployment-gui"
SSOT = os.path.join(REPO_ROOT, ".planning/T0244-artifacts/01-netns-enforcement-SSOT.md")
ORACLE_DIR = os.path.join(REPO_ROOT, ".planning/T0244-artifacts")
DEPLOY_DIR = os.path.join(REPO_ROOT, ".planning/T0244-artifacts/deploy")
FILES_DIR = os.path.join(DEPLOY_DIR, "files")
MANIFEST = os.path.join(DEPLOY_DIR, "MANIFEST.tsv")
CLOUD_INIT = os.path.join(DEPLOY_DIR, "zone-avv-user.yaml")

os.makedirs(FILES_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────
# 1. SSOT einlesen
# ─────────────────────────────────────────────────────────────────
with open(SSOT, "r", encoding="utf-8") as fh:
    raw_lines = fh.readlines()

# 1-indexed for spec references
lines = [""] + raw_lines   # lines[n] == line n


def get_fence_content(start_l, end_l):
    """Gibt Zeilen [start_l..end_l] OHNE die Fence-Marker zurück (Inhalt dazwischen)."""
    # start_l ist die ``` Opener-Zeile, end_l ist die ``` Closer-Zeile
    return raw_lines[start_l - 1 + 1 : end_l - 1]   # exklusive Fence-Zeilen


def content_to_str(content_lines):
    return "".join(content_lines)


def write_file(local_name, content_str, vm_path, mode_oct, source_tag):
    """Schreibt eine Datei in FILES_DIR und gibt (local_path, sha256, bytes) zurück."""
    local_path = os.path.join(FILES_DIR, local_name)
    data = content_str.encode("utf-8")
    with open(local_path, "wb") as fh:
        fh.write(data)
    sha = hashlib.sha256(data).hexdigest()
    return local_path, sha, len(data)


# ─────────────────────────────────────────────────────────────────
# 2. Code-Fence-Slicing per Spec
#    Strategie: suche die Opener-Fence-Zeile exakt per Inhalt-Marker,
#    dann finde den zugehörigen Closer.
# ─────────────────────────────────────────────────────────────────

def find_fence(marker_substr, start_search=1, skip=0):
    """
    Findet Zeile (1-idx) der Code-Fence-Opener, die marker_substr enthält.
    skip=N überspringt die ersten N Treffer.
    Gibt (opener_line, closer_line) zurück.
    """
    found = 0
    for i, line in enumerate(raw_lines, start=1):
        if i < start_search:
            continue
        if line.strip().startswith("```") and marker_substr in line:
            if found < skip:
                found += 1
                continue
            # Finde Closer
            for j in range(i + 1, len(raw_lines) + 1):
                if raw_lines[j - 1].strip() == "```":
                    return i, j
            raise ValueError(f"Kein Closer für Fence bei L{i}")
    raise ValueError(f"Fence-Marker '{marker_substr}' nicht gefunden (skip={skip})")


# ─── §2: zone-netns-setup.sh (```bash, L70-139) ─────────────────
fence_setup_open, fence_setup_close = find_fence("bash", start_search=60)
print(f"[§2] zone-netns-setup.sh fence: L{fence_setup_open}–L{fence_setup_close}")
content_setup = content_to_str(get_fence_content(fence_setup_open, fence_setup_close))

lp_setup, sha_setup, sz_setup = write_file(
    "zone-netns-setup.sh", content_setup,
    "/usr/local/sbin/zone-netns-setup.sh", "0755", "SSOT §2"
)

# ─── §3: zone-root.nft (```nft, L151-211) ───────────────────────
fence_nft_open, fence_nft_close = find_fence("nft", start_search=140)
print(f"[§3] zone-root.nft fence: L{fence_nft_open}–L{fence_nft_close}")
content_nft = content_to_str(get_fence_content(fence_nft_open, fence_nft_close))

lp_nft, sha_nft, sz_nft = write_file(
    "zone-root.nft", content_nft,
    "/etc/zone/zone-root.nft", "0644", "SSOT §3"
)

# ─── §3: zone-root-nft.service (```ini, L214-233) ───────────────
# Das erste ```ini nach der nft-Fence (um L214)
fence_rootnft_open, fence_rootnft_close = find_fence("ini", start_search=fence_nft_close)
print(f"[§3] zone-root-nft.service fence: L{fence_rootnft_open}–L{fence_rootnft_close}")
raw_rootnft = get_fence_content(fence_rootnft_open, fence_rootnft_close)
# Die erste Zeile ist ein Kommentar-Header: "# /etc/systemd/system/zone-root-nft.service"
content_rootnft = content_to_str(raw_rootnft)

lp_rootnft, sha_rootnft, sz_rootnft = write_file(
    "zone-root-nft.service", content_rootnft,
    "/etc/systemd/system/zone-root-nft.service", "0644", "SSOT §3"
)

# ─── §3: DREIFACH-FENCE (zone-broker-llm/merkel + zone-resolver) ─
# Das zweite ```ini nach zone-root-nft-Fence
fence_broker_open, fence_broker_close = find_fence("ini", start_search=fence_rootnft_close + 1)
print(f"[§3] Broker-3-in-1 fence: L{fence_broker_open}–L{fence_broker_close}")
broker_lines = get_fence_content(fence_broker_open, fence_broker_close)

# Split anhand der # /etc/systemd/system/<name>.service Header-Zeilen
# Format: "# /etc/systemd/system/zone-broker-llm.service  (analog ...)"
def split_multi_unit(content_lines):
    """
    Teilt eine Multi-Unit-Fence anhand von Kommentarzeilen der Form
    '# /etc/systemd/system/<name>.service ...' auf.
    Der Unit-Name ist der erste Token nach dem Pfad-Präfix (endet auf .service).
    Gibt Liste von (unit_name, content_str) zurück.
    """
    _PAT = re.compile(r"^# /etc/systemd/system/([\w@.-]+\.service)")

    units = []
    current_name = None
    current_lines = []

    for line in content_lines:
        stripped = line.strip()
        m = _PAT.match(stripped)
        if m:
            # Neuen Abschnitt beginnen
            if current_name is not None:
                units.append((current_name, "".join(current_lines)))
            current_name = m.group(1)
            current_lines = []
        else:
            if current_name is not None:
                current_lines.append(line)

    if current_name is not None:
        units.append((current_name, "".join(current_lines)))

    return units

broker_units = split_multi_unit(broker_lines)
print(f"[§3] Broker-Units gefunden: {[u[0] for u in broker_units]}")

broker_map = {
    "zone-broker-llm.service":    "/etc/systemd/system/zone-broker-llm.service",
    "zone-broker-merkel.service": "/etc/systemd/system/zone-broker-merkel.service",
    "zone-resolver.service":      "/etc/systemd/system/zone-resolver.service",
}

extracted = {}  # local_name → (vm_path, mode, sha, bytes, source, local_path)

def reg(local_name, vm_path, mode_oct, sha, sz, source, local_path):
    extracted[local_name] = (vm_path, mode_oct, sha, sz, source, local_path)

reg("zone-netns-setup.sh",      "/usr/local/sbin/zone-netns-setup.sh",           "0755", sha_setup,   sz_setup,   "SSOT §2", lp_setup)
reg("zone-root.nft",            "/etc/zone/zone-root.nft",                        "0644", sha_nft,     sz_nft,     "SSOT §3", lp_nft)
reg("zone-root-nft.service",    "/etc/systemd/system/zone-root-nft.service",      "0644", sha_rootnft, sz_rootnft, "SSOT §3", lp_rootnft)

for unit_name, unit_content in broker_units:
    if unit_name not in broker_map:
        print(f"  WARNUNG: Unbekannte Unit '{unit_name}' in Broker-Fence — übersprungen")
        continue
    vm_path = broker_map[unit_name]
    lp, sha, sz = write_file(unit_name, unit_content, vm_path, "0644", "SSOT §3")
    reg(unit_name, vm_path, "0644", sha, sz, "SSOT §3", lp)

# ─── §4: zone-hardening.conf (```ini, L302-332) ──────────────────
# Erstes ```ini nach den Broker-Units (nach L291)
fence_hard_open, fence_hard_close = find_fence("ini", start_search=fence_broker_close + 1)
print(f"[§4] zone-hardening.conf fence: L{fence_hard_open}–L{fence_hard_close}")
content_hard = content_to_str(get_fence_content(fence_hard_open, fence_hard_close))

lp_hard, sha_hard, sz_hard = write_file(
    "zone-hardening.conf", content_hard,
    "/etc/zone/zone-hardening.conf", "0644", "SSOT §4"
)
reg("zone-hardening.conf", "/etc/zone/zone-hardening.conf", "0644", sha_hard, sz_hard, "SSOT §4", lp_hard)

# ─── §4: zone-seat@.service (```ini, L334-364) ───────────────────
fence_seat_open, fence_seat_close = find_fence("ini", start_search=fence_hard_close + 1)
print(f"[§4] zone-seat@.service fence: L{fence_seat_open}–L{fence_seat_close}")
raw_seat = get_fence_content(fence_seat_open, fence_seat_close)
content_seat = content_to_str(raw_seat)

lp_seat, sha_seat, sz_seat = write_file(
    "zone-seat@.service", content_seat,
    "/etc/systemd/system/zone-seat@.service", "0644", "SSOT §4"
)
reg("zone-seat@.service", "/etc/systemd/system/zone-seat@.service", "0644", sha_seat, sz_seat, "SSOT §4", lp_seat)

# ─── §5: zone-seat.nft (```nft, L383-411) ────────────────────────
fence_seatnft_open, fence_seatnft_close = find_fence("nft", start_search=fence_seat_close + 1)
print(f"[§5] zone-seat.nft fence: L{fence_seatnft_open}–L{fence_seatnft_close}")
content_seatnft = content_to_str(get_fence_content(fence_seatnft_open, fence_seatnft_close))

lp_seatnft, sha_seatnft, sz_seatnft = write_file(
    "zone-seat.nft", content_seatnft,
    "/etc/zone/zone-seat.nft", "0644", "SSOT §5"
)
reg("zone-seat.nft", "/etc/zone/zone-seat.nft", "0644", sha_seatnft, sz_seatnft, "SSOT §5", lp_seatnft)

# ─── §5: zone-nft-seat@.service + zone-seat-stop@.service ────────
# Nächstes ```ini nach zone-seat.nft fence
fence_nftseat_open, fence_nftseat_close = find_fence("ini", start_search=fence_seatnft_close + 1)
print(f"[§5] nft-seat+stop fence: L{fence_nftseat_open}–L{fence_nftseat_close}")
nftseat_lines = get_fence_content(fence_nftseat_open, fence_nftseat_close)

nftseat_units = split_multi_unit(nftseat_lines)
print(f"[§5] Units gefunden: {[u[0] for u in nftseat_units]}")

nftseat_map = {
    "zone-nft-seat@.service":  "/etc/systemd/system/zone-nft-seat@.service",
    "zone-seat-stop@.service": "/etc/systemd/system/zone-seat-stop@.service",
}

for unit_name, unit_content in nftseat_units:
    if unit_name not in nftseat_map:
        print(f"  WARNUNG: Unbekannte Unit '{unit_name}' in §5-Fence — übersprungen")
        continue
    vm_path = nftseat_map[unit_name]
    lp, sha, sz = write_file(unit_name, unit_content, vm_path, "0644", "SSOT §5")
    reg(unit_name, vm_path, "0644", sha, sz, "SSOT §5", lp)

# ─── §6: zone-selftest-net.service + zone-selftest-hardening.service ─
# Nächstes ```ini nach dem §5-Fence (selftest-Units, L485-519)
fence_selftest_open, fence_selftest_close = find_fence("ini", start_search=fence_nftseat_close + 1)
print(f"[§6] selftest fence: L{fence_selftest_open}–L{fence_selftest_close}")
selftest_lines = get_fence_content(fence_selftest_open, fence_selftest_close)

selftest_units = split_multi_unit(selftest_lines)
print(f"[§6] selftest Units: {[u[0] for u in selftest_units]}")

selftest_map = {
    "zone-selftest-net.service":       "/etc/systemd/system/zone-selftest-net.service",
    "zone-selftest-hardening.service": "/etc/systemd/system/zone-selftest-hardening.service",
}

for unit_name, unit_content in selftest_units:
    if unit_name not in selftest_map:
        print(f"  WARNUNG: Unbekannte Unit '{unit_name}' in §6-Fence — übersprungen")
        continue
    vm_path = selftest_map[unit_name]
    lp, sha, sz = write_file(unit_name, unit_content, vm_path, "0644", "SSOT §6")
    reg(unit_name, vm_path, "0644", sha, sz, "SSOT §6", lp)

# ─── §6: zone-spawner.service (L524-536) ─────────────────────────
fence_spawner_open, fence_spawner_close = find_fence("ini", start_search=fence_selftest_close + 1)
print(f"[§6] zone-spawner fence: L{fence_spawner_open}–L{fence_spawner_close}")
spawner_lines = get_fence_content(fence_spawner_open, fence_spawner_close)

spawner_units = split_multi_unit(spawner_lines)
print(f"[§6] spawner units: {[u[0] for u in spawner_units]}")

spawner_map = {
    "zone-spawner.service": "/etc/systemd/system/zone-spawner.service",
}

for unit_name, unit_content in spawner_units:
    if unit_name not in spawner_map:
        print(f"  WARNUNG: Unbekannte Unit '{unit_name}' — übersprungen")
        continue
    vm_path = spawner_map[unit_name]
    lp, sha, sz = write_file(unit_name, unit_content, vm_path, "0644", "SSOT §6")
    reg(unit_name, vm_path, "0644", sha, sz, "SSOT §6", lp)

# ─────────────────────────────────────────────────────────────────
# SCHRITT B: Oracle-Scripts aus artifacts/ kopieren
# ─────────────────────────────────────────────────────────────────
oracle_scripts = [
    ("seat-negative-oracle.sh",   "/usr/local/sbin/seat-negative-oracle.sh",   "0755"),
    ("seat-hardening-oracle.sh",  "/usr/local/sbin/seat-hardening-oracle.sh",  "0755"),  # 0755 (ausführbar)
    ("zone-seat-probe.sh",        "/usr/local/sbin/zone-seat-probe.sh",        "0755"),
]

for fname, vm_path, mode in oracle_scripts:
    src = os.path.join(ORACLE_DIR, fname)
    with open(src, "rb") as fh:
        data = fh.read()
    local_path = os.path.join(FILES_DIR, fname)
    with open(local_path, "wb") as fh:
        fh.write(data)
    sha = hashlib.sha256(data).hexdigest()
    reg(fname, vm_path, mode, sha, len(data), "T0244-artifacts/", local_path)
    print(f"[ORACLE] {fname}: {len(data)}B sha256={sha[:16]}…")

# ─────────────────────────────────────────────────────────────────
# SCHRITT C: MANIFEST.tsv
# ─────────────────────────────────────────────────────────────────
manifest_lines = ["vm_target_path\tlocal_file\tquelle\tsha256\tbytes"]
for local_name, (vm_path, mode, sha, sz, source, local_path) in sorted(extracted.items()):
    manifest_lines.append(f"{vm_path}\t{local_name}\t{source}\t{sha}\t{sz}")

with open(MANIFEST, "w", encoding="utf-8") as fh:
    fh.write("\n".join(manifest_lines) + "\n")
print(f"\n[MANIFEST] {MANIFEST} ({len(manifest_lines)-1} Einträge)")

# ─────────────────────────────────────────────────────────────────
# SCHRITT D: zone-avv-user.yaml assemblieren
# ─────────────────────────────────────────────────────────────────

def b64_encode_file(local_path):
    """Base64-encodes a file, einzeilig (kein Newline)."""
    with open(local_path, "rb") as fh:
        data = fh.read()
    encoded = base64.b64encode(data).decode("ascii")
    # Sanity: runde Reise
    decoded = base64.b64decode(encoded)
    sha_orig = hashlib.sha256(data).hexdigest()
    sha_decoded = hashlib.sha256(decoded).hexdigest()
    if sha_orig != sha_decoded:
        raise RuntimeError(f"ROUND-TRIP FEHLER für {local_path}: {sha_orig} != {sha_decoded}")
    return encoded


# Reihenfolge der write_files: Scripts zuerst (sbin), dann /etc/zone, dann systemd-Units
WF_ORDER = [
    # Oracle-Scripts
    ("seat-negative-oracle.sh",   "0755"),
    ("seat-hardening-oracle.sh",  "0755"),
    ("zone-seat-probe.sh",        "0755"),
    # Shell-Script
    ("zone-netns-setup.sh",       "0755"),
    # /etc/zone
    ("zone-root.nft",             "0644"),
    ("zone-seat.nft",             "0644"),
    ("zone-hardening.conf",       "0644"),
    # systemd-Units
    ("zone-root-nft.service",     "0644"),
    ("zone-broker-llm.service",   "0644"),
    ("zone-broker-merkel.service","0644"),
    ("zone-resolver.service",     "0644"),
    ("zone-seat@.service",        "0644"),
    ("zone-nft-seat@.service",    "0644"),
    ("zone-seat-stop@.service",   "0644"),
    ("zone-selftest-net.service", "0644"),
    ("zone-selftest-hardening.service", "0644"),
    ("zone-spawner.service",      "0644"),
]

yaml_lines = [
    "#cloud-config",
    "hostname: zone-avv",
    "ssh_pwauth: false",
    "write_files:",
]

write_files_count = 0
round_trip_errors = []

for local_name, mode in WF_ORDER:
    if local_name not in extracted:
        print(f"  [SKIP cloud-init] {local_name} nicht extrahiert")
        continue
    vm_path, _, sha, sz, source, local_path = extracted[local_name]
    try:
        b64 = b64_encode_file(local_path)
    except RuntimeError as e:
        round_trip_errors.append(str(e))
        print(f"  [FEHLER] {e}")
        continue
    yaml_lines.append(f"  - path: {vm_path}")
    yaml_lines.append(f"    permissions: '{mode}'")
    yaml_lines.append(f"    owner: root:root")
    yaml_lines.append(f"    encoding: b64")
    yaml_lines.append(f"    content: {b64}")
    write_files_count += 1

yaml_lines += [
    "runcmd:",
    "  - [ systemctl, daemon-reload ]",
    "  - [ mkdir, -p, /etc/systemd/system/zone-seat@.service.d ]",
    "  - [ ln, -sf, /etc/zone/zone-hardening.conf, /etc/systemd/system/zone-seat@.service.d/10-hardening.conf ]",
    "  - [ systemctl, enable, zone-root-nft.service, zone-selftest-hardening.service ]",
    "# NOTE: zone-netns-setup.service ist NICHT in SSOT als Unit vorhanden — siehe GAP-REPORT",
]

with open(CLOUD_INIT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(yaml_lines) + "\n")

cloud_init_size = os.path.getsize(CLOUD_INIT)
print(f"\n[CLOUD-INIT] {CLOUD_INIT}")
print(f"  write_files: {write_files_count} Einträge, {cloud_init_size} Bytes")

if round_trip_errors:
    print(f"\n[FATAL] Round-Trip-Fehler:")
    for e in round_trip_errors:
        print(f"  {e}")
    sys.exit(1)
else:
    print("  Round-Trip: OK (alle base64 sha256-verifiziert)")

# ─────────────────────────────────────────────────────────────────
# SCHRITT E: Summary
# ─────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("EXTRAHIERTE DATEIEN:")
print("="*70)
for local_name, (vm_path, mode, sha, sz, source, local_path) in sorted(extracted.items()):
    print(f"  {vm_path}")
    print(f"    local: {local_name}  mode={mode}  {sz}B  sha256={sha[:12]}…  [{source}]")

# ─────────────────────────────────────────────────────────────────
# SCHRITT F: GAP-REPORT (in den extrahierten Daten; kein File)
# ─────────────────────────────────────────────────────────────────
ALL_EXPECTED_UNITS = [
    "zone-netns-setup.service",
    "zone-root-nft.service",
    "zone-broker-llm.service",
    "zone-broker-merkel.service",
    "zone-resolver.service",
    "zone-nft-seat@.service",
    "zone-seat@.service",
    "zone-selftest-net.service",
    "zone-selftest-hardening.service",
    "zone-selftest-broker.service",
    "zone-spawner.service",
    "zone-coordinator.service",
]

with open(SSOT, "r", encoding="utf-8") as fh:
    ssot_text = fh.read()

print("\n" + "="*70)
print("GAP-REPORT: Units vs. SSOT")
print("="*70)
for unit in ALL_EXPECTED_UNITS:
    present = unit in extracted
    status = "VORHANDEN" if present else "FEHLT"
    if not present:
        # Suche ob in SSOT referenziert
        refs = []
        for keyword in ["Requires=", "After=", "Before=", "BindsTo=", "PartOf=", "ExecStartPre=", "OnFailure="]:
            if f"{keyword}{unit}" in ssot_text or f"{keyword}…{unit}" in ssot_text:
                refs.append(keyword)
        # Einfachere Suche: kommt der Name überhaupt vor?
        count = ssot_text.count(unit)
        ref_str = f"→ {', '.join(refs)} referenziert" if refs else ""
        print(f"  [{status}] {unit}  (im SSOT {count}× erwähnt) {ref_str}")
    else:
        print(f"  [{status}] {unit}")

print("\n[FERTIG]")
