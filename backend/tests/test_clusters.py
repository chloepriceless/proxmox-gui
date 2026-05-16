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


# ----------------------------------------------------------------------------
# Plan 02-08 — tenant bootstrap on cluster registration (Pitfall 8)
# ----------------------------------------------------------------------------


def _bootstrap_responses_for_team(team_id: int = 1) -> dict:
    """Happy-path FakeProxmox responses for a tenant bootstrap on one cluster."""
    from tests.fixtures.pve_responses import CREATE_TOKEN_OK, EMPTY_OK
    return {
        "version.get": VERSION_OK,
        "pools.post": EMPTY_OK,
        "access.users.post": EMPTY_OK,
        f"access.users.gui-team-{team_id}@pve.token.api.post": CREATE_TOKEN_OK,
        "access.acl.put": EMPTY_OK,
        # Rollback paths exercised by the failure test.
        f"access.users.gui-team-{team_id}@pve.delete": EMPTY_OK,
        f"pools.gui-team-{team_id}.delete": EMPTY_OK,
    }


@pytest.mark.asyncio
async def test_post_cluster_bootstraps_existing_personal_team(
    client, session_factory,
):
    """POST /clusters with an active team writes a team_cluster_tokens row."""
    from sqlalchemy import func, select

    from app.models import TeamClusterToken
    _, cookies = await _login_admin(
        client, session_factory, "admin_b1", with_personal_team=True,
    )
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses=_bootstrap_responses_for_team(team_id=1))
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )
    assert response.status_code == 201, response.text
    cid = response.json()["id"]

    async with session_factory() as session:
        n_tokens = await session.scalar(
            select(func.count()).select_from(TeamClusterToken)
        )
        token_row = (await session.execute(
            select(TeamClusterToken).where(TeamClusterToken.cluster_id == cid)
        )).scalar_one()
    assert n_tokens == 1
    assert token_row.userid == "gui-team-1@pve"
    assert token_row.poolid == "gui-team-1"


@pytest.mark.asyncio
async def test_post_cluster_rolls_back_on_bootstrap_failure(
    client, session_factory,
):
    """If bootstrap fails on PVE, cluster INSERT + any partial token rows
    must roll back, and the PVE pool/user are best-effort cleaned up."""
    from sqlalchemy import func, select

    from app.models import Cluster, TeamClusterToken
    from tests.fixtures.pve_responses import EMPTY_OK, pve_api_error
    _, cookies = await _login_admin(
        client, session_factory, "admin_b2", with_personal_team=True,
    )
    csrf = cookies["csrf_token"]
    # Pool created OK, but user creation fails — rollback should delete the
    # pool we just made.
    responses = {
        "version.get": VERSION_OK,
        "pools.post": EMPTY_OK,
        "access.users.post": pve_api_error(content="user creation refused"),
        "pools.gui-team-1.delete": EMPTY_OK,
    }
    fake = FakeProxmox(responses=responses)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )
    assert response.status_code == 500, response.text
    assert "bootstrap failed" in response.text.lower()

    async with session_factory() as session:
        n_clusters = await session.scalar(
            select(func.count()).select_from(Cluster)
        )
        n_tokens = await session.scalar(
            select(func.count()).select_from(TeamClusterToken)
        )
    assert n_clusters == 0, "cluster INSERT must roll back on bootstrap failure"
    assert n_tokens == 0

    # PVE rollback ran — pool deletion attempted.
    delete_calls = fake.find_calls("pools.gui-team-1.delete")
    assert delete_calls, "best-effort PVE cleanup must call delete_pool"


@pytest.mark.asyncio
async def test_backfill_bootstrap_route_creates_missing_tokens(
    client, session_factory,
):
    """Retroactive backfill for a cluster that exists without team tokens
    (the user's actual situation after the buggy first-run wizard)."""
    from sqlalchemy import func, select

    from app.models import Team, TeamClusterToken

    # Admin user but no personal team — register cluster without bootstrap.
    _, cookies = await _login_admin(
        client, session_factory, "admin_b3", with_personal_team=False,
    )
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses=_bootstrap_responses_for_team(team_id=1))
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )
    assert response.status_code == 201
    cid = response.json()["id"]

    # Now add a personal team after the fact — simulates the wizard order.
    async with session_factory() as session:
        team = Team(name="personal-1", personal=True, is_active=True)
        session.add(team)
        await session.commit()
        await session.refresh(team)

    # No token yet.
    async with session_factory() as session:
        n_tokens = await session.scalar(
            select(func.count()).select_from(TeamClusterToken)
        )
    assert n_tokens == 0

    # Backfill it.
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            f"/api/v1/clusters/{cid}/backfill-bootstrap",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cluster_id"] == cid
    assert body["bootstrapped_teams"] == 1

    async with session_factory() as session:
        n_tokens = await session.scalar(
            select(func.count()).select_from(TeamClusterToken)
        )
    assert n_tokens == 1


