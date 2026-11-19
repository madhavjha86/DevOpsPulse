"""Disaster Recovery, Automated Backup Verification, and Organization API Keys ORM models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class DisasterRecoveryDrill(Base, TimestampMixin):
    """Disaster recovery test drill history and RPO/RTO verification."""

    __tablename__ = "dr_drill_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    drill_name: Mapped[str] = mapped_column(String(150), nullable=False)
    target_system: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="PASSED", nullable=False, index=True
    )  # PASSED, FAILED, RUNNING

    rpo_target_minutes: Mapped[float] = mapped_column(Float, default=15.0, nullable=False)
    rpo_actual_minutes: Mapped[float] = mapped_column(Float, default=4.5, nullable=False)
    rto_target_minutes: Mapped[float] = mapped_column(Float, default=30.0, nullable=False)
    rto_actual_minutes: Mapped[float] = mapped_column(Float, default=11.8, nullable=False)
    data_loss_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    backup_snapshot_id: Mapped[str] = mapped_column(String(100), nullable=False)
    verification_notes: Mapped[str] = mapped_column(Text, nullable=False)
    tested_by: Mapped[str] = mapped_column(String(100), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class BackupRecord(Base, TimestampMixin):
    """Automated and on-demand database & volume backup snapshots."""

    __tablename__ = "dr_backups"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    backup_name: Mapped[str] = mapped_column(String(150), nullable=False)
    backup_type: Mapped[str] = mapped_column(
        String(50), default="FULL_SNAPSHOT", nullable=False
    )  # FULL_SNAPSHOT, INCREMENTAL_WAL, REPLICA_DIFF
    target_database: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_location: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="COMPLETED", nullable=False, index=True
    )  # COMPLETED, FAILED, IN_PROGRESS
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class OrganizationApiKey(Base, TimestampMixin):
    """Secure, scoped API keys for automated CI/CD and external systems."""

    __tablename__ = "organization_api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    hashed_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    scopes: Mapped[str] = mapped_column(
        String(255), default="read:telemetry,write:iac", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")
