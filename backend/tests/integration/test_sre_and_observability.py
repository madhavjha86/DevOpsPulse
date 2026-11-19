"""Integration tests for SRE Reliability Engineering and Advanced Observability (Phase 3 & Phase 4)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_sre_reliability_and_observability_suite(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup authenticated user and organization
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "sre_director@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "SRE Director",
            "username": "sre_director",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "Reliability Platform Corp",
            "slug": "reliability-platform-corp",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]
    headers["X-Organization-Id"] = str(org_id)

    # 2. Get SRE overview (verifies default seeding, MTTD, MTTR, and SLO targets)
    overview_resp = await client.get("/api/v1/sre/overview", headers=headers)
    assert overview_resp.status_code == 200, overview_resp.text
    overview = overview_resp.json()

    assert "overall_uptime_percentage" in overview
    assert overview["overall_uptime_percentage"] > 90.0
    assert "mttd_minutes" in overview
    assert "mttr_minutes" in overview
    assert overview["active_slos_count"] >= 3
    assert overview["active_on_call"] is not None
    assert overview["active_on_call"]["primary_engineer"] != ""
    assert len(overview["slos"]) >= 3

    # 3. List SLOs and verify explicit separation of internal target vs contractual SLA
    slos_resp = await client.get("/api/v1/sre/slos", headers=headers)
    assert slos_resp.status_code == 200
    slos = slos_resp.json()
    api_gateway_slo = next((s for s in slos if s["service_name"] == "api-gateway"), None)
    assert api_gateway_slo is not None
    # Internal target 99.9% vs Customer contractual SLA 99.5%
    assert api_gateway_slo["target_percentage"] == 99.9
    assert api_gateway_slo["contractual_sla_percentage"] == 99.5
    assert api_gateway_slo["error_budget_percentage"] == 0.1
    assert "error_budget_remaining_percentage" in api_gateway_slo
    assert "error_budget_burn_rate_1h" in api_gateway_slo

    # 4. Create a new custom SLO
    create_slo_payload = {
        "name": "Checkout Order Pipeline SLO",
        "service_name": "order-service",
        "sli_type": "AVAILABILITY",
        "target_percentage": 99.95,
        "contractual_sla_percentage": 99.5,
        "time_window_days": 30,
        "warning_threshold": 25.0,
        "description": "Critical checkout path availability target.",
    }
    create_slo_resp = await client.post("/api/v1/sre/slos", json=create_slo_payload, headers=headers)
    assert create_slo_resp.status_code == 201, create_slo_resp.text
    created_slo = create_slo_resp.json()
    assert created_slo["name"] == "Checkout Order Pipeline SLO"
    assert created_slo["target_percentage"] == 99.95
    assert created_slo["contractual_sla_percentage"] == 99.5
    assert created_slo["status"] == "HEALTHY"
    slo_id = created_slo["id"]

    # 5. Simulate an error surge and verify error budget consumption & status transition
    burn_payload = {
        "burn_rate_multiplier": 8.5,
        "reduce_budget_percent": 70.0,
    }
    burn_resp = await client.post(
        f"/api/v1/sre/slos/{slo_id}/simulate-burn", json=burn_payload, headers=headers
    )
    assert burn_resp.status_code == 200, burn_resp.text
    burned_slo = burn_resp.json()
    assert burned_slo["error_budget_burn_rate_1h"] >= 8.0
    assert burned_slo["error_budget_remaining_percentage"] <= 20.0
    assert burned_slo["status"] in ["WARNING", "BREACHED"]

    # 6. Verify On-Call Schedules & Escalation Policies
    oncall_resp = await client.get("/api/v1/sre/on-call", headers=headers)
    assert oncall_resp.status_code == 200
    oncall_list = oncall_resp.json()
    assert len(oncall_list) >= 1
    assert oncall_list[0]["escalation_policy"] != ""

    create_oncall_payload = {
        "name": "Secondary Database DBA On-Call",
        "primary_engineer": "Sarah Chen (Staff DBA)",
        "secondary_engineer": "Mark Davis (Senior DBA)",
        "rotation_type": "BIWEEKLY",
        "escalation_policy": "P1: 10min PagerDuty -> SMS Lead -> Director",
        "handoff_day": "Wednesday",
    }
    create_oncall_resp = await client.post(
        "/api/v1/sre/on-call", json=create_oncall_payload, headers=headers
    )
    assert create_oncall_resp.status_code == 201
    assert create_oncall_resp.json()["primary_engineer"] == "Sarah Chen (Staff DBA)"

    # 7. Verify Custom Observability Alert Rules & Toggle
    alerts_resp = await client.get("/api/v1/sre/alerts", headers=headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) >= 2

    create_alert_payload = {
        "name": "Order Service Latency Spikes (p95 > 200ms)",
        "service_name": "order-service",
        "metric_type": "LATENCY_P95",
        "operator": ">",
        "threshold_value": 200.0,
        "duration_minutes": 5,
        "severity": "HIGH",
        "notification_channel": "WEBHOOK",
    }
    create_alert_resp = await client.post(
        "/api/v1/sre/alerts", json=create_alert_payload, headers=headers
    )
    assert create_alert_resp.status_code == 201
    created_rule = create_alert_resp.json()
    rule_id = created_rule["id"]
    assert created_rule["is_active"] is True

    toggle_resp = await client.patch(f"/api/v1/sre/alerts/{rule_id}/toggle", headers=headers)
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # 8. Verify Distributed Microservice Dependency Topology Map (Phase 3)
    topo_resp = await client.get("/api/v1/sre/topology", headers=headers)
    assert topo_resp.status_code == 200
    topology = topo_resp.json()
    assert len(topology["nodes"]) >= 5
    assert len(topology["edges"]) >= 5

    node_types = {n["type"] for n in topology["nodes"]}
    assert "gateway" in node_types
    assert "service" in node_types
    assert "database" in node_types
    assert "cache" in node_types

    # 9. Verify APM Latency Percentiles (p50, p95, p99) and Throughput (Phase 3)
    apm_resp = await client.get("/api/v1/sre/apm?hours=24", headers=headers)
    assert apm_resp.status_code == 200
    apm = apm_resp.json()
    assert apm["total_spans"] > 0
    assert apm["system_p95_ms"] > 0
    assert len(apm["services"]) >= 4

    gateway_apm = next((s for s in apm["services"] if s["service_name"] == "api-gateway"), None)
    assert gateway_apm is not None
    assert gateway_apm["p50_latency_ms"] <= gateway_apm["p95_latency_ms"] <= gateway_apm["p99_latency_ms"]
    assert gateway_apm["request_count"] > 0
