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
