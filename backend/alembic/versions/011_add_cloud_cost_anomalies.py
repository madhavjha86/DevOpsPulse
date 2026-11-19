"""Add cloud cost anomalies table for spike detection and alerting.

Revision ID: 011_add_cost_anomalies
Revises: 010_add_org_webhooks
Create Date: 2026-11-20 00:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "011_add_cost_anomalies"
down_revision: Union[str, None] = "010_add_org_webhooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cloud_cost_anomalies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cloud_account_id", sa.Integer(), sa.ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("anomaly_date", sa.Date(), nullable=False),
        sa.Column("actual_amount", sa.Float(), nullable=False),
        sa.Column("expected_amount", sa.Float(), nullable=False),
        sa.Column("spike_percentage", sa.Float(), nullable=False),
        sa.Column("severity", sa.String(length=50), server_default="HIGH", nullable=False),
        sa.Column("root_cause", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="ACTIVE", nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cloud_cost_anomalies_org", "cloud_cost_anomalies", ["organization_id"])
    op.create_index("ix_cloud_cost_anomalies_user", "cloud_cost_anomalies", ["user_id"])
    op.create_index("ix_cost_anomaly_status", "cloud_cost_anomalies", ["status"])
    op.create_index("ix_cost_anomaly_provider", "cloud_cost_anomalies", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_cost_anomaly_provider", table_name="cloud_cost_anomalies")
    op.drop_index("ix_cost_anomaly_status", table_name="cloud_cost_anomalies")
    op.drop_index("ix_cloud_cost_anomalies_user", table_name="cloud_cost_anomalies")
    op.drop_index("ix_cloud_cost_anomalies_org", table_name="cloud_cost_anomalies")
    op.drop_table("cloud_cost_anomalies")
