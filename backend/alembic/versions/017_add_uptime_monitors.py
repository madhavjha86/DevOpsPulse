"""Add service_monitors table for persistent uptime and health monitoring.

Revision ID: 017_add_uptime_monitors
Revises: 016_harden_cloud_cost_prod
Create Date: 2026-11-20 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "017_add_uptime_monitors"
down_revision: Union[str, None] = "016_harden_cloud_cost_prod"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_monitors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("method", sa.String(length=10), server_default="GET", nullable=False),
        sa.Column("interval_seconds", sa.Integer(), server_default="60", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="operational", nullable=False),
        sa.Column("uptime_percentage", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("avg_latency_ms", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recent_probes_json", sa.Text(), server_default="[200, 200, 200]", nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_service_monitors_org_user", "service_monitors", ["organization_id", "user_id"])


def downgrade() -> None:
    op.drop_index("ix_service_monitors_org_user", table_name="service_monitors")
    op.drop_table("service_monitors")
