"""End-to-end route tests for ``/api/v1/clusters``.

Covers:

- Admin gate (non-admin → 403).
- Schema validation on POST (rejects URL prefix in ``host``).
- Validate-before-persist (Pitfall A4): a bad token → 422 and NO DB row.
- Tokens stored Fernet-encrypted (raw BLOB ≠ plaintext).
- Token never returned in any response.
- ``POST /test`` dry-run (no DB write at all).
- ``POST /{id}/test`` re-validates stored token.
- PATCH preserves token unless explicitly replaced.
- DELETE returns 409 if any ``team_cluster_tokens`` row references the cluster.
- DELETE invalidates the connector cache.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import (
    VERSION_OK,
    FakeProxmox,
    auth_error,
    connection_error,
)


async def _login_admin(
    client, session_factory, username="admin1", *, with_personal_team=False,
):
    """Make an admin user, log in, return (user, cookies).

    Default ``with_personal_team=False`` so register_cluster's tenant
    bootstrap (Pitfall 8 fix) sees zero teams and is a no-op. Tests that
    explicitly cover the bootstrap path opt in with True and supply matching
    FakeProxmox bootstrap responses.
    """
    user = await make_user(
        session_factory, username=username, password="adminpass12345",
        is_admin=True, with_personal_team=with_personal_team,
    )
    cookies = await login_as(client, username=username, password="adminpass12345")
    return user, cookies


def _valid_cluster_payload(**overrides):
    payload = {
        "name": "pve-prod",
        "host": "pve.example.test",
        "port": 8006,
        "verify_ssl": True,
        "token_user": "root@pam",
        "token_name": "gui-bootstrap",
        "api_token_secret": "deadbeef-0000-1111-2222-333344445555",
        "notes": None,
    }
    payload.update(overrides)
    return payload


# ----------------------------------------------------------------------------
# Auth & admin gate
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_clusters_as_non_admin_returns_403(client, session_factory):
    await make_user(session_factory, username="bob", password="testpass12345")
    cookies = await login_as(client, username="bob", password="testpass12345")
    csrf = cookies["csrf_token"]

    response = await client.post(
        "/api/v1/clusters/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json=_valid_cluster_payload(),
    )
    assert response.status_code == 403


# ----------------------------------------------------------------------------
# Schema validation
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_with_url_prefix_in_host_returns_422(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_a")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/clusters/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json=_valid_cluster_payload(host="https://pve.example.test"),
    )
    assert response.status_code == 422
    body = response.json()
    assert any("URL" in str(e).upper() or "url" in str(e) or "host" in str(e).lower()
               for e in body["detail"])


@pytest.mark.asyncio
async def test_post_with_invalid_token_user_returns_422(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_b")
    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/clusters/",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json=_valid_cluster_payload(token_user="not-a-realm"),
    )
    assert response.status_code == 422


# ----------------------------------------------------------------------------
# Validate-before-persist
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_with_failing_token_validation_returns_422_and_no_row(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_c")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": auth_error()})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )
    assert response.status_code == 422
    # Verify NO row was persisted.
    from sqlalchemy import func, select

    from app.models import Cluster
    async with session_factory() as session:
        n = await session.scalar(select(func.count()).select_from(Cluster))
    assert n == 0


@pytest.mark.asyncio
async def test_post_with_valid_token_persists_encrypted(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_d")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    plaintext_token = "deadbeef-0000-1111-2222-333344445555"
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(api_token_secret=plaintext_token),
        )
    assert response.status_code == 201, response.text
    body = response.json()
    # Plaintext token MUST NOT appear in the response.
    assert plaintext_token not in response.text
    assert "api_token_secret" not in body
    assert body["name"] == "pve-prod"
    assert body["host"] == "pve.example.test"

    # Verify the BLOB on disk is NOT the plaintext (Fernet-encrypted).
    from sqlalchemy import text
    async with session_factory() as session:
        rows = (await session.execute(
            text("SELECT api_token_secret FROM clusters")
        )).all()
    assert len(rows) == 1
    raw_blob = rows[0][0]
    # raw_blob is bytes; the plaintext must not be a substring of those bytes.
    assert plaintext_token.encode("utf-8") not in raw_blob


# ----------------------------------------------------------------------------
# GET list — never reveals the token
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_clusters_never_returns_decrypted_token(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_e")
    csrf = cookies["csrf_token"]
    plaintext_token = "supersecret-token-abcdef"
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(api_token_secret=plaintext_token),
        )

    response = await client.get("/api/v1/clusters/", cookies=cookies)
    assert response.status_code == 200
    assert plaintext_token not in response.text


# ----------------------------------------------------------------------------
# POST /test — dry-run, NO DB write
# ----------------------------------------------------------------------------


async def _count_clusters(session_factory):
    from sqlalchemy import func, select

    from app.models import Cluster
    async with session_factory() as session:
        return await session.scalar(select(func.count()).select_from(Cluster))


@pytest.mark.asyncio
async def test_post_clusters_test_dryrun_with_valid_token(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_f")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    payload = _valid_cluster_payload()
    payload.pop("name", None)
    payload.pop("notes", None)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/test",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=payload,
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is True
    assert body["version"] == "8.2.4"
    assert body["release"] == "8.2"
    # NO DB write.
    assert await _count_clusters(session_factory) == 0


@pytest.mark.asyncio
async def test_post_clusters_test_dryrun_with_invalid_token(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_g")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": auth_error()})
    payload = _valid_cluster_payload()
    payload.pop("name", None)
    payload.pop("notes", None)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/test",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=payload,
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is False
    assert "rejected" in body["error"].lower()
    assert await _count_clusters(session_factory) == 0


@pytest.mark.asyncio
async def test_post_clusters_test_dryrun_with_unreachable_host(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_h")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": connection_error()})
    payload = _valid_cluster_payload()
    payload.pop("name", None)
    payload.pop("notes", None)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/test",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=payload,
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is False
    assert "reach" in body["error"].lower()
    assert await _count_clusters(session_factory) == 0


# ----------------------------------------------------------------------------
# POST /{id}/test — re-validate stored token
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_cluster_id_test_revalidates(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_i")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )).json()
        cid = created["id"]
        # Re-validate
        response = await client.post(
            f"/api/v1/clusters/{cid}/test",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is True
    assert body["version"] == "8.2.4"


# ----------------------------------------------------------------------------
# PATCH semantics
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_without_token_preserves_existing(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_j")
    csrf = cookies["csrf_token"]
    plaintext_token = "preserve-this-token-please"
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(api_token_secret=plaintext_token),
        )).json()
    cid = created["id"]

    response = await client.patch(
        f"/api/v1/clusters/{cid}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
        json={"name": "renamed-cluster"},
    )
    assert response.status_code == 200, response.text
    # Verify the row's encrypted secret still decrypts back to the original.
    from app.models import Cluster
    async with session_factory() as session:
        row = await session.get(Cluster, cid)
        assert row.api_token_secret == plaintext_token
        assert row.name == "renamed-cluster"


@pytest.mark.asyncio
async def test_patch_with_new_token_revalidates(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_k")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )).json()
    cid = created["id"]

    # Now PATCH with a bad token — validation must trip.
    fake2 = FakeProxmox(responses={"version.get": auth_error()})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake2):
        response = await client.patch(
            f"/api/v1/clusters/{cid}",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json={"api_token_secret": "evil-new-token"},
        )
    assert response.status_code == 422, response.text


# ----------------------------------------------------------------------------
# DELETE: 409 if bound, registry-invalidate on success
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_with_team_cluster_tokens_returns_409(
    client, session_factory,
):
    _, cookies = await _login_admin(client, session_factory, "admin_l")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )).json()
    cid = created["id"]

    # Manually insert a team_cluster_tokens row.
    from app.models import Team, TeamClusterToken
    async with session_factory() as session:
        team = Team(name="some-shared-team", personal=False)
        session.add(team)
        await session.flush()
        session.add(TeamClusterToken(
            team_id=team.id, cluster_id=cid,
            userid=f"gui-team-{team.id}@pve", tokenid="api",
            token_secret="fake-secret", poolid=f"gui-team-{team.id}",
        ))
        await session.commit()

    response = await client.delete(
        f"/api/v1/clusters/{cid}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 409, response.text


@pytest.mark.asyncio
async def test_delete_invalidates_registry(client, session_factory):
    _, cookies = await _login_admin(client, session_factory, "admin_m")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )).json()
    cid = created["id"]

    # Reach into app.state.registry, prime its cache, then DELETE and assert
    # the cache entry is gone.
    # The app fixture's app exposes the registry on app.state via the
    # lifespan; in tests we have to do this manually since the lifespan
    # may not have run. Use a fresh registry to assert invalidate is called.
    # Easier: monkeypatch the global delete_cluster service to spy on
    # registry.invalidate.
    from app.clusters import service as cluster_service
    from app.clusters.registry import PVEConnectorRegistry  # noqa: F401

    real_delete = cluster_service.delete_cluster
    seen = {"invalidated": None}

    async def spy_delete(db, registry, *, cluster_id):
        result = await real_delete(db, registry, cluster_id=cluster_id)
        # Spy after the fact: registry should already have called invalidate.
        seen["invalidated"] = cluster_id
        return result

    # Just verify the route deletes — registry-invalidate verified at the
    # service layer below.
    response = await client.delete(
        f"/api/v1/clusters/{cid}",
        cookies=cookies, headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_service_delete_cluster_invalidates_registry(session_factory):
    """Unit-level: delete_cluster service call invalidates the registry cache."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.clusters.schemas import ClusterCreate
    from app.clusters.service import delete_cluster, register_cluster
    from app.models import User

    # Insert an admin user to satisfy any audit references (not strictly
    # needed for this unit test).
    async with session_factory() as session:
        admin = User(username="zzz", email="z@z.test", password_hash="x",
                     is_admin=True, is_active=True)
        session.add(admin)
        await session.commit()

    # Register a cluster with a passing token validation.
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as session:
            payload = ClusterCreate(
                name="reg-test", host="pve.test", port=8006, verify_ssl=True,
                token_user="root@pam", token_name="t",
                api_token_secret="abcdef-12345",
            )
            cluster = await register_cluster(session, payload=payload)
            cid = cluster.id

    registry = PVEConnectorRegistry(None, session_factory)
    # Force-cache an entry
    registry._connectors[cid] = "fake-connector"  # type: ignore[assignment]
    async with session_factory() as session:
        await delete_cluster(session, registry, cluster_id=cid)
    assert cid not in registry._connectors
