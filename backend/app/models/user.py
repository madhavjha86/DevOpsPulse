"""User ORM model."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING without circular import at runtime
    from app.models.ai_code_intelligence import AIPullRequestReview, AIFailurePrediction
    from app.models.ai_copilot import AIConversation, AIRootCauseAnalysis
    from app.models.github_account import GitHubAccount
    from app.models.notification import Notification
    from app.models.audit_log import AuditLog
    from app.models.docker_host import DockerHost
    from app.models.k8s_cluster import K8sCluster
    from app.models.cloud_account import CloudAccount
    from app.models.telemetry import TelemetryLog, TelemetrySpan


class User(Base, TimestampMixin):
    """Application user."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # nullable for OAuth-only users
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)
    role: Mapped[str] = mapped_column(
        String(50), default="user"
    )  # user, admin, viewer
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # Relationships
    github_accounts: Mapped[list["GitHubAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="user"
    )
    docker_hosts: Mapped[list["DockerHost"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    k8s_clusters: Mapped[list["K8sCluster"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    cloud_accounts: Mapped[list["CloudAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    telemetry_logs: Mapped[list["TelemetryLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    telemetry_spans: Mapped[list["TelemetrySpan"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ai_conversations: Mapped[list["AIConversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    root_cause_analyses: Mapped[list["AIRootCauseAnalysis"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    pr_reviews: Mapped[list["AIPullRequestReview"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    failure_predictions: Mapped[list["AIFailurePrediction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
