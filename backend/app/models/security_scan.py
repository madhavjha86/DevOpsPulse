"""DevSecOps Security Scanner and Software Supply Chain (SBOM) ORM Models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.repository import Repository
    from app.models.user import User


class SecurityScan(Base, TimestampMixin):
    """Execution record for an automated or on-demand security scan."""

    __tablename__ = "security_scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_name: Mapped[str] = mapped_column(String(255), nullable=False)
    scan_type: Mapped[str] = mapped_column(
        String(50), default="ALL", nullable=False
    )  # ALL, SAST, SCA, SECRETS, CONTAINER, IAC
    status: Mapped[str] = mapped_column(
        String(50), default="COMPLETED", nullable=False
    )  # QUEUED, RUNNING, COMPLETED, FAILED
    total_findings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    critical_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    high_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    medium_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    info_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    organization: Mapped["Organization | None"] = relationship("Organization")
    repository: Mapped["Repository | None"] = relationship("Repository")
    findings: Mapped[list["SecurityFinding"]] = relationship(
        "SecurityFinding", back_populates="scan", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_security_scans_org_status", "organization_id", "status"),
        Index("ix_security_scans_type", "scan_type"),
    )


class SecurityFinding(Base, TimestampMixin):
    """Individual security finding, CVE vulnerability, leaked secret, or configuration defect."""

    __tablename__ = "security_findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("security_scans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    finding_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # SAST, SCA, SECRET, CONTAINER, IAC
    cve_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50), default="MEDIUM", nullable=False, index=True
    )  # CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    package_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    current_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fixed_in: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    remediation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="OPEN", nullable=False, index=True
    )  # OPEN, FIXED, FALSE_POSITIVE, SUPPRESSED

    # Relationships
    scan: Mapped["SecurityScan"] = relationship("SecurityScan", back_populates="findings")
    organization: Mapped["Organization | None"] = relationship("Organization")

    __table_args__ = (
        Index("ix_sec_findings_severity", "severity"),
        Index("ix_sec_findings_type", "finding_type"),
        Index("ix_sec_findings_status", "status"),
    )


class SbomDocument(Base, TimestampMixin):
    """Software Bill of Materials (SBOM) document in CycloneDX or SPDX standard format."""

    __tablename__ = "sbom_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    format: Mapped[str] = mapped_column(
        String(50), default="CYCLONEDX_1_5", nullable=False
    )  # CYCLONEDX_1_5, SPDX_2_3
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(100), default="1.0.0", nullable=False)
    total_packages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vulnerable_packages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
    organization: Mapped["Organization | None"] = relationship("Organization")
    repository: Mapped["Repository | None"] = relationship("Repository")
    packages: Mapped[list["SbomPackage"]] = relationship(
        "SbomPackage", back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_sbom_docs_org", "organization_id"),
        Index("ix_sbom_docs_format", "format"),
    )


class SbomPackage(Base, TimestampMixin):
    """Granular software package inventory item extracted from SBOM analysis."""

    __tablename__ = "sbom_packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    sbom_document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sbom_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(100), nullable=False)
    purl: Mapped[str] = mapped_column(String(255), nullable=False)  # Package URL
    license_spdx: Mapped[str] = mapped_column(String(100), default="UNKNOWN", nullable=False)
    is_copyleft: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cve_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    highest_severity: Mapped[str | None] = mapped_column(String(50), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Relationships
    document: Mapped["SbomDocument"] = relationship("SbomDocument", back_populates="packages")
    organization: Mapped["Organization | None"] = relationship("Organization")

    __table_args__ = (
        Index("ix_sbom_pkg_name", "name"),
        Index("ix_sbom_pkg_license", "license_spdx"),
    )
