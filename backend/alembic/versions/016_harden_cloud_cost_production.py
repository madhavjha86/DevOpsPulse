"""Harden Cloud Cost Intelligence with dimension preservation, anomaly fingerprinting, and external ID.

Revision ID: 016_harden_cloud_cost_prod
Revises: 015_add_dr_and_api_keys
Create Date: 2026-11-20 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "016_harden_cloud_cost_prod"
down_revision: Union[str, None] = "015_add_dr_and_api_keys"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enhance cloud_cost_items with dimensions and lifecycle status
    op.add_column("cloud_cost_items", sa.Column("region", sa.String(length=50), nullable=True))
    op.add_column("cloud_cost_items", sa.Column("usage_type", sa.String(length=100), nullable=True))
    op.add_column(
        "cloud_cost_items",
        sa.Column("granularity", sa.String(length=20), server_default="DAILY", nullable=False),
    )
    op.add_column(
        "cloud_cost_items",
        sa.Column("billing_status", sa.String(length=20), server_default="FINAL", nullable=False),
    )
    op.add_column("cloud_cost_items", sa.Column("usage_quantity", sa.Float(), nullable=True))
    op.add_column("cloud_cost_items", sa.Column("usage_unit", sa.String(length=50), nullable=True))

    op.create_index(
        "ix_cloud_cost_composite_natural_key",
        "cloud_cost_items",
        [
            "organization_id",
            "cloud_account_id",
            "provider",
            "service_name",
            "region",
            "usage_type",
            "usage_date",
            "granularity",
            "currency",
        ],
        unique=False,
    )

    # 2. Enhance cloud_cost_anomalies with fingerprinting and simulation tracking
    op.add_column("cloud_cost_anomalies", sa.Column("region", sa.String(length=50), nullable=True))
    op.add_column(
        "cloud_cost_anomalies", sa.Column("anomaly_fingerprint", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "cloud_cost_anomalies",
        sa.Column("is_simulated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    # Backfill stable fingerprints for existing anomaly records
    op.execute(
        """
        UPDATE cloud_cost_anomalies
        SET anomaly_fingerprint = md5(id::text || '_' || provider || '_' || service_name || '_' || anomaly_date::text)
        WHERE anomaly_fingerprint IS NULL
        """
    )

    op.create_index(
        "ix_cloud_cost_anomalies_fingerprint",
        "cloud_cost_anomalies",
        ["anomaly_fingerprint"],
        unique=True,
    )

    # 3. Enhance cloud_accounts with tenant-isolated external_id
    op.add_column("cloud_accounts", sa.Column("external_id", sa.String(length=100), nullable=True))
    op.create_index("ix_cloud_accounts_external_id", "cloud_accounts", ["external_id"], unique=False)


def downgrade() -> None:
    # 3. Revert cloud_accounts
    op.drop_index("ix_cloud_accounts_external_id", table_name="cloud_accounts")
    op.drop_column("cloud_accounts", "external_id")

    # 2. Revert cloud_cost_anomalies
    op.drop_index("ix_cloud_cost_anomalies_fingerprint", table_name="cloud_cost_anomalies")
    op.drop_column("cloud_cost_anomalies", "is_simulated")
    op.drop_column("cloud_cost_anomalies", "anomaly_fingerprint")
    op.drop_column("cloud_cost_anomalies", "region")

    # 1. Revert cloud_cost_items
    op.drop_index("ix_cloud_cost_composite_natural_key", table_name="cloud_cost_items")
    op.drop_column("cloud_cost_items", "usage_unit")
    op.drop_column("cloud_cost_items", "usage_quantity")
    op.drop_column("cloud_cost_items", "billing_status")
    op.drop_column("cloud_cost_items", "granularity")
    op.drop_column("cloud_cost_items", "usage_type")
    op.drop_column("cloud_cost_items", "region")
