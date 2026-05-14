"""Job queue rows — Phase 3 owns the worker; Plan 01-02 ships the schema.

**Pitfall 12 mitigation:** ``idempotency_key`` (unique, nullable) lets every
HTTP write be safely retried. The HTTP handler computes the key from
``hash(method + path + actor + body_hash)`` and tries to insert; an
IntegrityError on the unique constraint means "already enqueued, return the
existing job state".

**Pitfall 2 mitigation:** when the worker dispatches a job to PVE, it
persists the returned UPID *before* polling. The row therefore has ``upid``
(plus the node it was issued on for `task_status` lookups) populated as
soon as PVE returns from the dispatch call.

State machine (column ``state``):
- ``pending`` → newly created, not yet picked up by a worker
- ``claimed`` → worker has reserved it but not started execution
- ``running`` → dispatched to PVE; UPID populated; polling in progress
- ``succeeded`` → terminal happy path
- ``failed`` → terminal sad path; ``error`` populated
- ``orphaned`` → boot-time reaper marked: worker died mid-flight, state
  unknown until PVE confirms
- ``needs_review`` → orphan reaper couldn't determine the outcome; admin
  must check
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable so internal/boot jobs can skip it; unique so accidental
    # double-submits collide loudly.
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True
    )
    state: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    cluster_id: Mapped[int | None] = mapped_column(
        ForeignKey("clusters.id"), nullable=True
    )
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id"), nullable=True
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # e.g. "vm.create", "lxc.start", "vm.snapshot.create".
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    # Persisted BEFORE worker begins polling (Pitfall 2).
    upid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upid_node: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        Index("ix_jobs_state", "state"),
        Index("ix_jobs_team_created", "team_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<Job id={self.id} kind={self.kind!r} state={self.state!r} "
            f"upid={self.upid!r}>"
        )
