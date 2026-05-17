"""Alembic migration runtime.

This module is imported by Alembic on every command invocation. It does
three things:

1. Imports :mod:`app.models` (the package) which transitively imports every
   concrete model module and thereby populates :data:`Base.metadata` —
   without this Alembic autogenerate sees an empty schema.

2. Sets ``target_metadata = Base.metadata`` so autogenerate diffs against
   the live ORM definitions.

3. Configures :func:`context.configure` with:

   - ``render_as_batch=True`` — Pitfall A1: SQLite does not support
     ``ALTER COLUMN``; Alembic's batch mode recreates the table under the
     hood. Setting this on every migration future-proofs us against any
     later ALTER without us having to remember.
   - ``compare_type=True`` — autogenerate will detect column-type changes,
     not just structural ones. Important for catching accidental
     LargeBinary→Text on EncryptedSecret columns.

Alembic itself is sync, so this file uses the **sync** engine API even
though the application uses an async engine at runtime. That is fine:
``op.create_table`` doesn't care which flavour of engine you bring.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Force every concrete model module to import so Base.metadata is fully
# populated before we hand it to Alembic. (``from app.models import Base``
# alone re-exports Base but lazily; the package __init__ does the heavy
# lifting via its other imports.)
from app.models import Base  # noqa: F401  # noqa is for the explicit re-export

# Alembic Config object exposing the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
#
# disable_existing_loggers=False is load-bearing: run_migrations() runs
# `alembic upgrade head` inside the FastAPI lifespan on every API start, so
# this fileConfig() call fires mid-startup. With the fileConfig default
# (disable_existing_loggers=True) it would disable every logger not named in
# alembic.ini — including `uvicorn.error` and the whole `app.*` tree — so all
# backend logger.info output (and uvicorn's "startup complete") went silent.
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Honour PROXMOX_GUI_DATABASE_URL when present AND the current sqlalchemy.url
# is still the alembic.ini placeholder. Keep alembic + app on the same
# database (Plan 01-04 follow-up: prior versions of this file silently
# fell back to ``sqlite:///./app.db`` from alembic.ini, which put migrations
# in /opt/proxmox-gui/backend/app.db while the app read /var/lib/proxmox-gui/app.db,
# leaving the live DB schemaless. Operator smoke-test caught this.)
#
# The placeholder gate matters: tests that build their own Config object
# with command.upgrade(cfg, "head") set a file-based sqlalchemy.url before
# this module is imported, and that explicit choice must win over the
# in-memory PROXMOX_GUI_DATABASE_URL set in conftest.py.
#
# Alembic is sync, so strip the ``+aiosqlite`` driver suffix the app uses.
_ALEMBIC_INI_PLACEHOLDER = "sqlite:///./app.db"
_env_db_url = os.environ.get("PROXMOX_GUI_DATABASE_URL")
_current_url = config.get_main_option("sqlalchemy.url")
if _env_db_url and _current_url == _ALEMBIC_INI_PLACEHOLDER:
    _sync_db_url = _env_db_url.replace("sqlite+aiosqlite://", "sqlite://")
    config.set_main_option("sqlalchemy.url", _sync_db_url)

# Target metadata used by autogenerate diffs.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout, no engine.

    Used by ``alembic upgrade --sql`` for review workflows; not exercised
    in normal app boot.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Pitfall A1
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connect via engine, execute DDL."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Pitfall A1
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
