"""TDD RED: Tests for quota HTTP routes.

Written BEFORE implementation — expected to fail until app/quotas/routes.py is created.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

import pytest

from tests.factories import login_as, make_user

_GB = 1024**3

# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


async def _seed_full(
    session_factory,
    *,
    username: str = "quota_u1",
    poolid: str = "gui-team-qr",
    is_admin: bool = False,
    n_clusters: int = 1,
) -> tuple:
    """Seed User + Team + Cluster(s) + TeamClusterToken(s)."""
    from app.models import Cluster, Team, TeamClusterToken, TeamMembership

    async with session_factory() as session:
        user = await make_user(
            session_factory,
            username=username,
            email=f"{username}@example.com",
            is_admin=is_admin,
        )

        team = Team(name=f"team-{username}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        session.add(TeamMembership(team_id=team.id, user_id=user.id))

        cluster_ids = []
        for i in range(n_clusters):
            cluster = Cluster(
                name=f"c{i}-{username}",
                host=f"c{i}-{username}.test",
                port=8006,
                verify_ssl=False,
                token_user="root@pam",
                token_name="gui",
                api_token_secret="secret",
                is_active=True,
            )
            session.add(cluster)
            await session.flush()

            session.add(TeamClusterToken(
                team_id=team.id,
                cluster_id=cluster.id,
                userid=f"gui-team-{team.id}@pve",
                tokenid="api",
                token_secret="tok-secret",
                poolid=f"{poolid}-c{i}",
            ))
            cluster_ids.append(cluster.id)

        await session.commit()
        return user, team.id, cluster_ids


def _fake_empty(n_clusters: int = 1):
    from tests.fixtures.pve_responses import FakeProxmox

    fake = FakeProxmox()
    for _ in range(n_clusters):
        fake.queue_response("cluster.resources.get", [])
        fake.queue_response("cluster.resources.get", [])
    return fake


# ---------------------------------------------------------------------------
# GET /teams/{team_id}/quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_team_quotas_requires_admin(client, session_factory):
    """Non-admin user gets 403 on GET /teams/{id}/quotas."""
    user, team_id, _ = await _seed_full(session_factory, username="qr_nonadmin")
    cookies = await login_as(client, username="qr_nonadmin", password="testpass12345")

    fake = _fake_empty()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.get(
            f"/api/v1/teams/{team_id}/quotas",
            cookies=cookies,
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_team_quotas_admin_returns_page(client, session_factory):
    """Admin GET /teams/{id}/quotas returns TeamQuotaPage shape."""
    from app.models import Quota

    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_admin_get", is_admin=True
    )

    async with session_factory() as session:
        session.add(Quota(
            team_id=team_id,
            cluster_id=cluster_ids[0],
            cpu_cores=8,
            updated_at=datetime.utcnow(),
        ))
        await session.commit()

    cookies = await login_as(client, username="qr_admin_get", password="testpass12345")

    fake = _fake_empty()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.get(
            f"/api/v1/teams/{team_id}/quotas",
            cookies=cookies,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["team_id"] == team_id
    assert len(body["rows"]) == 1
    assert body["rows"][0]["limit"]["cpu_cores"] == 8


# ---------------------------------------------------------------------------
# PUT /teams/{team_id}/quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_team_quotas_admin_writes_and_audits(client, session_factory):
    """Admin PUT /teams/{id}/quotas creates Quota + AuditLog."""
    from sqlalchemy import select

    from app.models import AuditLog

    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_admin_put", is_admin=True
    )
    cookies = await login_as(client, username="qr_admin_put", password="testpass12345")
    csrf = cookies["csrf_token"]

    fake = _fake_empty()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.put(
            f"/api/v1/teams/{team_id}/quotas",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
            json={
                "rows": [{"cluster_id": cluster_ids[0], "cpu_cores": 16, "ram_gb": 32}],
                "allow_over": False,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["rows"]) == 1
    assert body["rows"][0]["limit"]["cpu_cores"] == 16

    # Verify audit row
    async with session_factory() as session:
        audit = (await session.execute(
            select(AuditLog).where(AuditLog.action == "quota.update")
        )).scalar_one_or_none()
        assert audit is not None


@pytest.mark.asyncio
async def test_put_team_quotas_csrf_required(client, session_factory):
    """Admin PUT without X-CSRF-Token header → 403."""
    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_csrf", is_admin=True
    )
    cookies = await login_as(client, username="qr_csrf", password="testpass12345")

    resp = await client.put(
        f"/api/v1/teams/{team_id}/quotas",
        cookies=cookies,
        # No X-CSRF-Token header
        json={"rows": [], "allow_over": False},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_put_team_quotas_lower_below_usage_409(client, session_factory):
    """Setting cpu_cores=5 when usage=10 (allow_over=False) → 409."""
    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_409", is_admin=True, poolid="gui-team-409"
    )
    cookies = await login_as(client, username="qr_409", password="testpass12345")
    csrf = cookies["csrf_token"]

    from tests.fixtures.pve_responses import FakeProxmox

    poolid = "gui-team-409-c0"
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 10, "maxmem": 0, "maxdisk": 0},
    ])
    fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.put(
            f"/api/v1/teams/{team_id}/quotas",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
            json={
                "rows": [{"cluster_id": cluster_ids[0], "cpu_cores": 5}],
                "allow_over": False,
            },
        )

    assert resp.status_code == 409
    assert resp.json()["detail"]["cluster_id"] == cluster_ids[0]


@pytest.mark.asyncio
async def test_put_team_quotas_allow_over_succeeds(client, session_factory):
    """Same scenario but allow_over=True → 200."""
    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_allowover", is_admin=True, poolid="gui-team-ao"
    )
    cookies = await login_as(client, username="qr_allowover", password="testpass12345")
    csrf = cookies["csrf_token"]

    from tests.fixtures.pve_responses import FakeProxmox

    poolid = "gui-team-ao-c0"
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 10, "maxmem": 0, "maxdisk": 0},
    ])
    fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.put(
            f"/api/v1/teams/{team_id}/quotas",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
            json={
                "rows": [{"cluster_id": cluster_ids[0], "cpu_cores": 5}],
                "allow_over": True,
            },
        )

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /me/quotas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_quotas_unauth_401(client):
    """Unauthenticated GET /me/quotas → 401."""
    resp = await client.get("/api/v1/me/quotas")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_my_quotas_returns_aggregate(client, session_factory):
    """Authenticated user's GET /me/quotas returns teams list with aggregate."""
    from app.models import Quota

    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_myquota", n_clusters=2
    )

    async with session_factory() as session:
        for cid in cluster_ids:
            session.add(Quota(
                team_id=team_id,
                cluster_id=cid,
                cpu_cores=8,
                updated_at=datetime.utcnow(),
            ))
        await session.commit()

    cookies = await login_as(client, username="qr_myquota", password="testpass12345")

    fake = _fake_empty(n_clusters=2)
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.get("/api/v1/me/quotas", cookies=cookies)

    assert resp.status_code == 200
    body = resp.json()
    # Should include the seeded team
    team_entry = next((t for t in body["teams"] if t["team_id"] == team_id), None)
    assert team_entry is not None
    assert team_entry["aggregate_limit"]["cpu_cores"] == 16  # 8 + 8


