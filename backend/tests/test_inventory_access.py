"""TDD RED: Tests for inventory RBAC (require_resource_access / resolve_resource).

These tests are written BEFORE implementation and are expected to FAIL until
app/inventory/access.py is created.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_LXC,
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
    connection_error,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed(
    session_factory,
    *,
    team_id: int = 42,
    poolid: str = "gui-team-42",
    add_user: bool = True,
    cluster_name: str = "cluster-1",
) -> tuple:
    """Seed a User + Team + Cluster + TeamMembership + TeamClusterToken.

    Returns (user, cluster_id, team_id, token_row).
    """
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership, User

    async with session_factory() as session:
        user = User(
            username=f"user{team_id}",
            email=f"user{team_id}@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(
            id=team_id,
            name=f"gui-team-{team_id}",
            personal=False,
            is_active=True,
        )
        session.add(team)
        await session.flush()

        if add_user:
            membership = TeamMembership(team_id=team.id, user_id=user.id)
            session.add(membership)

        cluster = Cluster(
            name=cluster_name,
            host=f"{cluster_name}.test",
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
        await session.refresh(token)
        return user, cluster.id, team.id, token


def _make_principal(user):
    from app.auth.dependencies import Principal

    return Principal(user=user, mode="session")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_resource_returns_owning_team_for_member(session_factory):
    """resolve_resource returns ResolvedResource with the correct team_id."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource

    user, cluster_id, team_id, token = await _seed(session_factory, team_id=42, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            resolved = await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=100,
            )

    assert resolved.team_id == team_id
    assert resolved.poolid == "gui-team-42"
    assert resolved.vm_item["vmid"] == 100


@pytest.mark.asyncio
async def test_resolve_resource_403_when_pool_mismatch(session_factory):
    """VM whose pool doesn't match principal's poolid → 403."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource

    # Team's poolid is "gui-team-99" but VM has pool "gui-team-42"
    user, cluster_id, team_id, token = await _seed(
        session_factory, team_id=99, poolid="gui-team-99"
    )
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    # VM with pool "gui-team-42" (not "gui-team-99")
    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,  # pool="gui-team-42"
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as db:
            with pytest.raises(HTTPException) as exc_info:
                await resolve_resource(
                    db=db,
                    registry=registry,
                    principal=principal,
                    cluster_id=cluster_id,
                    vmid=100,
                )

    assert exc_info.value.status_code == 403
    assert "No access to that resource" in exc_info.value.detail


@pytest.mark.asyncio
async def test_resolve_resource_403_when_user_has_no_membership_on_cluster(session_factory):
    """User has a team but no TeamClusterToken for that cluster → 403."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource
    from app.models import Cluster, Team, TeamMembership, User

    async with session_factory() as session:
        user = User(
            username="nomatch",
            email="nomatch@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.flush()

        team = Team(id=77, name="gui-team-77", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        membership = TeamMembership(team_id=team.id, user_id=user.id)
        session.add(membership)

        # Cluster WITHOUT any TeamClusterToken for team 77
        cluster = Cluster(
            name="cluster-no-token",
            host="pve-nt.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.commit()
        await session.refresh(user)
        await session.refresh(cluster)
        cluster_id = cluster.id

    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    async with session_factory() as db:
        with pytest.raises(HTTPException) as exc_info:
            await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=100,
            )

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_resource_404_when_cluster_missing(session_factory):
    """Non-existent cluster_id → 404."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource
    from app.models import User

    async with session_factory() as session:
        user = User(
            username="miss",
            email="miss@example.com",
            password_hash="x",
            is_active=True,
            is_admin=False,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    async with session_factory() as db:
        with pytest.raises(HTTPException) as exc_info:
            await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=9999,
                vmid=100,
            )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_resource_returns_stale_when_breaker_open(session_factory):
    """When the circuit breaker is open (after repeated failures) and cache is present,
    resolve_resource still returns the vm_item from stale cache with is_stale=True."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource

    user, cluster_id, team_id, token = await _seed(session_factory, team_id=42, poolid="gui-team-42")
    principal = _make_principal(user)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    fake = FakeProxmox(responses={
        "cluster.resources.get": CLUSTER_RESOURCES_VM,
    })

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        # First call: populate cache
        async with session_factory() as db:
            resolved_ok = await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=100,
            )

        # Now force stale: set snapshot then set fetched_at to a very old time
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id,
        )
        import time
        connector._resource_cache.fetched_at = time.monotonic() - 1000.0
        # Make subsequent calls fail
        fake.queue_error("cluster.resources.get", ConnectionError("forced error"))
        fake.queue_error("cluster.resources.get", ConnectionError("forced error"))
        fake.queue_error("cluster.resources.get", ConnectionError("forced error"))
        fake.queue_error("cluster.resources.get", ConnectionError("forced error"))

        async with session_factory() as db:
            resolved_stale = await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=100,
            )

    assert resolved_stale.is_stale is True
    assert resolved_stale.vm_item["vmid"] == 100


@pytest.mark.asyncio
async def test_resolve_resource_admin_still_requires_team_token(session_factory):
    """Even admin users must have a TeamClusterToken for the cluster — no super-token fallback."""
    from fastapi import HTTPException

    from app.clusters.registry import PVEConnectorRegistry
    from app.inventory.access import resolve_resource
    from app.models import Cluster, Team, TeamMembership, User

    async with session_factory() as session:
        admin = User(
            username="admin-ntoken",
            email="admin@example.com",
            password_hash="x",
            is_active=True,
            is_admin=True,
        )
        session.add(admin)
        await session.flush()

        # Admin's personal team — but no TeamClusterToken
        team = Team(id=1, name="personal-1", personal=True, is_active=True)
        session.add(team)
        await session.flush()

        membership = TeamMembership(team_id=team.id, user_id=admin.id)
        session.add(membership)

        cluster = Cluster(
            name="cluster-admin-no-token",
            host="pve-admin.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.commit()
        await session.refresh(admin)
        await session.refresh(cluster)
        cluster_id = cluster.id

    principal = _make_principal(admin)
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    async with session_factory() as db:
        with pytest.raises(HTTPException) as exc_info:
            await resolve_resource(
                db=db,
                registry=registry,
                principal=principal,
                cluster_id=cluster_id,
                vmid=100,
            )

    assert exc_info.value.status_code == 403
