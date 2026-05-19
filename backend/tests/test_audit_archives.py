"""Audit-archive route tests (plan 05-03, D-08).

Task 2, TDD RED phase:

  - GET /api/v1/audit/archives           — admin only; lists {name, size, ctime}
  - GET /api/v1/audit/archives/{name}    — admin only; FileResponse of the gz
  - GET /api/v1/audit/archives/<traversal> returns 400

Both routes are require_admin (T-05-03-02 — archives are the unscoped
compliance dump, not RBAC-filtered).
"""

from __future__ import annotations

import gzip

import pytest

from tests.factories import login_as, make_user


def _seed_archive(tmp_path, name: str, body: bytes = b"hello") -> None:
    """Write a fake .csv.gz at ARCHIVE_DIR/name."""
    archive_dir = tmp_path / "audit-archives"
    archive_dir.mkdir(parents=True, exist_ok=True)
    with gzip.open(archive_dir / name, "wb") as fh:
        fh.write(body)


# ---------------------------------------------------------------------------
# GET /audit/archives — admin list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_archives_admin_returns_metadata(
    client, session_factory, tmp_path, monkeypatch
):
    """Admin sees {name, size_bytes, ctime} for each file in the archive dir."""
    import app.audit.archive as archive

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")
    _seed_archive(tmp_path, "audit-20250101-20250131.csv.gz")
    _seed_archive(tmp_path, "audit-20250201-20250228.csv.gz")

    await make_user(
        session_factory,
        username="archiveadmin",
        password="archivepass12345",
        is_admin=True,
    )
    cookies = await login_as(
        client, username="archiveadmin", password="archivepass12345"
    )

    response = await client.get("/api/v1/audit/archives", cookies=cookies)
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    names = {item["name"] for item in body}
    assert names == {
        "audit-20250101-20250131.csv.gz",
        "audit-20250201-20250228.csv.gz",
    }
    for item in body:
        assert "size_bytes" in item
        assert "ctime" in item


@pytest.mark.asyncio
async def test_list_archives_non_admin_forbidden(
    client, session_factory, tmp_path, monkeypatch
):
    """A non-admin user gets 403 — archives are unscoped (T-05-03-02)."""
    import app.audit.archive as archive

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")
    _seed_archive(tmp_path, "audit-20250101-20250131.csv.gz")

    await make_user(
        session_factory, username="archiveuser", password="userpass12345"
    )
    cookies = await login_as(
        client, username="archiveuser", password="userpass12345"
    )

    response = await client.get("/api/v1/audit/archives", cookies=cookies)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# GET /audit/archives/{name} — admin download
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_download_archive_admin_streams_gzip(
    client, session_factory, tmp_path, monkeypatch
):
    """Download streams the .csv.gz with Content-Disposition: attachment."""
    import app.audit.archive as archive

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")
    _seed_archive(
        tmp_path, "audit-20250101-20250131.csv.gz", body=b"timestamp,action\n"
    )

    await make_user(
        session_factory,
        username="archiveadmin2",
        password="archivepass12345",
        is_admin=True,
    )
    cookies = await login_as(
        client, username="archiveadmin2", password="archivepass12345"
    )

    response = await client.get(
        "/api/v1/audit/archives/audit-20250101-20250131.csv.gz", cookies=cookies
    )
    assert response.status_code == 200, response.text
    disp = response.headers.get("content-disposition", "")
    assert "attachment" in disp
    assert "audit-20250101-20250131.csv.gz" in disp
    media = response.headers.get("content-type", "")
    assert "gzip" in media
    # Body is the raw gzip; decompresses to the seeded payload.
    decompressed = gzip.decompress(response.content)
    assert decompressed == b"timestamp,action\n"


@pytest.mark.asyncio
async def test_download_archive_path_traversal_rejected(
    client, session_factory, tmp_path, monkeypatch
):
    """A path-traversal attempt returns 400 (T-05-03-01)."""
    import app.audit.archive as archive

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")

    await make_user(
        session_factory,
        username="traversaladmin",
        password="traversalpass12345",
        is_admin=True,
    )
    cookies = await login_as(
        client, username="traversaladmin", password="traversalpass12345"
    )

    # A name containing ".." is rejected by the path-traversal guard before
    # any filesystem read. We use a single-segment name (no slashes) so the
    # FastAPI route matches and our guard runs — the literal "../etc/passwd"
    # with slashes would be split into multiple path segments by Starlette
    # and fail to match the route at all (a 404, not a 400 from our guard).
    response = await client.get(
        "/api/v1/audit/archives/..etc-passwd", cookies=cookies
    )
    assert response.status_code == 400

    # And the same protection holds for a name containing a backslash, which
    # is the Windows-style traversal vector.
    response = await client.get(
        "/api/v1/audit/archives/foo%5Cbar.csv.gz", cookies=cookies
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_download_archive_non_admin_forbidden(
    client, session_factory, tmp_path, monkeypatch
):
    """A non-admin user gets 403 on the download endpoint."""
    import app.audit.archive as archive

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")
    _seed_archive(tmp_path, "audit-20250101-20250131.csv.gz")

    await make_user(
        session_factory, username="dluser", password="dlpass12345"
    )
    cookies = await login_as(client, username="dluser", password="dlpass12345")

    response = await client.get(
        "/api/v1/audit/archives/audit-20250101-20250131.csv.gz", cookies=cookies
    )
    assert response.status_code == 403
