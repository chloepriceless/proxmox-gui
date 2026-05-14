"""Canned Proxmox API responses + ``FakeProxmox`` test double.

proxmoxer 2.3 is synchronous and built on top of ``requests``. ``respx`` only
intercepts ``httpx`` so we can't use it here — instead we substitute the
``ProxmoxAPI`` class itself with this recording fake. Per the plan body:

    "No real Proxmox in tests: mock the proxmoxer ProxmoxAPI class with a
    FakeProxmox that records calls."

Usage in a test:

    from unittest.mock import patch
    from tests.fixtures.pve_responses import FakeProxmox, VERSION_OK

    fake = FakeProxmox(responses={"version.get": VERSION_OK["data"]})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(...)
        assert await conn.version() == VERSION_OK["data"]
        assert fake.calls == [("version.get", (), {})]

The fake records every ``(path, args, kwargs)`` call and dispatches against
its ``responses`` dict (keyed by dotted path). To raise instead of return,
register a callable that raises.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from proxmoxer import AuthenticationError, ResourceException

# ----------------------------------------------------------------------------
# Canned response payloads (the .data sub-object, since proxmoxer unwraps it)
# ----------------------------------------------------------------------------

VERSION_OK: dict[str, Any] = {
    "data": {"version": "8.2.4", "release": "8.2", "repoid": "abc"},
}

CREATE_TOKEN_OK: dict[str, Any] = {
    "data": {
        "value": "01234567-aaaa-bbbb-cccc-deadbeef0001",
        "info": {"privsep": 1},
    },
}

# Empty-success responses (PVE returns {"data": null} for most mutators).
EMPTY_OK: dict[str, Any] = {"data": None}


# ----------------------------------------------------------------------------
# Exception factories — register these as the response value to raise instead
# of returning data.
# ----------------------------------------------------------------------------

def auth_error() -> Callable[..., Any]:
    """Returns a callable that raises proxmoxer.AuthenticationError."""

    def _raise(*_args: Any, **_kwargs: Any) -> Any:
        raise AuthenticationError("401 No ticket")

    return _raise


def connection_error() -> Callable[..., Any]:
    """Returns a callable that raises ConnectionError (network unreachable)."""

    def _raise(*_args: Any, **_kwargs: Any) -> Any:
        raise ConnectionError("Connection refused")

    return _raise


def pve_api_error(
    *, status_code: int = 500, status_message: str = "Internal Server Error",
    content: str = "boom",
) -> Callable[..., Any]:
    """Returns a callable that raises proxmoxer.ResourceException."""

    def _raise(*_args: Any, **_kwargs: Any) -> Any:
        raise ResourceException(status_code, status_message, content)

    return _raise


def pool_exists_error() -> Callable[..., Any]:
    """Raise a 'pool already exists' style ResourceException (idempotency test)."""
    return pve_api_error(
        status_code=500,
        status_message="Internal Server Error",
        content="pool 'gui-team-1' already exists",
    )


# ----------------------------------------------------------------------------
# FakeProxmox — drop-in replacement for proxmoxer.ProxmoxAPI in tests.
# ----------------------------------------------------------------------------


class _Node:
    """A node in the dotted-path tree.

    proxmoxer exposes a chained-attribute style API:
        client.version.get()                       -> "version.get"
        client.pools.post(poolid="x")              -> "pools.post"
        client.access.users("u@pve").token("api").post(privsep=1)
                                                   -> "access.users.u@pve.token.api.post"

    The fake mirrors this — every attribute or call deepens the path, and
    methods named ``get``/``post``/``put``/``delete`` (or the literal call at
    a leaf) trigger a dispatch.
    """

    _HTTP_METHODS = {"get", "post", "put", "delete"}

    def __init__(self, owner: FakeProxmox, path: tuple[str, ...]) -> None:
        self._owner = owner
        self._path = path

    def __getattr__(self, name: str) -> _Node:
        return _Node(self._owner, self._path + (name,))

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        # Path-extending call: client.access.users("root@pam") — appends the
        # positional arg(s) to the path and returns a deeper Node.
        if self._path and self._path[-1] not in self._HTTP_METHODS:
            new_path = self._path + tuple(str(a) for a in args)
            return _Node(self._owner, new_path)
        # HTTP-method call: client.version.get() / pools.post(...)
        dotted = ".".join(self._path)
        self._owner.calls.append((dotted, args, kwargs))
        response = self._owner.responses.get(dotted)
        if callable(response):
            return response(*args, **kwargs)
        # PVE's data is unwrapped by proxmoxer; we mimic by returning the
        # registered dict directly, OR ``None`` for an unregistered call.
        if response is None:
            return None
        if isinstance(response, dict) and "data" in response and len(response) == 1:
            return response["data"]
        return response


class FakeProxmox:
    """A drop-in replacement for ``proxmoxer.ProxmoxAPI``.

    Args:
        responses: Dict mapping dotted-path strings to either:
            - a dict (returned as-is; if shaped ``{"data": x}`` the inner ``x``
              is returned to mimic proxmoxer's unwrapping behavior)
            - a callable (invoked with the call's args/kwargs; raise to inject
              an error)
            - any other value (returned as-is)
        record_only: If True, every call returns None unless explicitly
            registered — useful for shape assertions.
    """

    def __init__(
        self,
        responses: dict[str, Any] | None = None,
    ) -> None:
        self.responses: dict[str, Any] = dict(responses or {})
        # Each entry: (dotted_path, positional_args, kwargs)
        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def __getattr__(self, name: str) -> _Node:
        return _Node(self, (name,))

    # Convenience for assertions in tests.
    def find_calls(self, dotted_prefix: str) -> list[tuple[str, tuple[Any, ...], dict[str, Any]]]:
        return [c for c in self.calls if c[0] == dotted_prefix or c[0].startswith(dotted_prefix + ".")]

    def queue_error(self, dotted_path: str, exc: BaseException) -> None:
        """Queue an exception to be raised on the next call to ``dotted_path``.

        If a queue exists, the first queued exception is popped and raised.
        After all queued errors are consumed, falls back to the static
        ``responses`` dict (or returns None if absent).

        Uses ``__dict__`` directly to bypass ``__getattr__`` which would
        otherwise return a ``_Node`` proxy for any attribute access.
        """
        if "_error_queues" not in self.__dict__:
            self.__dict__["_error_queues"] = {}
        self.__dict__["_error_queues"].setdefault(dotted_path, []).append(exc)

    def queue_response(self, dotted_path: str, value: Any) -> None:
        """Queue a return value for the next call to ``dotted_path``.

        Queued responses are consumed in FIFO order before falling back to
        the static ``responses`` dict. Useful when consecutive calls to the
        same path need different return values (e.g. type=vm vs type=lxc).

        Uses ``__dict__`` directly to bypass ``__getattr__``.
        """
        if "_response_queues" not in self.__dict__:
            self.__dict__["_response_queues"] = {}
        self.__dict__["_response_queues"].setdefault(dotted_path, []).append(value)


# Monkey-patch _Node.__call__ to support queue_error on FakeProxmox.
_original_node_call = _Node.__call__


def _patched_node_call(self, *args: Any, **kwargs: Any) -> Any:
    if self._path and self._path[-1] not in _Node._HTTP_METHODS:
        new_path = self._path + tuple(str(a) for a in args)
        return _Node(self._owner, new_path)
    dotted = ".".join(self._path)
    self._owner.calls.append((dotted, args, kwargs))
    # 1. Check queued errors first (access via __dict__ to avoid __getattr__ proxy).
    error_queues: dict[str, list[BaseException]] = self._owner.__dict__.get(
        "_error_queues", {}
    )
    if dotted in error_queues and error_queues[dotted]:
        raise error_queues[dotted].pop(0)
    # 2. Check queued responses (FIFO; consumed before static dict).
    response_queues: dict[str, list[Any]] = self._owner.__dict__.get(
        "_response_queues", {}
    )
    if dotted in response_queues and response_queues[dotted]:
        return response_queues[dotted].pop(0)
    # 3. Fall back to static responses dict.
    response = self._owner.responses.get(dotted)
    if callable(response):
        return response(*args, **kwargs)
    if response is None:
        return None
    if isinstance(response, dict) and "data" in response and len(response) == 1:
        return response["data"]
    return response


_Node.__call__ = _patched_node_call  # type: ignore[method-assign]


# ----------------------------------------------------------------------------
# Phase 2 canned response payloads (proxmoxer unwraps "data" -> returns inner)
# ----------------------------------------------------------------------------

CLUSTER_RESOURCES_VM = [
    {"vmid": 100, "name": "vm-prod-1", "type": "qemu", "node": "pve-01",
     "status": "running", "maxcpu": 4, "maxmem": 4294967296, "maxdisk": 53687091200,
     "tags": "prod;web", "pool": "gui-team-42"},
    {"vmid": 101, "name": "vm-prod-2", "type": "qemu", "node": "pve-02",
     "status": "stopped", "maxcpu": 2, "maxmem": 2147483648, "maxdisk": 21474836480,
     "tags": "", "pool": "gui-team-42"},
]
CLUSTER_RESOURCES_LXC = [
    {"vmid": 200, "name": "lxc-a", "type": "lxc", "node": "pve-01",
     "status": "running", "maxcpu": 1, "maxmem": 1073741824, "maxdisk": 10737418240,
     "tags": "infra", "pool": "gui-team-42"},
]
VM_STATUS_RUNNING = {"data": {"status": "running", "uptime": 12345, "cpu": 0.12,
                              "mem": 1234567890, "maxmem": 4294967296,
                              "netin": 100, "netout": 200, "diskread": 50, "diskwrite": 60}}
VM_CONFIG = {"data": {"name": "vm-prod-1", "cores": 4, "memory": 4096,
                      "tags": "prod;web", "description": "test VM"}}
RRD_HOUR = {"data": [
    {"time": 1700000000, "cpu": 0.12, "mem": 1234567890, "maxmem": 4294967296,
     "disk": 50, "maxdisk": 53687091200, "netin": 100, "netout": 200,
     "diskread": 50, "diskwrite": 60},
    {"time": 1700000060, "cpu": 0.15, "mem": 1300000000, "maxmem": 4294967296,
     "disk": 50, "maxdisk": 53687091200, "netin": 110, "netout": 210,
     "diskread": 55, "diskwrite": 65},
]}
POOL_GUI_TEAM_42 = {"data": {"comment": "team 42 pool",
    "members": [
        {"vmid": 100, "node": "pve-01", "type": "qemu", "id": "qemu/100"},
        {"vmid": 101, "node": "pve-02", "type": "qemu", "id": "qemu/101"},
        {"vmid": 200, "node": "pve-01", "type": "lxc",  "id": "lxc/200"},
    ]}}
