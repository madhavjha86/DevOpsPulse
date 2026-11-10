"""WorkflowRun ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.repository import Repository


class WorkflowRun(Base, TimestampMixin):
    """A GitHub Actions workflow run."""

    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    workflow_name: Mapped[str] = mapped_column(String(255))
    workflow_id: Mapped[int | None] = mapped_column(BigInteger)
    run_number: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(
        String(50)
    )  # queued, in_progress, completed
    conclusion: Mapped[str | None] = mapped_column(
        String(50)
    )  # success, failure, cancelled, skipped
    branch: Mapped[str | None] = mapped_column(String(255))
    event: Mapped[str | None] = mapped_column(String(100))  # push, pull_request, etc.
    url: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column()

    # Relationships
    repository: Mapped["Repository"] = relationship(back_populates="workflow_runs")

    __table_args__ = (
        Index("ix_workflow_runs_status", "status"),
        Index("ix_workflow_runs_conclusion", "conclusion"),
    )
