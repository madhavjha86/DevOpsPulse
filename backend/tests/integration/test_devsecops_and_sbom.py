"""Integration tests for Phase 1 (DevSecOps Scanner) & Phase 2 (Supply Chain / SBOM)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_devsecops_scanner_and_sbom_flow(client: AsyncClient, db_session: AsyncSession):
    """Test full security scan lifecycle, findings remediation, and CycloneDX/SPDX SBOM generation."""
    # 1. Register test user and create workspace
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "secops_lead@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "SecOps Lead",
            "username": "secops_lead",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "SecOps Testing Corp",
            "slug": "secops-testing-corp",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]
    headers["X-Organization-Id"] = str(org_id)

    # 2. Get Security Overview
    overview_resp = await client.get("/api/v1/security/overview", headers=headers)
    assert overview_resp.status_code == 200
    ov_data = overview_resp.json()
    assert "scorecard" in ov_data
    assert "recent_scans" in ov_data
    assert "active_findings" in ov_data
    assert "latest_sbom" in ov_data

    # 3. Trigger on-demand Multi-Vector DevSecOps scan
    scan_payload = {
        "target_name": "devopspulse-core-app",
        "scan_type": "ALL",
    }
    scan_resp = await client.post("/api/v1/security/scans", headers=headers, json=scan_payload)
    assert scan_resp.status_code == 201
    scan_data = scan_resp.json()
    scan_id = scan_data["id"]
    assert scan_data["status"] == "COMPLETED"
    assert scan_data["total_findings"] > 0
    assert len(scan_data["findings"]) > 0

    # 4. List scans
    scans_list_resp = await client.get("/api/v1/security/scans", headers=headers)
    assert scans_list_resp.status_code == 200
    assert any(s["id"] == scan_id for s in scans_list_resp.json())

    # 5. Get scan by ID
    scan_detail_resp = await client.get(f"/api/v1/security/scans/{scan_id}", headers=headers)
    assert scan_detail_resp.status_code == 200
    assert scan_detail_resp.json()["id"] == scan_id

    # 6. List and filter findings
    findings_resp = await client.get("/api/v1/security/findings?status=OPEN", headers=headers)
    assert findings_resp.status_code == 200
    findings = findings_resp.json()
    assert len(findings) >= 1
    first_finding_id = findings[0]["id"]

    # 7. Remediate finding (mark as FIXED)
    remediate_resp = await client.patch(
        f"/api/v1/security/findings/{first_finding_id}/remediate",
        headers=headers,
        json={"status": "FIXED"},
    )
    assert remediate_resp.status_code == 200
    assert remediate_resp.json()["status"] == "FIXED"

    # 8. Generate CycloneDX 1.5 SBOM
    cyclonedx_payload = {
        "component_name": "devopspulse-service",
        "version": "1.1.0",
        "format": "CYCLONEDX_1_5",
    }
    cyclonedx_resp = await client.post("/api/v1/security/sbom/generate", headers=headers, json=cyclonedx_payload)
    assert cyclonedx_resp.status_code == 201
    cdx_data = cyclonedx_resp.json()
    sbom_id = cdx_data["id"]
    assert cdx_data["format"] == "CYCLONEDX_1_5"
    assert cdx_data["total_packages"] > 0
    assert len(cdx_data["packages"]) > 0

    # 9. Generate SPDX 2.3 SBOM
    spdx_payload = {
        "component_name": "devopspulse-service",
        "version": "1.1.0",
        "format": "SPDX_2_3",
    }
    spdx_resp = await client.post("/api/v1/security/sbom/generate", headers=headers, json=spdx_payload)
    assert spdx_resp.status_code == 201
    assert spdx_resp.json()["format"] == "SPDX_2_3"

    # 10. List SBOMs
    sboms_list_resp = await client.get("/api/v1/security/sbom", headers=headers)
    assert sboms_list_resp.status_code == 200
    assert len(sboms_list_resp.json()) >= 2

    # 11. Get SBOM details & package inventory
    sbom_detail_resp = await client.get(f"/api/v1/security/sbom/{sbom_id}", headers=headers)
    assert sbom_detail_resp.status_code == 200
    assert sbom_detail_resp.json()["id"] == sbom_id
    packages = sbom_detail_resp.json()["packages"]
    assert any(p["name"] == "fastapi" for p in packages)
    assert any(p["is_copyleft"] for p in packages)

    # 12. Export raw SBOM specification
    export_resp = await client.get(f"/api/v1/security/sbom/{sbom_id}/export", headers=headers)
    assert export_resp.status_code == 200
    raw_export = export_resp.json()
    assert "bomFormat" in raw_export or "spdxVersion" in raw_export
