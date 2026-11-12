"""Multi-Tenant SaaS Organization and Workspace ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class OrganizationType(str, Enum):
    """Classification of workspace: Personal vs Company."""

    PERSONAL = "PERSONAL"
    COMPANY = "COMPANY"


class OrganizationRole(str, Enum):
    """Tenant-scoped RBAC roles."""

    SUPER_ADMIN = "SUPER_ADMIN"
    ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN"
    DEVOPS_ENGINEER = "DEVOPS_ENGINEER"
    DEVELOPER = "DEVELOPER"
    SECURITY_ENGINEER = "SECURITY_ENGINEER"
    VIEWER = "VIEWER"


class Organization(Base, TimestampMixin):
    """Workspace / Tenant boundary supporting Individual Developers and Companies."""

    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), default=OrganizationType.COMPANY.value, nullable=False, index=True
    )  # PERSONAL or COMPANY
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    members: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    invitations: Mapped[list["OrganizationInvitation"]] = relationship(
        "OrganizationInvitation",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_organizations_type_owner", "type", "owner_id"),
    )


class OrganizationMember(Base, TimestampMixin):
    """User membership and assigned tenant role within an organization."""

    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(50), default=OrganizationRole.DEVELOPER.value, nullable=False, index=True
    )  # ORGANIZATION_ADMIN, DEVOPS_ENGINEER, DEVELOPER, SECURITY_ENGINEER, VIEWER
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="members")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_org_member_unique", "organization_id", "user_id", unique=True),
        Index("ix_org_member_role", "organization_id", "role"),
    )


class OrganizationInvitation(Base, TimestampMixin):
    """Team member invitations to company organization workspaces."""

    __tablename__ = "organization_invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(
        String(50), default=OrganizationRole.DEVELOPER.value, nullable=False
    )
    token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    invited_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False, index=True
    )  # PENDING, ACCEPTED, REVOKED, EXPIRED
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="invitations")
    invited_by: Mapped["User"] = relationship("User", foreign_keys=[invited_by_id])

    __table_args__ = (
        Index("ix_org_invitation_org_email", "organization_id", "email"),
    )
