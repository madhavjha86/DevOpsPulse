"""Engineering Team Productivity Analytics ORM models."""

from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.repository import Repository
    from app.models.user import User


class EngineeringTeam(Base, TimestampMixin):
    """Team grouping for collective engineering productivity and DORA metrics."""

    __tablename__ = "engineering_teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_lead_time_hours: Mapped[float] = mapped_column(Float, default=24.0, nullable=False)
    target_deployment_freq_per_day: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)
    target_review_time_hours: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
    team_repositories: Mapped[list["TeamRepository"]] = relationship(
        "TeamRepository",
        back_populates="team",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_teams_user_name", "user_id", "name"),
    )


class TeamRepository(Base, TimestampMixin):
    """Mapping table connecting engineering teams to monitored repositories."""

    __tablename__ = "team_repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("engineering_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repository_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    team: Mapped["EngineeringTeam"] = relationship("EngineeringTeam", back_populates="team_repositories")
    repository: Mapped["Repository"] = relationship("Repository")

    __table_args__ = (
        Index("ix_team_repo_unique", "team_id", "repository_id", unique=True),
    )
