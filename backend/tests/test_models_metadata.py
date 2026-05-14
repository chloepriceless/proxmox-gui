"""Metadata-level tests for Plan 01-02 ORM models.

These tests are *not* the formal schema-invariant test (that lives in
``test_schema_invariants.py`` and is keyed to the threat register). They are
the TDD RED tests that drive the Task-1 implementation: prove every model is
importable, the metadata is exactly 11 tables, EncryptedSecret is the actual
column type on the two ciphertext columns, and the quota CHECK constraint is
present.

After Task 1 lands these all go green; they stay in the suite as a regression
guard against accidental model deletion / renaming.
"""

from __future__ import annotations

import pytest


def test_all_eleven_models_import() -> None:
    """`from app.models import <every class>` works.

    A missing import here means either the module didn't ship or
    ``app/models/__init__.py`` doesn't re-export it.
    """
    from app.models import (  # noqa: F401
        AuditLog,
        Base,
        Cluster,
        Job,
        PersonalAccessToken,
        Quota,
        RefreshToken,
        SshKey,
        Team,
        TeamClusterToken,
        TeamMembership,
        TimestampMixin,
        User,
    )


def test_metadata_has_exactly_eleven_tables() -> None:
    """``Base.metadata.tables`` is the source of truth for Alembic autogen."""
    from app.models import Base

    expected = {
        "users",
        "teams",
        "team_memberships",
        "clusters",
        "team_cluster_tokens",
        "ssh_keys",
        "personal_access_tokens",
        "refresh_tokens",
        "audit_log",
        "quotas",
        "jobs",
    }
    actual = set(Base.metadata.tables.keys())
    assert actual == expected, (
        f"unexpected tables; missing={expected - actual} extra={actual - expected}"
    )
    assert len(Base.metadata.tables) == 11


def test_cluster_api_token_secret_uses_encrypted_secret() -> None:
    from app.models import Base
    from app.models._types import EncryptedSecret

    col = Base.metadata.tables["clusters"].columns["api_token_secret"]
    assert isinstance(col.type, EncryptedSecret)
    assert col.nullable is False


def test_team_cluster_token_secret_uses_encrypted_secret() -> None:
    from app.models import Base
    from app.models._types import EncryptedSecret

    col = Base.metadata.tables["team_cluster_tokens"].columns["token_secret"]
    assert isinstance(col.type, EncryptedSecret)
    assert col.nullable is False


def test_quota_has_xor_check_constraint() -> None:
    """D-08: a quota row is either team-scoped XOR user-scoped, never both / neither."""
    from sqlalchemy import CheckConstraint

    from app.models import Base

    quotas = Base.metadata.tables["quotas"]
    check_names = {
        c.name for c in quotas.constraints if isinstance(c, CheckConstraint)
    }
    assert "ck_quota_team_xor_user" in check_names, (
        f"missing XOR check; found: {check_names}"
    )


def test_team_cluster_tokens_unique_team_cluster() -> None:
    """D-02: one privsep token per (team, cluster)."""
    from sqlalchemy import UniqueConstraint

    from app.models import Base

    tct = Base.metadata.tables["team_cluster_tokens"]
    uniques = [c for c in tct.constraints if isinstance(c, UniqueConstraint)]
    # The (team_id, cluster_id) pair must be unique somewhere — either as a
    # named UniqueConstraint or as a unique index.
    found = False
    for u in uniques:
        cols = {c.name for c in u.columns}
        if cols == {"team_id", "cluster_id"}:
            found = True
            break
    if not found:
        # Also accept a unique index covering the pair.
        for idx in tct.indexes:
            cols = {c.name for c in idx.columns}
            if idx.unique and cols == {"team_id", "cluster_id"}:
                found = True
                break
    assert found, "team_cluster_tokens missing UNIQUE(team_id, cluster_id)"


def test_team_membership_composite_pk() -> None:
    from app.models import Base

    tm = Base.metadata.tables["team_memberships"]
    pk_cols = {c.name for c in tm.primary_key.columns}
    assert pk_cols == {"team_id", "user_id"}


def test_refresh_token_self_referential_fk() -> None:
    from app.models import Base

    rt = Base.metadata.tables["refresh_tokens"]
    col = rt.columns["replaced_by_id"]
    assert col.nullable is True
    fks = list(col.foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "refresh_tokens"


def test_audit_log_team_id_nullable() -> None:
    """Pitfall 5: audit_log carries team_id from row 1, NULLABLE for system events."""
    from app.models import Base

    audit = Base.metadata.tables["audit_log"]
    assert "team_id" in audit.columns
    assert audit.columns["team_id"].nullable is True


def test_pat_has_lookup_prefix_index() -> None:
    from app.models import Base

    pats = Base.metadata.tables["personal_access_tokens"]
    indexed_cols = {col.name for idx in pats.indexes for col in idx.columns}
    assert "lookup_prefix" in indexed_cols


def test_job_idempotency_key_unique_nullable() -> None:
    """Pitfall 12: idempotency keys de-duplicate writes; nullable for boot-time entries."""
    from app.models import Base

    jobs = Base.metadata.tables["jobs"]
    col = jobs.columns["idempotency_key"]
    assert col.nullable is True
    assert col.unique is True or any(
        idx.unique and {c.name for c in idx.columns} == {"idempotency_key"}
        for idx in jobs.indexes
    )


@pytest.mark.asyncio
async def test_encrypted_secret_column_round_trip(session_factory) -> None:
    """ORM-level round trip proves bind/result hooks fire end-to-end."""
    from app.models import Cluster

    async with session_factory() as s:
        c = Cluster(
            name="pve1",
            host="10.0.0.10",
            port=8006,
            verify_ssl=True,
            token_user="root@pam",
            token_name="gui-bootstrap",
            api_token_secret="super-secret-token-value",
        )
        s.add(c)
        await s.commit()
        await s.refresh(c)
        assert c.api_token_secret == "super-secret-token-value"
