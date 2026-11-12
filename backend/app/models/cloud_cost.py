"""Cloud Cost Intelligence ORM models for AWS, Azure, and GCP tracking."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.cloud_account import CloudAccount
    from app.models.user import User


class CloudBudget(Base, TimestampMixin):
    """Budget tracking and alerting thresholds for cloud spend."""

    __tablename__ = "cloud_budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cloud_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(
        String(50), default="ALL", nullable=False
    )  # ALL, AWS, AZURE, GCP
    monthly_budget: Mapped[float] = mapped_column(Float, nullable=False)
    warning_threshold: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    critical_threshold: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    current_spend: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    alert_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    alert_slack_channel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_alert_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    cloud_account: Mapped["CloudAccount | None"] = relationship("CloudAccount")


class CloudCostItem(Base, TimestampMixin):
    """Granular daily and service-wise cloud cost entries."""

    __tablename__ = "cloud_cost_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cloud_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # AWS, AZURE, GCP
    service_name: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g., "Amazon EC2", "Google Cloud Storage", "Virtual Machines"
    cost_amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
    cloud_account: Mapped["CloudAccount | None"] = relationship("CloudAccount")

    __table_args__ = (
        Index("ix_cloud_cost_user_date", "user_id", "usage_date"),
        Index("ix_cloud_cost_provider_service", "provider", "service_name"),
    )


class CloudCostOptimization(Base, TimestampMixin):
    """Cost-saving recommendation generated from resource analysis."""

    __tablename__ = "cloud_cost_optimizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cloud_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # AWS, AZURE, GCP
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # IDLE_RESOURCE, RIGHTSIZING, STORAGE_LIFECYCLE, RESERVED_INSTANCE
    resource_id: Mapped[str] = mapped_column(String(100), nullable=False)
    estimated_monthly_savings: Mapped[float] = mapped_column(Float, nullable=False)
    difficulty: Mapped[str] = mapped_column(
        String(50), default="EASY", nullable=False
    )  # EASY, MEDIUM, COMPLEX
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="OPEN", nullable=False
    )  # OPEN, APPLIED, DISMISSED

    # Relationships
    user: Mapped["User"] = relationship("User")
    cloud_account: Mapped["CloudAccount | None"] = relationship("CloudAccount")

    __table_args__ = (
        Index("ix_cost_opt_category", "category"),
        Index("ix_cost_opt_status", "status"),
    )
