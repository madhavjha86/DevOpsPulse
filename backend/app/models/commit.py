"""Commit ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.repository import Repository


class Commit(Base, TimestampMixin):
    """A Git commit associated with a repository."""

    __tablename__ = "commits"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    sha: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    message: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(255))
    author_email: Mapped[str | None] = mapped_column(String(255))
    author_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    url: Mapped[str | None] = mapped_column(String(500))
    additions: Mapped[int | None] = mapped_column(default=0)
    deletions: Mapped[int | None] = mapped_column(default=0)

    # Relationships
    repository: Mapped["Repository"] = relationship(back_populates="commits")
