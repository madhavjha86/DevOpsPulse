"""Integration tests for Executive Reporting, Exporting, and Notification Delivery."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_executive_summary_report(client: AsyncClient, db_session: AsyncSession):
    # Register & get token directly
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "reports_exec@devopspulse.io",
            "username": "reports_exec",
            "password": "StrongPassword123!",
            "full_name": "Executive Officer",
        },
    )
    assert reg_res.status_code == 201, reg_res.text
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch Executive Summary
    summary_res = await client.get("/api/v1/reports/executive-summary?time_period=30d", headers=headers)
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert "security" in data
    assert "reliability" in data
    assert "finops" in data
    assert "disaster_recovery" in data
    assert "incidents" in data
    assert "cicd" in data
    assert "integrity_signature" in data
    assert len(data["integrity_signature"]) == 64

    # 2. Export CSV
    csv_res = await client.get("/api/v1/reports/export/csv?time_period=30d", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "DevOpsPulse Enterprise Executive Report" in csv_text
    assert "PILLAR: DEVSECOPS & SUPPLY CHAIN SECURITY" in csv_text
    assert "PILLAR: SRE & RELIABILITY ENGINEERING" in csv_text
    assert "PILLAR: CLOUD FINOPS & COST INTELLIGENCE" in csv_text
    assert "PILLAR: BACKUP & DISASTER RECOVERY" in csv_text

    # 3. Export PDF/HTML
    pdf_res = await client.get("/api/v1/reports/export/pdf?time_period=30d", headers=headers)
    assert pdf_res.status_code == 200
    assert "text/html" in pdf_res.headers["content-type"]
    assert "Enterprise Executive Intelligence Report" in pdf_res.text
    assert "DevOpsPulse Enterprise Intelligence Engine" in pdf_res.text

    # 4. Schedule Automated Delivery
    sched_res = await client.post(
        "/api/v1/reports/schedule",
        json={
            "frequency": "WEEKLY",
            "format": "PDF",
            "recipients": ["cto@company.com", "devops-leads@company.com"],
            "report_sections": ["security", "reliability", "finops", "dr"],
        },
        headers=headers,
    )
    assert sched_res.status_code == 201
    sched_data = sched_res.json()
    assert sched_data["frequency"] == "WEEKLY"
    assert len(sched_data["recipients"]) == 2

    # 5. Notification Delivery Test (Honest verification)
    # 5a. Invalid email
    invalid_email_res = await client.post(
        "/api/v1/reports/test-notification",
        json={"channel": "EMAIL", "target": "invalid-email-address"},
        headers=headers,
    )
    assert invalid_email_res.status_code == 200
    assert invalid_email_res.json()["delivery_status"] == "FAILED"

    # 5b. Valid email with unconfigured SMTP (returns CONFIG_MISSING, never falsely claims sent)
    valid_email_res = await client.post(
        "/api/v1/reports/test-notification",
        json={"channel": "EMAIL", "target": "audit@devopspulse.io"},
        headers=headers,
    )
    assert valid_email_res.status_code == 200
    assert valid_email_res.json()["delivery_status"] == "CONFIG_MISSING"
