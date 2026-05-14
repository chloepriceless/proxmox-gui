"""PAT route + service tests (Plan 01-05 Task 2).

Behaviours from the plan:

- POST /api/v1/me/tokens returns 201 with ``{id, name, plaintext: "pat_..."}``.
- GET /api/v1/me/tokens returns metadata + ``prefix_preview`` only — never
  plaintext (T-01-05-06).
- Bearer pat_<plaintext> on GET /api/v1/me/ returns 200 with mode=pat.
- POST with expires_at in the past → 422.
- DELETE /api/v1/me/tokens/{id} → 204; subsequent Bearer auth with that
  token → 401.
- resolve_pat is constant-time across candidates sharing a lookup_prefix
  (synthetic test: insert two rows with the same prefix; both must resolve
  to the right user).
- PAT-authed request to /api/v1/me/tokens/ rejected 403 (T-01-05-10).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import PersonalAccessToken
from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_mint_returns_plaintext_once(client, session_factory):
    await make_user(session_factory, username="patu1")
    cookies = await login_as(client, username="patu1", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    response = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "ci-token", "expires_at": None},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "ci-token"
    assert body["plaintext"].startswith("pat_")
    # Plaintext body is ≥ 16 chars after the prefix (24 base64url chars from
    # secrets.token_urlsafe(18)).
    assert len(body["plaintext"]) > 16


@pytest.mark.asyncio
async def test_list_returns_metadata_only_no_plaintext(client, session_factory):
    await make_user(session_factory, username="patu2")
    cookies = await login_as(client, username="patu2", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "tok-a", "expires_at": None},
    )
    await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "tok-b", "expires_at": None},
    )

    response = await client.get("/api/v1/me/tokens/", cookies=cookies)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    for it in items:
        assert "plaintext" not in it
        assert it["prefix_preview"].startswith("pat_")
        assert it["prefix_preview"].endswith("...")


@pytest.mark.asyncio
async def test_bearer_pat_on_me_returns_200(client, session_factory):
    await make_user(session_factory, username="patu3")
    cookies = await login_as(client, username="patu3", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    minted = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "bearer-test", "expires_at": None},
    )
    pat = minted.json()["plaintext"]

    # New client (no cookies) — just Bearer header.
    response = await client.get(
        "/api/v1/me/",
        headers={"Authorization": f"Bearer {pat}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["username"] == "patu3"


@pytest.mark.asyncio
async def test_mint_with_past_expires_at_returns_422(client, session_factory):
    await make_user(session_factory, username="patu4")
    cookies = await login_as(client, username="patu4", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    response = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "expired", "expires_at": past},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_delete_revokes_and_bearer_fails(client, session_factory):
    await make_user(session_factory, username="patu5")
    cookies = await login_as(client, username="patu5", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    minted = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "doomed", "expires_at": None},
    )
    body = minted.json()
    pat = body["plaintext"]
    pat_id = body["id"]

    # Sanity: it works first.
    r1 = await client.get(
        "/api/v1/me/",
        headers={"Authorization": f"Bearer {pat}"},
    )
    assert r1.status_code == 200

    # Revoke.
    deleted = await client.delete(
        f"/api/v1/me/tokens/{pat_id}",
        cookies=cookies,
        headers=csrf,
    )
    assert deleted.status_code == 204

    # Subsequent Bearer auth fails.
    r2 = await client.get(
        "/api/v1/me/",
        headers={"Authorization": f"Bearer {pat}"},
    )
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_pat_cannot_manage_tokens(client, session_factory):
    """T-01-05-10: PAT-authenticated request to /api/v1/me/tokens/* → 403."""
    await make_user(session_factory, username="patu6")
    cookies = await login_as(client, username="patu6", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    minted = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers=csrf,
        json={"name": "self-mgmt-attempt", "expires_at": None},
    )
    pat = minted.json()["plaintext"]

    # PAT-authed POST → 403.
    response = await client.post(
        "/api/v1/me/tokens/",
        headers={"Authorization": f"Bearer {pat}"},
        json={"name": "new-by-pat", "expires_at": None},
    )
    assert response.status_code == 403
    assert "pat" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_resolve_pat_constant_time_with_shared_prefix(
    client, session_factory
):
    """Synthetic collision: two PAT rows with the same lookup_prefix.

    Both must resolve correctly to the right user (proves the hash compare
    in resolve_pat narrows correctly within the candidate set).
    """
    user_a = await make_user(session_factory, username="prefa")
    user_b = await make_user(session_factory, username="prefb")

    from app.pats.service import _hash_pat, resolve_pat

    # Force-insert two rows with the SAME lookup_prefix but different bodies
    # (in the wild this is astronomically unlikely; here we synthesise it).
    shared_prefix = "aaaaaaaaaaaa"
    plain_a = f"pat_{shared_prefix}_userA_body_part"
    plain_b = f"pat_{shared_prefix}_userB_body_part"

    async with session_factory() as session:
        session.add(
            PersonalAccessToken(
                user_id=user_a.id,
                name="row-a",
                lookup_prefix=shared_prefix,
                token_hash=_hash_pat(plain_a),
            )
        )
        session.add(
            PersonalAccessToken(
                user_id=user_b.id,
                name="row-b",
                lookup_prefix=shared_prefix,
                token_hash=_hash_pat(plain_b),
            )
        )
        await session.commit()

    async with session_factory() as session:
        resolved_a = await resolve_pat(session, token=plain_a)
        resolved_b = await resolve_pat(session, token=plain_b)

    assert resolved_a is not None and resolved_a.username == "prefa"
    assert resolved_b is not None and resolved_b.username == "prefb"


@pytest.mark.asyncio
async def test_revoke_other_user_pat_returns_404(client, session_factory):
    """Cross-user revoke leaks no existence — same 404 as not-found."""
    await make_user(session_factory, username="ownpat")
    await make_user(session_factory, username="otherp")

    own_cookies = await login_as(
        client, username="ownpat", password="testpass12345"
    )
    own_csrf = {"X-CSRF-Token": own_cookies["csrf_token"]}
    minted = await client.post(
        "/api/v1/me/tokens/",
        cookies=own_cookies,
        headers=own_csrf,
        json={"name": "victim", "expires_at": None},
    )
    pat_id = minted.json()["id"]

    other_cookies = await login_as(
        client, username="otherp", password="testpass12345"
    )
    other_csrf = {"X-CSRF-Token": other_cookies["csrf_token"]}

    response = await client.delete(
        f"/api/v1/me/tokens/{pat_id}",
        cookies=other_cookies,
        headers=other_csrf,
    )
    assert response.status_code == 404

    # Original owner can still revoke (sanity check the row still exists).
    own_delete = await client.delete(
        f"/api/v1/me/tokens/{pat_id}",
        cookies=own_cookies,
        headers=own_csrf,
    )
    assert own_delete.status_code == 204
