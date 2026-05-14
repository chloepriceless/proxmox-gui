---
phase: 01-foundation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic.ini
  - backend/alembic/env.py
  - backend/alembic/script.py.mako
  - backend/alembic/versions/0001_initial.py
  - backend/app/models/user.py
  - backend/app/models/team.py
  - backend/app/models/team_membership.py
  - backend/app/models/cluster.py
  - backend/app/models/team_cluster_token.py
  - backend/app/models/ssh_key.py
  - backend/app/models/pat.py
  - backend/app/models/refresh_token.py
  - backend/app/models/audit_log.py
  - backend/app/models/quota.py
  - backend/app/models/job.py
  - backend/app/models/__init__.py
  - backend/tests/test_schema_invariants.py
  - backend/tests/test_migrations.py
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-05
  - AUTH-07
  - AUTH-08
  - CLUST-01
  - CLUST-05
user_setup: []
tags:
  - backend
  - database
  - sqlalchemy
  - alembic
  - multi-tenant
must_haves:
  truths:
    - "Alembic revision 0001_initial creates 11 tables: users, teams, team_memberships, clusters, team_cluster_tokens, ssh_keys, personal_access_tokens, refresh_tokens, audit_log, quotas, jobs"
    - "Every business table (excluding users/clusters/audit_log/ssh_keys/personal_access_tokens/refresh_tokens) has a team_id FK to teams.id"
    - "`alembic upgrade head` is idempotent — running it twice does not error"
    - "render_as_batch=True is set in env.py (Pitfall A1 mitigation)"
    - "EncryptedSecret columns are present on clusters.api_token_secret and team_cluster_tokens.token_secret"
    - "Schema invariant test asserts every table outside an explicit allowlist has team_id"
  artifacts:
    - path: "backend/alembic.ini"
      provides: "Alembic configuration pointing at backend/alembic/ + sqlalchemy.url placeholder"
      contains: "script_location = alembic"
    - path: "backend/alembic/env.py"
      provides: "Async migration runner with render_as_batch=True"
      contains: "render_as_batch=True"
    - path: "backend/alembic/versions/0001_initial.py"
      provides: "Initial schema migration"
      contains: "def upgrade"
    - path: "backend/app/models/user.py"
      provides: "User ORM model with is_admin, is_active, password_hash"
      exports: ["User"]
    - path: "backend/app/models/team.py"
      provides: "Team ORM model with personal discriminator"
      exports: ["Team"]
    - path: "backend/app/models/cluster.py"
      provides: "Cluster ORM model with EncryptedSecret api_token_secret"
      exports: ["Cluster"]
  key_links:
    - from: "backend/alembic/env.py"
      to: "backend/app/models/__init__.py"
      via: "import all models so Base.metadata is populated before context.configure(target_metadata=...)"
      pattern: "from app.models import"
    - from: "backend/app/models/cluster.py"
      to: "backend/app/models/_types.py"
      via: "api_token_secret column uses EncryptedSecret type"
      pattern: "EncryptedSecret"
    - from: "backend/app/models/team_cluster_token.py"
      to: "backend/app/models/_types.py"
      via: "token_secret column uses EncryptedSecret type"
      pattern: "EncryptedSecret"
---

<objective>
Land the full Phase 1 database schema as a single Alembic revision (`0001_initial`) plus the SQLAlchemy 2.0 declarative ORM models that mirror it. Every multi-tenant invariant from CONTEXT.md is encoded in the schema: D-05 (personal + shared teams via `team_memberships`), D-01/D-02 (`team_cluster_tokens` one per (team, cluster)), D-08 (quotas XOR), D-15 (Fernet-encrypted BLOBs for at-rest secrets), Pitfall 5 (team_id on audit_log row 1), Pitfall 12 (jobs schema present even though queue is Phase 3).

