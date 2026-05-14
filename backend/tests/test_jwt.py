"""Tests for :mod:`app.core.jwt`."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest

from app.config import settings
from app.core.jwt import ALG, ISSUER, decode_access_token, issue_access_token


def test_issue_and_decode_round_trip() -> None:
    token = issue_access_token(42, is_admin=True)
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["adm"] is True
    assert payload["iss"] == ISSUER
    assert "iat" in payload
    assert "exp" in payload
    assert "jti" in payload


def test_decode_preserves_non_admin_flag() -> None:
    token = issue_access_token(7, is_admin=False)
    payload = decode_access_token(token)
    assert payload["sub"] == "7"
    assert payload["adm"] is False


def test_decode_malformed_token_raises() -> None:
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_access_token("not-a-jwt")


def test_decode_tampered_signature_raises() -> None:
    token = issue_access_token(1, is_admin=False)
    # Flip the last char of the signature segment.
    head, payload, sig = token.split(".")
    bad_sig = sig[:-1] + ("A" if sig[-1] != "A" else "B")
    tampered = ".".join([head, payload, bad_sig])
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_access_token(tampered)


def test_decode_expired_token_raises() -> None:
    """Forge an already-expired token manually."""
    now = int(datetime.now(UTC).timestamp())
    expired_payload = {
        "sub": "1",
        "adm": False,
        "iat": now - 3600,
        "exp": now - 1,
        "jti": "deadbeef",
        "iss": ISSUER,
    }
    token = pyjwt.encode(expired_payload, settings.jwt_secret, algorithm=ALG)
    with pytest.raises(pyjwt.ExpiredSignatureError):
        decode_access_token(token)


def test_decode_rejects_wrong_issuer() -> None:
    """Mitigates cross-system replay."""
    now = datetime.now(UTC)
    payload = {
        "sub": "1",
        "adm": False,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
        "jti": "x",
        "iss": "some-other-system",
    }
    token = pyjwt.encode(payload, settings.jwt_secret, algorithm=ALG)
    with pytest.raises(pyjwt.InvalidIssuerError):
        decode_access_token(token)


def test_decode_rejects_alg_none_token() -> None:
    """T-01-01-02: algorithms=[ALG] must reject alg=none tokens."""
    now = int(datetime.now(UTC).timestamp())
    payload = {
        "sub": "1",
        "adm": False,
        "iat": now,
        "exp": now + 600,
        "jti": "x",
        "iss": ISSUER,
    }
    # Build an unsigned token (alg=none).
    none_token = pyjwt.encode(payload, key="", algorithm="none")
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_access_token(none_token)


def test_decode_rejects_wrong_key() -> None:
    payload = {
        "sub": "1",
        "adm": False,
        "iat": int(datetime.now(UTC).timestamp()),
        "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp()),
        "jti": "x",
        "iss": ISSUER,
    }
    token = pyjwt.encode(payload, "a-completely-different-secret", algorithm=ALG)
    with pytest.raises(pyjwt.InvalidSignatureError):
        decode_access_token(token)


def test_jti_is_unique_per_issue() -> None:
    a = decode_access_token(issue_access_token(1, is_admin=False))
    b = decode_access_token(issue_access_token(1, is_admin=False))
    assert a["jti"] != b["jti"]
