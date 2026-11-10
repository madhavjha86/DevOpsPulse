"""AI DevOps Copilot and Root Cause Analysis (RCA) ORM models."""

from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.repository import Repository
    from app.models.user import User
    from app.models.workflow_run import WorkflowRun


class AIConversation(Base, TimestampMixin):
    """An interactive chat session with the AI DevOps Copilot."""

    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New DevOps Discussion")

    # Relationships
    user: Mapped["User"] = relationship(back_populates="ai_conversations")
    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.id"
    )


class AIMessage(Base, TimestampMixin):
    """A message in an AI Copilot conversation."""

    __tablename__ = "ai_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(50))  # user, assistant, system
    content: Mapped[str] = mapped_column(Text)
    context_metadata_json: Mapped[str | None] = mapped_column(Text)  # attached workflow/logs context

    # Relationships
    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


class AIRootCauseAnalysis(Base, TimestampMixin):
    """Structured Root Cause Analysis (RCA) generated for CI/CD build failures or incidents."""

    __tablename__ = "ai_root_cause_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    workflow_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    failure_category: Mapped[str] = mapped_column(
        String(100), default="UNKNOWN"
    )  # TEST_FAILURE, DEPENDENCY_ERROR, DOCKER_BUILD_ERROR, TIMEOUT, SYNTAX_ERROR, PERMISSION_DENIED
    severity: Mapped[str] = mapped_column(
        String(50), default="MEDIUM"
    )  # CRITICAL, HIGH, MEDIUM, LOW
    summary: Mapped[str] = mapped_column(Text)
    root_cause: Mapped[str] = mapped_column(Text)
    remediation_steps_json: Mapped[str] = mapped_column(Text, default="[]")
    suggested_fix_diff: Mapped[str | None] = mapped_column(Text)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.88)
    status: Mapped[str] = mapped_column(
        String(50), default="generated"
    )  # generated, acknowledged, resolved

    # Relationships
    user: Mapped["User"] = relationship(back_populates="root_cause_analyses")
    workflow_run: Mapped["WorkflowRun | None"] = relationship()
    repository: Mapped["Repository | None"] = relationship()

    __table_args__ = (
        Index("ix_rca_failure_category", "failure_category"),
        Index("ix_rca_severity", "severity"),
        Index("ix_rca_status", "status"),
    )
