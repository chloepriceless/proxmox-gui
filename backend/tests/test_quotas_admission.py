"""TDD RED: Tests for quota admission primitive (check_and_preview).

Written BEFORE implementation — expected to fail until app/quotas/admission.py is created.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_full(
    session_factory,
    *,
    poolid: str = "gui-team-1",
    cpu_cores: int | None = None,
    ram_bytes: int | None = None,
    disk_bytes: int | None = None,
    vm_count: int | None = None,
    with_quota: bool = True,
) -> tuple:
    """Seed User + Team + Cluster + TeamClusterToken + optional Quota row."""
    from datetime import datetime

    from app.models import Cluster, Quota, Team, TeamClusterToken, TeamMembership, User

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

        team = Team(name="team-admission", personal=False, is_active=True)
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

        quota = None
        if with_quota:
            quota = Quota(
                team_id=team.id,
                cluster_id=cluster.id,
                cpu_cores=cpu_cores,
                ram_bytes=ram_bytes,
                disk_bytes=disk_bytes,
                vm_count=vm_count,
                updated_at=datetime.utcnow(),
            )
            session.add(quota)

        await session.commit()
        await session.refresh(cluster)
        return team.id, cluster.id, user.id


def _make_fake_with_resources(poolid, resources=None, lxcs=None):
    from tests.fixtures.pve_responses import FakeProxmox

    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", resources or [])
    fake.queue_response("cluster.resources.get", lxcs or [])
    return fake


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_and_preview_no_quota_row_unlimited(session_factory):
    """No Quota row → all dimensions unlimited, would_exceed=False."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    team_id, cluster_id, _ = await _seed_full(
        session_factory, with_quota=False
    )

    fake = _make_fake_with_resources("gui-team-1")
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        req = QuotaPreviewRequest(
            team_id=team_id, cluster_id=cluster_id,
            requested_cpu=4, requested_ram_bytes=1024**3, requested_disk_bytes=0, requested_count=1,
        )
        async with session_factory() as db:
            result = await check_and_preview(db, registry, request=req)

    assert result.would_exceed is False
    # All limits are None (unlimited)
    for dim in result.dimensions:
        assert dim.limit is None
        assert dim.headroom is None
        assert dim.would_exceed is False


@pytest.mark.asyncio
async def test_check_and_preview_exceeds_cpu(session_factory):
    """cpu_cores=10, current usage=8, requested=5 → would_exceed=True."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    team_id, cluster_id, _ = await _seed_full(
        session_factory, poolid="gui-team-cpu", cpu_cores=10
    )

    # Fake PVE returns 8 CPUs in pool
    resources = [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": "gui-team-cpu",
         "maxcpu": 8, "maxmem": 0, "maxdisk": 0},
    ]
    fake = _make_fake_with_resources("gui-team-cpu", resources=resources)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        req = QuotaPreviewRequest(
            team_id=team_id, cluster_id=cluster_id,
            requested_cpu=5, requested_ram_bytes=0, requested_disk_bytes=0, requested_count=0,
        )
        async with session_factory() as db:
            result = await check_and_preview(db, registry, request=req)

    assert result.would_exceed is True
    cpu_dim = next(d for d in result.dimensions if d.name == "cpu")
    assert cpu_dim.would_exceed is True
    assert cpu_dim.current == 8
    assert cpu_dim.requested == 5
    assert cpu_dim.limit == 10


@pytest.mark.asyncio
async def test_check_and_preview_within_limit_returns_headroom(session_factory):
    """limit=16, current=8, requested=4 → headroom=4, would_exceed=False."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    team_id, cluster_id, _ = await _seed_full(
        session_factory, poolid="gui-team-hr", cpu_cores=16
    )

    resources = [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": "gui-team-hr",
         "maxcpu": 8, "maxmem": 0, "maxdisk": 0},
    ]
    fake = _make_fake_with_resources("gui-team-hr", resources=resources)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        req = QuotaPreviewRequest(
            team_id=team_id, cluster_id=cluster_id,
            requested_cpu=4, requested_ram_bytes=0, requested_disk_bytes=0, requested_count=0,
        )
        async with session_factory() as db:
            result = await check_and_preview(db, registry, request=req)

    assert result.would_exceed is False
    cpu_dim = next(d for d in result.dimensions if d.name == "cpu")
    assert cpu_dim.headroom == 4  # 16 - (8 + 4)
    assert cpu_dim.would_exceed is False


