#!/usr/bin/env python3
"""Seeded, fake-backed Proxmox-GUI API for generating README screenshots.

This runs the *real* FastAPI backend (real auth, real routes, real schemas) but
replaces the live Proxmox connection with an in-process ``FakeProxmox`` double
that serves a hand-crafted, **entirely fictional** inventory. No real cluster,
no real VMs, no real IPs — safe to publish in a public repo.

Why a real backend instead of mocking the HTTP API in the browser? Because the
backend produces guaranteed schema-correct JSON, so the SvelteKit UI renders
exactly as it would in production — pixel-faithful, not a hand-faked payload.

Run from the repo's ``backend/`` dir with the project venv:

    cd backend && .venv/bin/python ../scripts/demo-screenshots/demo_server.py

Listens on 127.0.0.1:8000. Seeds an admin (``admin`` / ``demo-admin``) the
first time, then serves. Idempotent — re-running reuses the seeded DB.
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys

# ---------------------------------------------------------------------------
# 1. Environment MUST be set before importing app.config (Settings reads env
#    at import time). Local-only demo posture: ephemeral file DB + fixed master
#    key + insecure cookies (so http://localhost works without TLS).
# ---------------------------------------------------------------------------
DB_PATH = "/tmp/proxmox-gui-demo.db"
KEY_PATH = "/tmp/proxmox-gui-demo-master.key"

os.environ["PROXMOX_GUI_DATABASE_URL"] = f"sqlite+aiosqlite:///{DB_PATH}"
os.environ["PROXMOX_GUI_MASTER_KEY_PATH"] = KEY_PATH
os.environ["PROXMOX_GUI_COOKIE_SECURE"] = "false"

# Deterministic 32-byte master key so the seed step and the uvicorn lifespan
# decrypt the same EncryptedSecret columns.
key_file = pathlib.Path(KEY_PATH)
if not key_file.exists():
    key_file.write_bytes(b"proxmox-gui-demo-master-key-32by")  # exactly 32 bytes
    key_file.chmod(0o600)
assert len(key_file.read_bytes()) == 32, "master key must be exactly 32 bytes"

# Make both `app.*` and `tests.fixtures.*` importable (run with cwd=backend).
BACKEND = pathlib.Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

# ---------------------------------------------------------------------------
# 2. Fictional inventory. All VMs live in pool "gui-platform" so the seeded
#    team token (poolid="gui-platform") surfaces every one of them.
# ---------------------------------------------------------------------------
GIB = 1024**3
POOL = "gui-platform"

# (vmid, name, type, node, status, cores, mem_gib, disk_gib, tags,
#  cpu_load 0..1, mem_used_frac, uptime_days, description)
VMS = [
    (101, "web-01",       "qemu", "pve-01", "running", 4,  8,   80,  "prod;web;nginx",    0.18, 0.42, 37,  "Frontend reverse proxy + TLS termination"),
    (102, "web-02",       "qemu", "pve-02", "running", 4,  8,   80,  "prod;web;nginx",    0.22, 0.39, 37,  "Frontend reverse proxy (HA peer)"),
    (110, "db-primary",   "qemu", "pve-01", "running", 8,  32,  500, "prod;postgres",     0.41, 0.67, 96,  "PostgreSQL 16 primary"),
    (111, "db-replica",   "qemu", "pve-03", "running", 8,  32,  500, "prod;postgres",     0.27, 0.61, 96,  "PostgreSQL 16 streaming replica"),
    (120, "cache-redis",  "lxc",  "pve-02", "running", 2,  4,   20,  "prod;redis",        0.09, 0.55, 96,  "Redis cache + session store"),
    (130, "app-worker",   "qemu", "pve-03", "running", 4,  8,   60,  "prod;workers",      0.34, 0.48, 21,  "Background job workers (arq)"),
    (140, "ci-runner-01", "lxc",  "pve-01", "running", 4,  8,   100, "ci;ephemeral",      0.61, 0.30, 3,   "GitHub Actions self-hosted runner"),
    (150, "monitoring",   "qemu", "pve-02", "running", 2,  4,   40,  "infra;grafana",     0.12, 0.44, 96,  "Grafana + Prometheus + Loki"),
    (160, "backup-store", "lxc",  "pve-03", "running", 2,  4,   2048,"infra;backup",      0.04, 0.21, 96,  "Restic backup repository"),
    (170, "staging-app",  "qemu", "pve-03", "stopped", 4,  8,   60,  "staging",           0.0,  0.0,  0,   "Staging environment (powered off)"),
    (180, "dev-sandbox",  "qemu", "pve-01", "stopped", 2,  4,   40,  "dev",               0.0,  0.0,  0,   "Throwaway developer sandbox"),
]


def _resource(v: tuple) -> dict:
    vmid, name, vmtype, node, status, cores, mem_gib, disk_gib, tags, cpu, memf, up_d, _desc = v
    maxmem = mem_gib * GIB
    return {
        "vmid": vmid, "name": name, "type": vmtype, "node": node, "status": status,
        "maxcpu": cores, "maxmem": maxmem, "maxdisk": disk_gib * GIB,
        "cpu": cpu, "mem": int(memf * maxmem), "uptime": up_d * 86400,
        "tags": tags, "pool": POOL, "template": 0,
    }


def _status_payload(v: tuple) -> dict:
    vmid, name, vmtype, node, status, cores, mem_gib, disk_gib, tags, cpu, memf, up_d, _desc = v
    maxmem = mem_gib * GIB
    maxdisk = disk_gib * GIB
    running = status == "running"
    return {
        "status": status, "vmid": vmid, "name": name,
        "uptime": up_d * 86400 if running else 0,
        "cpu": cpu, "maxcpu": cores,
        "mem": int(memf * maxmem) if running else 0, "maxmem": maxmem,
        "disk": int(0.33 * maxdisk) if (running and vmtype == "lxc") else 0,
        "maxdisk": maxdisk,
        "netin": vmid * 9_400_000 if running else 0,
        "netout": vmid * 6_100_000 if running else 0,
        "diskread": vmid * 21_000_000 if running else 0,
        "diskwrite": vmid * 12_000_000 if running else 0,
    }


def _config_payload(v: tuple) -> dict:
    vmid, name, vmtype, node, status, cores, mem_gib, disk_gib, tags, cpu, memf, up_d, desc = v
    return {
        "name": name, "cores": cores, "memory": mem_gib * 1024,
        "sockets": 1, "ostype": "l26", "tags": tags, "description": desc,
        "net0": "virtio,bridge=vmbr0", "scsihw": "virtio-scsi-single",
    }


def _rrd(v: tuple) -> list[dict]:
    """~60 one-minute samples with a gentle CPU wave + slow mem ramp."""
    import math

    vmid, name, vmtype, node, status, cores, mem_gib, disk_gib, tags, cpu, memf, up_d, _desc = v
    if status != "running":
        return []
    maxmem = mem_gib * GIB
    base_t = 1_717_000_000
    rows = []
    for i in range(60):
        wave = cpu * (0.75 + 0.5 * (0.5 + 0.5 * math.sin(i / 6.0)))
        mem_ramp = memf * (0.9 + 0.1 * (i / 60.0))
        rows.append({
            "time": base_t + i * 60,
            "cpu": round(min(wave, 1.0), 4),
            "mem": int(mem_ramp * maxmem), "maxmem": maxmem,
            "disk": 0, "maxdisk": disk_gib * GIB,
            "netin": 9_000_000 + i * 130_000, "netout": 6_000_000 + i * 90_000,
            "diskread": 18_000_000 + i * 70_000, "diskwrite": 11_000_000 + i * 40_000,
        })
    return rows


def build_responses() -> dict:
    responses: dict = {
        "version.get": {"version": "8.2.4", "release": "8.2", "repoid": "demo-cluster"},
        "cluster.resources.get": [_resource(v) for v in VMS],
    }
    for v in VMS:
        vmid, name, vmtype, node = v[0], v[1], v[2], v[3]
        kind = "lxc" if vmtype == "lxc" else "qemu"
        base = f"nodes.{node}.{kind}.{vmid}"
        responses[f"{base}.status.current.get"] = _status_payload(v)
        responses[f"{base}.config.get"] = _config_payload(v)
        responses[f"{base}.rrddata.get"] = _rrd(v)
    return responses


# ---------------------------------------------------------------------------
# 3. Patch the proxmoxer client BEFORE the app builds any connector.
# ---------------------------------------------------------------------------
from tests.fixtures.pve_responses import FakeProxmox  # noqa: E402
import app.clusters.connector as connector_mod  # noqa: E402

_FAKE = FakeProxmox(responses=build_responses())
connector_mod.ProxmoxAPI = lambda *a, **k: _FAKE  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# 4. Migrate + seed the demo tenant (idempotent).
# ---------------------------------------------------------------------------
async def seed() -> None:
    from pathlib import Path as _P

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.cipher import SecretCipher
    from app.core.db import engine, run_migrations
    from app.core.passwords import hash_password
    from app.models._types_init import install_cipher
    from app.models import (
        Cluster, Team, TeamClusterToken, TeamMembership, User,
    )

    install_cipher(SecretCipher.from_file(_P(KEY_PATH)))
    await run_migrations()

    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as db:
        existing = (await db.execute(select(User).where(User.username == "admin"))).scalar_one_or_none()
        if existing is not None:
            print("seed: admin already present — reusing DB")
            return

        admin = User(
            username="admin", email="admin@demo.local",
            password_hash=hash_password("demo-admin"),
            is_admin=True, is_active=True,
        )
        db.add(admin)
        await db.flush()

        team = Team(name="Platform", personal=False, is_active=True)
        db.add(team)
        await db.flush()
        db.add(TeamMembership(team_id=team.id, user_id=admin.id))

        cluster = Cluster(
            name="Homelab", host="pve.demo.local", port=8006, verify_ssl=False,
            token_user="root@pam", token_name="gui",
            api_token_secret="demo-admin-token", is_active=True,
            notes="Fictional demo cluster — no real host.",
        )
        db.add(cluster)
        await db.flush()

        db.add(TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id,
            userid="gui-platform@pve", tokenid="api",
            token_secret="demo-team-token", poolid=POOL,
        ))
        await db.commit()
        print(f"seed: created admin / Platform team / cluster {cluster.id} ({len(VMS)} VMs)")


def main() -> None:
    import uvicorn

    asyncio.run(seed())
    from app.main import app  # imported after patch + seed
    print("demo backend listening on http://127.0.0.1:8000  (admin / demo-admin)")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


if __name__ == "__main__":
    main()
