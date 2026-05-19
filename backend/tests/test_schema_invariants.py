"""Schema-invariant tests — T-01-02-01, T-01-02-03, T-01-02-04 mitigation.

Pitfall A5 from 01-RESEARCH.md: "the day someone adds a new table without
``team_id``, multi-tenant isolation breaks". This test prevents that
regression by introspecting :data:`Base.metadata` and asserting:

1. Every table OUTSIDE an explicit allowlist has a ``team_id`` column.
   New tables are not "team-exempt by default"; the developer must edit
   :data:`ALLOWLIST` and document why.
2. Every column whose type is :class:`EncryptedSecret` is ``NOT NULL`` —
   partial ciphertext is never a valid state.

The allowlist is keyed to the threat register's "accept" / non-tenant-row
disposition. Each entry has a one-line rationale inline.
"""

from __future__ import annotations

from app.models import Base
from app.models._types import EncryptedSecret

# ---------------------------------------------------------------------------
# Allowlist of tables that legitimately do NOT carry a ``team_id`` column.
# ---------------------------------------------------------------------------
#
# Rationale per entry (Pitfall A5 — never silently expand without comment):
#
# - users                  : authentication identity; tenant lives in teams.
# - teams                  : a team IS the tenant; team_id would be its own id.
# - clusters               : a cluster is shared infra (multi-tenant per row
#                            via team_cluster_tokens), not tenant data itself.
# - team_memberships       : tenant FK lives in PK (team_id, user_id) — the
#                            column IS team_id, just renamed for symmetry.
# - audit_log              : carries a NULLABLE team_id (Pitfall 5: present
#                            from row 1, NULL for system events). Allow-listed
#                            for the "team_id is present + NOT NULL" check;
#                            still required to expose the column at all
#                            (verified by test_audit_has_team_id_column).
# - ssh_keys               : user-scoped artefact; user_id is the natural
#                            owner. Membership in a team is irrelevant to
#                            SSH key ownership.
# - personal_access_tokens : user-scoped artefact (the "personal" in PAT).
#                            Same reasoning as ssh_keys.
# - refresh_tokens         : per-session credential bound to a user; tenants
#                            don't share refresh tokens.
# - catalog_pin            : global config (Phase 4 — D-06). The
#                            community-scripts catalog pin is operator
#                            configuration, not tenant data: one row, shared
#                            by every team, cluster-agnostic.
# - notification_seen      : per-user row (Phase 4 — D-23). The notification
#                            bell's unread cursor is owned by a single user;
#                            user_id is the tenant boundary. Same reasoning as
#                            refresh_tokens / ssh_keys — no team_id because
#                            notifications are per-user, not per-team.
# - app_setting            : global operator config (Phase 5 — D-01). The
#                            idle-timeout and audit-retention values are one
#                            row, shared by every team, cluster-agnostic.
#                            Operator policy, not tenant data — same reasoning
#                            as catalog_pin.
# - alembic_version        : Alembic housekeeping, not application data.
#
ALLOWLIST: frozenset[str] = frozenset(
    {
        "users",
        "teams",
        "clusters",
        "team_memberships",
        "audit_log",
        "ssh_keys",
        "personal_access_tokens",
        "refresh_tokens",
        "catalog_pin",
        "notification_seen",
        "app_setting",
        "alembic_version",
    }
)


def _business_tables() -> dict[str, object]:
    """Tables on Base.metadata excluding test-fixture pollution (``_test_*``)."""
    return {
        name: tbl
        for name, tbl in Base.metadata.tables.items()
        if not name.startswith("_test_")
    }


def test_every_non_allowlisted_table_has_team_id() -> None:
    """T-01-02-01: any new tenant-data table must carry team_id."""
    offenders: list[str] = []
    for name, tbl in _business_tables().items():
        if name in ALLOWLIST:
            continue
        if "team_id" not in tbl.columns:
            offenders.append(name)
    assert not offenders, (
        f"tables missing team_id (must be added or allow-listed with a "
        f"documented rationale in test_schema_invariants.py): {offenders}"
    )


def test_audit_log_carries_team_id_column() -> None:
    """audit_log is allow-listed for the NOT NULL check, but the COLUMN
    itself MUST exist (Pitfall 5: present from row 1)."""
    audit = Base.metadata.tables["audit_log"]
    assert "team_id" in audit.columns, "audit_log is missing team_id"


def test_all_encrypted_secret_columns_are_not_null() -> None:
    """T-01-02-04: partial ciphertext is never a valid state.

    Iterate every column on every table; any whose ``type`` is an
    :class:`EncryptedSecret` instance MUST be ``NOT NULL``.
    """
    offenders: list[str] = []
    for name, tbl in _business_tables().items():
        for col in tbl.columns:
            if isinstance(col.type, EncryptedSecret) and col.nullable:
                offenders.append(f"{name}.{col.name}")
    assert not offenders, (
        f"EncryptedSecret columns must be NOT NULL: {offenders}"
    )


def test_at_least_two_encrypted_secret_columns_exist() -> None:
    """T-01-02-03: defence-in-depth — ensure the at-rest secret columns
    we *know* about are encrypted.

    If this test starts failing, somebody either (a) replaced
    EncryptedSecret with String on a known-secret column (regression), or
    (b) renamed the table (rename the assertion to match).
    """
    expected_pairs = {
        ("clusters", "api_token_secret"),
        ("team_cluster_tokens", "token_secret"),
    }
    found: set[tuple[str, str]] = set()
    for name, tbl in _business_tables().items():
        for col in tbl.columns:
            if isinstance(col.type, EncryptedSecret):
                found.add((name, col.name))
    missing = expected_pairs - found
    assert not missing, (
        f"known secret columns are not EncryptedSecret-typed: {missing}"
    )
