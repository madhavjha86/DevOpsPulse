"""Organization Webhook and Alerting Channel ORM model."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class WebhookTargetType(str, Enum):
    """Supported alert destination types."""

    SLACK = "SLACK"
    DISCORD = "DISCORD"
    TEAMS = "TEAMS"
    GENERIC = "GENERIC"


class OrganizationWebhook(Base, TimestampMixin):
    """Outgoing webhook subscription for real-time alerting (Slack, Discord, Teams, Custom)."""

    __tablename__ = "organization_webhooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(
        String(20), default=WebhookTargetType.SLACK.value, nullable=False
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    events: Mapped[str] = mapped_column(
        String(500), default="incident.created,incident.resolved,incident.critical", nullable=False
    )
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_delivery_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="webhooks")

    __table_args__ = (
        Index("ix_org_webhooks_active", "organization_id", "is_active"),
    )
