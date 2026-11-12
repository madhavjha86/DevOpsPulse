"""AI Pull Request Code Reviewer and CI/CD Failure Prediction ORM models."""

from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.pull_request import PullRequest
    from app.models.repository import Repository
    from app.models.user import User


class AIPullRequestReview(Base, TimestampMixin):
    """Automated AI Code Review and Security Audit for a Pull Request."""

    __tablename__ = "ai_pr_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    pull_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("pull_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pr_number: Mapped[int] = mapped_column(Integer, default=1)
    pr_title: Mapped[str] = mapped_column(String(500), default="Untitled Pull Request")
    review_verdict: Mapped[str] = mapped_column(
        String(50), default="COMMENT"
    )  # APPROVE, REQUEST_CHANGES, COMMENT
    summary: Mapped[str] = mapped_column(Text)
    findings_json: Mapped[str] = mapped_column(Text, default="[]")
    security_score: Mapped[int] = mapped_column(Integer, default=85)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="pr_reviews")
    pull_request: Mapped["PullRequest | None"] = relationship()
    repository: Mapped["Repository | None"] = relationship()

    __table_args__ = (
        Index("ix_pr_review_verdict", "review_verdict"),
        Index("ix_pr_review_security_score", "security_score"),
    )


class AIFailurePrediction(Base, TimestampMixin):
    """Predictive failure risk analysis for commits before or during pipeline execution."""

    __tablename__ = "ai_failure_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String(64), index=True)
    branch: Mapped[str] = mapped_column(String(255), default="main")
    risk_score: Mapped[float] = mapped_column(Float, default=0.25)  # 0.0 to 1.0
    risk_level: Mapped[str] = mapped_column(
        String(50), default="LOW"
    )  # LOW, MODERATE, HIGH, CRITICAL
    risk_factors_json: Mapped[str] = mapped_column(Text, default="[]")
    recommendations_json: Mapped[str] = mapped_column(Text, default="[]")

    # Relationships
    user: Mapped["User"] = relationship(back_populates="failure_predictions")
    repository: Mapped["Repository | None"] = relationship()

    __table_args__ = (
        Index("ix_pred_risk_level", "risk_level"),
        Index("ix_pred_commit_sha", "commit_sha"),
    )
