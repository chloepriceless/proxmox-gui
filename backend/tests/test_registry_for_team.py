"""Tests for PVEConnectorRegistry.get_for_team() — per-team privsep connector.

Task 2, TDD RED phase: tests written before implementation; will fail until
registry.py gains get_for_team + invalidate_for_team.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import FakeProxmox

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(session_factory, *, team_id: int, cluster_id_hint: int = 1):
    """Insert a Cluster row + Team row + TeamClusterToken row.

    Returns (cluster_id, team_id, token_row_userid, token_row_tokenid, token_secret).
    """
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        cluster = Cluster(
            name=f"cluster-{cluster_id_hint}",
            host=f"pve-{cluster_id_hint}.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()

        team = Team(
            id=team_id,
            name=f"gui-team-{team_id}",
            personal=False,
            is_active=True,
        )
        session.add(team)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id,
            cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve",
            tokenid="api",
            token_secret=f"team-{team_id}-secret",
            poolid=f"gui-team-{team_id}",
        )
        session.add(token)
        await session.commit()
        await session.refresh(cluster)
        await session.refresh(team)
        await session.refresh(token)
        return cluster.id, team.id, token.userid, token.tokenid, token.token_secret


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_for_team_returns_connector_with_team_token(session_factory):
    """get_for_team() builds a connector using the team_cluster_tokens row credentials."""
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, userid, tokenid, token_secret = await _seed_cluster_and_token(
        session_factory, team_id=42
    )

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    fake = FakeProxmox(responses={})

    with patch("app.clusters.connector.ProxmoxAPI") as mock_api:
        mock_api.return_value = fake
        async with session_factory() as session:
            connector = await registry.get_for_team(
                cluster_id=cluster_id, team_id=team_id, db=session
            )

    # ProxmoxAPI must have been called with the per-team token, not the bootstrap token.
    assert mock_api.called
    call_kwargs = mock_api.call_args.kwargs
    assert call_kwargs.get("user") == userid
    assert call_kwargs.get("token_name") == tokenid
    assert call_kwargs.get("token_value") == token_secret

    assert connector is not None


@pytest.mark.asyncio
async def test_get_for_team_caches_by_team_cluster_pair(session_factory):
    """Second call with same (team_id, cluster_id) returns the exact same connector object."""
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _, _, _ = await _seed_cluster_and_token(
        session_factory, team_id=99
    )

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    fake = FakeProxmox(responses={})

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as session:
            connector_a = await registry.get_for_team(
                cluster_id=cluster_id, team_id=team_id, db=session
            )
            connector_b = await registry.get_for_team(
                cluster_id=cluster_id, team_id=team_id, db=session
            )

    # Same object identity — cache hit.
    assert connector_a is connector_b


@pytest.mark.asyncio
async def test_get_for_team_missing_row_raises_lookuperror(session_factory):
    """get_for_team() raises LookupError when no team_cluster_tokens row exists."""
    from app.clusters.registry import PVEConnectorRegistry

    # Seed a cluster but NO token row for team_id=999.
    from app.models import Cluster
    async with session_factory() as session:
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
        await session.refresh(cluster)
        cluster_id = cluster.id

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    with pytest.raises(LookupError, match="no team_cluster_tokens row"):
        async with session_factory() as session:
            await registry.get_for_team(
                cluster_id=cluster_id, team_id=999, db=session
            )


@pytest.mark.asyncio
async def test_invalidate_for_team_drops_entry(session_factory):
    """After invalidate_for_team(), the next call builds a fresh connector."""
    from app.clusters.registry import PVEConnectorRegistry

    cluster_id, team_id, _, _, _ = await _seed_cluster_and_token(
        session_factory, team_id=7
    )

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    fake = FakeProxmox(responses={})

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake) as mock_api:
        async with session_factory() as session:
            connector_a = await registry.get_for_team(
                cluster_id=cluster_id, team_id=team_id, db=session
            )
        first_call_count = mock_api.call_count

        # Invalidate the cached entry.
        registry.invalidate_for_team(team_id=team_id, cluster_id=cluster_id)

        # Second call must build a new connector (ProxmoxAPI called again).
        async with session_factory() as session:
            connector_b = await registry.get_for_team(
                cluster_id=cluster_id, team_id=team_id, db=session
            )
        assert mock_api.call_count == first_call_count + 1
        # They are different objects since the cache was cleared.
        assert connector_a is not connector_b
