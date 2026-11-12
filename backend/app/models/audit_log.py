"""AuditLog ORM model."""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class AuditLog(Base, TimestampMixin):
    """An audit trail entry for tracking user and system actions."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(100))  # user.login, repo.sync, etc.
    resource_type: Mapped[str | None] = mapped_column(String(100))
    resource_id: Mapped[int | None] = mapped_column()
    details: Mapped[str | None] = mapped_column(Text)  # JSON string
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="audit_logs")

    __table_args__ = (Index("ix_audit_logs_action", "action"),)
