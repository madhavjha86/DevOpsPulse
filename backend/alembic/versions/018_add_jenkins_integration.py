"""Add Jenkins CI/CD integration tables for servers, jobs, and builds.

Revision ID: 018_add_jenkins_integration
Revises: 017_add_uptime_monitors
Create Date: 2026-11-20 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "018_add_jenkins_integration"
down_revision: Union[str, None] = "017_add_uptime_monitors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. jenkins_servers table
    op.create_table(
        "jenkins_servers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("server_url", sa.String(length=500), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=True),
        sa.Column("api_token", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_status", sa.String(length=50), server_default="connected", nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jenkins_servers_org_user", "jenkins_servers", ["organization_id", "user_id"])

    # 2. jenkins_jobs table
    op.create_table(
        "jenkins_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jenkins_server_id", sa.Integer(), sa.ForeignKey("jenkins_servers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=200), nullable=False, index=True),
        sa.Column("job_url", sa.String(length=500), nullable=False),
        sa.Column("job_type", sa.String(length=50), server_default="workflow-job", nullable=False),
        sa.Column("color", sa.String(length=50), server_default="blue", nullable=False),
        sa.Column("last_build_number", sa.Integer(), nullable=True),
        sa.Column("last_build_status", sa.String(length=50), nullable=True),
        sa.Column("is_buildable", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. jenkins_builds table
    op.create_table(
        "jenkins_builds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jenkins_job_id", sa.Integer(), sa.ForeignKey("jenkins_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("build_number", sa.Integer(), nullable=False),
        sa.Column("build_url", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="IN_PROGRESS", nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("branch", sa.String(length=100), nullable=True),
        sa.Column("commit_sha", sa.String(length=64), nullable=True),
        sa.Column("triggered_by", sa.String(length=100), nullable=True),
        sa.Column("estimated_duration_ms", sa.Integer(), nullable=True),
        sa.Column("console_log_snippet", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jenkins_builds_job_number", "jenkins_builds", ["jenkins_job_id", "build_number"])


def downgrade() -> None:
    op.drop_index("ix_jenkins_builds_job_number", table_name="jenkins_builds")
    op.drop_table("jenkins_builds")
    op.drop_table("jenkins_jobs")
    op.drop_index("ix_jenkins_servers_org_user", table_name="jenkins_servers")
    op.drop_table("jenkins_servers")