@pytest.mark.asyncio
async def test_check_and_preview_uses_begin_immediate(session_factory):
    """check_and_preview must execute BEGIN IMMEDIATE."""

    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    team_id, cluster_id, _ = await _seed_full(
        session_factory, with_quota=False
    )

    executed_sqls: list[str] = []

    fake = _make_fake_with_resources("gui-team-1")
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        req = QuotaPreviewRequest(
            team_id=team_id, cluster_id=cluster_id,
            requested_cpu=0, requested_ram_bytes=0, requested_disk_bytes=0, requested_count=0,
        )

        # Intercept all SQL statement strings
        from sqlalchemy import event

        async with session_factory() as db:
            # Use SQLAlchemy event to capture executed statements
            @event.listens_for(db.bind.sync_engine, "before_cursor_execute")
            def _capture(conn, cursor, statement, parameters, context, executemany):
                executed_sqls.append(statement.upper())

            await check_and_preview(db, registry, request=req)

    assert any("BEGIN IMMEDIATE" in s for s in executed_sqls), (
        f"BEGIN IMMEDIATE not found in executed SQL. Found: {executed_sqls}"
    )


@pytest.mark.asyncio
async def test_check_and_preview_releases_lock_after_commit(session_factory):
    """Two sequential calls must both succeed (lock is released after each)."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    team_id, cluster_id, _ = await _seed_full(
        session_factory, with_quota=False
    )

    for _ in range(2):
        fake = _make_fake_with_resources("gui-team-1")
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            registry = PVEConnectorRegistry(None, session_factory)
            req = QuotaPreviewRequest(
                team_id=team_id, cluster_id=cluster_id,
                requested_cpu=1, requested_ram_bytes=0, requested_disk_bytes=0, requested_count=0,
            )
            async with session_factory() as db:
                result = await check_and_preview(db, registry, request=req)
            assert result is not None  # Should not raise


@pytest.mark.asyncio
async def test_check_and_preview_user_scoped_quota_ignored_in_phase2(session_factory):
    """User-scoped Quota rows must NOT be honored in Phase 2 team-based preview."""
    from datetime import datetime

    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Quota
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    # Seed team + cluster + team_cluster_token (no team-quota row)
    team_id, cluster_id, user_id = await _seed_full(
        session_factory, with_quota=False, poolid="gui-team-usrscope"
    )

    # Seed a USER-scoped Quota row (not team-scoped) with very restrictive cpu_cores
    async with session_factory() as session:
        user_quota = Quota(
            user_id=user_id,
            team_id=None,
            cluster_id=cluster_id,
            cpu_cores=1,  # Restrictive
            updated_at=datetime.utcnow(),
        )
        session.add(user_quota)
        await session.commit()

    fake = _make_fake_with_resources("gui-team-usrscope")
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        registry = PVEConnectorRegistry(None, session_factory)
        req = QuotaPreviewRequest(
            team_id=team_id, cluster_id=cluster_id,
            requested_cpu=100,  # Would exceed user-scoped limit of 1 if honored
            requested_ram_bytes=0, requested_disk_bytes=0, requested_count=0,
        )
        async with session_factory() as db:
            result = await check_and_preview(db, registry, request=req)

    # Phase 2 ignores user-scoped rows; team has no quota row → unlimited
    assert result.would_exceed is False
    cpu_dim = next(d for d in result.dimensions if d.name == "cpu")
    assert cpu_dim.limit is None  # Unlimited, not 1
