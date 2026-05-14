"""TDD RED: Tests for RRD metrics endpoint.

Written BEFORE implementation — expected to fail until app/inventory/rrd.py exists.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
    RRD_HOUR,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_full(session_factory, *, team_id: int = 50, poolid: str = "gui-team-42") -> tuple:
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        user = User(
            username=f"rrd-u{team_id}",
            email=f"rrd-user-{team_id}@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        membership = TeamMembership(team_id=team.id, user_id=user.id)
        session.add(membership)

        cluster = Cluster(
            name="rrd-cluster",
            host="pve-rrd.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id,
            cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve",
            tokenid="api",
            token_secret=f"team-{team_id}-secret",
            poolid=poolid,
        )
        session.add(token)
        await session.commit()
        await session.refresh(user)
        await session.refresh(cluster)
        return user, cluster.id, team.id


def _make_principal(user):
    from app.auth.dependencies import Principal

    return Principal(user=user, mode="session")


async def _make_resolved(session_factory, registry, principal, cluster_id, vmid=100):
    from app.inventory.access import resolve_resource

    async with session_factory() as db:
        return await resolve_resource(
            db=db,
            registry=registry,
            principal=principal,
            cluster_id=cluster_id,
            vmid=vmid,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_vm_rrd_default_hour_average(session_factory):
    """RRD call returns samples; first sample has correct cpu value."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.schemas import RRDQuery
    from app.inventory.service import get_vm_rrd

    user, cluster_id, team_id = await _seed_full(session_factory, team_id=50, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,
        "nodes.pve-01.qemu.100.rrddata.get": RRD_HOUR,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resolved = await _make_resolved(session_factory, registry, principal, cluster_id)
        query = RRDQuery(timeframe="hour", cf="AVERAGE")
        samples = await get_vm_rrd(resolved=resolved, query=query)

    assert len(samples) == 2
    assert abs(samples[0].cpu - 0.12) < 0.001


@pytest.mark.asyncio
async def test_get_vm_rrd_normalizes_missing_fields_to_zero(session_factory):
    """RRD row with only 'time' key gets all numeric fields defaulted to 0."""
    from app.inventory.rrd import normalize_rrd_samples

    rows = [{"time": 123}]
    samples = normalize_rrd_samples(rows)

    assert len(samples) == 1
    s = samples[0]
    assert s.time == 123
    assert s.cpu == 0.0
    assert s.mem == 0
    assert s.maxmem == 0
    assert s.disk == 0
    assert s.maxdisk == 0
    assert s.netin == 0
    assert s.netout == 0
    assert s.diskread == 0
    assert s.diskwrite == 0


@pytest.mark.asyncio
async def test_get_vm_rrd_empty_rows_returns_empty_list(session_factory):
    """normalize_rrd_samples with empty/None input returns empty list."""
    from app.inventory.rrd import normalize_rrd_samples

    assert normalize_rrd_samples([]) == []
    assert normalize_rrd_samples(None) == []  # type: ignore[arg-type]
