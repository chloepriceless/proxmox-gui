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
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

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
