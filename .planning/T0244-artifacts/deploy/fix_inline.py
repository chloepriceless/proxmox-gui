import sys, re
DIRECTIVE = re.compile(r'^[A-Za-z][A-Za-z0-9]*=')
def fix_systemd_block(lines):
    """Relocate inline '#'-comments on systemd directive lines to their own line above.
       Safe ONLY because no directive VALUE here contains a literal '#'."""
    out=[]
    for ln in lines:
        s=ln.rstrip('\n')
        st=s.lstrip()
        if st.startswith('#') or st.startswith(';') or st.startswith('[') or st=='' or '#' not in s:
            out.append(s); continue
        if DIRECTIVE.match(s):
            i=s.index('#')
            directive=s[:i].rstrip()
            comment=s[i:].rstrip()
            out.append(comment)        # eigene Zeile drueber, '#' bleibt
            out.append(directive)
        else:
            out.append(s)
    return out

def fix_pure(path):
    lines=open(path,encoding='utf-8').read().split('\n')
    # trailing newline handling
    trail = lines[-1]==''
    body = lines[:-1] if trail else lines
    fixed=fix_systemd_block(body)
    open(path,'w',encoding='utf-8').write('\n'.join(fixed)+('\n' if trail else ''))

for p in sys.argv[1:]:
    fix_pure(p)
