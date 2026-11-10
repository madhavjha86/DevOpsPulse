"""Add docker_hosts table for container infrastructure monitoring.

Revision ID: 002_docker_monitoring
Revises: 001_initial
Create Date: 2026-11-06 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_docker_monitoring"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "docker_hosts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("host_url", sa.String(length=255), nullable=False),
        sa.Column("tls_verify", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_status", sa.String(length=50), server_default="unknown", nullable=False),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("server_version", sa.String(length=50), nullable=True),
        sa.Column("containers_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_docker_hosts_user_id", "docker_hosts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_docker_hosts_user_id", table_name="docker_hosts")
    op.drop_table("docker_hosts")
