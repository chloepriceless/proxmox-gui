"""Scheduled cluster health-probe arq cron tests (plan 05-03, carryover CLUST-06).

Task 2, TDD RED phase: ``probe_clusters`` iterates every Cluster row, calls
``connector.version()``, and updates the per-cluster reachability fields on
the cached connector — the same fields ``clusters/health.py`` updates (an
in-memory connector keeps ``status``/``last_seen_healthy``/``last_error``;
the worker registry caches connectors across cron runs so status survives).

Behaviours:
  1. probe_clusters sweeps every Cluster row.
  2. A successful version() call marks the connector status='ok'.
  3. A cluster whose version() raises PVEUnreachable is recorded as failed
     and does NOT abort the sweep — every OTHER cluster is still probed.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import VERSION_OK, FakeProxmox


async def _seed_cluster(session_factory, *, name: str, host: str):
    from app.models import Cluster

    async with session_factory() as session:
        c = Cluster(
            name=name,
            host=host,
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="secret",
            is_active=True,
        )
        session.add(c)
        await session.commit()
        await session.refresh(c)
        return c


# ---------------------------------------------------------------------------
# Behaviour 1 + 2 — sweep marks reachable clusters status='ok'
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_probe_clusters_marks_reachable_clusters_ok(session_factory):
    """probe_clusters calls version() on every cluster; success → status='ok'."""
    from app.clusters.probe import probe_clusters
    from app.clusters.registry import PVEConnectorRegistry

    c1 = await _seed_cluster(session_factory, name="cl1", host="pve-1.test")
    c2 = await _seed_cluster(session_factory, name="cl2", host="pve-2.test")

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    ctx = {"sessionmaker": session_factory, "registry": registry}

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        await probe_clusters(ctx)

    # Both connectors are now cached on the registry with status='ok'.
    conn1 = await registry.get(c1.id)
    conn2 = await registry.get(c2.id)
    assert conn1.status == "ok"
    assert conn2.status == "ok"
    assert conn1.last_error is None
    assert conn2.last_error is None


# ---------------------------------------------------------------------------
# Behaviour 3 — one bad cluster does not abort the sweep
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_probe_clusters_continues_after_unreachable_cluster(session_factory):
    """A cluster raising PVEUnreachable is recorded; the sweep continues."""
    from app.clusters.probe import probe_clusters
    from app.clusters.registry import PVEConnectorRegistry

    bad = await _seed_cluster(session_factory, name="bad", host="pve-bad.test")
    good = await _seed_cluster(session_factory, name="good", host="pve-good.test")

    # Pre-seed connectors so we can wire per-cluster behaviour. The registry's
    # get() returns the cached instance; we need version() to fail on the bad
    # one but succeed on the good one.
    from app.clusters.connector import PVEConnector

    fake_good = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake_good):
        good_conn = PVEConnector(
            host="pve-good.test", port=8006,
            token_user="root@pam", token_name="gui", token_value="s",
            verify_ssl=False,
        )

    def _raise_conn_error(*_a, **_kw):
        import requests
        raise requests.ConnectionError("network unreachable")

    fake_bad = FakeProxmox(responses={"version.get": _raise_conn_error})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake_bad):
        bad_conn = PVEConnector(
            host="pve-bad.test", port=8006,
            token_user="root@pam", token_name="gui", token_value="s",
            verify_ssl=False,
        )

    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)
    # Seed the registry's cache directly so probe_clusters picks up our wired
    # connectors instead of building fresh ones.
    registry._connectors[bad.id] = bad_conn
    registry._connectors[good.id] = good_conn

    ctx = {"sessionmaker": session_factory, "registry": registry}

    # Must not raise — the bad cluster is recorded, the good one is still probed.
    await probe_clusters(ctx)

    assert bad_conn.status == "failed"
    assert bad_conn.last_error is not None
    assert good_conn.status == "ok"
    assert good_conn.last_error is None
