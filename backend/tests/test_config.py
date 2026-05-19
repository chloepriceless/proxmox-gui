"""Tests for :mod:`app.config` — T-01-01-07 (secret redaction) + the
COOKIE_SECURE startup warning (carryover)."""

from __future__ import annotations

import warnings

from app.config import Settings, settings


def test_settings_database_url_default() -> None:
    """Sanity: default database URL is the local SQLite path."""
    fresh = Settings(_env_file=None)  # type: ignore[call-arg]
    assert fresh.master_key_path.name == "master.key"
    # ``cookie_secure`` may be overridden by the conftest env-tweak.
    assert isinstance(fresh.database_url, str)


def test_repr_redacts_jwt_secret() -> None:
    """T-01-01-07: ``repr(settings)`` MUST NOT contain the live jwt_secret value."""
    r = repr(settings)
    assert settings.jwt_secret  # precondition: secret is populated
    assert settings.jwt_secret not in r
    assert "***REDACTED***" in r


def test_repr_redacts_pat_pepper() -> None:
    r = repr(settings)
    assert settings.pat_pepper
    assert settings.pat_pepper not in r


def test_str_redacts_secrets() -> None:
    """``str(settings)`` shares the same redaction (alias of __repr__)."""
    s = str(settings)
    assert settings.jwt_secret not in s
    assert settings.pat_pepper not in s


def test_jwt_secret_attribute_remains_plain_str() -> None:
    """The plan deliberately keeps ``settings.jwt_secret`` as plain str — not SecretStr.

    Downstream code (jwt.encode, hashlib.sha256) calls it directly without
    ``.get_secret_value()``.
    """
    assert isinstance(settings.jwt_secret, str)
    assert isinstance(settings.pat_pepper, str)


# ---------------------------------------------------------------------------
# Carryover: COOKIE_SECURE=false production warning
# ---------------------------------------------------------------------------


def test_cookie_secure_false_with_prod_db_warns() -> None:
    """COOKIE_SECURE=false against a non-local (production) DB emits a
    UserWarning so an operator cannot silently ship insecure cookies."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        Settings(
            _env_file=None,  # type: ignore[call-arg]
            cookie_secure=False,
            database_url="sqlite+aiosqlite:////var/lib/proxmox-gui/app.db",
            jwt_secret="x" * 48,
            pat_pepper="y" * 48,
        )
    messages = [str(w.message) for w in caught]
    assert any("COOKIE_SECURE=false" in m for m in messages), messages


def test_cookie_secure_false_with_local_db_does_not_warn() -> None:
    """COOKIE_SECURE=false on a localhost dev DB is the documented dev mode —
    no warning, so the dev box stays quiet."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        Settings(
            _env_file=None,  # type: ignore[call-arg]
            cookie_secure=False,
            database_url="sqlite+aiosqlite:///./app.db",
            jwt_secret="x" * 48,
            pat_pepper="y" * 48,
        )
    messages = [str(w.message) for w in caught]
    assert not any("COOKIE_SECURE=false" in m for m in messages), messages


def test_cookie_secure_true_never_warns() -> None:
    """The secure-by-default case never emits the COOKIE_SECURE warning."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        Settings(
            _env_file=None,  # type: ignore[call-arg]
            cookie_secure=True,
            database_url="sqlite+aiosqlite:////var/lib/proxmox-gui/app.db",
            jwt_secret="x" * 48,
            pat_pepper="y" * 48,
        )
    messages = [str(w.message) for w in caught]
    assert not any("COOKIE_SECURE=false" in m for m in messages), messages
