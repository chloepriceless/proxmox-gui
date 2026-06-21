import re
DIRECTIVE = re.compile(r'^[A-Za-z][A-Za-z0-9]*=')
SSOT="01-netns-enforcement-SSOT.md"
src=open(SSOT,encoding='utf-8').read().split('\n')
out=[]; in_ini=False; changed=0
for ln in src:
    if ln.startswith('```'):
        in_ini = ln.strip()=='```ini'
        out.append(ln); continue
    if in_ini:
        st=ln.lstrip()
        if not (st.startswith('#') or st.startswith(';') or st.startswith('[') or st=='' or '#' not in ln) and DIRECTIVE.match(ln):
            i=ln.index('#')
            out.append(ln[:i].rstrip()); # directive clean
            out[-1:]=[ln[i:].rstrip(), ln[:i].rstrip()]  # comment above, then directive
            changed+=1; continue
    out.append(ln)
open(SSOT,'w',encoding='utf-8').write('\n'.join(out))
print(f"SSOT: {changed} Inline-Kommentar-Zeilen relokiert")
