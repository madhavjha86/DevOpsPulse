"""Notification ORM model."""

from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class Notification(Base, TimestampMixin):
    """An in-app notification for a user."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(
        String(50)
    )  # build_failure, build_success, workflow_completed, info
    is_read: Mapped[bool] = mapped_column(default=False, index=True)
    reference_type: Mapped[str | None] = mapped_column(
        String(50)
    )  # workflow_run, repository, etc.
    reference_id: Mapped[int | None] = mapped_column(BigInteger)
    metadata_json: Mapped[str | None] = mapped_column(Text)  # JSON string for extra data

    # Relationships
    user: Mapped["User"] = relationship(back_populates="notifications")
