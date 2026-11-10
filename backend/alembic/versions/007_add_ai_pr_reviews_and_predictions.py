"""Add ai_pr_reviews and ai_failure_predictions tables for AI PR Reviewer & Failure Prediction.

Revision ID: 007_ai_pr_review_predictions
Revises: 006_ai_copilot_rca
Create Date: 2026-11-06 20:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007_ai_pr_review_predictions"
down_revision: Union[str, None] = "006_ai_copilot_rca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ai_pr_reviews
    op.create_table(
        "ai_pr_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pull_request_id", sa.Integer(), sa.ForeignKey("pull_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("pr_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("pr_title", sa.String(length=500), server_default="Untitled Pull Request", nullable=False),
        sa.Column("review_verdict", sa.String(length=50), server_default="COMMENT", nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("findings_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("security_score", sa.Integer(), server_default="85", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_pr_reviews_user_id", "ai_pr_reviews", ["user_id"])
    op.create_index("ix_ai_pr_reviews_pull_request_id", "ai_pr_reviews", ["pull_request_id"])
    op.create_index("ix_ai_pr_reviews_repository_id", "ai_pr_reviews", ["repository_id"])
    op.create_index("ix_pr_review_verdict", "ai_pr_reviews", ["review_verdict"])
    op.create_index("ix_pr_review_security_score", "ai_pr_reviews", ["security_score"])

    # 2. ai_failure_predictions
    op.create_table(
        "ai_failure_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("commit_sha", sa.String(length=64), nullable=False),
        sa.Column("branch", sa.String(length=255), server_default="main", nullable=False),
        sa.Column("risk_score", sa.Float(), server_default="0.25", nullable=False),
        sa.Column("risk_level", sa.String(length=50), server_default="LOW", nullable=False),
        sa.Column("risk_factors_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("recommendations_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_failure_predictions_user_id", "ai_failure_predictions", ["user_id"])
    op.create_index("ix_ai_failure_predictions_repository_id", "ai_failure_predictions", ["repository_id"])
    op.create_index("ix_pred_commit_sha", "ai_failure_predictions", ["commit_sha"])
    op.create_index("ix_pred_risk_level", "ai_failure_predictions", ["risk_level"])


def downgrade() -> None:
    op.drop_index("ix_pred_risk_level", table_name="ai_failure_predictions")
    op.drop_index("ix_pred_commit_sha", table_name="ai_failure_predictions")
    op.drop_index("ix_ai_failure_predictions_repository_id", table_name="ai_failure_predictions")
    op.drop_index("ix_ai_failure_predictions_user_id", table_name="ai_failure_predictions")
    op.drop_table("ai_failure_predictions")

    op.drop_index("ix_pr_review_security_score", table_name="ai_pr_reviews")
    op.drop_index("ix_pr_review_verdict", table_name="ai_pr_reviews")
    op.drop_index("ix_ai_pr_reviews_repository_id", table_name="ai_pr_reviews")
    op.drop_index("ix_ai_pr_reviews_pull_request_id", table_name="ai_pr_reviews")
    op.drop_index("ix_ai_pr_reviews_user_id", table_name="ai_pr_reviews")
    op.drop_table("ai_pr_reviews")
