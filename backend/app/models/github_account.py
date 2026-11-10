"""GitHubAccount ORM model."""

from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if False:  # TYPE_CHECKING
    from app.models.user import User
    from app.models.repository import Repository


class GitHubAccount(Base, TimestampMixin):
    """A linked GitHub account belonging to a user."""

    __tablename__ = "github_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    github_username: Mapped[str] = mapped_column(String(100))
    access_token: Mapped[str] = mapped_column(String(255))  # encrypted in production
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    token_scope: Mapped[str | None] = mapped_column(String(500))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="github_accounts")
    repositories: Mapped[list["Repository"]] = relationship(
        back_populates="github_account", cascade="all, delete-orphan"
    )
