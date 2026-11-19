"""Add SRE Reliability Engineering, SLOs, Error Budgets, and Observability Alert Rules tables.

Revision ID: 013_add_sre_and_observability
Revises: 012_add_devsecops_sbom
Create Date: 2026-11-20 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "013_add_sre_and_observability"
down_revision: Union[str, None] = "012_add_devsecops_sbom"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sre_slos
    op.create_table(
        "sre_slos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("sli_type", sa.String(length=50), server_default="AVAILABILITY", nullable=False),
        sa.Column("target_percentage", sa.Float(), server_default="99.9", nullable=False),
        sa.Column("contractual_sla_percentage", sa.Float(), server_default="99.5", nullable=False),
        sa.Column("time_window_days", sa.Integer(), server_default="30", nullable=False),
        sa.Column("current_sli", sa.Float(), server_default="99.95", nullable=False),
        sa.Column("error_budget_percentage", sa.Float(), server_default="0.1", nullable=False),
        sa.Column("error_budget_remaining_percentage", sa.Float(), server_default="80.0", nullable=False),
        sa.Column("error_budget_burn_rate_1h", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("error_budget_burn_rate_6h", sa.Float(), server_default="0.9", nullable=False),
        sa.Column("error_budget_burn_rate_24h", sa.Float(), server_default="0.8", nullable=False),
        sa.Column("warning_threshold", sa.Float(), server_default="20.0", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="HEALTHY", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sre_slos_org", "sre_slos", ["organization_id"])
    op.create_index("ix_sre_slos_user", "sre_slos", ["user_id"])
    op.create_index("ix_sre_slos_service", "sre_slos", ["service_name"])
    op.create_index("ix_sre_slos_status", "sre_slos", ["status"])

    # 2. sre_on_call_schedules
    op.create_table(
        "sre_on_call_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("primary_engineer", sa.String(length=100), nullable=False),
        sa.Column("secondary_engineer", sa.String(length=100), nullable=False),
        sa.Column("rotation_type", sa.String(length=50), server_default="WEEKLY", nullable=False),
        sa.Column("escalation_policy", sa.String(length=255), server_default="P1: 5min Slack -> SMS -> Team Lead -> VP Eng", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("handoff_day", sa.String(length=20), server_default="Monday", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sre_oncall_org", "sre_on_call_schedules", ["organization_id"])

    # 3. observability_alert_rules
    op.create_table(
        "observability_alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("metric_type", sa.String(length=50), server_default="LATENCY_P99", nullable=False),
        sa.Column("operator", sa.String(length=10), server_default=">", nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), server_default="5", nullable=False),
        sa.Column("severity", sa.String(length=50), server_default="HIGH", nullable=False),
        sa.Column("notification_channel", sa.String(length=100), server_default="WEBHOOK", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_obs_rules_org", "observability_alert_rules", ["organization_id"])
    op.create_index("ix_obs_rules_service", "observability_alert_rules", ["service_name"])


def downgrade() -> None:
    op.drop_table("observability_alert_rules")
    op.drop_table("sre_on_call_schedules")
    op.drop_table("sre_slos")
