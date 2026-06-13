# LXC-Build-Playbook — Verteiltes Fleet (T-0204, Schraubi)

**INSTALL-READY DRAFT. GATED:** Ausführung erst nach Christins Topologie-Entscheid (Szenario R/C,
siehe `3-NODE-DISTRIBUTED-FLEET-DESIGN.md`) + R22-Codex-Refute + Schnüffi (Bind) + Netzi (nftables).
Befehle auf den Nodes als `root` (`ssh -i ~/.ssh/orchestrator_ed25519 root@<node>`). **proxmox/.240
ist TABU.** Hier steht das WIE — nichts davon jetzt ausführen.

## 0. Topologie (zwei LXC-Typen)
- **fleet-core-LXC** (1×): broker:7899 + agent-master:7890 + wa-bridge + telegram-bridge + spawnerd.
  Klein (2–3 G/2 vCPU/20 G), auf **ZFS (pz3 primary / pz1 failover)**, **Proxmox-HA + ZFS-Repl**.
- **peer-runner-LXC** (pro Node): hält die diesem Node zugewiesenen Peer-tmux-Sessions, Repos lokal
  geklont. Sizing je nach Node-Budget (Tabelle im Design-Doc). KEIN Proxmox-HA (Controller respawnt).

## 1. Template + Storage je Node
```bash
# Debian-13-Template sicherstellen (einmalig je Node):
pveam update && pveam available | grep debian-13
pveam download local debian-13-standard_*_amd64.tar.zst   # falls fehlt

# Storage je Node (gemessen):
#   pz3/pz1 -> Samsung_1TB (zfspool, ZFS)         | rootfs auf ZFS -> ZFS-Repl möglich
#   pz2     -> nvme (lvm, KEIN ZFS) ODER local-lvm | rootfs auf LVM  -> git-only-Failover
#   pve     -> Samsung_4TB (dir) / local-lvm       | git-only-Failover
```

## 2. fleet-core-LXC (Beispiel: ID 160 auf pz3)
```bash
# AUF pz3:
pct create 160 local:vztmpl/debian-13-standard_*_amd64.tar.zst \
  --hostname fleet-core --cores 2 --memory 3072 --swap 2048 \
  --rootfs Samsung_1TB:20 --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1 --unprivileged 1 --onboot 1 --start 1
# (nesting=1 nötig für tmux/Node-Subprozesse; unprivileged ok für reine Node/Python-Dienste)

# ZFS-Replikation pz3 -> pz1 (1-Min, wie die 5 Bestands-Services):
pvesr create-local-job 160-0 pz1 --schedule '*/1' --rate 0
pvesr status   # nach 2 Min: State=OK, kein FailCount (vgl. kaputter 102-0!)

# HA-Enrollment + Affinity (PVE9 HA-Rules):
ha-manager add ct:160 --state started --max_restart 3 --max_relocate 3
# Affinity preferred pz3, erlaubt pz1:
ha-manager rules add node-affinity ha-fleet-core --nodes 'pz3:2,pz1:1' --resources ct:160 --strict 0
```

## 3. peer-runner-LXC je Node (Beispiel-IDs)
```bash
# pz2 (NVMe, CPU-leichte Peers), z.B. ID 161:
pct create 161 <tmpl> --hostname fleet-pz2 --cores 4 --memory 4096 --swap 4096 \
  --rootfs nvme:60 --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1 --unprivileged 1 --onboot 1 --start 1
# pz3 (ZFS), ID 162: --rootfs Samsung_1TB:40 ; pz1 ID 163: --rootfs Samsung_1TB:40
# pve (16c, schwere Peers), ID 164: --cores 8 --memory 12288 --rootfs Samsung_4TB:60
# peer-runner: KEIN HA. ZFS-Repl optional nur für pz3/pz1 (git ist der primäre State-Layer).
```

## 4. Toolchain im LXC (alle)
```bash
pct exec <id> -- bash -c '
  apt-get update && apt-get install -y curl git tmux python3 python3-pip jq ca-certificates ttyd
  # Node v22 (Ist-Version v22.22.3):
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  # bun (für Broker/MCP):
  curl -fsSL https://bun.sh/install | bash
  # claude-code CLI (Ist v2.1.175):
  npm i -g @anthropic-ai/claude-code
  node --version; tmux -V; python3 --version; which ttyd bun
'
```

## 5. Payload-Migration (Live, repeatable; finaler Delta im Wartungsfenster)
```bash
# ~30 Repos + .secrets + codex/ + spawner/ + sentinel/ etc. (~33 G) vom Coding-Workspace.
# VORSEEDEN vor Cutover (33G über 2,5G ≈ 2–3 min) -> NICHT im Steady-Path:
rsync -aHAX --info=progress2 \
  --exclude 'node_modules' --exclude '.git/objects' \
  chrissi@192.168.42.42:/home/dev/  root@<node>:/home/dev/
# .git/objects via git clone/pull (kleiner als rsync der losen Objekte).
# Wartungsfenster: Coding-Fleet quiescen -> finaler rsync-Delta -> Dienste scharf.
```

## 6. systemd-Units (aus build-ready/systemd/)
Siehe `systemd/README.md`. Kurz: fleet-core-LXC bekommt broker/agent-master/wa-bridge/
telegram-bridge/spawner; peer-runner bekommt nur spawnerd (lokaler Teil). `enable --now`, dann
`systemctl is-enabled …` = alle `enabled` (Backup-Reboot-resilient).

## 7. Netz (Baustein 3) + Grid (Baustein 2)
- broker/agent-master auf LAN binden + **host-nftables-Allowlist** (Netzi-Regelset, src 42/20/16).
- ttyd-Grid je Node (`ttyd/README.md`, Option A: ein ttyd/Node + Landing-Seite im :7890-Dashboard).

## 8. Verify (R31 — gemessen, nicht „sieht gut aus")
- `pvesr status` → fleet-core-Job `OK`, FailCount 0.
- vom Coder-Workspace: `send_message` an einen Peer im LXC kommt an (Cross-Host-Bus).
- `systemctl is-enabled` alle Units `enabled`; Reboot-Test (kommt alles hoch?).
- Failover-Drill: peer-runner-Node stoppen → Controller respawnt essential-Peers auf Survivor
  (git pull + frische Session liest RESUME) → messen: kommt der Peer im Broker wieder online?
- **Replication-Health-Monitoring** (Kuma) für den fleet-core-Job — der Bestands-Job 102-0 ist seit
  19.05. still kaputt (FailCount 1158) → beweist: Repl-Jobs verrotten lautlos, MUSS überwacht werden.

## 9. Rollback
Coding-Workspace bleibt bis Stabilität als Fallback. Rollback = Fleet im LXC stoppen, Coding-Fleet
wieder scharf. Repos/State in git → kein Datenverlust.
