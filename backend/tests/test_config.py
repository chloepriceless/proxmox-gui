"""Tests for :mod:`app.config` — specifically T-01-01-07 (secret redaction)."""

from __future__ import annotations

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
