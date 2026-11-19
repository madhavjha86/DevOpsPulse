"""SRE Reliability and Observability ORM models."""

from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class ServiceLevelObjective(Base, TimestampMixin):
    """Service Level Objective (SLO) with explicit internal target vs contractual SLA and error budget burn."""

    __tablename__ = "sre_slos"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sli_type: Mapped[str] = mapped_column(
        String(50), default="AVAILABILITY", nullable=False
    )  # AVAILABILITY, LATENCY, ERROR_RATE, THROUGHPUT

    # Explicit separation of internal target vs contractual SLA (Requirement Phase 4)
    target_percentage: Mapped[float] = mapped_column(Float, default=99.9, nullable=False)
    contractual_sla_percentage: Mapped[float] = mapped_column(Float, default=99.5, nullable=False)

    time_window_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    current_sli: Mapped[float] = mapped_column(Float, default=99.95, nullable=False)

    # Error Budget Calculations
    error_budget_percentage: Mapped[float] = mapped_column(Float, default=0.1, nullable=False)
    error_budget_remaining_percentage: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    error_budget_burn_rate_1h: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    error_budget_burn_rate_6h: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    error_budget_burn_rate_24h: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)

    warning_threshold: Mapped[float] = mapped_column(Float, default=20.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="HEALTHY", nullable=False, index=True
    )  # HEALTHY, WARNING, BREACHED
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class OnCallSchedule(Base, TimestampMixin):
    """SRE On-Call schedule with rotation, primary/secondary responders, and escalation policies."""

    __tablename__ = "sre_on_call_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    primary_engineer: Mapped[str] = mapped_column(String(100), nullable=False)
    secondary_engineer: Mapped[str] = mapped_column(String(100), nullable=False)
    rotation_type: Mapped[str] = mapped_column(
        String(50), default="WEEKLY", nullable=False
    )  # WEEKLY, DAILY, BIWEEKLY
    escalation_policy: Mapped[str] = mapped_column(
        String(255),
        default="P1: 5min Slack -> SMS -> Team Lead -> VP Eng",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    handoff_day: Mapped[str] = mapped_column(String(20), default="Monday", nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class ObservabilityAlertRule(Base, TimestampMixin):
    """Custom metric threshold alert rules for latency, error rate, CPU and memory."""

    __tablename__ = "observability_alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(
        String(50), default="LATENCY_P99", nullable=False
    )  # LATENCY_P99, LATENCY_P95, ERROR_RATE, CPU_USAGE, MEMORY_USAGE
    operator: Mapped[str] = mapped_column(String(10), default=">", nullable=False)  # >, >=, <, <=
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50), default="HIGH", nullable=False
    )  # CRITICAL, HIGH, MEDIUM, LOW
    notification_channel: Mapped[str] = mapped_column(
        String(100), default="WEBHOOK", nullable=False
    )  # WEBHOOK, SLACK, EMAIL, PAGERDUTY
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")
