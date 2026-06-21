import os,re,sys
SSOT="01-netns-enforcement-SSOT.md"
FILES="deploy/files"
# 1. SSOT: ini-Fences einsammeln, in per-Datei-Chunks splitten (Header '# /pfad')
chunks={}   # basename -> [lines]
in_ini=False; cur=None
HDR=re.compile(r'^#\s+(/etc/\S+|/usr/\S+)')
for ln in open(SSOT,encoding='utf-8').read().split('\n'):
    if ln.startswith('```'):
        in_ini = ln.strip()=='```ini'; 
        if not in_ini: cur=None
        continue
    if in_ini:
        m=HDR.match(ln)
        if m:
            cur=os.path.basename(m.group(1)); chunks[cur]=[]
        if cur is not None: chunks[cur].append(ln)
def directives(lines):
    return [l.rstrip() for l in lines if l.strip() and not l.lstrip().startswith('#') and not l.lstrip().startswith(';')]
# 2. Vergleich je systemd-Datei
bad=0; checked=0
for name in sorted(os.listdir(FILES)):
    if not (name.endswith('.service') or name=='zone-hardening.conf'): continue
    checked+=1
    fpath=os.path.join(FILES,name)
    fdir=directives(open(fpath,encoding='utf-8').read().split('\n'))
    if name not in chunks:
        print(f"DRIFT {name}: nicht in SSOT-Chunks gefunden"); bad=1; continue
    sdir=directives(chunks[name])
    if fdir!=sdir:
        bad=1; print(f"DRIFT {name}:")
        only_f=[d for d in fdir if d not in sdir]; only_s=[d for d in sdir if d not in fdir]
        for d in only_f: print(f"   nur deploy: {d}")
        for d in only_s: print(f"   nur SSOT  : {d}")
print(f"\n{checked} systemd-Dateien geprüft, {'ALLE Direktiven konsistent ✅' if bad==0 else 'DRIFT gefunden ⚠️'}")
sys.exit(bad)
