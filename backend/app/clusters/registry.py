"""Per-cluster connector cache (Pattern 7 in 01-RESEARCH.md).

The registry is a process-local lazy cache of :class:`PVEConnector`
instances keyed by cluster id. Building a connector is cheap (it just
instantiates a proxmoxer session); the cache exists to (a) keep the
proxmoxer-internal ``requests.Session`` warm between calls and (b) ensure
we read the encrypted token from the DB exactly once per cluster.

Lifecycle invariants:

- The registry instance lives on ``app.state.registry`` for the lifetime of
  the FastAPI app. Tests build a fresh registry per fixture.
- :meth:`invalidate` is called from :func:`app.clusters.service.delete_cluster`
  and :func:`app.clusters.service.update_cluster` whenever the underlying
  cluster row (or its token) might have changed. Cached connectors don't
  survive a row update.
- :meth:`clear_all` exists for test cleanup.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.clusters.connector import PVEConnector
from app.models import Cluster

if TYPE_CHECKING:
    from app.core.cipher import SecretCipher


class PVEConnectorRegistry:
    """Lazy per-cluster connector cache.

    Args:
        cipher: Reserved for future use — the connector itself receives
            already-decrypted tokens via the ``EncryptedSecret`` TypeDecorator,
            but we keep the cipher reference so Phase 2's tenant-scoped
            registry variant has a stable injection point.
        session_factory: ``async_sessionmaker`` used to load Cluster rows
            on demand. The factory's lifetime must outlive the registry.
    """

    def __init__(
        self,
        cipher: SecretCipher | None,
        session_factory: async_sessionmaker,
    ) -> None:
        self._cipher = cipher
        self._session_factory = session_factory
        self._connectors: dict[int, PVEConnector] = {}

    async def get(self, cluster_id: int) -> PVEConnector:
        """Return the cached connector, building one on first access.

        Raises:
            LookupError: cluster row not found in DB.
        """
        if cluster_id in self._connectors:
            return self._connectors[cluster_id]

        async with self._session_factory() as session:
            row = await session.get(Cluster, cluster_id)
            if row is None:
                raise LookupError(f"cluster {cluster_id} not found")
            # EncryptedSecret transparently decrypted ``api_token_secret``
            # when the row was loaded. We pass the plaintext to the connector.
            connector = PVEConnector(
                host=row.host,
                port=row.port,
                token_user=row.token_user,
                token_name=row.token_name,
                token_value=row.api_token_secret,
                verify_ssl=row.verify_ssl,
                tls_fingerprint=row.tls_fingerprint,
            )

        self._connectors[cluster_id] = connector
        return connector

    def invalidate(self, cluster_id: int) -> None:
        """Drop the cached connector for ``cluster_id`` (no-op if absent)."""
        self._connectors.pop(cluster_id, None)

    def clear_all(self) -> None:
        """Drop every cached connector — useful for tests."""
        self._connectors.clear()
