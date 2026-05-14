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

Phase 2 additions (Plan 02-01):
- :meth:`get_for_team` — returns per-team privsep connector from team_cluster_tokens.
- :meth:`invalidate_for_team` — drops cached per-team connector.
- :meth:`start_probe` / :meth:`stop_probe` / :meth:`stop_all_probes` — background
  health probe lifecycle management.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

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
            on demand when no caller-supplied session is available. The
            factory's lifetime must outlive the registry.
    """

    def __init__(
        self,
        cipher: SecretCipher | None,
        session_factory: async_sessionmaker,
    ) -> None:
        self._cipher = cipher
        self._session_factory = session_factory
        self._connectors: dict[int, PVEConnector] = {}
        # Phase 2: per-(team_id, cluster_id) connector cache.
        self._team_connectors: dict[tuple[int, int], PVEConnector] = {}
        # Phase 2: background health probe tasks keyed by cluster_id.
        self._probes: dict[int, asyncio.Task] = {}

    async def get(
        self,
        cluster_id: int,
        *,
        db: AsyncSession | None = None,
    ) -> PVEConnector:
        """Return the cached connector, building one on first access.

        Args:
            cluster_id: The cluster row id.
            db: Optional caller-supplied session. When passed, the registry
                loads the Cluster row through it instead of opening its own
                session — important for ``bootstrap_tenant_on_clusters`` where
                the outer transaction has flushed (but not committed) rows
                that a separate connection couldn't see (in-memory SQLite +
                connection-isolation, but also production semantics for any
                read-your-writes pattern).

        Raises:
            LookupError: cluster row not found in DB.
        """
        if cluster_id in self._connectors:
            return self._connectors[cluster_id]

        if db is not None:
            row = await db.get(Cluster, cluster_id)
        else:
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
        """Drop every cached connector — useful for tests.

        NOTE: probe tasks must be stopped via ``stop_all_probes()`` separately —
        asyncio cancellation needs an awaitable context.
        """
        self._connectors.clear()
        self._team_connectors.clear()

    # ------------------------------------------------------------------
    # Phase 2: per-team connector resolution
    # ------------------------------------------------------------------

    async def get_for_team(
        self,
        *,
        cluster_id: int,
        team_id: int,
        db: AsyncSession | None = None,
    ) -> PVEConnector:
        """Return the per-team privsep connector for (team, cluster).

        UNIQUE(team_id, cluster_id) on team_cluster_tokens guarantees at most
        one row per pair. The Phase 1 D-02 auto-bootstrap mints a token row for
        every team (including personal teams) on every active cluster — so a
        missing row is a genuine error, not a "no quota yet" case.

        Raises:
            LookupError: no team_cluster_tokens row or cluster not found.
        """
        from app.models import TeamClusterToken

        key = (team_id, cluster_id)
        if key in self._team_connectors:
            return self._team_connectors[key]

        stmt = select(TeamClusterToken).where(
            TeamClusterToken.team_id == team_id,
            TeamClusterToken.cluster_id == cluster_id,
        )
        if db is not None:
            result = await db.execute(stmt)
        else:
            async with self._session_factory() as session:
                result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            raise LookupError(
                f"no team_cluster_tokens row for team={team_id} cluster={cluster_id}"
            )

        # We also need the Cluster row for host/port/verify_ssl/tls_fingerprint.
        if db is not None:
            cluster_row = await db.get(Cluster, cluster_id)
        else:
            async with self._session_factory() as session:
                cluster_row = await session.get(Cluster, cluster_id)
        if cluster_row is None:
            raise LookupError(f"cluster {cluster_id} not found")

        connector = PVEConnector(
            host=cluster_row.host,
            port=cluster_row.port,
            token_user=row.userid,
            token_name=row.tokenid,
            token_value=row.token_secret,
            verify_ssl=cluster_row.verify_ssl,
            tls_fingerprint=cluster_row.tls_fingerprint,
        )
        self._team_connectors[key] = connector
        return connector

    def invalidate_for_team(self, *, team_id: int, cluster_id: int) -> None:
        """Drop the cached per-team connector for (team_id, cluster_id) (no-op if absent)."""
        self._team_connectors.pop((team_id, cluster_id), None)

    # ------------------------------------------------------------------
    # Phase 2: background health probe lifecycle
    # ------------------------------------------------------------------

    async def start_probe(
        self,
        cluster_id: int,
        *,
        db: AsyncSession | None = None,
        interval: float = 15.0,
    ) -> None:
        """Spawn a background asyncio.Task probing ``/version`` every ``interval`` seconds.

        No-op if a probe already runs for ``cluster_id``.
        """
        if cluster_id in self._probes:
            return
        from app.clusters.health import health_probe_loop

        connector = await self.get(cluster_id, db=db)
        task = asyncio.create_task(
            health_probe_loop(connector, interval=interval),
            name=f"pve-probe-{cluster_id}",
        )
        self._probes[cluster_id] = task

    async def stop_probe(self, cluster_id: int) -> None:
        """Cancel + await the probe for ``cluster_id`` (no-op if absent)."""
        task = self._probes.pop(cluster_id, None)
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def stop_all_probes(self) -> None:
        """Cancel + await every probe — used in app shutdown and test teardown."""
        for cluster_id in list(self._probes.keys()):
            await self.stop_probe(cluster_id)
