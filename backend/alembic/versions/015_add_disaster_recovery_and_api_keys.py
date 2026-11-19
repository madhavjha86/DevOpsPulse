"""Add Disaster Recovery Drills, Backup Snapshots, and Scoped Organization API Keys tables.

Revision ID: 015_add_dr_and_api_keys
Revises: 014_add_iac_and_catalog
Create Date: 2026-11-20 02:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "015_add_dr_and_api_keys"
down_revision: Union[str, None] = "014_add_iac_and_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. dr_drill_history
    op.create_table(
        "dr_drill_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drill_name", sa.String(length=150), nullable=False),
        sa.Column("target_system", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="PASSED", nullable=False),
        sa.Column("rpo_target_minutes", sa.Float(), server_default="15.0", nullable=False),
        sa.Column("rpo_actual_minutes", sa.Float(), server_default="4.5", nullable=False),
        sa.Column("rto_target_minutes", sa.Float(), server_default="30.0", nullable=False),
        sa.Column("rto_actual_minutes", sa.Float(), server_default="11.8", nullable=False),
        sa.Column("data_loss_bytes", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("backup_snapshot_id", sa.String(length=100), nullable=False),
        sa.Column("verification_notes", sa.Text(), nullable=False),
        sa.Column("tested_by", sa.String(length=100), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dr_drill_org", "dr_drill_history", ["organization_id"])

    # 2. dr_backups
    op.create_table(
        "dr_backups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("backup_name", sa.String(length=150), nullable=False),
        sa.Column("backup_type", sa.String(length=50), server_default="FULL_SNAPSHOT", nullable=False),
        sa.Column("target_database", sa.String(length=100), nullable=False),
        sa.Column("storage_location", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="COMPLETED", nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dr_backups_org", "dr_backups", ["organization_id"])

    # 3. organization_api_keys
    op.create_table(
        "organization_api_keys",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("hashed_key", sa.String(length=64), nullable=False),
        sa.Column("scopes", sa.String(length=255), server_default="read:telemetry,write:iac", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_ip", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_api_keys_org", "organization_api_keys", ["organization_id"])
    op.create_index("ix_api_keys_prefix", "organization_api_keys", ["key_prefix"])
    op.create_index("ix_api_keys_hashed", "organization_api_keys", ["hashed_key"])


def downgrade() -> None:
    op.drop_table("organization_api_keys")
    op.drop_table("dr_backups")
    op.drop_table("dr_drill_history")