@pytest.mark.asyncio
async def test_backfill_bootstrap_is_idempotent(
    client, session_factory,
):
    """Calling backfill twice is a no-op the second time."""
    from sqlalchemy import func, select

    from app.models import TeamClusterToken
    _, cookies = await _login_admin(
        client, session_factory, "admin_b4", with_personal_team=True,
    )
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses=_bootstrap_responses_for_team(team_id=1))
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )
        cid = response.json()["id"]

        # Now backfill — should be a no-op since token already exists.
        response = await client.post(
            f"/api/v1/clusters/{cid}/backfill-bootstrap",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert response.status_code == 200
    assert response.json()["bootstrapped_teams"] == 0

    async with session_factory() as session:
        n_tokens = await session.scalar(
            select(func.count()).select_from(TeamClusterToken)
        )
    assert n_tokens == 1  # still just the one from registration


# ----------------------------------------------------------------------------
# Health-probe lifecycle — clusters registered after app boot
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_cluster_starts_health_probe(session_factory):
    """register_cluster wires a background health probe for the new cluster.

    The lifespan only probes clusters present at boot; without this a
    cluster added later is stuck on status 'untested' until the next
    restart."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.clusters.schemas import ClusterCreate
    from app.clusters.service import register_cluster

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    registry = PVEConnectorRegistry(None, session_factory)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as session:
            payload = ClusterCreate(
                name="probe-reg", host="pve.test", port=8006, verify_ssl=True,
                token_user="root@pam", token_name="t",
                api_token_secret="abcdef-12345",
            )
            cluster = await register_cluster(
                session, payload=payload, registry=registry,
            )
        assert cluster.id in registry._probes
        await registry.stop_all_probes()
    assert cluster.id not in registry._probes


@pytest.mark.asyncio
async def test_delete_cluster_stops_health_probe(session_factory):
    """delete_cluster cancels the cluster's background health probe."""
    from app.clusters.registry import PVEConnectorRegistry
    from app.clusters.schemas import ClusterCreate
    from app.clusters.service import delete_cluster, register_cluster

    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    registry = PVEConnectorRegistry(None, session_factory)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        async with session_factory() as session:
            payload = ClusterCreate(
                name="probe-del", host="pve.test", port=8006, verify_ssl=True,
                token_user="root@pam", token_name="t",
                api_token_secret="abcdef-12345",
            )
            cluster = await register_cluster(
                session, payload=payload, registry=registry,
            )
        assert cluster.id in registry._probes
        async with session_factory() as session:
            await delete_cluster(session, registry, cluster_id=cluster.id)
        assert cluster.id not in registry._probes


# ----------------------------------------------------------------------------
# GET /{id}/nodes/resources — per-node free CPU/RAM for the node-fit hint (VM-10)
# ----------------------------------------------------------------------------
#
# The route exposes ``connector.node_resources()`` (a thin read of PVE's
# ``/cluster/resources?type=node``) so the create wizard's node-fit hint can
# compare a requested size against each node's LIVE free capacity. The
# connector reads ``cluster.resources.get`` under the hood, so FakeProxmox is
# keyed on that dotted path.

# A canned ``/cluster/resources?type=node`` payload. The first row is the
# unit-math anchor from the plan's <behavior> block: maxcpu=8, cpu=0.25 →
# free_cpu == 6.0; maxmem=16 GiB, mem=4 GiB → free_ram_mb == 12288.
_NODE_RESOURCE_ROWS = [
    {
        "node": "node-1", "type": "node", "status": "online",
        "maxcpu": 8, "cpu": 0.25,
        "maxmem": 16 * 1024 ** 3, "mem": 4 * 1024 ** 3,
    },
    {
        "node": "node-2", "type": "node", "status": "offline",
        "maxcpu": 4, "cpu": 0.0,
        "maxmem": 8 * 1024 ** 3, "mem": 0,
    },
]


async def _register_cluster_for_resources(client, session_factory, suffix):
    """Register a cluster (admin) and return its id + the admin cookies."""
    _, cookies = await _login_admin(client, session_factory, f"admin_{suffix}")
    csrf = cookies["csrf_token"]
    fake = FakeProxmox(responses={"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        created = (await client.post(
            "/api/v1/clusters/",
            cookies=cookies, headers={"X-CSRF-Token": csrf},
            json=_valid_cluster_payload(),
        )).json()
    return created["id"], cookies


@pytest.mark.asyncio
async def test_node_resources_returns_per_node_free_capacity(
    client, session_factory,
):
    """GET /{id}/nodes/resources → 200 with per-node free CPU/RAM figures."""
    cid, cookies = await _register_cluster_for_resources(
        client, session_factory, "nr1",
    )
    fake = FakeProxmox(responses={"cluster.resources.get": _NODE_RESOURCE_ROWS})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.get(
            f"/api/v1/clusters/{cid}/nodes/resources", cookies=cookies,
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    by_node = {row["node"]: row for row in body}
    assert set(by_node) == {"node-1", "node-2"}
    # Every row carries the four fields the node-fit hint consumes.
    for row in body:
        assert set(row) >= {"node", "free_cpu", "free_ram_mb", "status"}


@pytest.mark.asyncio
async def test_node_resources_unit_math(client, session_factory):
    """The route performs the byte→MB / load-fraction→free-cores conversion.

    node-1: maxcpu=8, cpu=0.25 → free_cpu == 6.0;
            maxmem=16 GiB, mem=4 GiB → free_ram_mb == 12288.
    """
    cid, cookies = await _register_cluster_for_resources(
        client, session_factory, "nr2",
    )
    fake = FakeProxmox(responses={"cluster.resources.get": _NODE_RESOURCE_ROWS})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.get(
            f"/api/v1/clusters/{cid}/nodes/resources", cookies=cookies,
        )
    assert response.status_code == 200, response.text
    by_node = {row["node"]: row for row in response.json()}
    assert by_node["node-1"]["free_cpu"] == 6.0
    assert by_node["node-1"]["free_ram_mb"] == 12288


@pytest.mark.asyncio
async def test_node_resources_includes_offline_node(client, session_factory):
    """An offline node is still returned — the frontend, not the route, decides."""
    cid, cookies = await _register_cluster_for_resources(
        client, session_factory, "nr3",
    )
    fake = FakeProxmox(responses={"cluster.resources.get": _NODE_RESOURCE_ROWS})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.get(
            f"/api/v1/clusters/{cid}/nodes/resources", cookies=cookies,
        )
    assert response.status_code == 200, response.text
    by_node = {row["node"]: row for row in response.json()}
    assert "node-2" in by_node
    assert by_node["node-2"]["status"] == "offline"


@pytest.mark.asyncio
async def test_node_resources_requires_authentication(client, session_factory):
    """An unauthenticated request to the node-resources route gets 401."""
    # Register the cluster as admin so a valid id exists, then call WITHOUT
    # cookies — the route must reject an anonymous caller.
    cid, _ = await _register_cluster_for_resources(
        client, session_factory, "nr4",
    )
    response = await client.get(f"/api/v1/clusters/{cid}/nodes/resources")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_node_resources_allows_non_admin_user(client, session_factory):
    """A regular (non-admin) user can read node resources — the create wizard
    is run by regular users, so the route is NOT admin-gated."""
    # First register a cluster as admin.
    cid, _ = await _register_cluster_for_resources(
        client, session_factory, "nr5",
    )
    # Now log in as a plain user and hit the route.
    await make_user(
        session_factory, username="plainuser", password="userpass12345",
    )
    user_cookies = await login_as(
        client, username="plainuser", password="userpass12345",
    )
    fake = FakeProxmox(responses={"cluster.resources.get": _NODE_RESOURCE_ROWS})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        response = await client.get(
            f"/api/v1/clusters/{cid}/nodes/resources", cookies=user_cookies,
        )
    assert response.status_code == 200, response.text
