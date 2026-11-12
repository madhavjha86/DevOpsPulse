"""Integration API tests for DevOpsPulse v1.1 Four Major Features.

Covers REST endpoints:
- /api/v1/incidents
- /api/v1/cloud/cost
- /api/v1/analytics/team-productivity
- /api/v1/ai/rca/generate
"""

import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_incidents_api_endpoints(authenticated_client: tuple[AsyncClient, User]):
    """Test full incident management REST API."""
    client, user = authenticated_client

    # 1. Stats endpoint
    stats_resp = await client.get("/api/v1/incidents/stats")
    assert stats_resp.status_code == 200
    assert "total_incidents" in stats_resp.json()

    # 2. Create Incident
    create_payload = {
        "title": "Payment Service Circuit Breaker Tripped",
        "description": "Stripe webhook 504 timeouts causing downstream queue buildup",
        "severity": "HIGH",
        "priority": "P2",
        "service": "payment-service",
        "environment": "production",
        "send_email": False,
        "send_slack": False,
    }
    create_resp = await client.post("/api/v1/incidents", json=create_payload)
    assert create_resp.status_code == 201
    created_inc = create_resp.json()
    inc_id = created_inc["id"]
    assert created_inc["title"] == create_payload["title"]
    assert created_inc["status"] == "OPEN"

    # 3. List Incidents
    list_resp = await client.get("/api/v1/incidents")
    assert list_resp.status_code == 200
    assert any(i["id"] == inc_id for i in list_resp.json())

    # 4. Get Detail
    detail_resp = await client.get(f"/api/v1/incidents/{inc_id}")
    assert detail_resp.status_code == 200
    assert len(detail_resp.json()["timeline_events"]) >= 1

    # 5. Transition Status
    status_resp = await client.put(
        f"/api/v1/incidents/{inc_id}/status",
        json={"status": "INVESTIGATING", "comment": "Checking downstream gateway latency"},
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "INVESTIGATING"

    # 6. Add Comment
    comment_resp = await client.post(
        f"/api/v1/incidents/{inc_id}/comments",
        json={"message": "Identified TLS renegotiation bug in edge proxy"},
    )
    assert comment_resp.status_code == 201
    assert any(
        "TLS renegotiation bug" in ev["message"]
        for ev in comment_resp.json()["timeline_events"]
    )


@pytest.mark.asyncio
async def test_cloud_cost_api_endpoints(authenticated_client: tuple[AsyncClient, User]):
    """Test cloud cost intelligence REST API."""
    client, user = authenticated_client

    # 1. Overview
    overview_resp = await client.get("/api/v1/cloud/cost/overview")
    assert overview_resp.status_code == 200
    data = overview_resp.json()
    assert "total_monthly_spend" in data
    assert "providers" in data
    assert len(data["providers"]) == 3

    # 2. Budgets CRUD
    budget_payload = {
        "name": "Q4 Cloud Spend Guardrail",
        "provider": "AWS",
        "monthly_budget": 3500.0,
        "warning_threshold": 75.0,
        "critical_threshold": 95.0,
    }
    budget_create_resp = await client.post("/api/v1/cloud/cost/budgets", json=budget_payload)
    assert budget_create_resp.status_code == 201
    b_id = budget_create_resp.json()["id"]

    budgets_list_resp = await client.get("/api/v1/cloud/cost/budgets")
    assert budgets_list_resp.status_code == 200
    assert any(b["id"] == b_id for b in budgets_list_resp.json())

    # 3. Optimizations
    opts_resp = await client.get("/api/v1/cloud/cost/optimizations")
    assert opts_resp.status_code == 200
    opts = opts_resp.json()
    assert len(opts) >= 1

    first_id = opts[0]["id"]
    apply_resp = await client.put(f"/api/v1/cloud/cost/optimizations/{first_id}/apply")
    assert apply_resp.status_code == 200


@pytest.mark.asyncio
async def test_team_productivity_api_endpoints(authenticated_client: tuple[AsyncClient, User]):
    """Test team productivity analytics REST API."""
    client, user = authenticated_client

    # 1. Create Team
    team_payload = {
        "name": "Frontend Experience Squad",
        "description": "User interface, design systems, and client performance",
    }
    create_team_resp = await client.post(
        "/api/v1/analytics/team-productivity/teams", json=team_payload
    )
    assert create_team_resp.status_code == 201
    team_data = create_team_resp.json()
    team_id = team_data["id"]

    # 2. List Teams
    teams_resp = await client.get("/api/v1/analytics/team-productivity/teams")
    assert teams_resp.status_code == 200
    assert any(t["id"] == team_id for t in teams_resp.json())

    # 3. Overview
    overview_resp = await client.get(
        "/api/v1/analytics/team-productivity/overview", params={"team_id": team_id}
    )
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["team_name"] == "Frontend Experience Squad"
    assert "dora" in overview
    assert "pr_metrics" in overview
    assert "pr_size_distribution" in overview
    assert "ranking_disclaimer" in overview


@pytest.mark.asyncio
async def test_ai_rca_api_generate(authenticated_client: tuple[AsyncClient, User]):
    """Test AI Root Cause Analysis generation endpoint."""
    client, user = authenticated_client

    req_payload = {
        "job_name": "pytest-unit-tests",
        "log_excerpt": "FAILED tests/unit/test_auth.py::test_login - AssertionError: Expected 200 but got 401\nExit code 1",
    }
    resp = await client.post("/api/v1/ai/rca/generate", json=req_payload)
    assert resp.status_code in (200, 201)
    rca = resp.json()
    assert rca["id"] is not None
    assert rca["confidence_score"] > 0
    assert len(rca["remediation_steps"]) >= 1
