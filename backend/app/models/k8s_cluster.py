"""Kubernetes Cluster ORM model for Cluster and Pod Observability."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User


class K8sCluster(Base, TimestampMixin):
    """Configured Kubernetes cluster for pod and node infrastructure monitoring."""

    __tablename__ = "k8s_clusters"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_server_url: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="https://127.0.0.1:6443",
    )  # e.g., https://127.0.0.1:6443, https://k8s.company.com:6443
    auth_type: Mapped[str] = mapped_column(
        String(50), default="token", nullable=False
    )  # token, certificate, none
    bearer_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    ca_certificate: Mapped[str | None] = mapped_column(Text, nullable=True)
    namespace_filter: Mapped[str] = mapped_column(
        String(100), default="all", nullable=False
    )  # all or specific namespace like default
    tls_verify: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Telemetry and state caches
    last_status: Mapped[str] = mapped_column(
        String(50), default="unknown", nullable=False
    )  # connected, unreachable, auth_error, unknown
    last_connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    k8s_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nodes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pods_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="k8s_clusters")
