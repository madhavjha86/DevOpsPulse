"""Add Terraform IaC management and Developer Portal Service Catalog tables.

Revision ID: 014_add_iac_and_catalog
Revises: 013_add_sre_and_observability
Create Date: 2026-11-20 02:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "014_add_iac_and_catalog"
down_revision: Union[str, None] = "013_add_sre_and_observability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. terraform_workspaces
    op.create_table(
        "terraform_workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("repository_url", sa.String(length=255), nullable=False),
        sa.Column("working_directory", sa.String(length=255), server_default="terraform", nullable=False),
        sa.Column("terraform_version", sa.String(length=50), server_default="1.8.2", nullable=False),
        sa.Column("current_state_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("resource_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="HEALTHY", nullable=False),
        sa.Column("has_drift", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("last_drift_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_approve_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tf_workspaces_org", "terraform_workspaces", ["organization_id"])
    op.create_index("ix_tf_workspaces_status", "terraform_workspaces", ["status"])

    # 2. terraform_runs
    op.create_table(
        "terraform_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("terraform_workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_type", sa.String(length=50), server_default="PLAN", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="PLANNED", nullable=False),
        sa.Column("resources_to_add", sa.Integer(), server_default="0", nullable=False),
        sa.Column("resources_to_change", sa.Integer(), server_default="0", nullable=False),
        sa.Column("resources_to_destroy", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_destructive", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("plan_output", sa.Text(), nullable=True),
        sa.Column("security_scan_passed", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("security_issues_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("approved_by", sa.String(length=100), nullable=True),
        sa.Column("rollback_guidance", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tf_runs_workspace", "terraform_runs", ["workspace_id"])
    op.create_index("ix_tf_runs_status", "terraform_runs", ["status"])

    # 3. service_catalog_items
    op.create_table(
        "service_catalog_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tier", sa.String(length=50), server_default="TIER_1_CRITICAL", nullable=False),
        sa.Column("owner_team", sa.String(length=100), nullable=False),
        sa.Column("tech_stack", sa.String(length=150), nullable=False),
        sa.Column("lifecycle", sa.String(length=50), server_default="PRODUCTION", nullable=False),
        sa.Column("health_status", sa.String(length=50), server_default="HEALTHY", nullable=False),
        sa.Column("environment", sa.String(length=50), server_default="PRODUCTION", nullable=False),
        sa.Column("repository_url", sa.String(length=255), nullable=True),
        sa.Column("documentation_url", sa.String(length=255), nullable=True),
        sa.Column("api_spec_url", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_service_catalog_org", "service_catalog_items", ["organization_id"])
    op.create_index("ix_service_catalog_name", "service_catalog_items", ["name"])

    # 4. golden_path_templates
    op.create_table(
        "golden_path_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), server_default="BACKEND", nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("repository_template_url", sa.String(length=255), nullable=False),
        sa.Column("ci_template", sa.String(length=100), server_default="GitHub Actions", nullable=False),
        sa.Column("is_recommended", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("golden_path_templates")
    op.drop_table("service_catalog_items")
    op.drop_table("terraform_runs")
    op.drop_table("terraform_workspaces")
