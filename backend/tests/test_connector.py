"""Unit tests for :class:`app.clusters.connector.PVEConnector`.

The connector wraps the synchronous ``proxmoxer.ProxmoxAPI`` with
``asyncio.to_thread`` (Pitfall A3). Tests verify:

- ``version()`` returns the dict proxmoxer returns.
- Calls go through ``asyncio.to_thread`` (a spy on the executor confirms this).
- ``validate()`` succeeds on 200, raises ``PVEAuthError`` on 401, raises
  ``PVEUnreachable`` on a connection error.
- The mutating methods (``create_pool`` / ``create_user`` / ``create_token`` /
  ``set_pool_acl`` / ``delete_pool`` / ``delete_user``) issue the correct
  proxmoxer chained call with the right kwargs.
- The TLS-fingerprint+verify_ssl=False combination raises NotImplementedError.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from tests.fixtures.pve_responses import (
    CLUSTER_RESOURCES_LXC,
    CLUSTER_RESOURCES_VM,
    CREATE_TOKEN_OK,
    EMPTY_OK,
    POOL_GUI_TEAM_42,
    RRD_HOUR,
    VM_CONFIG,
    VM_STATUS_RUNNING,
    VERSION_OK,
    FakeProxmox,
    auth_error,
    connection_error,
    pve_api_error,
)


def _make_fake(responses):
    """Helper: instantiate a FakeProxmox and patch ProxmoxAPI to return it."""
    return FakeProxmox(responses=responses)


@pytest.mark.asyncio
async def test_version_returns_mocked_payload():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="pve.example.test",
            port=8006,
            token_user="root@pam",
            token_name="gui",
            token_value="deadbeef",
            verify_ssl=True,
        )
        result = await conn.version()
    assert result == VERSION_OK["data"]
    assert fake.calls[0] == ("version.get", (), {})


@pytest.mark.asyncio
async def test_calls_go_through_asyncio_to_thread(monkeypatch):
    """Verify every proxmoxer call is dispatched via asyncio.to_thread (Pitfall A3)."""
    from app.clusters import connector as connector_module

    fake = _make_fake({"version.get": VERSION_OK})

    counter = {"n": 0}
    real_to_thread = asyncio.to_thread

    async def counting_to_thread(fn, *args, **kwargs):
        counter["n"] += 1
        return await real_to_thread(fn, *args, **kwargs)

    monkeypatch.setattr(connector_module.asyncio, "to_thread", counting_to_thread)

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = connector_module.PVEConnector(
            host="pve.example.test", port=8006,
            token_user="root@pam", token_name="gui", token_value="d",
            verify_ssl=True,
        )
        await conn.version()
    assert counter["n"] >= 1, "asyncio.to_thread was not invoked"


@pytest.mark.asyncio
async def test_validate_succeeds_on_200():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        # No exception means success.
        await conn.validate()


@pytest.mark.asyncio
async def test_validate_raises_pve_auth_error_on_401():
    from app.clusters.connector import PVEConnector
    from app.clusters.errors import PVEAuthError

    fake = _make_fake({"version.get": auth_error()})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        with pytest.raises(PVEAuthError):
            await conn.validate()


@pytest.mark.asyncio
async def test_validate_raises_pve_unreachable_on_connection_error():
    from app.clusters.connector import PVEConnector
    from app.clusters.errors import PVEUnreachable

    fake = _make_fake({"version.get": connection_error()})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        with pytest.raises(PVEUnreachable):
            await conn.validate()


@pytest.mark.asyncio
async def test_validate_raises_pve_api_error_on_other_resource_exception():
    from app.clusters.connector import PVEConnector
    from app.clusters.errors import PVEAPIError

    fake = _make_fake({"version.get": pve_api_error(status_code=500)})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        with pytest.raises(PVEAPIError):
            await conn.validate()


@pytest.mark.asyncio
async def test_create_pool_sends_correct_payload():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"pools.post": EMPTY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        await conn.create_pool("gui-team-42", comment="tenant 42")
    # Find the pools.post call
    posts = [c for c in fake.calls if c[0] == "pools.post"]
    assert len(posts) == 1
    _, _, kwargs = posts[0]
    assert kwargs == {"poolid": "gui-team-42", "comment": "tenant 42"}


@pytest.mark.asyncio
async def test_delete_pool_sends_correct_path():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"pools.gui-team-42.delete": EMPTY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        await conn.delete_pool("gui-team-42")
    deletes = [c for c in fake.calls if c[0].endswith(".delete")]
    assert len(deletes) == 1
    assert deletes[0][0] == "pools.gui-team-42.delete"


@pytest.mark.asyncio
async def test_create_user_sends_correct_payload():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"access.users.post": EMPTY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        await conn.create_user("gui-team-42@pve", comment="GUI tenant")
    posts = [c for c in fake.calls if c[0] == "access.users.post"]
    assert len(posts) == 1
    _, _, kwargs = posts[0]
    assert kwargs == {"userid": "gui-team-42@pve", "comment": "GUI tenant"}


@pytest.mark.asyncio
async def test_delete_user_sends_correct_path():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"access.users.gui-team-42@pve.delete": EMPTY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        await conn.delete_user("gui-team-42@pve")
    deletes = [c for c in fake.calls if c[0].endswith(".delete")]
    assert len(deletes) == 1
    assert deletes[0][0] == "access.users.gui-team-42@pve.delete"


@pytest.mark.asyncio
async def test_create_token_returns_payload_and_uses_privsep():
    from app.clusters.connector import PVEConnector

    fake = _make_fake(
        {"access.users.gui-team-42@pve.token.api.post": CREATE_TOKEN_OK}
    )
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        result = await conn.create_token("gui-team-42@pve", "api", privsep=True)
    assert result == CREATE_TOKEN_OK["data"]
    posts = [
        c for c in fake.calls
        if c[0] == "access.users.gui-team-42@pve.token.api.post"
    ]
    assert len(posts) == 1
    _, _, kwargs = posts[0]
    assert kwargs == {"privsep": 1}


@pytest.mark.asyncio
async def test_set_pool_acl_sends_correct_payload():
    from app.clusters.connector import PVEConnector

    fake = _make_fake({"access.acl.put": EMPTY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="h", port=8006, token_user="r@pam", token_name="t",
            token_value="v", verify_ssl=True,
        )
        await conn.set_pool_acl(
            "gui-team-42", userid="gui-team-42@pve", role="PVEVMUser",
        )
    puts = [c for c in fake.calls if c[0] == "access.acl.put"]
    assert len(puts) == 1
    _, _, kwargs = puts[0]
    assert kwargs == {
        "path": "/pool/gui-team-42",
        "users": "gui-team-42@pve",
        "roles": "PVEVMUser",
        "propagate": 1,
    }


@pytest.mark.asyncio
async def test_tls_fingerprint_without_verify_ssl_raises_not_implemented():
    """Phase 1: tls_fingerprint enforcement is deferred. The connector accepts
    the field on the model but refuses the combination (fingerprint AND
    verify_ssl=False) so operators don't think pinning is active when it isn't.
    """
    from app.clusters.connector import PVEConnector

    with pytest.raises(NotImplementedError, match="fingerprint"):
        PVEConnector(
            host="h", port=8006,
            token_user="r@pam", token_name="t", token_value="v",
            verify_ssl=False,
            tls_fingerprint="SHA256:aaaa",
        )


# ---------------------------------------------------------------------------
# Phase 2: new read/write methods
# ---------------------------------------------------------------------------


def _make_conn(fake: FakeProxmox):
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.test", port=8006,
            token_user="root@pam", token_name="api", token_value="x",
            verify_ssl=False,
        )


@pytest.mark.asyncio
async def test_list_resources_happy_path():
    """list_resources() returns the (qemu + lxc merged) snapshot from one call.

    PVE's /cluster/resources?type=vm returns BOTH qemu and lxc items —
    `type=lxc` is not a valid parameter value (PVE 9.x rejects with 400).
    """
    fake = FakeProxmox(responses={})
    # Real PVE returns both qemu + lxc items under type=vm.
    fake.queue_response(
        "cluster.resources.get", CLUSTER_RESOURCES_VM + CLUSTER_RESOURCES_LXC,
    )
    conn = _make_conn(fake)

    snapshot, stale = await conn.list_resources()
    assert stale is False
    assert len(snapshot) == 3
    vm_calls = [c for c in fake.calls if c[0] == "cluster.resources.get"]
    assert len(vm_calls) == 1
    assert vm_calls[0][2] == {"type": "vm"}


@pytest.mark.asyncio
async def test_get_vm_status_qemu_path():
    """get_vm_status with is_lxc=False calls nodes.{node}.qemu.{vmid}.status.current.get."""
    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.status.current.get": VM_STATUS_RUNNING,
    })
    conn = _make_conn(fake)
    result = await conn.get_vm_status(node="pve-01", vmid=100, is_lxc=False)
    assert result == VM_STATUS_RUNNING["data"]
    assert fake.calls[0] == ("nodes.pve-01.qemu.100.status.current.get", (), {})


@pytest.mark.asyncio
async def test_get_vm_status_lxc_path():
    """get_vm_status with is_lxc=True calls nodes.{node}.lxc.{vmid}.status.current.get."""
    fake = FakeProxmox(responses={
        "nodes.pve-01.lxc.200.status.current.get": VM_STATUS_RUNNING,
    })
    conn = _make_conn(fake)
    result = await conn.get_vm_status(node="pve-01", vmid=200, is_lxc=True)
    assert result == VM_STATUS_RUNNING["data"]
    assert fake.calls[0] == ("nodes.pve-01.lxc.200.status.current.get", (), {})


@pytest.mark.asyncio
async def test_get_vm_config_qemu():
    """get_vm_config with is_lxc=False calls nodes.{node}.qemu.{vmid}.config.get."""
    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.config.get": VM_CONFIG,
    })
    conn = _make_conn(fake)
    result = await conn.get_vm_config(node="pve-01", vmid=100, is_lxc=False)
    assert result == VM_CONFIG["data"]
    assert fake.calls[0][0] == "nodes.pve-01.qemu.100.config.get"


@pytest.mark.asyncio
async def test_set_vm_config_invalidates_cache():
    """set_vm_config writes to PVE and then nulls the resource cache snapshot."""
    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.config.put": EMPTY_OK,
    })
    conn = _make_conn(fake)
    # Seed a fake cache snapshot.
    conn._resource_cache.snapshot = [{"vmid": 100}]

    await conn.set_vm_config(node="pve-01", vmid=100, is_lxc=False, tags="prod;web")

    # Cache must be invalidated.
    assert conn._resource_cache.snapshot is None
    # PUT call must have been made.
    put_calls = [c for c in fake.calls if c[0] == "nodes.pve-01.qemu.100.config.put"]
    assert len(put_calls) == 1
    assert put_calls[0][2] == {"tags": "prod;web"}


@pytest.mark.asyncio
async def test_rrddata_valid_timeframe():
    """rrddata() calls the correct PVE path with timeframe + cf kwargs."""
    fake = FakeProxmox(responses={
        "nodes.pve-01.qemu.100.rrddata.get": RRD_HOUR,
    })
    conn = _make_conn(fake)
    result = await conn.rrddata(node="pve-01", vmid=100, is_lxc=False,
                                timeframe="hour", cf="AVERAGE")
    assert result == RRD_HOUR["data"]
    calls = [c for c in fake.calls if "rrddata.get" in c[0]]
    assert len(calls) == 1
    assert calls[0][2] == {"timeframe": "hour", "cf": "AVERAGE"}


@pytest.mark.asyncio
async def test_rrddata_invalid_timeframe_raises_value_error():
    """rrddata() raises ValueError for unsupported timeframe values."""
    fake = FakeProxmox(responses={})
    conn = _make_conn(fake)
    with pytest.raises(ValueError, match="timeframe"):
        await conn.rrddata(node="pve-01", vmid=100, is_lxc=False, timeframe="minute")


@pytest.mark.asyncio
async def test_rrddata_invalid_cf_raises_value_error():
    """rrddata() raises ValueError for unsupported cf values."""
    fake = FakeProxmox(responses={})
    conn = _make_conn(fake)
    with pytest.raises(ValueError, match="cf"):
        await conn.rrddata(node="pve-01", vmid=100, is_lxc=False, cf="MIN")


@pytest.mark.asyncio
async def test_pool_members_returns_members_list():
    """pool_members() returns the 'members' list from the pool payload."""
    fake = FakeProxmox(responses={
        "pools.gui-team-42.get": POOL_GUI_TEAM_42,
    })
    conn = _make_conn(fake)
    members = await conn.pool_members(poolid="gui-team-42")
    assert len(members) == 3
    assert members[0]["vmid"] == 100
    calls = [c for c in fake.calls if "pools" in c[0]]
    assert len(calls) == 1
    assert calls[0][0] == "pools.gui-team-42.get"


@pytest.mark.asyncio
async def test_pool_members_empty_when_no_members_key():
    """pool_members() returns [] when the pool payload has no 'members' key."""
    fake = FakeProxmox(responses={
        "pools.empty-pool.get": {"data": {"comment": "no vms"}},
    })
    conn = _make_conn(fake)
    members = await conn.pool_members(poolid="empty-pool")
    assert members == []
