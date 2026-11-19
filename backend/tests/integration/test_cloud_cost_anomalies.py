"""Integration tests for Cloud Cost Anomaly Detection, Spike Simulation & Webhook Alerts."""

from unittest.mock import AsyncMock, patch
import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_cloud_cost_anomalies_flow(client: AsyncClient, db_session: AsyncSession):
    """Test cost anomaly listing, spike simulation, and status update."""
    print("STEP 1: Register")
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "cost_lead@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "Cost Lead",
            "username": "cost_lead",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("STEP 2: Create Org")
    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "FinOps Cloud Org",
            "slug": "finops-cloud-org",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]
    headers["X-Organization-Id"] = str(org_id)

    print("STEP 3: Overview")
    overview_resp = await client.get("/api/v1/cloud/cost/overview", headers=headers)
    assert overview_resp.status_code == 200
    overview_data = overview_resp.json()
    assert "anomalies" in overview_data
    assert "active_anomalies_count" in overview_data

    print("STEP 4: List")
    list_resp = await client.get("/api/v1/cloud/cost/anomalies", headers=headers)
    assert list_resp.status_code == 200
    anomalies = list_resp.json()
    assert isinstance(anomalies, list)

    print("STEP 5: Simulate")
    with patch("app.services.webhook_dispatcher.WebhookDispatcher.dispatch_event", new_callable=AsyncMock) as mock_dispatch:
        mock_dispatch.return_value = 1
        sim_resp = await client.post("/api/v1/cloud/cost/anomalies/simulate", headers=headers)
        assert sim_resp.status_code in (200, 201)
        simulated = sim_resp.json()
        anomaly_id = simulated["id"]
        assert simulated["provider"] == "AWS"
        assert simulated["severity"] == "CRITICAL"
        assert simulated["status"] == "ACTIVE"
        assert simulated["spike_percentage"] > 100.0

    print("STEP 6: Acknowledge")
    ack_resp = await client.post(
        f"/api/v1/cloud/cost/anomalies/{anomaly_id}/status",
        headers=headers,
        json={"status": "ACKNOWLEDGED"},
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "ACKNOWLEDGED"

    print("STEP 7: Resolve")
    res_resp = await client.post(
        f"/api/v1/cloud/cost/anomalies/{anomaly_id}/status",
        headers=headers,
        json={"status": "RESOLVED"},
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "RESOLVED"
    assert res_resp.json()["resolved_at"] is not None

    print("STEP 8: Filter")
    resolved_list_resp = await client.get("/api/v1/cloud/cost/anomalies?status=RESOLVED", headers=headers)
    assert resolved_list_resp.status_code == 200
    assert any(a["id"] == anomaly_id for a in resolved_list_resp.json())
    print("ALL STEPS COMPLETED!")

