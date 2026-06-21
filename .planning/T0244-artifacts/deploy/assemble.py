import base64, hashlib, os, re, sys
ART = os.path.dirname(os.path.abspath(__file__))          # .../deploy
ROOT = os.path.dirname(ART)                                # .../T0244-artifacts
FILES = os.path.join(ART, "files")
SSOT = os.path.join(ROOT, "01-netns-enforcement-SSOT.md")

# --- 1. zone-netns-setup.service lossless aus der SSOT extrahieren (§2.1) ---
src = open(SSOT, encoding="utf-8").read().splitlines()
hdr = "# /etc/systemd/system/zone-netns-setup.service"
try:
    i = next(n for n,l in enumerate(src) if l.strip() == hdr)
except StopIteration:
    sys.exit("FATAL: zone-netns-setup.service header not found in SSOT")
# Inhalt = ab Header bis zur naechsten ```-Zeile (exklusiv)
j = i
while j < len(src) and not src[j].startswith("```"):
    j += 1
content = "\n".join(src[i:j]) + "\n"
open(os.path.join(FILES,"zone-netns-setup.service"),"w",encoding="utf-8").write(content)
print(f"[extract] zone-netns-setup.service: SSOT-Zeilen {i+1}-{j} ({len(content)} bytes)")

# --- 2. Datei->(VM-Pfad, perms) Mapping ---
def vmpath(name):
    if name.endswith(".service"): return ("/etc/systemd/system/"+name, "0644")
    if name == "zone-netns-setup.sh": return ("/usr/local/sbin/"+name, "0755")
    if name in ("zone-root.nft","zone-seat.nft","zone-hardening.conf"): return ("/etc/zone/"+name, "0644")
    sys.exit("FATAL: kein Mapping fuer "+name)

entries = []   # (vm_path, perms, local_abs)
ORACLES = ("seat-negative-oracle.sh","seat-hardening-oracle.sh","zone-seat-probe.sh")
for name in sorted(os.listdir(FILES)):
    if name in ORACLES: continue           # kanonisch aus Parent, kein Duplikat
    fp = os.path.join(FILES,name)
    if not os.path.isfile(fp): continue
    vp, perm = vmpath(name)
    entries.append((vp, perm, fp))
# 3 vorhandene Oracle-Scripts aus dem Parent-Dir
for name in ("seat-negative-oracle.sh","seat-hardening-oracle.sh","zone-seat-probe.sh"):
    entries.append(("/usr/local/sbin/"+name, "0755", os.path.join(ROOT,name)))

# --- 3. YAML emittieren + Round-Trip-Assert ---
out = ["#cloud-config","hostname: zone-avv","ssh_pwauth: false","write_files:"]
manifest = []
for vp, perm, local in sorted(entries):
    raw = open(local,"rb").read()
    b64 = base64.b64encode(raw).decode("ascii")          # einzeilig
    assert base64.b64decode(b64) == raw, "roundtrip FAIL "+vp
    sh = hashlib.sha256(raw).hexdigest()
    out += [f"  - path: {vp}", f"    permissions: '{perm}'",
            "    owner: root:root", "    encoding: b64", f'    content: "{b64}"']
    manifest.append((vp, perm, len(raw), sh))
out += ["runcmd:",
        "  - [ systemctl, daemon-reload ]",
        "  - [ mkdir, -p, /etc/systemd/system/zone-seat@.service.d ]",
        "  - [ ln, -sf, /etc/zone/zone-hardening.conf, /etc/systemd/system/zone-seat@.service.d/10-hardening.conf ]",
        ""]
yaml = "\n".join(out)
open(os.path.join(ART,"zone-avv-vendor.yaml"),"w",encoding="utf-8").write(yaml)

# Manifest schreiben
with open(os.path.join(ART,"MANIFEST.tsv"),"w") as f:
    f.write("vm_path\tperms\tbytes\tsha256\n")
    for vp,perm,n,sh in manifest: f.write(f"{vp}\t{perm}\t{n}\t{sh}\n")

print(f"[assemble] {len(entries)} write_files, YAML {len(yaml)} bytes, alle Round-Trips OK")
print("[runcmd] daemon-reload + drop-in-symlink ; KEIN systemctl enable (D7-rev: netz-los kein nft-Binary)")
