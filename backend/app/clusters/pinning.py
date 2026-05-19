"""TLS leaf-certificate fingerprint pinning for self-signed PVE clusters (D-20).

Phase 1 deferred per-cluster TLS pinning; this module closes the carryover
TLS-pinning verification item. The model is **capture-on-register (TOFU)**:
during the cluster "Test" flow :func:`capture_fingerprint` fetches the PVE
leaf certificate's SHA-256, the admin confirms it, and it is persisted to
``clusters.tls_fingerprint``. Every subsequent connection is validated against
that pin via :class:`FingerprintPinningAdapter` — cert-chain (CA) validation
stays off, the fingerprint *is* the trust anchor.

Mechanism (RESEARCH §Pattern 1, verified-correct):

- ``urllib3``'s ``HTTPSConnectionPool`` accepts ``assert_fingerprint`` — when
  set it verifies the presented leaf cert's SHA-256 against the pin and raises
  ``ssl.SSLError`` on mismatch, independently of any CA-chain check.
- ``requests`` has no fingerprint API, but it delegates connection-pool
  construction to a mountable :class:`requests.adapters.HTTPAdapter`. Subclass
  it and inject ``assert_fingerprint`` into ``pool_kwargs``.

Mount seam (the spike — RESEARCH Open Question Q1, resolved):

  proxmoxer 2.3.0 builds its ``ProxmoxHttpSession`` (a ``requests.Session``
  subclass) exactly once, at ``ProxmoxAPI`` construction, and stores it at
  ``ProxmoxAPI._store["session"]`` — every API call reuses that same session
  object (``proxmoxer/core.py:143,216``). Mounting the adapter on that
  persistent session object is therefore reliable: see
  :func:`mount_pinning_adapter`. The session-level ``request()`` falls back to
  ``verify = auth.verify_ssl`` when ``verify`` is unset, so ``verify_ssl=False``
  keeps CA-chain validation off while the adapter enforces the fingerprint —
  exactly the design.

A negative test (``tests/test_tls_pinning.py``) asserts a wrong-cert host is
refused — Pitfall 4: a pin that cannot fail is not a pin.
"""

from __future__ import annotations

import hashlib
import socket
import ssl

from requests.adapters import HTTPAdapter


class FingerprintPinningAdapter(HTTPAdapter):
    """Pins the PVE leaf cert by SHA-256 fingerprint (D-20 TOFU).

    ``assert_fingerprint`` is a urllib3 connection-pool kwarg. When set,
    urllib3 verifies the presented leaf cert's SHA-256 against it and raises
    ``ssl.SSLError`` on mismatch — independently of CA-chain checks. The
    fingerprint is normalised to colon-free lowercase hex (``ab:cd`` → ``abcd``)
    so an operator can paste either ``ssh-keygen``-style colon-grouped hex or
    the bare digest.
    """

    def __init__(self, fingerprint: str, **kw: object) -> None:
        self._fingerprint = fingerprint.replace(":", "").lower()
        super().__init__(**kw)  # type: ignore[arg-type]

    def init_poolmanager(  # type: ignore[override]
        self,
        connections: int,
        maxsize: int,
        block: bool = False,
        **pool_kwargs: object,
    ) -> None:
        pool_kwargs["assert_fingerprint"] = self._fingerprint
        # Disable hostname/CA checks — the fingerprint is the trust anchor.
        pool_kwargs["assert_hostname"] = False
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)

    def proxy_manager_for(self, proxy: str, **proxy_kwargs: object):  # type: ignore[override]
        # A connection routed through an HTTPS proxy must pin too.
        proxy_kwargs["assert_fingerprint"] = self._fingerprint
        proxy_kwargs["assert_hostname"] = False
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def mount_pinning_adapter(client: object, fingerprint: str) -> None:
    """Mount a :class:`FingerprintPinningAdapter` on a ``ProxmoxAPI``'s session.

    proxmoxer 2.3.0 keeps a single persistent ``requests.Session`` at
    ``ProxmoxAPI._store["session"]`` and reuses it for every call (the spike —
    see module docstring). Mounting the adapter for ``https://`` on that
    session pins every subsequent PVE call.

    Best-effort: if a future proxmoxer release reshapes the store, this raises
    :class:`RuntimeError` so the caller (the connector) can surface a clear
    error rather than silently shipping an unpinned connection (Pitfall 4).
    """
    store = getattr(client, "_store", None)
    session = store.get("session") if isinstance(store, dict) else None
    if session is None or not hasattr(session, "mount"):
        raise RuntimeError(
            "proxmoxer session mount seam not found — TLS fingerprint pinning "
            "cannot be applied; refusing to ship an unpinned connection."
        )
    session.mount("https://", FingerprintPinningAdapter(fingerprint))


def capture_fingerprint(host: str, port: int) -> str:
    """Fetch the PVE leaf certificate and return its SHA-256 as lowercase hex.

    Stdlib-only (no proxmoxer needed) — used during the ``POST /clusters/test``
    dry-run so the admin can confirm the fingerprint before it is pinned (D-20
    capture-on-register TOFU). CA-chain and hostname validation are disabled
    deliberately: the whole point is to read a *self-signed* cert's fingerprint.

    Raises:
        OSError / ssl.SSLError: the host is unreachable or the TLS handshake
            failed — the caller maps this to a friendly "couldn't reach" error.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            der = ssock.getpeercert(binary_form=True)
    if not der:
        raise ssl.SSLError("peer presented no certificate")
    return hashlib.sha256(der).hexdigest()  # colon-free lowercase hex
