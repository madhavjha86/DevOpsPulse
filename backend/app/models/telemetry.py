"""Telemetry ORM models for Centralized Logs and Distributed Tracing."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class TelemetryLog(Base, TimestampMixin):
    """Centralized application and infrastructure structured log entry."""

    __tablename__ = "telemetry_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_name: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    level: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # INFO, WARN, ERROR, DEBUG, FATAL
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    trace_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    span_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attributes_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="telemetry_logs")


class TelemetrySpan(Base, TimestampMixin):
    """OpenTelemetry distributed tracing span."""

    __tablename__ = "telemetry_spans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    span_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    parent_span_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_name: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(30), default="SERVER", nullable=False
    )  # SERVER, CLIENT, INTERNAL, PRODUCER, CONSUMER
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    status_code: Mapped[str] = mapped_column(
        String(20), default="OK", nullable=False, index=True
    )  # OK, ERROR, UNSET
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attributes_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="telemetry_spans")
