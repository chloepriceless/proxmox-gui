"""Small factory helpers for auth-related test setup.

Reusable across :mod:`test_auth`, :mod:`test_refresh_rotation`,
:mod:`test_csrf`, :mod:`test_ssh_keys`, :mod:`test_pats`.

These are deliberately tiny — full Pydantic Factories-style support is overkill
for Phase-1's surface area. Each helper is one ORM write plus an optional
HTTP login round-trip.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.passwords import hash_password
from app.models import Team, TeamMembership, User


async def make_user(
    session_factory: async_sessionmaker[Any],
    *,
    username: str = "u1",
    email: str | None = None,
    password: str = "testpass12345",
    is_admin: bool = False,
    is_active: bool = True,
    with_personal_team: bool = True,
) -> User:
    """Insert a User row directly via the test session factory.

    When ``with_personal_team`` is True (the default) a matching personal team
    is created with the canonical ``personal-<user_id>`` name and the user is
    added as a member — this mirrors what Plan 07's ``create_user`` flow will
    eventually do, but inline so the auth tests don't depend on that flow.
    """
    if email is None:
        email = f"{username}@example.test"
    async with session_factory() as session:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            is_admin=is_admin,
            is_active=is_active,
        )
        session.add(user)
        await session.flush()  # populate user.id

        if with_personal_team:
            team = Team(name=f"personal-{user.id}", personal=True, is_active=True)
            session.add(team)
            await session.flush()
            session.add(TeamMembership(team_id=team.id, user_id=user.id))

        await session.commit()
        await session.refresh(user)
        return user


async def login_as(
    client: AsyncClient, *, username: str, password: str
) -> dict[str, str]:
    """POST /api/v1/auth/login and return the response cookies as a dict.

    Raises ``AssertionError`` if login does not return 200 — tests should
    handle expected-failure paths inline.
    """
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, (
        f"login failed: {response.status_code} {response.text}"
    )
    return dict(response.cookies)
