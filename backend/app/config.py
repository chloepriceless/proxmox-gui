"""Application settings.

Settings are loaded from environment variables (prefix ``PROXMOX_GUI_``) and/or a ``.env``
file in the working directory. Secrets (``jwt_secret``, ``pat_pepper``) may also be
provided via a path to a file containing only the secret value — this is how the
installer ships them in production. If neither env nor file is provided the app
generates ephemeral values and emits a ``UserWarning`` (acceptable for dev/test only;
in production the installer always writes the files).

This module deliberately keeps ``jwt_secret`` and ``pat_pepper`` as plain ``str`` rather
than ``pydantic.SecretStr`` because downstream code passes them to ``jwt.encode`` /
``hashlib.sha256`` which expect ``str``. Logging callers MUST NOT bind the
``settings`` object directly into structlog contexts — see threat T-01-01-07.
"""

from __future__ import annotations

import secrets
import warnings
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _read_secret_file(path: Path) -> str | None:
    """Return the stripped contents of ``path`` if it exists and is readable, else None."""
    try:
        return path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, PermissionError, OSError):
        return None


class Settings(BaseSettings):
    """Runtime configuration loaded from environment + .env file.

    See ``.env.example`` for the full documented set of variables.
    """

    model_config = SettingsConfigDict(
        env_prefix="PROXMOX_GUI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Paths.
    master_key_path: Path = Path("/etc/proxmox-gui/master.key")

    # Database.
    database_url: str = "sqlite+aiosqlite:///./app.db"
    sql_echo: bool = False

    # Secrets — populated from *_file or env, or ephemeral fallback (with warning).
    jwt_secret_file: Path | None = None
    jwt_secret: str = ""
    pat_pepper_file: Path | None = None
    pat_pepper: str = ""

    # Cookie hardening.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    # HI-01: trusted reverse-proxy IPs. ``X-Forwarded-For`` is honoured ONLY
    # when ``request.client.host`` matches an entry in this set. In the
    # default same-host Caddy + LXC deployment the proxy speaks to the API
    # over localhost, so set this to ``["127.0.0.1", "::1"]`` in production.
    # Empty default (this list) means: never trust ``X-Forwarded-For``,
    # always use the direct TCP peer — the safe-by-default choice.
    # See ``app.auth.routes._client_ip`` for the consumer.
    trusted_proxies: list[str] = []

    # Token TTLs.
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 7 * 24 * 3600

    # CSRF.
    csrf_cookie_name: str = "csrf_token"

    # Logging.
    log_level: str = "INFO"

    @model_validator(mode="after")
    def _populate_secrets_from_files(self) -> Settings:
        """If a secret is empty but the matching ``*_file`` is readable, load it.

        Falls back to ephemeral ``secrets.token_urlsafe(48)`` with a ``UserWarning``
        if neither env nor file yields a value. This branch is acceptable for dev/test;
        the production installer always writes the files (D-14, D-15).
        """
        if not self.jwt_secret and self.jwt_secret_file is not None:
            file_value = _read_secret_file(self.jwt_secret_file)
            if file_value:
                # ``self.jwt_secret = ...`` bypasses Pydantic's frozen-on-validate guard
                # because we're inside ``mode="after"`` which still allows mutation.
                object.__setattr__(self, "jwt_secret", file_value)

        if not self.pat_pepper and self.pat_pepper_file is not None:
            file_value = _read_secret_file(self.pat_pepper_file)
            if file_value:
                object.__setattr__(self, "pat_pepper", file_value)

        if not self.jwt_secret:
            ephemeral = secrets.token_urlsafe(48)
            warnings.warn(
                "PROXMOX_GUI_JWT_SECRET / PROXMOX_GUI_JWT_SECRET_FILE not set; "
                "using ephemeral JWT signing key (DEV/TEST ONLY — restarts invalidate all sessions).",
                stacklevel=2,
            )
            object.__setattr__(self, "jwt_secret", ephemeral)

        if not self.pat_pepper:
            ephemeral = secrets.token_urlsafe(48)
            warnings.warn(
                "PROXMOX_GUI_PAT_PEPPER / PROXMOX_GUI_PAT_PEPPER_FILE not set; "
                "using ephemeral PAT pepper (DEV/TEST ONLY — restarts invalidate all PATs).",
                stacklevel=2,
            )
            object.__setattr__(self, "pat_pepper", ephemeral)

        # Carryover: COOKIE_SECURE=false ships httpOnly session cookies WITHOUT
        # the Secure flag, so they travel over plain HTTP — acceptable for a
        # localhost dev box, never for a real deployment. Emit a startup
        # warning when cookie_secure is False and the database is not the
        # ephemeral local dev DB, so an operator cannot silently ship insecure
        # cookies to production. ``deploy/README.md`` documents the flag as
        # dev-only and the production .env template sets it true.
        if not self.cookie_secure:
            db_url = (self.database_url or "").lower()
            is_local_dev_db = (
                ":memory:" in db_url
                or "./app.db" in db_url
                or "test" in db_url
            )
            if not is_local_dev_db:
                warnings.warn(
                    "PROXMOX_GUI_COOKIE_SECURE=false — DEV ONLY; production "
                    "MUST set PROXMOX_GUI_COOKIE_SECURE=true so session "
                    "cookies carry the Secure flag.",
                    UserWarning,
                    stacklevel=2,
                )

        return self

    def __repr__(self) -> str:
        """Redacted repr — never include ``jwt_secret`` / ``pat_pepper`` values.

        Defense-in-depth for T-01-01-07: if a logger ever binds the entire
        ``settings`` object (against the documented prohibition), the secrets
        are still masked. Tests rely on the *attribute* (``settings.jwt_secret``)
        being a plain ``str`` — only the textual representation is redacted.
        """
        public_fields = {
            name: value
            for name, value in self.__dict__.items()
            if name not in {"jwt_secret", "pat_pepper"}
        }
        masked = {
            "jwt_secret": "***REDACTED***" if self.jwt_secret else "<unset>",
            "pat_pepper": "***REDACTED***" if self.pat_pepper else "<unset>",
        }
        merged = {**public_fields, **masked}
        body = ", ".join(f"{k}={v!r}" for k, v in merged.items())
        return f"Settings({body})"

    __str__ = __repr__


# Module-level singleton. Tests can monkeypatch attributes via
# ``monkeypatch.setattr(settings, ..., ...)`` or rebind the singleton wholesale.
settings = Settings()
