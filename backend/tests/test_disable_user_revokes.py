"""End-to-end test: disabling a user immediately revokes their refresh
tokens AND their personal access tokens (Plan 01-07 Task 2, AUTH-07).

The critical invariant from CONTEXT D-? (disable-user-semantics) + the
plan's <important_constraints>: PATCH ``is_active=False`` on a user MUST
synchronously call :func:`app.auth.service.revoke_user_sessions`, which
revokes every non-revoked refresh row + every non-revoked PAT row for
that user, committing inside the same transaction.

Threat-model link: T-01-07-06 — disabling a user with their old refresh
token still working is a tampering threat. We mitigate by calling
``revoke_user_sessions`` on every is_active True→False transition.

Test plan:
1. Admin creates user U via /api/v1/users/.
2. U logs in → access + refresh + csrf cookies.
3. U mints a PAT P.
4. Admin PATCHes U with {is_active: false}.
5. Verify:
   - POST /api/v1/auth/refresh with U's old refresh cookie → 401.
   - GET /api/v1/me/ with Authorization: Bearer P → 401.
"""

from __future__ import annotations

import pytest

from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_disable_user_revokes_refresh_and_pat_end_to_end(
    client, session_factory,
):
    # 1. Bootstrap admin.
    admin = await make_user(
        session_factory, username="adminZ", password="adminpass12345",
        is_admin=True,
    )
    admin_cookies = await login_as(
        client, username="adminZ", password="adminpass12345",
    )
    admin_csrf = admin_cookies["csrf_token"]

    # 2. Admin creates user U.
    create_resp = await client.post(
        "/api/v1/users/",
        cookies=admin_cookies,
        headers={"X-CSRF-Token": admin_csrf},
        json={
            "username": "diabled_u",
            "email": "diabled_u@example.com",
            "password": "userpass12345",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    u_id = create_resp.json()["id"]

    # 3. U logs in.
    u_cookies = await login_as(
        client, username="diabled_u", password="userpass12345",
    )
    u_refresh = u_cookies["refresh_token"]
    u_csrf = u_cookies["csrf_token"]

    # 4. U mints a PAT.
    pat_resp = await client.post(
        "/api/v1/me/tokens/",
        cookies=u_cookies,
        headers={"X-CSRF-Token": u_csrf},
        json={"name": "test-pat"},
    )
    assert pat_resp.status_code == 201, pat_resp.text
    pat_plaintext = pat_resp.json()["token"]
    assert pat_plaintext.startswith("pat_")

    # Sanity: PAT works before disable.
    me_before = await client.get(
        "/api/v1/me/", headers={"Authorization": f"Bearer {pat_plaintext}"},
    )
    assert me_before.status_code == 200, me_before.text

    # 5. Admin disables U.
    disable_resp = await client.patch(
        f"/api/v1/users/{u_id}",
        cookies=admin_cookies,
        headers={"X-CSRF-Token": admin_csrf},
        json={"is_active": False},
    )
    assert disable_resp.status_code == 200, disable_resp.text

    # 6. Old refresh cookie is dead.
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": u_refresh},
    )
    assert refresh_resp.status_code == 401, refresh_resp.text

    # 7. PAT bearer auth is dead.
    me_after = await client.get(
        "/api/v1/me/", headers={"Authorization": f"Bearer {pat_plaintext}"},
    )
    assert me_after.status_code == 401, me_after.text


@pytest.mark.asyncio
async def test_re_enable_does_not_un_revoke_old_credentials(
    client, session_factory,
):
    """Once revoked, refresh tokens stay dead — even after re-enable.

    Re-enabling a user does NOT resurrect their old refresh tokens or PATs.
    The user must log in again (new credentials). This guards against a
    'disable + re-enable' bypass of session revocation.
    """
    admin = await make_user(
        session_factory, username="adminZZ", password="adminpass12345",
        is_admin=True,
    )
    admin_cookies = await login_as(
        client, username="adminZZ", password="adminpass12345",
    )
    admin_csrf = admin_cookies["csrf_token"]

    create_resp = await client.post(
        "/api/v1/users/",
        cookies=admin_cookies,
        headers={"X-CSRF-Token": admin_csrf},
        json={
            "username": "flipflop_u",
            "email": "flipflop_u@example.com",
            "password": "userpass12345",
        },
    )
    u_id = create_resp.json()["id"]
    u_cookies = await login_as(
        client, username="flipflop_u", password="userpass12345",
    )
    u_refresh = u_cookies["refresh_token"]

    # Disable.
    await client.patch(
        f"/api/v1/users/{u_id}",
        cookies=admin_cookies, headers={"X-CSRF-Token": admin_csrf},
        json={"is_active": False},
    )
    # Re-enable.
    re_enable = await client.patch(
        f"/api/v1/users/{u_id}",
        cookies=admin_cookies, headers={"X-CSRF-Token": admin_csrf},
        json={"is_active": True},
    )
    assert re_enable.status_code == 200

    # Old refresh stays dead.
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": u_refresh},
    )
    assert refresh_resp.status_code == 401, refresh_resp.text
