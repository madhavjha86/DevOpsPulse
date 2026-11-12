"""Docker Host ORM model for Docker Container Monitoring."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class DockerHost(Base, TimestampMixin):
    """Configured Docker daemon host for infrastructure container monitoring."""

    __tablename__ = "docker_hosts"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    host_url: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="http://localhost:2375",
    )  # e.g., unix:///var/run/docker.sock, http://localhost:2375, tcp://host:2376
    tls_verify: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Cached status telemetry
    last_status: Mapped[str] = mapped_column(
        String(50), default="unknown", nullable=False
    )  # connected, unreachable, auth_error, unknown
    last_connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    server_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    containers_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="docker_hosts")
