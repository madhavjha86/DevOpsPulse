"""Deployment ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.repository import Repository


class Deployment(Base, TimestampMixin):
    """A GitHub deployment."""

    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    environment: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(
        String(50)
    )  # pending, success, failure, error, inactive
    description: Mapped[str | None] = mapped_column(Text)
    ref: Mapped[str | None] = mapped_column(String(255))
    sha: Mapped[str | None] = mapped_column(String(40))
    url: Mapped[str | None] = mapped_column(String(500))
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creator: Mapped[str | None] = mapped_column(String(255))

    # Relationships
    repository: Mapped["Repository"] = relationship(back_populates="deployments")