Purpose: A schema that does NOT need retrofit. Plan 06's `create_team` writes to `team_cluster_tokens`; Plan 05's login writes to `refresh_tokens`; Plan 07's user admin reads from `users` + `team_memberships`. All later plans assume the tables, indexes, and FK shapes from this plan are stable.

Output: `alembic upgrade head` builds 11 tables; `pytest tests/test_migrations.py tests/test_schema_invariants.py` is green; ORM models are importable.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/research/PITFALLS.md
@CLAUDE.md

<interfaces>
<!-- Models the rest of Phase 1 will import. Concrete SQLAlchemy 2.0 declarative shapes. -->

```python
# backend/app/models/user.py
class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    # relationships defined for navigation, not eagerly loaded
    teams: Mapped[list["Team"]] = relationship(secondary="team_memberships", back_populates="members", lazy="selectin")

# backend/app/models/team.py
class Team(Base, TimestampMixin):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    personal: Mapped[bool] = mapped_column(default=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    members: Mapped[list[User]] = relationship(secondary="team_memberships", back_populates="teams", lazy="selectin")

# backend/app/models/cluster.py
class Cluster(Base, TimestampMixin):
    __tablename__ = "clusters"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(default=8006)
    verify_ssl: Mapped[bool] = mapped_column(default=True)
    token_user: Mapped[str] = mapped_column(String(128))   # "root@pam" or similar
    token_name: Mapped[str] = mapped_column(String(64))    # "gui-bootstrap"
    api_token_secret: Mapped[str] = mapped_column(EncryptedSecret)  # Fernet ciphertext
    tls_fingerprint: Mapped[str | None] = mapped_column(String(255), default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SQLAlchemy ORM models for all 11 Phase 1 tables</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Schema Sketch, §Pattern 3 EncryptedSecret)
    - /home/dev/vm-deployment-gui/.planning/research/PITFALLS.md (Pitfall 5, 6, 12, 22)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-01..D-15)
    - /home/dev/vm-deployment-gui/backend/app/models/base.py (created in Plan 01)
    - /home/dev/vm-deployment-gui/backend/app/models/_types.py (created in Plan 01)
  </read_first>
  <files>
    backend/app/models/user.py,
    backend/app/models/team.py,
    backend/app/models/team_membership.py,
    backend/app/models/cluster.py,
    backend/app/models/team_cluster_token.py,
    backend/app/models/ssh_key.py,
    backend/app/models/pat.py,
    backend/app/models/refresh_token.py,
    backend/app/models/audit_log.py,
    backend/app/models/quota.py,
    backend/app/models/job.py,
    backend/app/models/__init__.py
  </files>
  <behavior>
    - Test: `from app.models import User, Team, TeamMembership, Cluster, TeamClusterToken, SshKey, PersonalAccessToken, RefreshToken, AuditLog, Quota, Job` imports cleanly.
    - Test: `Base.metadata.tables` contains exactly 11 table names.
    - Test: `Base.metadata.tables['team_cluster_tokens'].columns['token_secret'].type.__class__.__name__ == 'EncryptedSecret'`.
    - Test: `Base.metadata.tables['quotas']` has the CHECK constraint enforcing team_id XOR user_id.
  </behavior>
  <action>
    Implement each ORM model per 01-RESEARCH.md §Schema Sketch using SQLAlchemy 2.0 `Mapped[]` syntax. Use `from app.models.base import Base, TimestampMixin`. Use `EncryptedSecret` from `app.models._types` for ciphertext columns.

    Exact field requirements per model:

    **user.py** — `id` PK, `username` unique+indexed VARCHAR(64), `email` unique VARCHAR(255), `password_hash` VARCHAR(255), `is_admin` bool default False, `is_active` bool default True, TimestampMixin.

    **team.py** — `id` PK, `name` unique VARCHAR(128), `personal` bool default False indexed, `is_active` bool default True, TimestampMixin.

    **team_membership.py** — composite PK `(team_id, user_id)`, both NOT NULL FKs ON DELETE CASCADE, `created_at` TEXT default CURRENT_TIMESTAMP. Add `ix_team_memberships_user` index on `user_id`.

    **cluster.py** — `id` PK, `name` unique VARCHAR(128), `host` VARCHAR(255), `port` int default 8006, `verify_ssl` bool default True, `token_user` VARCHAR(128), `token_name` VARCHAR(64), `api_token_secret` `EncryptedSecret`, `tls_fingerprint` VARCHAR(255) NULL, `is_active` bool default True, `notes` TEXT NULL, TimestampMixin.

    **team_cluster_token.py** — `id` PK, `team_id` FK teams.id CASCADE, `cluster_id` FK clusters.id CASCADE, `userid` VARCHAR(128) (e.g. `gui-team-<id>@pve`), `tokenid` VARCHAR(64) (e.g. `api`), `token_secret` `EncryptedSecret`, `poolid` VARCHAR(128) (e.g. `gui-team-<id>`), `created_at`. UNIQUE(team_id, cluster_id).

    **ssh_key.py** — `id` PK, `user_id` FK users.id CASCADE, `name` VARCHAR(128), `public_key` TEXT (OpenSSH), `fingerprint` VARCHAR(255) indexed (`SHA256:...`), `created_at`. UNIQUE(user_id, name).

    **pat.py** — Class `PersonalAccessToken`. `id` PK, `user_id` FK users.id CASCADE, `name` VARCHAR(128), `lookup_prefix` VARCHAR(16) indexed, `token_hash` VARCHAR(128), `expires_at` TEXT NULL, `revoked_at` TEXT NULL, `last_used_at` TEXT NULL, `created_at`. UNIQUE(user_id, name).

    **refresh_token.py** — `id` PK, `user_id` FK users.id CASCADE indexed, `token_hash` VARCHAR(128) unique, `expires_at` TEXT, `revoked_at` TEXT NULL, `replaced_by_id` self-FK ON DELETE SET NULL, `user_agent` TEXT NULL, `ip_address` VARCHAR(64) NULL, `created_at`. Add `ix_refresh_tokens_expires` index on `expires_at`.

    **audit_log.py** — `id` PK, `occurred_at` indexed, `actor_user_id` FK users.id ON DELETE SET NULL NULL, `actor_pat_id` FK personal_access_tokens.id ON DELETE SET NULL NULL, `team_id` FK teams.id ON DELETE SET NULL NULL (Pitfall 5), `cluster_id` FK clusters.id ON DELETE SET NULL NULL, `action` VARCHAR(128), `target_type` VARCHAR(64) NULL, `target_id` VARCHAR(128) NULL, `result` VARCHAR(32) (`success`|`failure`|`pending`), `source_ip` VARCHAR(64) NULL, `correlation_id` VARCHAR(64) NULL, `payload_before` TEXT NULL (JSON), `payload_after` TEXT NULL (JSON), `error` TEXT NULL. Indexes: `(team_id, occurred_at)` and `(actor_user_id, occurred_at)`. Phase 1 ships schema only — writer lives in Phase 2 per CONTEXT.md Deferred Ideas.

    **quota.py** — `id` PK, `team_id` UNIQUE FK teams.id CASCADE NULL, `user_id` UNIQUE FK users.id CASCADE NULL, `cpu_cores` INT NULL, `ram_bytes` INT NULL, `disk_bytes` INT NULL, `vm_count` INT NULL, `lxc_count` INT NULL, `updated_at`. Add `CheckConstraint("(team_id IS NOT NULL) <> (user_id IS NOT NULL)", name="ck_quota_team_xor_user")` per D-08.

    **job.py** — `id` PK, `idempotency_key` VARCHAR(128) unique NULL (Pitfall 12), `state` VARCHAR(32) default `pending` (values: `pending|claimed|running|succeeded|failed|orphaned|needs_review`), `cluster_id` FK clusters.id NULL, `team_id` FK teams.id NULL, `actor_user_id` FK users.id NULL, `kind` VARCHAR(64), `payload` TEXT (JSON), `upid` VARCHAR(255) NULL (persisted BEFORE polling — Pitfall 2), `upid_node` VARCHAR(64) NULL, `started_at` TEXT NULL, `finished_at` TEXT NULL, `error` TEXT NULL, `created_at`. Indexes: `state`, `(team_id, created_at)`.

    **__init__.py** — import all model classes so `from app.models import User, Team, ...` works AND `Base.metadata` is populated. Re-export `Base` and `TimestampMixin` from `app.models.base`. Explicit `__all__` list.

    For datetime columns, use `Mapped[datetime]` with `server_default=text("CURRENT_TIMESTAMP")`. For nullable datetimes use `Mapped[datetime | None]`. Use SQLAlchemy `String`, `Text`, `Boolean`, `Integer`, `LargeBinary` (via EncryptedSecret) as appropriate.

    Constraints (D-05): the personal team name format is `personal-<user_id>` (not `<username>-personal` per 01-RESEARCH.md §Anti-Patterns). Add a comment noting this in `team.py`. Plan 07 enforces the format on creation.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.models import User, Team, TeamMembership, Cluster, TeamClusterToken, SshKey, PersonalAccessToken, RefreshToken, AuditLog, Quota, Job, Base; assert len(Base.metadata.tables) == 11, list(Base.metadata.tables); print('OK', sorted(Base.metadata.tables))"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -c "from app.models import Base; assert len(Base.metadata.tables) == 11"` exits 0
    - `grep -q 'EncryptedSecret' backend/app/models/cluster.py`
    - `grep -q 'EncryptedSecret' backend/app/models/team_cluster_token.py`
    - `grep -q 'CheckConstraint' backend/app/models/quota.py`
    - `grep -q 'ck_quota_team_xor_user' backend/app/models/quota.py`
    - `grep -q 'replaced_by_id' backend/app/models/refresh_token.py`
    - `grep -q 'lookup_prefix' backend/app/models/pat.py`
    - `grep -q 'idempotency_key' backend/app/models/job.py`
  </acceptance_criteria>
  <done>All 11 ORM models exist; metadata has 11 tables; encrypted columns + CHECK constraint + FK relationships are in place.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Alembic baseline + revision 0001_initial + schema invariant tests</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Pitfall A1 batch mode, §Schema Sketch)
    - /home/dev/vm-deployment-gui/backend/app/models/__init__.py (created in Task 1)
    - /home/dev/vm-deployment-gui/backend/app/core/db.py (created in Plan 01)
  </read_first>
  <files>
    backend/alembic.ini,
    backend/alembic/env.py,
    backend/alembic/script.py.mako,
    backend/alembic/versions/0001_initial.py,
    backend/tests/test_schema_invariants.py,
    backend/tests/test_migrations.py
  </files>
  <behavior>
    - Test (test_migrations): Programmatically run `alembic upgrade head` against an in-memory SQLite — succeeds. Run again — succeeds (idempotent). Assert 11 tables exist via `inspect(engine).get_table_names()`.
    - Test (test_migrations): After `alembic downgrade base`, no `proxmox_gui_*` tables remain (only `alembic_version`).
    - Test (test_schema_invariants): Every business-data table outside the allowlist `{users, teams, clusters, alembic_version, audit_log, ssh_keys, personal_access_tokens, refresh_tokens, team_memberships}` has a `team_id` column. (Phase 1 tables that fall under this rule: `team_cluster_tokens`, `quotas`, `jobs`.)
    - Test (test_schema_invariants): Every `EncryptedSecret`-typed column is `NOT NULL` (we never store partial ciphertext).
  </behavior>
  <action>
    **alembic.ini:** Standard alembic config. Set `script_location = alembic`, `sqlalchemy.url = sqlite:///./app.db` (overridden at runtime). Disable `prepend_sys_path` (use pythonpath from pyproject).

    **alembic/env.py:** Implement per 01-RESEARCH.md §Pitfall A1. Critical: `from app.models import Base` (this forces all model modules to import, populating metadata). In `run_migrations_offline()` and `run_migrations_online()`, pass `target_metadata=Base.metadata`, `render_as_batch=True`, `compare_type=True`. Use the sync `Engine` API inside env.py (alembic itself is sync) — let it read `sqlalchemy.url` from `alembic.ini` or `-x url=<url>` override. Do NOT try to use the async engine here; the sync engine is fine for migrations.

    **alembic/script.py.mako:** Standard Alembic template (default Alembic-generated form is acceptable).

    **alembic/versions/0001_initial.py:** Single revision, `revision = "0001_initial"`, `down_revision = None`. `def upgrade()`: create all 11 tables matching the ORM models in dependency order: `users` → `teams` → `clusters` → `team_memberships` → `team_cluster_tokens` → `ssh_keys` → `personal_access_tokens` → `refresh_tokens` → `audit_log` → `quotas` → `jobs`. Use `op.create_table(...)` with the exact column types from 01-RESEARCH.md §Schema Sketch. For encrypted columns use `sa.LargeBinary()` (Alembic doesn't know about TypeDecorator; the underlying type matters). For the CHECK constraint on `quotas` use `sa.CheckConstraint("(team_id IS NOT NULL) <> (user_id IS NOT NULL)", name="ck_quota_team_xor_user")`. Create all indexes after their tables: `ix_users_username`, `ix_teams_personal`, `ix_team_memberships_user`, `ix_ssh_keys_fingerprint`, `ix_pats_lookup_prefix`, `ix_refresh_tokens_user`, `ix_refresh_tokens_expires`, `ix_audit_team_time`, `ix_audit_actor_time`, `ix_jobs_state`, `ix_jobs_team_created`.

    `def downgrade()`: drop all tables in reverse order.

    **tests/test_migrations.py:** A pytest test that builds an in-memory SQLite engine, runs `alembic upgrade head` via `alembic.command.upgrade(Config, "head")` with `sqlalchemy.url` overridden to the in-memory DB. Uses `sqlalchemy.inspect` to count tables. Then runs upgrade head again to verify idempotence (no exception). Then runs `downgrade base` and asserts cleanup.

    **tests/test_schema_invariants.py:** Iterate `Base.metadata.tables.items()`. For each table NOT in the allowlist, assert `"team_id" in table.columns`. For each column with type `EncryptedSecret`, assert `column.nullable is False`. The allowlist is documented inline with a comment explaining why each table is exempt (Pitfall A5 reference).

    Note: `team_id` on the audit_log table is NULLable (audit entries during system actions may not be tenant-scoped) — that's why audit_log is in the allowlist for the `team_id present` check but NOT for `team_id NOT NULL`. The invariant test enforces presence-not-nullability.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_migrations.py tests/test_schema_invariants.py -x -v && python -c "import sqlalchemy as sa; from sqlalchemy import create_engine; from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); cfg.set_main_option('sqlalchemy.url', 'sqlite:///./tmp_test.db'); command.upgrade(cfg, 'head'); e = create_engine('sqlite:///./tmp_test.db'); print(sorted(sa.inspect(e).get_table_names()))" && rm -f backend/tmp_test.db</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && python -m pytest tests/test_migrations.py tests/test_schema_invariants.py -x` exits 0
    - `grep -q 'render_as_batch=True' backend/alembic/env.py`
    - `grep -q 'compare_type=True' backend/alembic/env.py`
    - `grep -q '0001_initial' backend/alembic/versions/0001_initial.py`
    - `grep -q 'ck_quota_team_xor_user' backend/alembic/versions/0001_initial.py`
    - `grep -q 'ix_pats_lookup_prefix' backend/alembic/versions/0001_initial.py`
    - Running migration upgrade twice does not error (idempotence)
    - After migration, `sqlalchemy.inspect(engine).get_table_names()` returns 11 + `alembic_version`
  </acceptance_criteria>
  <done>Alembic revision 0001 creates the full schema, idempotently; schema-invariant tests are green; render_as_batch is set; ORM and migration agree on column types.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Migration → data | Migration runs as part of app boot; bad migration can drop user data |
| Per-row tenant FK | Every business row carries `team_id`; missing FK = cross-tenant leak (Pitfall 5) |
| Encrypted-at-rest blob | Fernet ciphertext stored as `BLOB`; loss of master.key = permanent data loss |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-02-01 | Information disclosure | `team_id` missing on a new table | mitigate | `tests/test_schema_invariants.py` introspects metadata and fails CI if a new table outside the explicit allowlist lacks `team_id` (Pitfall A5) |
| T-01-02-02 | Tampering | SQLite ALTER COLUMN crashes on later migrations | mitigate | `render_as_batch=True` in `env.py` (Pitfall A1); enforced by acceptance criteria grep |
| T-01-02-03 | Information disclosure | Plaintext token stored if EncryptedSecret bypassed | mitigate | ORM column type IS `EncryptedSecret`; ALL writes go through `process_bind_param`. Audited via `test_schema_invariants` enumerating EncryptedSecret columns. |
| T-01-02-04 | Information disclosure | EncryptedSecret column accidentally made nullable + accepts plaintext | mitigate | Invariant test asserts all EncryptedSecret columns are NOT NULL. |
| T-01-02-05 | Repudiation | audit_log row inserted without team_id | accept (system actions) | Schema permits `team_id` NULL on audit_log because some system events (e.g., boot) are not tenant-scoped. Plan 07's audit-stub documents this. |
| T-01-02-06 | Tampering | quota row has both team_id AND user_id set (D-08 violation) | mitigate | CHECK constraint `(team_id IS NOT NULL) <> (user_id IS NOT NULL)` enforced at DB level; quota writes that violate raise IntegrityError |
| T-01-02-07 | Denial of service | Long-running migration on a large DB | accept | Phase 1 schema is brand-new; later phases will be additive (not destructive). Acceptable. |
| T-01-02-08 | Elevation of privilege | A user query reaches another team's rows because no `team_id` filter | mitigate (in code) | Schema enables filtering — actual filtering happens in service layer (Plan 06/07). Phase 2 will add connector-level ACL enforcement. |

**ASVS L1 mappings:**
- V8.1 (sensitive data identification) → `EncryptedSecret` columns explicitly enumerate the at-rest secrets (cluster API tokens, per-team tokens). Refresh tokens are HASHED not encrypted (different security property: server can't impersonate but can revoke).
- V8.3 (sensitive data at rest encryption) → Fernet AEAD via `EncryptedSecret` TypeDecorator
- V13.1 (API/data minimization) → no audit_log payload_before/payload_after writes in Phase 1; schema exists, writer ships Phase 2
</threat_model>

<verification>
- `cd backend && python -m pytest tests/test_migrations.py tests/test_schema_invariants.py -x -v` exits 0
- `cd backend && alembic upgrade head` against fresh DB exits 0
- `cd backend && alembic upgrade head` against already-migrated DB exits 0 (idempotent)
- `cd backend && python -c "from app.models import Base; print(len(Base.metadata.tables))"` prints `11`
</verification>

<success_criteria>
A fresh SQLite database can be brought to Phase 1 schema via a single `alembic upgrade head`. ORM models for all 11 tables compile, import, and pass invariant checks. Plans 05, 06, 07 can `from app.models import User, Team, Cluster, ...` and treat these as stable contracts.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-02-SUMMARY.md` documenting:
- 11 tables created (list)
- Indexes created (list)
- The allowlist used in schema-invariant tests and the rationale per table
- Any deviation from 01-RESEARCH.md §Schema Sketch with reason
</output>
