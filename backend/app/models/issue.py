"""Issue ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.repository import Repository


class Issue(Base, TimestampMixin):
    """A GitHub issue associated with a repository."""

    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, index=True)
    number: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(50))  # open, closed
    author: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(500))
    labels: Mapped[str | None] = mapped_column(Text)  # JSON string of labels
    created_at_gh: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    repository: Mapped["Repository"] = relationship(back_populates="issues")

    __table_args__ = (
        UniqueConstraint("repository_id", "number", name="uq_issue_repo_number"),
    )
