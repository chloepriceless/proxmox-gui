"""Phase-1 carryover regression tests (plan 05-02, D-19).

One test module covering the correctness/security carryover items that are
behavioural (not pure-config): ME-01, IN-01, IN-02, IN-03, LO-01. The TLS
pinning carryover lives in ``test_tls_pinning.py``; the rate-limiter carryover
in ``test_rate_limit.py``; the config/deploy carryover in ``test_config.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models import AuditLog, PersonalAccessToken, Team, TeamMembership, User
from tests.factories import login_as, make_user


# ---------------------------------------------------------------------------
# ME-01 + IN-02 — first-run admin creation is one atomic transaction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_initial_admin_is_atomic(session_factory):
    """ME-01: create_initial_admin commits user + personal team + membership
    once. After it returns, all three rows exist and are consistent."""
    from app.setup.service import create_initial_admin

    async with session_factory() as session:
        user, team = await create_initial_admin(
            session,
            username="firstadmin",
            email="admin@example.test",
            password="adminpass12345",
        )
        assert user.is_admin is True
        assert team.personal is True
        assert team.name == f"personal-{user.id}"

    # Verify in a FRESH session that everything committed together.
    async with session_factory() as session:
        u = (
            await session.execute(
                select(User).where(User.username == "firstadmin")
            )
        ).scalar_one()
        t = (
            await session.execute(
                select(Team).where(Team.name == f"personal-{u.id}")
            )
        ).scalar_one()
        m = await session.get(TeamMembership, (t.id, u.id))
        assert m is not None  # membership bound — no orphaned team


@pytest.mark.asyncio
async def test_create_team_for_admin_bootstrap_does_not_commit(session_factory):
    """IN-02: the internal bootstrap path flushes but does NOT commit — the
    caller owns the transaction, which is what makes ME-01 atomic."""
    from app.teams.service import create_team_for_admin_bootstrap

    async with session_factory() as session:
        team = await create_team_for_admin_bootstrap(session, name="personal-99")
        assert team.id is not None  # flushed
        await session.rollback()  # caller-owned txn — rollback must drop it

    async with session_factory() as session:
        found = (
            await session.execute(
                select(Team).where(Team.name == "personal-99")
            )
        ).scalar_one_or_none()
        assert found is None  # uncommitted → rolled back cleanly


def test_create_team_signature_dropped_internal_flag():
    """IN-02: the fragile ``_internal`` flag is gone from create_team."""
    import inspect

    from app.teams.service import create_team

    params = inspect.signature(create_team).parameters
    assert "_internal" not in params
    assert "personal" not in params


# ---------------------------------------------------------------------------
# IN-01 — PAT presented after the owning user is disabled is audited
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_disabled_user_pat_writes_audit_entry(session_factory):
    """IN-01: a valid PAT whose owning user is disabled is rejected AND an
    audit_log row is written so the rejection is observable."""
    from app.pats.service import mint_pat, resolve_pat

    # Create a user, mint a PAT, then disable the user.
    user = await make_user(session_factory, username="patdisabled")
    async with session_factory() as session:
        u = await session.get(User, user.id)
        minted = await mint_pat(session, user=u, name="ci", expires_at=None)
        plaintext = minted.plaintext
        await session.commit()

    async with session_factory() as session:
        u = await session.get(User, user.id)
        u.is_active = False
        await session.commit()

    # Resolve the still-valid PAT — must reject (None) and audit.
    async with session_factory() as session:
        resolved = await resolve_pat(session, token=plaintext)
        assert resolved is None

    async with session_factory() as session:
        rows = (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.action == "pat.rejected_user_disabled"
                )
            )
        ).scalars().all()
        assert len(rows) >= 1
        assert rows[0].result == "failure"
        assert rows[0].target_type == "pat"


@pytest.mark.asyncio
async def test_active_user_pat_writes_no_disabled_audit(session_factory):
    """IN-01 negative: a PAT for an ACTIVE user resolves and writes no
    pat.rejected_user_disabled audit noise."""
    from app.pats.service import mint_pat, resolve_pat

    user = await make_user(session_factory, username="patactive")
    async with session_factory() as session:
        u = await session.get(User, user.id)
        minted = await mint_pat(session, user=u, name="ci", expires_at=None)
        plaintext = minted.plaintext
        await session.commit()

    async with session_factory() as session:
        resolved = await resolve_pat(session, token=plaintext)
        assert resolved is not None

    async with session_factory() as session:
        rows = (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.action == "pat.rejected_user_disabled"
                )
            )
        ).scalars().all()
        assert rows == []


# ---------------------------------------------------------------------------
# IN-03 — cluster PATCH rejects token_user without api_token_secret
# ---------------------------------------------------------------------------


def test_cluster_update_token_user_without_secret_rejected():
    """IN-03: changing token_user alone is a validation error — a PVE API
    token belongs to its user, the stored secret would silently mismatch."""
    import pydantic

    from app.clusters.schemas import ClusterUpdate

    with pytest.raises(pydantic.ValidationError):
        ClusterUpdate(token_user="newuser@pam")


def test_cluster_update_token_pair_together_accepted():
    """IN-03: token_user + api_token_secret supplied together is accepted."""
    from app.clusters.schemas import ClusterUpdate

    upd = ClusterUpdate(
        token_user="newuser@pam",
        api_token_secret="00000000-0000-0000-0000-000000000000",
    )
    assert upd.token_user == "newuser@pam"


def test_cluster_update_token_name_alone_accepted():
    """IN-03: token_name may still change alone — it only re-labels the same
    token-user's token, no credential mismatch is possible."""
    from app.clusters.schemas import ClusterUpdate

    upd = ClusterUpdate(token_name="relabelled")
    assert upd.token_name == "relabelled"


def test_cluster_update_other_fields_alone_accepted():
    """IN-03 must not over-trigger — a name-only PATCH still validates."""
    from app.clusters.schemas import ClusterUpdate

    upd = ClusterUpdate(name="renamed-cluster")
    assert upd.name == "renamed-cluster"


# ---------------------------------------------------------------------------
# LO-01 — disabled-user login is constant-time (no Argon2id-skip leak)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_disabled_user_login_runs_password_verify(session_factory, monkeypatch):
    """LO-01: a disabled-user login attempt runs verify_password (against the
    dummy hash) BEFORE raising 403 — so its timing matches a wrong-password
    attempt and the is_active state does not leak via response latency."""
    import app.auth.service as auth_service
    from app.auth.service import login

    await make_user(
        session_factory, username="disabledlogin", is_active=False,
    )

    calls: list[bool] = []
    real_verify = auth_service.verify_password

    def _counting_verify(password: str, hashed: str) -> bool:
        calls.append(True)
        return real_verify(password, hashed)

    monkeypatch.setattr(auth_service, "verify_password", _counting_verify)

    async with session_factory() as session:
        with pytest.raises(Exception) as exc_info:
            await login(
                session,
                username="disabledlogin",
                password="testpass12345",
                user_agent=None,
                ip=None,
            )
    # 403 raised, AND verify_password was invoked on the disabled path.
    assert getattr(exc_info.value, "status_code", None) == 403
    assert len(calls) == 1, "disabled-user path must run one verify_password"
