"""Security & Vulnerability Hub Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel


class VulnerabilityItem(BaseModel):
    """A detected software vulnerability or CVE."""

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

    id: int
    file_path: str
    secret_type: str  # AWS Key, Private Key, JWT Secret, Token
    line_number: int
    severity: str
    status: str  # resolved, open


class SecurityScorecard(BaseModel):
    """Overall security rating and posture metrics."""

    overall_score: int  # 0 to 100
    grade: str  # A, B, C, D, F
    total_vulnerabilities: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    secret_scans_passed: bool
    dependencies_audited: int
    last_scanned_at: datetime


class SecurityOverviewResponse(BaseModel):
    """Security hub summary report."""

    scorecard: SecurityScorecard
    vulnerabilities: list[VulnerabilityItem]
    secret_findings: list[SecretScanFinding]
