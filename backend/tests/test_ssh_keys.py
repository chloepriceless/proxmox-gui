"""SSH-key route + service tests (Plan 01-05 Task 2).

Behaviours from the plan:

- POST /api/v1/me/ssh-keys with valid ed25519 → 201 + SHA256 fingerprint.
- POST with malformed key (e.g., missing base64) → 422.
- POST with duplicate (user_id, name) → 409.
- GET returns only the current user's keys.
- DELETE returns 204 + key gone on subsequent GET.
- User A trying to DELETE user B's key returns 404 (not 403 — don't leak
  existence; T-01-05-11).
"""

from __future__ import annotations

import pytest

from tests.factories import login_as, make_user

# Pre-canned ed25519 public key (valid OpenSSH format) for use in tests.
ED25519_KEY = (
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAh0fJZ1nVbXopY5b4mYpL3iPv9eqJjr"
    "+tPaCEX5g6Bf test@host"
)

# Another valid ed25519 key (different blob) for "second key" tests.
ED25519_KEY_2 = (
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB8m+Sqlk3xMlxNB6sPLCMRzCvCWOdgN"
    "9w3oM4Zk6vDH second@host"
)


@pytest.mark.asyncio
async def test_post_valid_ed25519_returns_201_with_fingerprint(
    client, session_factory
):
    await make_user(session_factory, username="sshu1")
    cookies = await login_as(client, username="sshu1", password="testpass12345")
    csrf = cookies["csrf_token"]

    response = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"name": "laptop", "public_key": ED25519_KEY},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "laptop"
    assert body["fingerprint"].startswith("SHA256:")
    assert len(body["fingerprint"]) > 10
    assert "public_key" not in body  # list-shape response: no key text


@pytest.mark.asyncio
async def test_post_malformed_key_returns_422(client, session_factory):
    await make_user(session_factory, username="sshu2")
    cookies = await login_as(client, username="sshu2", password="testpass12345")
    csrf = cookies["csrf_token"]

    response = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"name": "broken", "public_key": "ssh-ed25519 not-base64"},
    )
    assert response.status_code == 422
    assert "ssh public key" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_post_duplicate_name_returns_409(client, session_factory):
    await make_user(session_factory, username="sshu3")
    cookies = await login_as(client, username="sshu3", password="testpass12345")
    csrf = cookies["csrf_token"]
    headers = {"X-CSRF-Token": csrf}

    r1 = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers=headers,
        json={"name": "laptop", "public_key": ED25519_KEY},
    )
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers=headers,
        json={"name": "laptop", "public_key": ED25519_KEY_2},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_get_returns_only_current_user_keys(client, session_factory):
    # Two users, two keys each.
    await make_user(session_factory, username="alice_ssh")
    await make_user(session_factory, username="bob_ssh")

    a_cookies = await login_as(client, username="alice_ssh", password="testpass12345")
    a_csrf = {"X-CSRF-Token": a_cookies["csrf_token"]}
    await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=a_cookies,
        headers=a_csrf,
        json={"name": "akey", "public_key": ED25519_KEY},
    )

    b_cookies = await login_as(client, username="bob_ssh", password="testpass12345")
    b_csrf = {"X-CSRF-Token": b_cookies["csrf_token"]}
    await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=b_cookies,
        headers=b_csrf,
        json={"name": "bkey", "public_key": ED25519_KEY_2},
    )

    a_list = await client.get("/api/v1/me/ssh-keys/", cookies=a_cookies)
    assert a_list.status_code == 200
    names = [k["name"] for k in a_list.json()]
    assert names == ["akey"]


@pytest.mark.asyncio
async def test_delete_returns_204_and_key_gone(client, session_factory):
    await make_user(session_factory, username="delu")
    cookies = await login_as(client, username="delu", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    created = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers=csrf,
        json={"name": "doomed", "public_key": ED25519_KEY},
    )
    key_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/me/ssh-keys/{key_id}",
        cookies=cookies,
        headers=csrf,
    )
    assert deleted.status_code == 204

    after = await client.get("/api/v1/me/ssh-keys/", cookies=cookies)
    assert after.json() == []


