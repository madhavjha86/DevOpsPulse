"""Jenkins CI/CD integration ORM models for controllers, jobs, and build executions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class JenkinsServer(Base, TimestampMixin):
    """Registered Jenkins controller instance."""

    __tablename__ = "jenkins_servers"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    server_url: Mapped[str] = mapped_column(String(500), nullable=False)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    api_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_status: Mapped[str] = mapped_column(
        String(50), default="connected", nullable=False
    )  # connected, error, unreachable, unconfigured
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    organization: Mapped["Organization | None"] = relationship("Organization")
    jobs: Mapped[list["JenkinsJob"]] = relationship(
        "JenkinsJob", back_populates="server", cascade="all, delete-orphan"
    )


class JenkinsJob(Base, TimestampMixin):
    """Jenkins pipeline or freestyle project."""

    __tablename__ = "jenkins_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    jenkins_server_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jenkins_servers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    job_url: Mapped[str] = mapped_column(String(500), nullable=False)
    job_type: Mapped[str] = mapped_column(
        String(50), default="workflow-job", nullable=False
    )  # workflow-job, freestyle, multibranch
    color: Mapped[str] = mapped_column(
        String(50), default="blue", nullable=False
    )  # blue, red, yellow, notbuilt, disabled, anime
    last_build_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_build_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # SUCCESS, FAILURE, UNSTABLE, ABORTED, IN_PROGRESS
    is_buildable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    server: Mapped["JenkinsServer"] = relationship("JenkinsServer", back_populates="jobs")
    builds: Mapped[list["JenkinsBuild"]] = relationship(
        "JenkinsBuild", back_populates="job", cascade="all, delete-orphan"
    )


class JenkinsBuild(Base, TimestampMixin):
    """Execution run of a Jenkins pipeline/job."""

    __tablename__ = "jenkins_builds"

    id: Mapped[int] = mapped_column(primary_key=True)
    jenkins_job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jenkins_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    build_number: Mapped[int] = mapped_column(Integer, nullable=False)
    build_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="IN_PROGRESS", nullable=False
    )  # SUCCESS, FAILURE, UNSTABLE, ABORTED, IN_PROGRESS
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    triggered_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    console_log_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    job: Mapped["JenkinsJob"] = relationship("JenkinsJob", back_populates="builds")
