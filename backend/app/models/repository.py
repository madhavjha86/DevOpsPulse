"""Repository ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.github_account import GitHubAccount
    from app.models.commit import Commit
    from app.models.pull_request import PullRequest
    from app.models.issue import Issue
    from app.models.workflow_run import WorkflowRun
    from app.models.deployment import Deployment


class Repository(Base, TimestampMixin):
    """A GitHub repository tracked by the application."""

    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_account_id: Mapped[int] = mapped_column(
        ForeignKey("github_accounts.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(500), nullable=False)  # owner/repo
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(500))
    html_url: Mapped[str] = mapped_column(String(500))
    language: Mapped[str | None] = mapped_column(String(100))
    stars_count: Mapped[int] = mapped_column(default=0)
    forks_count: Mapped[int] = mapped_column(default=0)
    open_issues_count: Mapped[int] = mapped_column(default=0)
    is_private: Mapped[bool] = mapped_column(default=False)
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    github_account: Mapped["GitHubAccount"] = relationship(
        back_populates="repositories"
    )
    commits: Mapped[list["Commit"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    pull_requests: Mapped[list["PullRequest"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    issues: Mapped[list["Issue"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    workflow_runs: Mapped[list["WorkflowRun"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    deployments: Mapped[list["Deployment"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_repositories_full_name", "full_name"),)