@pytest.mark.asyncio
async def test_get_my_quotas_pat_auth_path(client, session_factory):
    """Bearer PAT auth returns 200 on GET /me/quotas."""
    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_pat"
    )

    # Mint a PAT for this user
    cookies = await login_as(client, username="qr_pat", password="testpass12345")
    csrf = cookies["csrf_token"]
    pat_resp = await client.post(
        "/api/v1/me/tokens/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"name": "test-pat", "expires_at": "2099-12-31"},
    )
    assert pat_resp.status_code == 201
    pat_token = pat_resp.json()["plaintext"]

    fake = _fake_empty()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.get(
            "/api/v1/me/quotas",
            headers={"Authorization": f"Bearer {pat_token}"},
        )

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /quotas/preview
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_quotas_preview_non_admin_denied_for_other_team(client, session_factory):
    """Non-admin previewing for a team they don't belong to → 403."""
    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_preview_nonadmin"
    )

    # Different team (non-member)
    other_user, other_team_id, other_cluster_ids = await _seed_full(
        session_factory, username="qr_preview_other"
    )

    cookies = await login_as(client, username="qr_preview_nonadmin", password="testpass12345")
    csrf = cookies["csrf_token"]

    resp = await client.post(
        "/api/v1/quotas/preview",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={
            "team_id": other_team_id,  # team user doesn't belong to
            "cluster_id": other_cluster_ids[0],
            "requested_cpu": 4,
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_post_quotas_preview_admin_any_team(client, session_factory):
    """Admin can preview for any team."""
    admin_user, _, _ = await _seed_full(
        session_factory, username="qr_preview_admin", is_admin=True
    )
    target_user, target_team_id, target_cluster_ids = await _seed_full(
        session_factory, username="qr_preview_target"
    )

    cookies = await login_as(client, username="qr_preview_admin", password="testpass12345")
    csrf = cookies["csrf_token"]

    fake = _fake_empty()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.post(
            "/api/v1/quotas/preview",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
            json={
                "team_id": target_team_id,
                "cluster_id": target_cluster_ids[0],
                "requested_cpu": 4,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "would_exceed" in body
    assert "dimensions" in body


@pytest.mark.asyncio
async def test_post_quotas_preview_returns_would_exceed_true(client, session_factory):
    """Preview with cpu quota=10, usage=8, requested=5 → would_exceed=True."""
    from app.models import Quota

    user, team_id, cluster_ids = await _seed_full(
        session_factory, username="qr_preview_exceed", poolid="gui-team-exc"
    )

    async with session_factory() as session:
        session.add(Quota(
            team_id=team_id,
            cluster_id=cluster_ids[0],
            cpu_cores=10,
            updated_at=datetime.utcnow(),
        ))
        await session.commit()

    cookies = await login_as(client, username="qr_preview_exceed", password="testpass12345")
    csrf = cookies["csrf_token"]

    from tests.fixtures.pve_responses import FakeProxmox

    poolid = "gui-team-exc-c0"
    fake = FakeProxmox()
    fake.queue_response("cluster.resources.get", [
        {"vmid": 100, "type": "qemu", "node": "n1", "pool": poolid,
         "maxcpu": 8, "maxmem": 0, "maxdisk": 0},
    ])
    fake.queue_response("cluster.resources.get", [])

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        resp = await client.post(
            "/api/v1/quotas/preview",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
            json={
                "team_id": team_id,
                "cluster_id": cluster_ids[0],
                "requested_cpu": 5,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["would_exceed"] is True
    cpu_dim = next(d for d in body["dimensions"] if d["name"] == "cpu")
    assert cpu_dim["would_exceed"] is True
