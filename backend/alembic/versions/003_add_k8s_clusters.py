"""Add k8s_clusters table for Kubernetes cluster and pod monitoring.

Revision ID: 003_k8s_monitoring
Revises: 002_docker_monitoring
Create Date: 2026-11-06 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_k8s_monitoring"
down_revision: Union[str, None] = "002_docker_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "k8s_clusters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("api_server_url", sa.String(length=255), nullable=False),
        sa.Column("auth_type", sa.String(length=50), server_default="token", nullable=False),
        sa.Column("bearer_token", sa.Text(), nullable=True),
        sa.Column("ca_certificate", sa.Text(), nullable=True),
        sa.Column("namespace_filter", sa.String(length=100), server_default="all", nullable=False),
        sa.Column("tls_verify", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_status", sa.String(length=50), server_default="unknown", nullable=False),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("k8s_version", sa.String(length=50), nullable=True),
        sa.Column("nodes_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pods_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_k8s_clusters_user_id", "k8s_clusters", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_k8s_clusters_user_id", table_name="k8s_clusters")
    op.drop_table("k8s_clusters")
