"""Security, DevSecOps Scanner, and Software Supply Chain (SBOM) Pydantic schemas."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

ScanType = Literal["ALL", "SAST", "SCA", "SECRETS", "CONTAINER", "IAC"]
SeverityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]
FindingStatus = Literal["OPEN", "FIXED", "FALSE_POSITIVE", "SUPPRESSED"]
SbomFormat = Literal["CYCLONEDX_1_5", "SPDX_2_3"]


class VulnerabilityItem(BaseModel):
    """A detected software vulnerability or CVE."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    cve_id: str
    title: str
    package_name: str
    current_version: str
    fixed_in: str
    severity: str  # critical, high, medium, low
    description: str
    detected_at: datetime


class SecretScanFinding(BaseModel):
    """An alert about a potentially exposed secret or credential."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    secret_type: str  # AWS Key, Private Key, JWT Secret, Token
    line_number: int
    severity: str
    status: str  # resolved, open, verified_clean


class SecurityScorecard(BaseModel):
    """Overall security rating and posture metrics."""

    overall_score: int  # 0 to 100
    grade: str  # A+, A, B, C, D, F
    total_vulnerabilities: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int = 0
    secret_scans_passed: bool
    dependencies_audited: int
    last_scanned_at: datetime


class SecurityFindingResponse(BaseModel):
    """Detailed finding from SAST, SCA, Secret, Container, or IaC audit."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_id: int
    finding_type: str  # SAST, SCA, SECRET, CONTAINER, IAC
    cve_id: str | None = None
    title: str
    severity: SeverityLevel
    package_name: str | None = None
    current_version: str | None = None
    fixed_in: str | None = None
    file_path: str
    line_number: int | None = None
    description: str
    remediation: str
    status: FindingStatus
    created_at: datetime


class SecurityFindingRemediate(BaseModel):
    """Payload to transition finding status."""

    status: FindingStatus


class SecurityScanCreate(BaseModel):
    """Payload to trigger an on-demand security scan."""

    target_name: str = Field(default="devopspulse-workspace", max_length=255)
    scan_type: ScanType = Field(default="ALL")
    repository_id: int | None = None


class SecurityScanResponse(BaseModel):
    """Summary representation of a security scan execution."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    target_name: str
    scan_type: str
    status: str
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int
    score: int
    duration_ms: int
    completed_at: datetime | None = None
    created_at: datetime
    findings: list[SecurityFindingResponse] = []


class SbomPackageResponse(BaseModel):
    """Granular software package representation in an SBOM."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str
    purl: str
    license_spdx: str
    is_copyleft: bool
    cve_count: int
    highest_severity: str | None = None
    checksum_sha256: str | None = None


class SbomDocumentResponse(BaseModel):
    """Software Bill of Materials (SBOM) metadata and inventory."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    format: str
    component_name: str
    version: str
    total_packages: int
    vulnerable_packages: int
    created_at: datetime
    packages: list[SbomPackageResponse] = []


class SbomGenerateRequest(BaseModel):
    """Payload to generate a new software supply chain SBOM."""

    component_name: str = Field(default="devopspulse", max_length=255)
    version: str = Field(default="1.1.0", max_length=100)
    format: SbomFormat = Field(default="CYCLONEDX_1_5")
    repository_id: int | None = None


class SecurityOverviewResponse(BaseModel):
    """Comprehensive DevSecOps & Supply Chain Overview."""

    scorecard: SecurityScorecard
    vulnerabilities: list[VulnerabilityItem]
    secret_findings: list[SecretScanFinding]
    recent_scans: list[SecurityScanResponse] = []
    active_findings: list[SecurityFindingResponse] = []
    latest_sbom: SbomDocumentResponse | None = None
