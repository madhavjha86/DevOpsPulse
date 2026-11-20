"""Enhance AI Root Cause Analysis and AI Copilot tables with real-time multi-source telemetry and evidence fields.

Revision ID: 019_enhance_ai_intelligence
Revises: 018_add_jenkins_integration
Create Date: 2026-11-20 20:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "019_enhance_ai_intelligence"
down_revision: Union[str, None] = "018_add_jenkins_integration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update ai_conversations
    op.add_column("ai_conversations", sa.Column("system_prompt", sa.Text(), nullable=True))
    op.add_column(
        "ai_conversations",
        sa.Column("context_scope", sa.String(length=100), server_default="ORGANIZATION_WIDE", nullable=False),
    )

    # 2. Update ai_messages
    op.add_column("ai_messages", sa.Column("sources_json", sa.Text(), nullable=True))
    op.add_column("ai_messages", sa.Column("tokens_used", sa.Integer(), nullable=True))
    op.add_column("ai_messages", sa.Column("model_name", sa.String(length=100), nullable=True))

    # 3. Update ai_root_cause_analyses
    op.add_column(
        "ai_root_cause_analyses",
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_ai_root_cause_analyses_incident_id", "ai_root_cause_analyses", ["incident_id"])
    op.add_column(
        "ai_root_cause_analyses",
        sa.Column("evidence_timeline_json", sa.Text(), server_default="[]", nullable=True),
    )
    op.add_column(
        "ai_root_cause_analyses",
        sa.Column("affected_services_json", sa.Text(), server_default="[]", nullable=True),
    )
    op.add_column(
        "ai_root_cause_analyses",
        sa.Column("correlated_metrics_json", sa.Text(), server_default="{}", nullable=True),
    )
    op.add_column(
        "ai_root_cause_analyses",
        sa.Column("confidence_explanation", sa.Text(), server_default="", nullable=True),
    )


def downgrade() -> None:
    # Downgrade ai_root_cause_analyses
    op.drop_column("ai_root_cause_analyses", "confidence_explanation")
    op.drop_column("ai_root_cause_analyses", "correlated_metrics_json")
    op.drop_column("ai_root_cause_analyses", "affected_services_json")
    op.drop_column("ai_root_cause_analyses", "evidence_timeline_json")
    op.drop_index("ix_ai_root_cause_analyses_incident_id", table_name="ai_root_cause_analyses")
    op.drop_column("ai_root_cause_analyses", "incident_id")

    # Downgrade ai_messages
    op.drop_column("ai_messages", "model_name")
    op.drop_column("ai_messages", "tokens_used")
    op.drop_column("ai_messages", "sources_json")

    # Downgrade ai_conversations
    op.drop_column("ai_conversations", "context_scope")
    op.drop_column("ai_conversations", "system_prompt")
