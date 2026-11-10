"""Add telemetry_logs and telemetry_spans tables for Centralized Logs & Distributed Tracing.

Revision ID: 005_telemetry_tracing
Revises: 004_cloud_monitoring
Create Date: 2026-11-06 19:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_telemetry_tracing"
down_revision: Union[str, None] = "004_cloud_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. telemetry_logs
    op.create_table(
        "telemetry_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=True),
        sa.Column("span_id", sa.String(length=32), nullable=True),
        sa.Column("attributes_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_telemetry_logs_user_id", "telemetry_logs", ["user_id"])
    op.create_index("ix_telemetry_logs_service_name", "telemetry_logs", ["service_name"])
    op.create_index("ix_telemetry_logs_level", "telemetry_logs", ["level"])
    op.create_index("ix_telemetry_logs_timestamp", "telemetry_logs", ["timestamp"])
    op.create_index("ix_telemetry_logs_trace_id", "telemetry_logs", ["trace_id"])

    # 2. telemetry_spans
    op.create_table(
        "telemetry_spans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("span_id", sa.String(length=32), nullable=False),
        sa.Column("parent_span_id", sa.String(length=32), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("service_name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=30), server_default="SERVER", nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False),
        sa.Column("status_code", sa.String(length=20), server_default="OK", nullable=False),
        sa.Column("status_message", sa.Text(), nullable=True),
        sa.Column("attributes_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_telemetry_spans_user_id", "telemetry_spans", ["user_id"])
    op.create_index("ix_telemetry_spans_trace_id", "telemetry_spans", ["trace_id"])
    op.create_index("ix_telemetry_spans_span_id", "telemetry_spans", ["span_id"])
    op.create_index("ix_telemetry_spans_parent_span_id", "telemetry_spans", ["parent_span_id"])
    op.create_index("ix_telemetry_spans_service_name", "telemetry_spans", ["service_name"])
    op.create_index("ix_telemetry_spans_duration_ms", "telemetry_spans", ["duration_ms"])
    op.create_index("ix_telemetry_spans_status_code", "telemetry_spans", ["status_code"])


def downgrade() -> None:
    op.drop_table("telemetry_spans")
    op.drop_table("telemetry_logs")
