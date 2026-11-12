"""Add v1.1 tables: incidents, incident_timeline_events, cloud_budgets, cloud_cost_items, cloud_cost_optimizations, engineering_teams, team_repositories.

Revision ID: 008_v1_1_features
Revises: 007_ai_pr_review_predictions
Create Date: 2026-11-12 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008_v1_1_features"
down_revision: Union[str, None] = "007_ai_pr_review_predictions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("workflow_run_id", sa.Integer(), sa.ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("root_cause_analysis_id", sa.Integer(), sa.ForeignKey("ai_root_cause_analyses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=50), server_default="MEDIUM", nullable=False),
        sa.Column("priority", sa.String(length=10), server_default="P2", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="OPEN", nullable=False),
        sa.Column("service", sa.String(length=100), server_default="api-service", nullable=False),
        sa.Column("environment", sa.String(length=50), server_default="production", nullable=False),
        sa.Column("slack_channel", sa.String(length=100), nullable=True),
        sa.Column("slack_notification_sent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("email_notification_sent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_incidents_user_id", "incidents", ["user_id"])
    op.create_index("ix_incidents_assignee_id", "incidents", ["assignee_id"])
    op.create_index("ix_incidents_repository_id", "incidents", ["repository_id"])
    op.create_index("ix_incidents_severity", "incidents", ["severity"])
    op.create_index("ix_incidents_priority", "incidents", ["priority"])
    op.create_index("ix_incidents_status", "incidents", ["status"])
    op.create_index("ix_incidents_service", "incidents", ["service"])

    # 2. incident_timeline_events
    op.create_table(
        "incident_timeline_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("from_value", sa.String(length=100), nullable=True),
        sa.Column("to_value", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_incident_timeline_events_incident_id", "incident_timeline_events", ["incident_id"])

    # 3. cloud_budgets
    op.create_table(
        "cloud_budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cloud_account_id", sa.Integer(), sa.ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=50), server_default="ALL", nullable=False),
        sa.Column("monthly_budget", sa.Float(), nullable=False),
        sa.Column("warning_threshold", sa.Float(), server_default="80.0", nullable=False),
        sa.Column("critical_threshold", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("current_spend", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("alert_email", sa.String(length=255), nullable=True),
        sa.Column("alert_slack_channel", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_alert_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cloud_budgets_user_id", "cloud_budgets", ["user_id"])

    # 4. cloud_cost_items
    op.create_table(
        "cloud_cost_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cloud_account_id", sa.Integer(), sa.ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("cost_amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("is_simulated", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cloud_cost_items_user_id", "cloud_cost_items", ["user_id"])
    op.create_index("ix_cloud_cost_items_provider", "cloud_cost_items", ["provider"])
    op.create_index("ix_cloud_cost_items_service_name", "cloud_cost_items", ["service_name"])
    op.create_index("ix_cloud_cost_items_usage_date", "cloud_cost_items", ["usage_date"])

    # 5. cloud_cost_optimizations
    op.create_table(
        "cloud_cost_optimizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cloud_account_id", sa.Integer(), sa.ForeignKey("cloud_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=100), nullable=False),
        sa.Column("estimated_monthly_savings", sa.Float(), nullable=False),
        sa.Column("difficulty", sa.String(length=50), server_default="EASY", nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="OPEN", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cloud_cost_opt_user_id", "cloud_cost_optimizations", ["user_id"])
    op.create_index("ix_cloud_cost_opt_category", "cloud_cost_optimizations", ["category"])
    op.create_index("ix_cloud_cost_opt_status", "cloud_cost_optimizations", ["status"])

    # 6. engineering_teams
    op.create_table(
        "engineering_teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_lead_time_hours", sa.Float(), server_default="24.0", nullable=False),
        sa.Column("target_deployment_freq_per_day", sa.Float(), server_default="2.0", nullable=False),
        sa.Column("target_review_time_hours", sa.Float(), server_default="4.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_engineering_teams_user_id", "engineering_teams", ["user_id"])

    # 7. team_repositories
    op.create_table(
        "team_repositories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("engineering_teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_team_repo_unique", "team_repositories", ["team_id", "repository_id"], unique=True)


def downgrade() -> None:
    op.drop_table("team_repositories")
    op.drop_table("engineering_teams")
    op.drop_table("cloud_cost_optimizations")
    op.drop_table("cloud_cost_items")
    op.drop_table("cloud_budgets")
    op.drop_table("incident_timeline_events")
    op.drop_table("incidents")
