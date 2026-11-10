"""PullRequest ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.repository import Repository


class PullRequest(Base, TimestampMixin):
    """A GitHub pull request associated with a repository."""

    __tablename__ = "pull_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, index=True)
    number: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(50))  # open, closed, merged
    author: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(500))
    created_at_gh: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    merged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    additions: Mapped[int | None] = mapped_column(default=0)
    deletions: Mapped[int | None] = mapped_column(default=0)

    # Relationships
    repository: Mapped["Repository"] = relationship(back_populates="pull_requests")

    __table_args__ = (
        UniqueConstraint("repository_id", "number", name="uq_pr_repo_number"),
    )
