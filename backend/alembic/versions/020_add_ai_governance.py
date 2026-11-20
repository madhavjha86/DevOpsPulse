"""Add AI Token Ledger and User Quotas for Enterprise AI Governance and Cost Attribution.

Revision ID: 020_add_ai_governance
Revises: 019_enhance_ai_intelligence
Create Date: 2026-11-20 21:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "020_add_ai_governance"
down_revision: Union[str, None] = "019_enhance_ai_intelligence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ai_token_ledgers table
    op.create_table(
        "ai_token_ledgers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tool_name", sa.String(length=100), server_default="DevOpsPulse Copilot", nullable=False),
        sa.Column("provider", sa.String(length=50), server_default="openai", nullable=False),
        sa.Column("model_name", sa.String(length=100), server_default="gpt-4o", nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completion_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("request_latency_ms", sa.Integer(), server_default="0", nullable=True),
        sa.Column("status", sa.String(length=50), server_default="SUCCESS", nullable=False),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("client_metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_token_ledgers_organization_id", "ai_token_ledgers", ["organization_id"])
    op.create_index("ix_ai_token_ledgers_user_id", "ai_token_ledgers", ["user_id"])
    op.create_index("ix_ai_token_ledgers_tool_name", "ai_token_ledgers", ["tool_name"])
    op.create_index("ix_ai_token_ledgers_provider", "ai_token_ledgers", ["provider"])
    op.create_index("ix_ai_token_ledgers_model_name", "ai_token_ledgers", ["model_name"])
    op.create_index("ix_ai_ledger_org_user", "ai_token_ledgers", ["organization_id", "user_id"])
    op.create_index("ix_ai_ledger_org_created", "ai_token_ledgers", ["organization_id", "created_at"])
    op.create_index("ix_ai_ledger_tool_model", "ai_token_ledgers", ["tool_name", "model_name"])

    # 2. Create ai_user_quotas table
    op.create_table(
        "ai_user_quotas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("monthly_token_limit", sa.Integer(), server_default="5000000", nullable=False),
        sa.Column("monthly_cost_limit_usd", sa.Float(), server_default="50.0", nullable=False),
        sa.Column("alert_threshold_percentage", sa.Integer(), server_default="80", nullable=False),
        sa.Column("enforcement_action", sa.String(length=50), server_default="NOTIFY", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_user_quotas_organization_id", "ai_user_quotas", ["organization_id"])
    op.create_index("ix_ai_user_quotas_user_id", "ai_user_quotas", ["user_id"])
    op.create_index("ix_ai_quota_unique", "ai_user_quotas", ["organization_id", "user_id"], unique=True)


def downgrade() -> None:
    op.drop_table("ai_user_quotas")
    op.drop_table("ai_token_ledgers")
