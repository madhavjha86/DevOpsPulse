"""Built-in CI/CD Automation Pipeline ORM models.

DevOpsPulse ka apna pipeline engine — code push hone se deploy hone tak
saara kaam automatically handle karta hai.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.organization import Organization


# ── Enums ────────────────────────────────────────────────────────

class PipelineTrigger(str, Enum):
    """What starts a pipeline run."""
    PUSH = "PUSH"
    PULL_REQUEST = "PULL_REQUEST"
    MANUAL = "MANUAL"
    SCHEDULE = "SCHEDULE"
    WEBHOOK = "WEBHOOK"
    TAG = "TAG"


class PipelineStatus(str, Enum):
    """Overall pipeline run status."""
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"


class StageStatus(str, Enum):
    """Individual stage execution status."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


# ── Pipeline Definition ─────────────────────────────────────────

class Pipeline(Base, TimestampMixin):
    """A reusable CI/CD pipeline template belonging to an organization."""

    __tablename__ = "pipelines"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    branch: Mapped[str] = mapped_column(String(200), default="main", nullable=False)
    trigger: Mapped[str] = mapped_column(
        String(30), default=PipelineTrigger.PUSH.value, nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Stage definitions stored as ordered JSON list
    # Each item: {"name": "Build", "type": "BUILD", "commands": [...], "docker_image": "node:20", "timeout_sec": 300}
    stages_config: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)

    # Auto-deploy settings
    auto_deploy: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deploy_target: Mapped[str | None] = mapped_column(String(100), nullable=True)  # k8s-cluster, docker-host, etc.

    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Relationships
    runs: Mapped[list["PipelineRun"]] = relationship(
        "PipelineRun", back_populates="pipeline",
        cascade="all, delete-orphan", order_by="PipelineRun.id.desc()",
    )

    __table_args__ = (
        Index("ix_pipeline_org_name", "organization_id", "name"),
    )


# ── Pipeline Run (one execution) ────────────────────────────────

class PipelineRun(Base, TimestampMixin):
    """One execution of a pipeline — triggered by push, PR, or manual."""

    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    run_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        String(30), default=PipelineStatus.QUEUED.value, nullable=False, index=True,
    )
    trigger: Mapped[str] = mapped_column(
        String(30), default=PipelineTrigger.MANUAL.value, nullable=False,
    )
    branch: Mapped[str | None] = mapped_column(String(200), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    commit_author: Mapped[str | None] = mapped_column(String(200), nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    triggered_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Relationships
    pipeline: Mapped["Pipeline"] = relationship("Pipeline", back_populates="runs")
    stages: Mapped[list["PipelineStage"]] = relationship(
        "PipelineStage", back_populates="run",
        cascade="all, delete-orphan", order_by="PipelineStage.order",
    )

    __table_args__ = (
        Index("ix_run_pipeline_status", "pipeline_id", "status"),
    )


# ── Pipeline Stage (one step within a run) ──────────────────────

class PipelineStage(Base, TimestampMixin):
    """One stage within a pipeline run (Build, Test, Scan, Deploy, etc.)."""

    __tablename__ = "pipeline_stages"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pipeline_runs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    stage_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )  # BUILD, TEST, SECURITY_SCAN, DOCKER_BUILD, DEPLOY, CUSTOM
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(30), default=StageStatus.PENDING.value, nullable=False,
    )
    docker_image: Mapped[str | None] = mapped_column(String(300), nullable=True)
    commands: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    run: Mapped["PipelineRun"] = relationship("PipelineRun", back_populates="stages")

    __table_args__ = (
        Index("ix_stage_run_order", "run_id", "order"),
    )
