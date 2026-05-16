"""Model package — single import surface for all ORM classes.

This module exists to (a) populate :data:`Base.metadata` by importing every
concrete model class, and (b) re-export them so callers and Alembic can do
``from app.models import User, Cluster, ...`` without knowing the
sub-module layout.

Plan 01 deliberately did NOT create this file. Plan 02 owns it. See the
header comment of :mod:`app.models.base`.

SQLAlchemy resolves string-based class names lazily, so import order does
not affect relationship resolution. We let ``ruff`` keep the imports
alphabetised (one import block, no manual section breaks).
"""

from __future__ import annotations

from app.models.audit_log import AuditLog
from app.models.backup_schedule import BackupSchedule
from app.models.base import Base, TimestampMixin
from app.models.cluster import Cluster
from app.models.job import Job
from app.models.pat import PersonalAccessToken
from app.models.quota import Quota
from app.models.refresh_token import RefreshToken
from app.models.ssh_key import SshKey
from app.models.team import Team
from app.models.team_cluster_token import TeamClusterToken
from app.models.team_membership import TeamMembership
from app.models.user import User

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "Team",
    "TeamMembership",
    "Cluster",
    "TeamClusterToken",
    "SshKey",
    "PersonalAccessToken",
    "RefreshToken",
    "AuditLog",
    "Quota",
    "Job",
    "BackupSchedule",
]
