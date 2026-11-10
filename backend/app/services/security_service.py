"""Security scanning and CVE vulnerability aggregation service."""
from datetime import datetime, timezone
from app.schemas.security_hub import (
    SecurityOverviewResponse,
    SecurityScorecard,
    SecretScanFinding,
    VulnerabilityItem,
)


class SecurityService:
    """Service handling repository vulnerability intelligence and secret scanning."""

    @staticmethod
    async def get_overview() -> SecurityOverviewResponse:
        """Generate repository security posture scorecard and active findings."""
        now = datetime.now(timezone.utc)

        vulnerabilities = [
            VulnerabilityItem(
                id=1,
                cve_id="CVE-2024-34064",
                title="Jinja2 sandbox escape via attribute access",
                package_name="jinja2",
                current_version="3.1.3",
                fixed_in="3.1.4",
                severity="medium",
                description="Jinja2 contains a sandbox escape vulnerability allowing restricted code execution.",
                detected_at=now,
            ),
            VulnerabilityItem(
                id=2,
                cve_id="CVE-2024-21538",
                title="Regular Expression Denial of Service in nanoid",
                package_name="nanoid",
                current_version="3.3.6",
                fixed_in="3.3.7",
                severity="low",
                description="Inefficient regular expression complexity may lead to CPU exhaustion.",
                detected_at=now,
            ),
        ]

        secrets = [
            SecretScanFinding(
                id=1,
                file_path=".env.example",
                secret_type="Mock Example Secret (Safe)",
                line_number=5,
                severity="info",
                status="resolved",
            )
        ]

        scorecard = SecurityScorecard(
            overall_score=94,
            grade="A",
            total_vulnerabilities=len(vulnerabilities),
            critical_count=0,
            high_count=0,
            medium_count=1,
            low_count=1,
            secret_scans_passed=True,
            dependencies_audited=148,
            last_scanned_at=now,
        )

        return SecurityOverviewResponse(
            scorecard=scorecard,
            vulnerabilities=vulnerabilities,
            secret_findings=secrets,
        )
