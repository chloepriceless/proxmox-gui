"""TDD RED: Tests for quota service layer (list_team_quotas, set_team_quotas, get_my_quotas).

Written BEFORE implementation — expected to fail until app/quotas/service.py is created.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GB = 1024**3


async def _seed_team_and_clusters(
    session_factory,
    *,
    n_clusters: int = 1,
    username: str = "u1",
    poolid_prefix: str = "gui-team",
) -> tuple:
    """Seed User + Team + n_clusters Clusters + TeamClusterTokens."""
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        user = User(
            username=username,
            email=f"{username}@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(name=f"team-{username}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        session.add(TeamMembership(team_id=team.id, user_id=user.id))

        cluster_ids = []
        for i in range(n_clusters):
            cluster = Cluster(
                name=f"c{i}",
                host=f"c{i}.test",
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
                userid=f"gui-team-{team.id}@pve",
                tokenid="api",
                token_secret="tok-secret",
                poolid=f"{poolid_prefix}-{team.id}-c{i}",
            )
            session.add(tok)
            cluster_ids.append(cluster.id)

        await session.commit()
        await session.refresh(user)
        return team.id, cluster_ids, user


def _fake_for(poolids: list[str], per_cluster_resources=None):
    """Return a fresh FakeProxmox pre-loaded with empty resources for each poolid."""
    from tests.fixtures.pve_responses import FakeProxmox

    fake = FakeProxmox()
    if per_cluster_resources:
        for resources in per_cluster_resources:
            fake.queue_response("cluster.resources.get", resources)
            fake.queue_response("cluster.resources.get", [])  # lxc call
    else:
        for _ in poolids:
            fake.queue_response("cluster.resources.get", [])  # vm call
            fake.queue_response("cluster.resources.get", [])  # lxc call
    return fake


def _make_admin_principal(user):
    from app.auth.dependencies import Principal

    return Principal(user=user, mode="session")


# ---------------------------------------------------------------------------
# Tests: list_team_quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_team_quotas_returns_one_row_per_bound_cluster(session_factory):
    """team bound to 2 clusters; one has Quota row, other doesn't → 2 rows."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Quota
    from app.quotas.service import list_team_quotas

    team_id, cluster_ids, _ = await _seed_team_and_clusters(
        session_factory, n_clusters=2
    )

    # Add Quota only for first cluster
    async with session_factory() as session:
        session.add(Quota(
            team_id=team_id,
            cluster_id=cluster_ids[0],
            cpu_cores=8,
            updated_at=datetime.utcnow(),
        ))
        await session.commit()

    fake = _fake_for([f"pool-{i}" for i in range(2)])
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        async with session_factory() as db:
            page = await list_team_quotas(db, registry, team_id=team_id)

    assert len(page.rows) == 2
    # The cluster with a quota row has cpu_cores=8; the other is unlimited (None)
    rows_by_cid = {r.cluster_id: r for r in page.rows}
    assert rows_by_cid[cluster_ids[0]].limit.cpu_cores == 8
    assert rows_by_cid[cluster_ids[1]].limit.cpu_cores is None


@pytest.mark.asyncio
async def test_list_team_quotas_team_not_found_raises_404(session_factory):
    """team_id=9999 raises HTTPException(404)."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.service import list_team_quotas

    registry = PVEConnectorRegistry(None, session_factory)
    with pytest.raises(HTTPException) as exc_info:
        async with session_factory() as db:
            await list_team_quotas(db, registry, team_id=9999)
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Tests: set_team_quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_team_quotas_upserts_and_audits(session_factory):
    """Admin sets quotas: Quota row created + AuditLog row with quota.update."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import AuditLog, Quota
    from app.quotas.schemas import QuotaLimit, QuotaLimitsUpdate
    from app.quotas.service import set_team_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(session_factory)
    principal = _make_admin_principal(user)
    payload = QuotaLimitsUpdate(
        rows=[QuotaLimit(cluster_id=cluster_ids[0], cpu_cores=16, ram_gb=64, disk_gb=500, vm_count=10)],
        allow_over=False,
    )

    fake = _fake_for(["pool"])
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        async with session_factory() as db:
            await set_team_quotas(
                db, registry, principal=principal, team_id=team_id,
                payload=payload, source_ip="127.0.0.1",
            )

    # Verify the Quota row was created
    async with session_factory() as session:
        from sqlalchemy import select
        q = (await session.execute(
            select(Quota).where(Quota.team_id == team_id)
        )).scalar_one_or_none()
        assert q is not None
        assert q.cpu_cores == 16
        assert q.ram_bytes == 64 * _GB
        assert q.disk_bytes == 500 * _GB
        assert q.vm_count == 10

        # Verify audit row
        audit = (await session.execute(
            select(AuditLog).where(AuditLog.action == "quota.update")
        )).scalar_one_or_none()
        assert audit is not None
        assert audit.team_id == team_id
        assert audit.cluster_id == cluster_ids[0]


