"""Add ai_conversations, ai_messages, and ai_root_cause_analyses tables for AI DevOps Copilot & RCA.

Revision ID: 006_ai_copilot_rca
Revises: 005_telemetry_tracing
Create Date: 2026-11-06 20:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006_ai_copilot_rca"
down_revision: Union[str, None] = "005_telemetry_tracing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ai_conversations
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), server_default="New DevOps Discussion", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])

    # 2. ai_messages
    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("context_metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])

    # 3. ai_root_cause_analyses
    op.create_table(
        "ai_root_cause_analyses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workflow_run_id", sa.Integer(), sa.ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("failure_category", sa.String(length=100), server_default="UNKNOWN", nullable=False),
        sa.Column("severity", sa.String(length=50), server_default="MEDIUM", nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("root_cause", sa.Text(), nullable=False),
        sa.Column("remediation_steps_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("suggested_fix_diff", sa.Text(), nullable=True),
        sa.Column("confidence_score", sa.Float(), server_default="0.88", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="generated", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_rca_user_id", "ai_root_cause_analyses", ["user_id"])
    op.create_index("ix_ai_rca_workflow_run_id", "ai_root_cause_analyses", ["workflow_run_id"])
    op.create_index("ix_ai_rca_repository_id", "ai_root_cause_analyses", ["repository_id"])
    op.create_index("ix_rca_failure_category", "ai_root_cause_analyses", ["failure_category"])
    op.create_index("ix_rca_severity", "ai_root_cause_analyses", ["severity"])
    op.create_index("ix_rca_status", "ai_root_cause_analyses", ["status"])


def downgrade() -> None:
    op.drop_index("ix_rca_status", table_name="ai_root_cause_analyses")
    op.drop_index("ix_rca_severity", table_name="ai_root_cause_analyses")
    op.drop_index("ix_rca_failure_category", table_name="ai_root_cause_analyses")
    op.drop_index("ix_ai_rca_repository_id", table_name="ai_root_cause_analyses")
    op.drop_index("ix_ai_rca_workflow_run_id", table_name="ai_root_cause_analyses")
    op.drop_index("ix_ai_rca_user_id", table_name="ai_root_cause_analyses")
    op.drop_table("ai_root_cause_analyses")

    op.drop_index("ix_ai_messages_conversation_id", table_name="ai_messages")
    op.drop_table("ai_messages")

    op.drop_index("ix_ai_conversations_user_id", table_name="ai_conversations")
    op.drop_table("ai_conversations")
