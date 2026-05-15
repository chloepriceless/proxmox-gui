"""D-02 tenant bootstrap with PVE-side rollback (Pattern 8 in 01-RESEARCH.md).

For every (team, active_cluster) pair, mint:

1. A PVE pool ``gui-team-<team_id>`` (D-06).
2. A PVE user ``gui-team-<team_id>@pve``.
3. A privilege-separated PVE token ``gui-team-<team_id>!api`` (D-01).
4. An ACL entry granting role ``PVEVMUser`` to the user on the pool, with
   ``propagate=1``.
5. A row in ``team_cluster_tokens`` with the (Fernet-encrypted) token value.

The whole thing is **atomic across DB + PVE**. If any step on any cluster
fails:

- The outer DB transaction is rolled back (caller does the actual rollback;
  we just stop adding rows + raise).
- A **best-effort** PVE-side cleanup walks every cluster touched (whether
  fully or partially bootstrapped) and tries ``delete_user`` then
  ``delete_pool``. Each cleanup is wrapped in try/except so a cleanup
  failure on cluster A does not prevent cluster B's cleanup.

The exception bubbled to the caller is :class:`BootstrapFailed`, carrying
the failing cluster name so the FastAPI error handler can produce a
human-readable 500 response. T-01-06-04 mitigation, verified by
``test_bootstrap_rolls_back_on_partial_failure``.

PVE naming convention (CONTEXT discretion):

- Pool:   ``gui-team-<team_id>``
- User:   ``gui-team-<team_id>@pve``
- Token:  ``api`` (full PVE-side string is ``gui-team-<id>@pve!api``)
- Role:   ``PVEVMUser`` (D-02 + D-06 — least privilege at the PVE layer)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Cluster, Team, TeamClusterToken

if TYPE_CHECKING:
    from app.clusters.registry import PVEConnectorRegistry

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------------
# Result + exception types
# ----------------------------------------------------------------------------


@dataclass
class BootstrapResult:
    """Per-cluster summary of a successful bootstrap step.

    Returned by :func:`bootstrap_tenant_on_clusters` for each cluster the
    team was provisioned on. Useful for audit / display; the secret value
    is held only transiently here — the persisted form is the
    Fernet-encrypted column in ``team_cluster_tokens``.
    """

    cluster_id: int
    poolid: str
    userid: str
    tokenid: str
    plaintext_token: str


class BootstrapFailed(Exception):
    """Raised when tenant bootstrap fails on at least one cluster.

    Carries:
        cluster_name: The name of the cluster that triggered the failure.
        original: The underlying exception (PVEAPIError, PVEAuthError, etc).

    The FastAPI exception handler in :mod:`app.main` maps this to 500 with
    ``{"detail": "Tenant bootstrap failed on cluster '<name>': <orig>"}``.
    """

    def __init__(self, *, cluster_name: str, original: BaseException) -> None:
        self.cluster_name = cluster_name
        self.original = original
        super().__init__(
            f"Tenant bootstrap failed on cluster {cluster_name!r}: {original}"
        )


# ----------------------------------------------------------------------------
# Bootstrap
# ----------------------------------------------------------------------------


async def bootstrap_tenant_on_clusters(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team: Team,
    comment: str,
) -> list[BootstrapResult]:
    """Provision PVE objects for ``team`` on every active cluster.

    Args:
        db: Active session — the caller MUST own the outer transaction.
            We add ``TeamClusterToken`` rows but do NOT commit; the caller
            commits on success or rolls back on exception.
        registry: Per-cluster connector cache.
        team: Already-flushed team row (must have ``team.id``).
        comment: Human-readable label included in PVE pool/user comments.

    Returns:
        One ``BootstrapResult`` per active cluster (in cluster id order).

    Raises:
        BootstrapFailed: any cluster failed; PVE-side rollback already
            attempted on every cluster touched.
    """
    # Empty active-cluster set → nothing to do (Plan 07's first-run scenario).
    result = await db.execute(
        select(Cluster).where(Cluster.is_active.is_(True)).order_by(Cluster.id)
    )
    clusters = list(result.scalars().all())
    if not clusters:
        return []

    poolid = f"gui-team-{team.id}"
    userid = f"gui-team-{team.id}@pve"
    tokenid = "api"

    # Track per-cluster state so the rollback knows what to clean up.
    bootstrap_state: dict[int, dict] = {}
    results: list[BootstrapResult] = []

    failing_cluster: Cluster | None = None
    failure: BaseException | None = None

    for cluster in clusters:
        state = {"pool_created": False, "user_created": False, "token": None}
        bootstrap_state[cluster.id] = state
        try:
            # Pass the outer session so the registry sees rows flushed by
            # the in-progress transaction without opening its own
            # connection (in-memory SQLite + connection-isolation; also
            # the read-your-writes idiom in production).
            conn = await registry.get(cluster.id, db=db)
            await conn.create_pool(poolid, comment=f"GUI tenant {comment}")
            state["pool_created"] = True

            await conn.create_user(userid, comment=f"GUI tenant {comment}")
            state["user_created"] = True

            token_payload = await conn.create_token(
                userid, tokenid, privsep=True,
            )
            state["token"] = token_payload
            token_value = token_payload.get("value", "")

            await conn.set_pool_acl(poolid, userid=userid, role="PVEVMUser")

            # Add row to the outer transaction (NOT committed here).
            db.add(TeamClusterToken(
                team_id=team.id,
                cluster_id=cluster.id,
                userid=userid,
                tokenid=tokenid,
                token_secret=token_value,  # EncryptedSecret column
                poolid=poolid,
            ))
            results.append(BootstrapResult(
                cluster_id=cluster.id,
                poolid=poolid,
                userid=userid,
                tokenid=tokenid,
                plaintext_token=token_value,
            ))
        except Exception as exc:  # noqa: BLE001 — capture, rollback, re-raise
            failing_cluster = cluster
            failure = exc
            break

    if failure is not None:
        # Best-effort PVE rollback on every cluster touched (including the
        # failing one — pool/user may have been created before the failing
        # step). Each cleanup wrapped in try/except — one failure should
        # never block another.
        await _rollback_pve_state(
            registry, bootstrap_state, db=db,
            poolid=poolid, userid=userid,
        )
        cluster_name = failing_cluster.name if failing_cluster else "<unknown>"
        raise BootstrapFailed(cluster_name=cluster_name, original=failure)

    return results


async def _rollback_pve_state(
    registry: PVEConnectorRegistry,
    bootstrap_state: dict[int, dict],
    *,
    db: AsyncSession,
    poolid: str,
    userid: str,
) -> None:
    """Best-effort PVE cleanup on each cluster that has any bootstrap state.

    Order: ``delete_user`` first (so the ACL goes with it), then
    ``delete_pool``. Each call is independently try/except'd — the only
    visible effect of a failure is a logged warning.
    """
    for cluster_id, state in bootstrap_state.items():
        if not (state["pool_created"] or state["user_created"]):
            continue
        try:
            # Reuse the outer session to read Cluster rows (read-your-writes
            # within the still-open transaction).
            conn = await registry.get(cluster_id, db=db)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Tenant rollback: could not load connector for cluster %s: %s",
                cluster_id, exc,
            )
            continue
        if state["user_created"]:
            try:
                await conn.delete_user(userid)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Tenant rollback: delete_user(%s) on cluster %s failed: %s",
                    userid, cluster_id, exc,
                )
        if state["pool_created"]:
            try:
                await conn.delete_pool(poolid)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Tenant rollback: delete_pool(%s) on cluster %s failed: %s",
                    poolid, cluster_id, exc,
                )


# ----------------------------------------------------------------------------
# Inverse direction — cluster-add path (Plan 02-08, Pitfall 8 / Assumption A1)
#
# bootstrap_tenant_on_clusters iterates 1 team × N clusters (called from
# team create). The cluster-add path needs the opposite: 1 cluster × N
# existing teams. Without it, /inventory has no token for the personal
# team after the first-run wizard adds a cluster, so the UI shows 0 VMs
# even though the cluster is reachable.
# ----------------------------------------------------------------------------


async def bootstrap_all_teams_on_cluster(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    cluster: Cluster,
    comment: str,
) -> list[BootstrapResult]:
    """Provision PVE pool/user/token for every active team on ``cluster``.

    Mirror of :func:`bootstrap_tenant_on_clusters` for the cluster-add and
    retroactive-backfill paths. Idempotent: teams that already have a
    ``team_cluster_tokens`` row for this cluster are skipped.

    Args:
        db: Active session — caller owns the outer transaction; commits or
            rolls back. We add ``TeamClusterToken`` rows but do NOT commit.
        registry: Per-cluster connector cache.
        cluster: The freshly-inserted (or existing) cluster row.
        comment: Human-readable label included in PVE pool/user comments.

    Returns:
        One ``BootstrapResult`` per team bootstrapped (in team id order).
        Empty list if there are no active teams, or every active team
        already has a token for this cluster.

    Raises:
        BootstrapFailed: any team failed; PVE-side rollback already
            attempted for every team touched on this cluster.
    """
    teams_result = await db.execute(
        select(Team).where(Team.is_active.is_(True)).order_by(Team.id)
    )
    teams = list(teams_result.scalars().all())
    if not teams:
        return []

    existing_result = await db.execute(
        select(TeamClusterToken.team_id).where(
            TeamClusterToken.cluster_id == cluster.id
        )
    )
    already_bootstrapped = set(existing_result.scalars().all())
    pending_teams = [t for t in teams if t.id not in already_bootstrapped]
    if not pending_teams:
        return []

    bootstrap_state: dict[int, dict] = {}
    results: list[BootstrapResult] = []

    failing_team: Team | None = None
    failure: BaseException | None = None

    conn = await registry.get(cluster.id, db=db)
    tokenid = "api"

    for team in pending_teams:
        poolid = f"gui-team-{team.id}"
        userid = f"gui-team-{team.id}@pve"
        state = {
            "pool_created": False,
            "user_created": False,
            "token": None,
            "poolid": poolid,
            "userid": userid,
        }
        bootstrap_state[team.id] = state
        try:
            await conn.create_pool(poolid, comment=f"GUI tenant {comment}")
            state["pool_created"] = True

            await conn.create_user(userid, comment=f"GUI tenant {comment}")
            state["user_created"] = True

            token_payload = await conn.create_token(
                userid, tokenid, privsep=True,
            )
            state["token"] = token_payload
            token_value = token_payload.get("value", "")

            await conn.set_pool_acl(poolid, userid=userid, role="PVEVMUser")

            db.add(TeamClusterToken(
                team_id=team.id,
                cluster_id=cluster.id,
                userid=userid,
                tokenid=tokenid,
                token_secret=token_value,
                poolid=poolid,
            ))
            results.append(BootstrapResult(
                cluster_id=cluster.id,
                poolid=poolid,
                userid=userid,
                tokenid=tokenid,
                plaintext_token=token_value,
            ))
        except Exception as exc:  # noqa: BLE001
            failing_team = team
            failure = exc
            break

    if failure is not None:
        await _rollback_pve_state_per_team(
            registry, bootstrap_state, db=db, cluster_id=cluster.id,
        )
        team_label = failing_team.name if failing_team else "<unknown>"
        raise BootstrapFailed(
            cluster_name=f"{cluster.name} (team {team_label})",
            original=failure,
        )

    return results


async def _rollback_pve_state_per_team(
    registry: PVEConnectorRegistry,
    bootstrap_state: dict[int, dict],
    *,
    db: AsyncSession,
    cluster_id: int,
) -> None:
    """PVE cleanup for the cluster-add path. Each team owns its own
    pool/user, so we clean per team_id."""
    try:
        conn = await registry.get(cluster_id, db=db)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Tenant rollback: could not load connector for cluster %s: %s",
            cluster_id, exc,
        )
        return
    for team_id, state in bootstrap_state.items():
        if not (state["pool_created"] or state["user_created"]):
            continue
        if state["user_created"]:
            try:
                await conn.delete_user(state["userid"])
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Tenant rollback: delete_user(%s) on cluster %s failed: %s",
                    state["userid"], cluster_id, exc,
                )
        if state["pool_created"]:
            try:
                await conn.delete_pool(state["poolid"])
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Tenant rollback: delete_pool(%s) on cluster %s failed: %s",
                    state["poolid"], cluster_id, exc,
                )


# ----------------------------------------------------------------------------
# Teardown — Phase 2 endpoint will use this; Plan 06 ships it for symmetry
# but never calls it from the team-delete path (D-04 letter, WARNING-7 fix).
# ----------------------------------------------------------------------------


async def teardown_tenant_on_clusters(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team: Team,
) -> None:
    """Best-effort delete of PVE pool + user for every team_cluster_tokens row.

    The DB rows are NOT deleted here — the caller cascades them via the
    team's ``ON DELETE CASCADE`` foreign key.

    Phase 1 does NOT call this from the team-delete path (D-04 option-a:
    operator must explicitly unbind first via a Phase-2 endpoint). Shipped
    here for symmetry and Phase-2 use.
    """
    result = await db.execute(
        select(TeamClusterToken).where(TeamClusterToken.team_id == team.id)
    )
    rows = list(result.scalars().all())
    for row in rows:
        try:
            conn = await registry.get(row.cluster_id, db=db)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Tenant teardown: could not load connector for cluster %s: %s",
                row.cluster_id, exc,
            )
            continue
        try:
            await conn.delete_user(row.userid)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Tenant teardown: delete_user(%s) on cluster %s failed: %s",
                row.userid, row.cluster_id, exc,
            )
        try:
            await conn.delete_pool(row.poolid)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Tenant teardown: delete_pool(%s) on cluster %s failed: %s",
                row.poolid, row.cluster_id, exc,
            )