@pytest.mark.asyncio
async def test_set_team_quotas_lowering_below_usage_returns_409(session_factory):
    """Setting cpu_cores=10 when usage=20 (allow_over=False) → 409."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.schemas import QuotaLimit, QuotaLimitsUpdate
    from app.quotas.service import set_team_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(session_factory)
    principal = _make_admin_principal(user)
    payload = QuotaLimitsUpdate(
        rows=[QuotaLimit(cluster_id=cluster_ids[0], cpu_cores=10)],
        allow_over=False,
    )

    # Fake: usage has 20 cpus
    from tests.fixtures.pve_responses import FakeProxmox

    poolid = f"gui-team-{team_id}-c0"
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 20, "maxmem": 0, "maxdisk": 0},
    ])
    fake.queue_response("cluster.resources.get", [])  # lxc call

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        with pytest.raises(HTTPException) as exc_info:
            async with session_factory() as db:
                await set_team_quotas(
                    db, registry, principal=principal, team_id=team_id,
                    payload=payload, source_ip="127.0.0.1",
                )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["cluster_id"] == cluster_ids[0]


@pytest.mark.asyncio
async def test_set_team_quotas_allow_over_bypasses_409(session_factory):
    """Same usage > limit scenario but allow_over=True → succeeds + audited."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import AuditLog, Quota
    from app.quotas.schemas import QuotaLimit, QuotaLimitsUpdate
    from app.quotas.service import set_team_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(
        session_factory, username="u_allowover"
    )
    principal = _make_admin_principal(user)
    payload = QuotaLimitsUpdate(
        rows=[QuotaLimit(cluster_id=cluster_ids[0], cpu_cores=10)],
        allow_over=True,
    )

    from tests.fixtures.pve_responses import FakeProxmox

    poolid = f"gui-team-{team_id}-c0"
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 20, "maxmem": 0, "maxdisk": 0},
    ])
    fake.queue_response("cluster.resources.get", [])  # lxc

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        async with session_factory() as db:
            page = await set_team_quotas(
                db, registry, principal=principal, team_id=team_id,
                payload=payload, source_ip="127.0.0.1",
            )

    assert page is not None
    # Verify quota row was updated
    async with session_factory() as session:
        from sqlalchemy import select
        q = (await session.execute(
            select(Quota).where(Quota.team_id == team_id)
        )).scalar_one_or_none()
        assert q is not None
        assert q.cpu_cores == 10

        # Audit still written
        audit = (await session.execute(
            select(AuditLog).where(AuditLog.action == "quota.update")
        )).scalar_one_or_none()
        assert audit is not None


@pytest.mark.asyncio
async def test_set_team_quotas_rejects_unbound_cluster_422(session_factory):
    """PUT rows includes cluster_id not bound to team → 422."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.schemas import QuotaLimit, QuotaLimitsUpdate
    from app.quotas.service import set_team_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(session_factory)
    principal = _make_admin_principal(user)

    # Use a cluster_id that doesn't belong to this team
    payload = QuotaLimitsUpdate(
        rows=[QuotaLimit(cluster_id=9999, cpu_cores=8)],
        allow_over=False,
    )

    registry = PVEConnectorRegistry(None, session_factory)
    with pytest.raises(HTTPException) as exc_info:
        async with session_factory() as db:
            await set_team_quotas(
                db, registry, principal=principal, team_id=team_id,
                payload=payload, source_ip="127.0.0.1",
            )

    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_set_team_quotas_team_not_found_404(session_factory):
    """team_id=9999 → 404."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.schemas import QuotaLimit, QuotaLimitsUpdate
    from app.quotas.service import set_team_quotas
    from tests.factories import make_user

    user = await make_user(session_factory, username="admin-404", is_admin=True)
    principal = _make_admin_principal(user)
    payload = QuotaLimitsUpdate(rows=[QuotaLimit(cluster_id=1, cpu_cores=8)])
    registry = PVEConnectorRegistry(None, session_factory)

    with pytest.raises(HTTPException) as exc_info:
        async with session_factory() as db:
            await set_team_quotas(
                db, registry, principal=principal, team_id=9999,
                payload=payload, source_ip="127.0.0.1",
            )

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Tests: get_my_quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_quotas_aggregates_across_clusters(session_factory):
    """User in team with 2 clusters, each cpu_cores=8 → aggregate=16."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Quota
    from app.quotas.service import get_my_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(
        session_factory, n_clusters=2, username="u_agg"
    )
    principal = _make_admin_principal(user)

    # Set quota for both clusters
    async with session_factory() as session:
        for cid in cluster_ids:
            session.add(Quota(
                team_id=team_id,
                cluster_id=cid,
                cpu_cores=8,
                updated_at=datetime.utcnow(),
            ))
        await session.commit()

    fake = _fake_for([f"pool-{i}" for i in range(2)])
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        async with session_factory() as db:
            resp = await get_my_quotas(db, registry, principal=principal)

    assert len(resp.teams) == 1
    team_quota = resp.teams[0]
    assert team_quota.aggregate_limit.cpu_cores == 16  # 8 + 8


@pytest.mark.asyncio
async def test_get_my_quotas_aggregate_none_when_any_unlimited(session_factory):
    """One cluster has cpu_cores=8, other unlimited → aggregate.cpu_cores=None."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Quota
    from app.quotas.service import get_my_quotas

    team_id, cluster_ids, user = await _seed_team_and_clusters(
        session_factory, n_clusters=2, username="u_unlim"
    )
    principal = _make_admin_principal(user)

    # Only set quota for first cluster; second is unlimited
    async with session_factory() as session:
        session.add(Quota(
            team_id=team_id,
            cluster_id=cluster_ids[0],
            cpu_cores=8,
            updated_at=datetime.utcnow(),
        ))
        await session.commit()

    fake = _fake_for([f"pool-{i}" for i in range(2)])
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        async with session_factory() as db:
            resp = await get_my_quotas(db, registry, principal=principal)

    assert len(resp.teams) == 1
    # One cluster has no quota row → unlimited → aggregate is None (unlimited wins)
    assert resp.teams[0].aggregate_limit.cpu_cores is None
