"""Add DevSecOps Security Scanner and SBOM Supply Chain tables.

Revision ID: 012_add_devsecops_sbom
Revises: 011_add_cost_anomalies
Create Date: 2026-11-20 01:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "012_add_devsecops_sbom"
down_revision: Union[str, None] = "011_add_cost_anomalies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. security_scans
    op.create_table(
        "security_scans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_name", sa.String(length=255), nullable=False),
        sa.Column("scan_type", sa.String(length=50), server_default="ALL", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="COMPLETED", nullable=False),
        sa.Column("total_findings", sa.Integer(), server_default="0", nullable=False),
        sa.Column("critical_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("high_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("medium_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("low_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("info_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("score", sa.Integer(), server_default="100", nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_security_scans_org", "security_scans", ["organization_id"])
    op.create_index("ix_security_scans_user", "security_scans", ["user_id"])
    op.create_index("ix_security_scans_type", "security_scans", ["scan_type"])
    op.create_index("ix_security_scans_org_status", "security_scans", ["organization_id", "status"])

    # 2. security_findings
    op.create_table(
        "security_findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scan_id", sa.Integer(), sa.ForeignKey("security_scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("finding_type", sa.String(length=50), nullable=False),
        sa.Column("cve_id", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=50), server_default="MEDIUM", nullable=False),
        sa.Column("package_name", sa.String(length=150), nullable=True),
        sa.Column("current_version", sa.String(length=100), nullable=True),
        sa.Column("fixed_in", sa.String(length=100), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("remediation", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="OPEN", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_security_findings_scan_id", "security_findings", ["scan_id"])
    op.create_index("ix_security_findings_org", "security_findings", ["organization_id"])
    op.create_index("ix_sec_findings_severity", "security_findings", ["severity"])
    op.create_index("ix_sec_findings_type", "security_findings", ["finding_type"])
    op.create_index("ix_sec_findings_status", "security_findings", ["status"])

    # 3. sbom_documents
    op.create_table(
        "sbom_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("format", sa.String(length=50), server_default="CYCLONEDX_1_5", nullable=False),
        sa.Column("component_name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.String(length=100), server_default="1.0.0", nullable=False),
        sa.Column("total_packages", sa.Integer(), server_default="0", nullable=False),
        sa.Column("vulnerable_packages", sa.Integer(), server_default="0", nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sbom_docs_org", "sbom_documents", ["organization_id"])
    op.create_index("ix_sbom_docs_format", "sbom_documents", ["format"])

    # 4. sbom_packages
    op.create_table(
        "sbom_packages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sbom_document_id", sa.Integer(), sa.ForeignKey("sbom_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=100), nullable=False),
        sa.Column("purl", sa.String(length=255), nullable=False),
        sa.Column("license_spdx", sa.String(length=100), server_default="UNKNOWN", nullable=False),
        sa.Column("is_copyleft", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("cve_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("highest_severity", sa.String(length=50), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sbom_pkg_doc_id", "sbom_packages", ["sbom_document_id"])
    op.create_index("ix_sbom_pkg_org", "sbom_packages", ["organization_id"])
    op.create_index("ix_sbom_pkg_name", "sbom_packages", ["name"])
    op.create_index("ix_sbom_pkg_license", "sbom_packages", ["license_spdx"])


def downgrade() -> None:
    op.drop_table("sbom_packages")
    op.drop_table("sbom_documents")
    op.drop_table("security_findings")
    op.drop_table("security_scans")
