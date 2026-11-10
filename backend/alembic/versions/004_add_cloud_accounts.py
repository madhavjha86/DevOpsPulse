"""Add cloud_accounts table for AWS, Azure, and GCP Cloud Monitoring.

Revision ID: 004_cloud_monitoring
Revises: 003_k8s_monitoring
Create Date: 2026-11-06 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_cloud_monitoring"
down_revision: Union[str, None] = "003_k8s_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cloud_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("region", sa.String(length=50), server_default="us-east-1", nullable=False),
        sa.Column("encrypted_credentials", sa.Text(), nullable=False),
        sa.Column("last_status", sa.String(length=50), server_default="unconfigured", nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resources_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cloud_accounts_user_id", "cloud_accounts", ["user_id"])
    op.create_index("ix_cloud_accounts_provider", "cloud_accounts", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_cloud_accounts_provider", table_name="cloud_accounts")
    op.drop_index("ix_cloud_accounts_user_id", table_name="cloud_accounts")
    op.drop_table("cloud_accounts")
