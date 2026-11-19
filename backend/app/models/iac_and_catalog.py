"""Infrastructure as Code (Terraform) and Developer Portal (Service Catalog) ORM models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class TerraformWorkspace(Base, TimestampMixin):
    """Terraform infrastructure workspace with drift tracking and configuration validation."""

    __tablename__ = "terraform_workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    repository_url: Mapped[str] = mapped_column(String(255), nullable=False)
    working_directory: Mapped[str] = mapped_column(String(255), default="terraform", nullable=False)
    terraform_version: Mapped[str] = mapped_column(String(50), default="1.8.2", nullable=False)
    current_state_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resource_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[str] = mapped_column(
        String(50), default="HEALTHY", nullable=False, index=True
    )  # HEALTHY, DRIFT_DETECTED, PLANNING, APPLIED, FAILED
    has_drift: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_drift_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_approve_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    runs: Mapped[list["TerraformRun"]] = relationship(
        "TerraformRun", back_populates="workspace", cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class TerraformRun(Base, TimestampMixin):
    """Terraform plan, apply execution, change preview, security audit, and rollback guidance."""

    __tablename__ = "terraform_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("terraform_workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    run_type: Mapped[str] = mapped_column(
        String(50), default="PLAN", nullable=False
    )  # PLAN, APPLY, DRIFT_CHECK, VALIDATION
    status: Mapped[str] = mapped_column(
        String(50), default="PLANNED", nullable=False, index=True
    )  # PENDING, PLANNED, CONFIRMED, APPLIED, REJECTED, FAILED

    resources_to_add: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resources_to_change: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resources_to_destroy: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_destructive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    plan_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    security_scan_passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    security_issues_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rollback_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    workspace: Mapped["TerraformWorkspace"] = relationship("TerraformWorkspace", back_populates="runs")
    user: Mapped["User"] = relationship("User", lazy="selectin")


class ServiceCatalogItem(Base, TimestampMixin):
    """Developer Portal service catalog, ownership matrix, documentation, and API specifications."""

    __tablename__ = "service_catalog_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tier: Mapped[str] = mapped_column(
        String(50), default="TIER_1_CRITICAL", nullable=False
    )  # TIER_1_CRITICAL, TIER_2_CORE, TIER_3_SUPPORTING
    owner_team: Mapped[str] = mapped_column(String(100), nullable=False)
    tech_stack: Mapped[str] = mapped_column(String(150), nullable=False)
    lifecycle: Mapped[str] = mapped_column(
        String(50), default="PRODUCTION", nullable=False
    )  # PRODUCTION, BETA, EXPERIMENTAL, DEPRECATED
    health_status: Mapped[str] = mapped_column(
        String(50), default="HEALTHY", nullable=False
    )  # HEALTHY, DEGRADED, DOWN
    environment: Mapped[str] = mapped_column(
        String(50), default="PRODUCTION", nullable=False
    )  # PRODUCTION, STAGING, DEV

    repository_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    documentation_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_spec_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    organization: Mapped["Organization | None"] = relationship("Organization", lazy="selectin")


class GoldenPathTemplate(Base, TimestampMixin):
    """Developer Portal Golden Path scaffolding template for standards-compliant microservices."""

    __tablename__ = "golden_path_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), default="BACKEND", nullable=False
    )  # BACKEND, FRONTEND, DATA_PIPELINE, INFRASTRUCTURE
    description: Mapped[str] = mapped_column(Text, nullable=False)
    repository_template_url: Mapped[str] = mapped_column(String(255), nullable=False)
    ci_template: Mapped[str] = mapped_column(String(100), default="GitHub Actions", nullable=False)
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
