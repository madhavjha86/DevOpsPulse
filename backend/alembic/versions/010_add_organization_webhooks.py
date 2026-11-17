"""Add organization webhooks table for Slack, Teams, Discord, and outbound alerts.

Revision ID: 010_add_org_webhooks
Revises: 009_multi_tenant_orgs
Create Date: 2026-11-17 14:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "010_add_org_webhooks"
down_revision: Union[str, None] = "009_multi_tenant_orgs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization_webhooks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=20), server_default="SLACK", nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("events", sa.String(length=500), server_default="incident.created,incident.resolved,incident.critical", nullable=False),
        sa.Column("secret", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_status_code", sa.Integer(), nullable=True),
        sa.Column("last_delivery_status", sa.String(length=20), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organization_webhooks_organization_id", "organization_webhooks", ["organization_id"])
    op.create_index("ix_org_webhooks_active", "organization_webhooks", ["organization_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_org_webhooks_active", table_name="organization_webhooks")
    op.drop_index("ix_organization_webhooks_organization_id", table_name="organization_webhooks")
    op.drop_table("organization_webhooks")
