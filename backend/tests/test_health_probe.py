"""Tests for health_probe_loop and PVEConnectorRegistry probe management.

Task 2, TDD RED phase: tests written before implementation.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest
import requests

from tests.fixtures.pve_responses import VERSION_OK, FakeProxmox


def _make_connector(fake: FakeProxmox):
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.health.test",
            port=8006,
            token_user="root@pam",
            token_name="api",
            token_value="x",
            verify_ssl=False,
        )


@pytest.mark.asyncio
async def test_health_probe_updates_status_on_success():
    """health_probe_loop marks connector.status='ok' after a successful /version call."""
    from app.clusters.health import health_probe_loop

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    connector = _make_connector(fake)

    assert connector.status == "untested"
    assert connector.last_seen_healthy is None

    task = asyncio.create_task(health_probe_loop(connector, interval=0.05))
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert connector.status == "ok"
    assert connector.last_seen_healthy is not None
    assert connector.last_error is None


@pytest.mark.asyncio
async def test_health_probe_records_error_on_unreachable():
    """health_probe_loop marks connector.status='failed' on ConnectionError."""
    from app.clusters.health import health_probe_loop

    fake = FakeProxmox(responses={"version.get": lambda: (_ for _ in ()).throw(
        requests.ConnectionError("refused")
    )})

    def _raise(*a, **kw):
        raise requests.ConnectionError("refused")

    fake.responses["version.get"] = _raise
    connector = _make_connector(fake)

    task = asyncio.create_task(health_probe_loop(connector, interval=0.05))
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert connector.status == "failed"
    assert connector.last_error is not None
    assert "refused" in connector.last_error


@pytest.mark.asyncio
async def test_registry_start_probe_then_stop_probe(session_factory):
    """start_probe() spawns an asyncio.Task stored in _probes; stop_probe() cancels it."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Cluster

    # Seed a cluster row.
    async with session_factory() as session:
        cluster = Cluster(
            name="probe-cluster",
            host="pve-probe.test",
            port=8006,
            verify_ssl=False,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="secret",
            is_active=True,
        )
        session.add(cluster)
        await session.commit()
        await session.refresh(cluster)
        cluster_id = cluster.id

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as session:
            await registry.start_probe(cluster_id, db=session, interval=0.05)

    assert cluster_id in registry._probes
    task = registry._probes[cluster_id]
    assert not task.done()

    await registry.stop_probe(cluster_id)

    assert cluster_id not in registry._probes
    assert task.cancelled() or task.done()


@pytest.mark.asyncio
async def test_registry_stop_all_probes_cancels_every_task(session_factory):
    """stop_all_probes() cancels every running probe and empties _probes dict."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.models import Cluster

    cluster_ids = []
    async with session_factory() as session:
        for i in range(1, 3):
            cluster = Cluster(
                name=f"probe-cluster-{i}",
                host=f"pve-probe-{i}.test",
                port=8006,
                verify_ssl=False,
                token_user="root@pam",
                token_name="gui",
                api_token_secret=f"secret-{i}",
                is_active=True,
            )
            session.add(cluster)
        await session.commit()

    async with session_factory() as session:
        from sqlalchemy import select

        from app.models import Cluster as C
        result = await session.execute(select(C.id))
        cluster_ids = [row[0] for row in result.all()]

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    registry = PVEConnectorRegistry(cipher=None, session_factory=session_factory)

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        for cid in cluster_ids:
            async with session_factory() as session:
                await registry.start_probe(cid, db=session, interval=0.05)

    assert len(registry._probes) == len(cluster_ids)
    tasks = list(registry._probes.values())

    await registry.stop_all_probes()

    assert len(registry._probes) == 0
    for task in tasks:
        assert task.cancelled() or task.done()
