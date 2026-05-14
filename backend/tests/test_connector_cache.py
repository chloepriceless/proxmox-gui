"""Tests for PVEConnector ResourceCache, CircuitBreaker, and thundering-herd protection.

TDD RED phase: these tests are written before the implementation exists and
are expected to FAIL until Task 1's implementation lands.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest
import requests

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_LXC,
    CLUSTER_RESOURCES_VM,
    FakeProxmox,
)


def _make_connector(fake: FakeProxmox):
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="pve.test",
            port=8006,
            token_user="root@pam",
            token_name="api",
            token_value="x",
            verify_ssl=False,
        )
    return conn


@pytest.mark.asyncio
async def test_list_resources_serves_from_cache_within_30s():
    """Second list_resources() within 30s must hit the cache, not PVE."""
    fake = FakeProxmox(responses={})
    # Queue separate responses: first call gets VMs, second gets LXCs.
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_LXC)
    conn = _make_connector(fake)

    # First call — hits PVE (2 calls: type=vm + type=lxc).
    snapshot1, stale1 = await conn.list_resources()
    assert stale1 is False
    assert len(snapshot1) == 3  # 2 VM + 1 LXC

    # Second call within 30s — cache hit; no new PVE calls.
    snapshot2, stale2 = await conn.list_resources()
    assert stale2 is False
    assert snapshot2 is snapshot1  # same object (not a copy)

    # Exactly 2 PVE calls (type=vm + type=lxc on the first call only).
    resource_calls = [c for c in fake.calls if "cluster.resources.get" in c[0]]
    assert len(resource_calls) == 2


@pytest.mark.asyncio
async def test_list_resources_force_refresh_bypasses_cache():
    """force_refresh=True must bypass the TTL check and re-fetch."""
    # Queue 4 responses: 2 for first call (vm+lxc), 2 for force_refresh call.
    fake = FakeProxmox(responses={})
    for _ in range(2):
        fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
        fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_LXC)
    conn = _make_connector(fake)

    await conn.list_resources()  # first call: 2 PVE calls
    await conn.list_resources(force_refresh=True)  # force: 2 more PVE calls

    resource_calls = [c for c in fake.calls if "cluster.resources.get" in c[0]]
    assert len(resource_calls) == 4


@pytest.mark.asyncio
async def test_breaker_opens_after_three_unreachable_failures():
    """Three consecutive ConnectionErrors must open the breaker; 4th call raises PVEUnreachable('breaker open')."""
    from app.clusters.errors import PVEUnreachable

    fake = FakeProxmox(responses={})
    # Queue 4 connection errors.
    for _ in range(4):
        fake.queue_error("cluster.resources.get", requests.ConnectionError("boom"))

    conn = _make_connector(fake)

    # Calls 1-3: each raises PVEUnreachable (no cache yet → re-raise).
    for _ in range(3):
        with pytest.raises(PVEUnreachable):
            await conn.list_resources()

    # Call 4: breaker is open → PVEUnreachable("breaker open").
    with pytest.raises(PVEUnreachable, match="breaker open"):
        await conn.list_resources()


@pytest.mark.asyncio
async def test_breaker_open_with_stale_cache_returns_stale():
    """If breaker opens and stale cache exists, returns (snapshot, True) instead of raising.

    Strategy:
    1. Trip the breaker by calling list_resources() with no cache 3 times (errors propagate).
    2. Restore a stale cache snapshot manually.
    3. Next call: breaker open + stale cache → (snapshot, True) returned without raising.
    """
    from app.clusters.errors import PVEUnreachable

    fake = FakeProxmox(responses={})
    # Queue 3 connection errors to trip the breaker (no cache yet → errors propagate).
    for _ in range(3):
        fake.queue_error("cluster.resources.get", requests.ConnectionError("down"))

    conn = _make_connector(fake)

    # Trip the breaker (3 failures, no cache → each raises PVEUnreachable).
    for _ in range(3):
        with pytest.raises(PVEUnreachable):
            await conn.list_resources()

    # Breaker is now open. Manually inject a stale snapshot into the cache.
    stale_snapshot = CLUSTER_RESOURCES_VM + CLUSTER_RESOURCES_LXC
    conn._resource_cache.snapshot = stale_snapshot
    conn._resource_cache.fetched_at = 0.0  # expired (stale)

    # Now: breaker open + stale cache → should return (snapshot, True) without raising.
    result, is_stale = await conn.list_resources()
    assert is_stale is True
    assert result == stale_snapshot


@pytest.mark.asyncio
async def test_auth_error_does_not_trip_breaker():
    """AuthenticationError must surface as PVEAuthError without incrementing the breaker."""
    from proxmoxer import AuthenticationError

    from app.clusters.errors import PVEAuthError

    fake = FakeProxmox(responses={})
    for _ in range(5):
        fake.queue_error(
            "cluster.resources.get",
            AuthenticationError("401 Unauthorized"),
        )

    conn = _make_connector(fake)

    for _ in range(5):
        with pytest.raises(PVEAuthError):
            await conn.list_resources()

    # Breaker fail_counter must remain 0 (auth errors are excluded).
    assert conn._breaker.fail_counter == 0


@pytest.mark.asyncio
async def test_concurrent_list_resources_only_fetches_once():
    """Five concurrent list_resources() calls must result in exactly 2 PVE calls (1 vm + 1 lxc)."""
    fake = FakeProxmox(responses={})
    # Only queue 2 responses — the lock ensures only one refresh happens.
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_LXC)
    conn = _make_connector(fake)

    # Fire 5 concurrent calls.
    results = await asyncio.gather(
        *[conn.list_resources() for _ in range(5)]
    )

    # All should succeed with the same snapshot.
    for snapshot, stale in results:
        assert stale is False
        assert len(snapshot) == 3  # 2 VM + 1 LXC

    # Exactly 2 PVE calls total (thundering-herd protection via asyncio.Lock).
    resource_calls = [c for c in fake.calls if "cluster.resources.get" in c[0]]
    assert len(resource_calls) == 2
