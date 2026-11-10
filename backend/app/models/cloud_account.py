"""Cloud Account ORM model for AWS, Azure, and GCP Cloud Monitoring."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class CloudAccount(Base, TimestampMixin):
    """Configured Cloud Provider account (AWS, Azure, GCP) for telemetry and resource tracking."""

    __tablename__ = "cloud_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # aws, azure, gcp
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False, default="us-east-1")
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Status and telemetry caches
    last_status: Mapped[str] = mapped_column(
        String(50), default="unconfigured", nullable=False
    )  # connected, unconfigured, unreachable, auth_error
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resources_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="cloud_accounts")
