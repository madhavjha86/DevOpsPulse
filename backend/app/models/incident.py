"""Smart Incident Management ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_copilot import AIRootCauseAnalysis
    from app.models.repository import Repository
    from app.models.user import User
    from app.models.workflow_run import WorkflowRun


class Incident(Base, TimestampMixin):
    """Smart Incident entity tracking outages, degraded services, and CI/CD disruptions."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assignee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workflow_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    root_cause_analysis_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ai_root_cause_analyses.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50), default="MEDIUM", nullable=False
    )  # CRITICAL, HIGH, MEDIUM, LOW
    priority: Mapped[str] = mapped_column(
        String(10), default="P2", nullable=False
    )  # P1, P2, P3, P4
    status: Mapped[str] = mapped_column(
        String(50), default="OPEN", nullable=False
    )  # OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED
    service: Mapped[str] = mapped_column(
        String(100), default="api-service", nullable=False
    )
    environment: Mapped[str] = mapped_column(
        String(50), default="production", nullable=False
    )  # production, staging, dev

    slack_channel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    slack_notification_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_notification_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assignee_id])
    repository: Mapped["Repository | None"] = relationship("Repository")
    workflow_run: Mapped["WorkflowRun | None"] = relationship("WorkflowRun")
    root_cause_analysis: Mapped["AIRootCauseAnalysis | None"] = relationship("AIRootCauseAnalysis")
    timeline_events: Mapped[list["IncidentTimelineEvent"]] = relationship(
        "IncidentTimelineEvent",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentTimelineEvent.id.asc()",
    )

    __table_args__ = (
        Index("ix_incidents_severity", "severity"),
        Index("ix_incidents_priority", "priority"),
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_service", "service"),
    )


class IncidentTimelineEvent(Base):
    """Audit log and chronological event entry for an incident."""

    __tablename__ = "incident_timeline_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # STATUS_CHANGE, SEVERITY_CHANGE, ASSIGNMENT, COMMENT, RCA_LINKED, RESOLVED, ALERT_TRIGGERED
    from_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="timeline_events")
    user: Mapped["User | None"] = relationship("User")