@pytest.mark.asyncio
async def test_user_a_cannot_delete_user_b_key_returns_404(
    client, session_factory
):
    await make_user(session_factory, username="cross_a")
    await make_user(session_factory, username="cross_b")

    b_cookies = await login_as(
        client, username="cross_b", password="testpass12345"
    )
    b_csrf = {"X-CSRF-Token": b_cookies["csrf_token"]}
    b_created = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=b_cookies,
        headers=b_csrf,
        json={"name": "bkey", "public_key": ED25519_KEY},
    )
    b_key_id = b_created.json()["id"]

    a_cookies = await login_as(
        client, username="cross_a", password="testpass12345"
    )
    a_csrf = {"X-CSRF-Token": a_cookies["csrf_token"]}

    # A tries to delete B's key — must get 404 (NOT 403; no leak).
    response = await client.delete(
        f"/api/v1/me/ssh-keys/{b_key_id}",
        cookies=a_cookies,
        headers=a_csrf,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_by_id_returns_public_key_text(client, session_factory):
    """GET /api/v1/me/ssh-keys/{id} returns the full public_key (detail view)."""
    await make_user(session_factory, username="detu")
    cookies = await login_as(client, username="detu", password="testpass12345")
    csrf = {"X-CSRF-Token": cookies["csrf_token"]}

    created = await client.post(
        "/api/v1/me/ssh-keys/",
        cookies=cookies,
        headers=csrf,
        json={"name": "viewable", "public_key": ED25519_KEY},
    )
    key_id = created.json()["id"]

    response = await client.get(
        f"/api/v1/me/ssh-keys/{key_id}", cookies=cookies
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fingerprint"].startswith("SHA256:")
    assert "ssh-ed25519" in body["public_key"]


def test_parse_rsa_ed25519_ecdsa_all_yield_fingerprints():
    """Service-level parse test — RSA, ed25519, ecdsa each produce a fingerprint.

    Fixtures generated once via :mod:`cryptography` (deterministic in shape;
    the actual private keys were discarded). Picking real keys avoids fragile
    hand-typed base64 that's almost always invalid as a real curve point.
    """
    from app.ssh_keys.service import parse_ssh_pubkey

    rsa_key = (
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCggCh1FZClswMgVBwYqYt5UMjY+v/"
        "byrQaZf+YhHSVZWzJlfi9eLkpovXJiH+KHEWGHY0qkxTKVBainm50WV44J3aI+vnPxEr"
        "51dz6K6qrW+EBLkPz/4Utt0MBCewkIWMh8IZfcrt1jrfRAG93RTrHwZm4CEgN24v1noNX"
        "y2lvkiPsqdyNQOQ1zpgo5q+iTeB/Hsq8lAKCFYZtVGpwljZW5S2oSwqaa7sZPAxs3sxvZ"
        "DFLCkDLnoaWHrOayFtW0pvgr+XqrdSoONN13h7OS98Z5DW0ON2JAw7uFAhlitFNq4AdMS"
        "RiTfzxXG4b+hYypRgHJBgryydQD2UvN+fOwHef"
    )
    _, rsa_fp = parse_ssh_pubkey(rsa_key)
    assert rsa_fp.startswith("SHA256:")

    ecdsa_key = (
        "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYA"
        "AABBBGao+d/DHdda3Envv1MJWR1WaeHEiu2ADMbnEbVSTemAPOZLWtpZCjMsjC6EHi9U"
        "ylaazP3P8KrtZY/c7vXk4Bc="
    )
    _, ecdsa_fp = parse_ssh_pubkey(ecdsa_key)
    assert ecdsa_fp.startswith("SHA256:")

    _, ed_fp = parse_ssh_pubkey(ED25519_KEY)
    assert ed_fp.startswith("SHA256:")
    # Different keys → different fingerprints.
    assert len({rsa_fp, ecdsa_fp, ed_fp}) == 3


def test_parse_malformed_raises_valueerror():
    from app.ssh_keys.service import parse_ssh_pubkey

    import pytest as _pytest

    with _pytest.raises(ValueError):
        parse_ssh_pubkey("not even close")

    with _pytest.raises(ValueError):
        parse_ssh_pubkey("ssh-ed25519 garbage-not-base64 comment")
