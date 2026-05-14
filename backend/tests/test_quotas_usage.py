"""TDD RED: Tests for quota usage computation (compute_team_usage).

Written BEFORE implementation — expected to fail until app/quotas/usage.py is created.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_team(session_factory, *, poolid: str = "gui-team-1"):
    """Seed a Cluster + Team + TeamClusterToken row."""
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        user = User(
            username="u1",
            email="u1@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(name="team-1", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        session.add(TeamMembership(team_id=team.id, user_id=user.id))

        cluster = Cluster(
            name="c1",
            host="c1.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()

        tok = TeamClusterToken(
            team_id=team.id,
            cluster_id=cluster.id,
            userid="gui-team-1@pve",
            tokenid="api",
            token_secret="tok-secret",
            poolid=poolid,
        )
        session.add(tok)
        await session.commit()
        await session.refresh(cluster)
        return team.id, cluster.id, poolid


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_compute_team_usage_filters_by_pool(session_factory):
    """Only resources in the team's pool contribute to usage."""
    from tests.fixtures.pve_responses import FakeProxmox

    team_id, cluster_id, poolid = await _seed_cluster_and_team(
        session_factory, poolid="gui-team-1"
    )

    resources = [
        # In-pool VM
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 4, "maxmem": 4 * 1024**3, "maxdisk": 50 * 1024**3},
        # Different pool — must be ignored
        {"vmid": 200, "type": "qemu", "node": "n1", "pool": "gui-team-99",
         "maxcpu": 8, "maxmem": 8 * 1024**3, "maxdisk": 100 * 1024**3},
    ]

    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", resources)
    fake.queue_response("cluster.resources.get", [])  # type=lxc call returns empty

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):

        from app.clusters.registry import PVEConnectorRegistry

        registry = PVEConnectorRegistry(None, session_factory)

        from app.quotas.usage import compute_team_usage

        async with session_factory() as db:
            usage = await compute_team_usage(
                db, registry, team_id=team_id, cluster_id=cluster_id
            )

    assert usage.cpu_cores == 4
    assert usage.ram_bytes == 4 * 1024**3
    assert usage.disk_bytes == 50 * 1024**3
    assert usage.vm_count == 1
    assert usage.lxc_count == 0


@pytest.mark.asyncio
async def test_compute_team_usage_no_token_returns_zero(session_factory):
    """When no TeamClusterToken exists, returns QuotaUsage() defaults."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.usage import compute_team_usage

    registry = PVEConnectorRegistry(None, session_factory)

    async with session_factory() as db:
        usage = await compute_team_usage(
            db, registry, team_id=9999, cluster_id=9999
        )

    assert usage.cpu_cores == 0
    assert usage.ram_bytes == 0
    assert usage.disk_bytes == 0
    assert usage.vm_count == 0
    assert usage.lxc_count == 0


@pytest.mark.asyncio
async def test_compute_team_usage_sums_mixed_qemu_lxc(session_factory):
    """2 qemu + 1 lxc in pool: vm_count=2, lxc_count=1, sums correct."""
    from tests.fixtures.pve_responses import FakeProxmox

    team_id, cluster_id, poolid = await _seed_cluster_and_team(
        session_factory, poolid="gui-team-2"
    )

    vms = [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 2, "maxmem": 2 * 1024**3, "maxdisk": 20 * 1024**3},
        {"vmid": 101, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 4, "maxmem": 4 * 1024**3, "maxdisk": 40 * 1024**3},
    ]
    lxcs = [
        {"vmid": 200, "type": "lxc", "node": "n1", "pool": poolid,
         "maxcpu": 1, "maxmem": 1024**3, "maxdisk": 10 * 1024**3},
    ]

    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", vms)
    fake.queue_response("cluster.resources.get", lxcs)

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        from app.clusters.registry import PVEConnectorRegistry

        registry = PVEConnectorRegistry(None, session_factory)
        from app.quotas.usage import compute_team_usage

        async with session_factory() as db:
            usage = await compute_team_usage(
                db, registry, team_id=team_id, cluster_id=cluster_id
            )

    assert usage.vm_count == 2
    assert usage.lxc_count == 1
    assert usage.cpu_cores == 7
    assert usage.ram_bytes == 7 * 1024**3
    assert usage.disk_bytes == 70 * 1024**3
