"""Quota usage derivation (02-RESEARCH §Common Operation 4).

Anti-pattern guard (02-RESEARCH §Anti-Patterns): NEVER maintain an in-memory
counter. Always recompute from the connector's resource cache.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.registry import PVEConnectorRegistry
from app.models import TeamClusterToken
from app.quotas.schemas import QuotaUsage


async def compute_team_usage(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team_id: int,
    cluster_id: int,
) -> QuotaUsage:
    """Recompute current usage from the connector's resource cache.

    Anti-pattern guard (02-RESEARCH §Anti-Patterns): NEVER maintain an
    in-memory counter. Always recompute.
    """
    tok = (await db.execute(
        select(TeamClusterToken).where(
            TeamClusterToken.team_id == team_id,
            TeamClusterToken.cluster_id == cluster_id,
        )
    )).scalar_one_or_none()
    if tok is None:
        return QuotaUsage()
    connector = await registry.get_for_team(
        cluster_id=cluster_id, team_id=team_id, db=db,
    )
    snapshot, _is_stale = await connector.list_resources()
    usage = QuotaUsage()
    for item in snapshot:
        if item.get("pool") != tok.poolid:
            continue
        usage.cpu_cores += int(item.get("maxcpu") or 0)
        usage.ram_bytes += int(item.get("maxmem") or 0)
        usage.disk_bytes += int(item.get("maxdisk") or 0)
        if item.get("type") == "qemu":
            usage.vm_count += 1
        elif item.get("type") == "lxc":
            usage.lxc_count += 1
    return usage
