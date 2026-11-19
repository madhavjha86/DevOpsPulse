"""Integration tests for Developer Portal (Phase 6) and Terraform IaC (Phase 5)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_iac_and_developer_portal_suite(client: AsyncClient, db_session: AsyncSession):
    # 1. Register test user and workspace
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "devplatform_lead@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "DevPlatform Lead",
            "username": "devplatform_lead",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "Cloud Infra Engineering",
            "slug": "cloud-infra-engineering",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]
    headers["X-Organization-Id"] = str(org_id)

    # 2. Get Developer Portal overview (verifies service catalog & golden paths)
    portal_resp = await client.get("/api/v1/developer-portal/overview", headers=headers)
    assert portal_resp.status_code == 200, portal_resp.text
    portal_data = portal_resp.json()

    assert portal_data["total_services"] >= 4
    assert portal_data["tier_1_count"] >= 2
    assert portal_data["healthy_services_count"] >= 4
    assert portal_data["templates_count"] >= 3
    assert len(portal_data["services"]) >= 4
    assert len(portal_data["templates"]) >= 3

    # 3. Register a new microservice in Developer Portal
    service_payload = {
        "name": "search-indexing-service",
        "display_name": "Elasticsearch Query & Indexing",
        "description": "High performance search engine indexing product catalogs and customer orders.",
        "tier": "TIER_2_CORE",
        "owner_team": "Search & Discovery Squad",
        "tech_stack": "Rust 1.78, Actix-web, OpenSearch",
        "lifecycle": "PRODUCTION",
        "health_status": "HEALTHY",
        "environment": "PRODUCTION",
        "repository_url": "https://github.com/devopspulse/search-indexing-service",
        "documentation_url": "https://docs.devopspulse.io/services/search-indexing",
        "api_spec_url": "https://api.devopspulse.io/openapi/search-v1.yaml",
    }
    create_svc_resp = await client.post(
        "/api/v1/developer-portal/services", json=service_payload, headers=headers
    )
    assert create_svc_resp.status_code == 201, create_svc_resp.text
    created_svc = create_svc_resp.json()
    assert created_svc["name"] == "search-indexing-service"
    assert created_svc["owner_team"] == "Search & Discovery Squad"
    assert created_svc["tier"] == "TIER_2_CORE"

    # 4. List Terraform IaC Workspaces (Phase 5)
    ws_resp = await client.get("/api/v1/developer-portal/iac/workspaces", headers=headers)
    assert ws_resp.status_code == 200
    workspaces = ws_resp.json()
    assert len(workspaces) >= 2
    eks_ws = next((w for w in workspaces if "eks" in w["name"]), None)
    assert eks_ws is not None
    assert eks_ws["resource_count"] >= 40
    assert eks_ws["has_drift"] is False

    # 5. Register a new Terraform workspace
    create_ws_payload = {
        "name": "prod-redis-cache-cluster",
        "repository_url": "https://github.com/devopspulse/infrastructure-terraform",
        "working_directory": "terraform/modules/redis",
        "terraform_version": "1.8.2",
        "description": "ElastiCache Redis multi-AZ replication cluster.",
    }
    create_ws_resp = await client.post(
        "/api/v1/developer-portal/iac/workspaces", json=create_ws_payload, headers=headers
    )
    assert create_ws_resp.status_code == 201
    created_ws = create_ws_resp.json()
    ws_id = created_ws["id"]
    assert created_ws["name"] == "prod-redis-cache-cluster"

    # 6. Generate Terraform Plan Preview with IaC Security Scanning
    plan_resp = await client.post(
        f"/api/v1/developer-portal/iac/workspaces/{ws_id}/plan", headers=headers
    )
    assert plan_resp.status_code == 201, plan_resp.text
    plan_data = plan_resp.json()
    assert plan_data["status"] == "PLANNED"
    assert "Plan: 1 to add" in plan_data["plan_output"]
    assert plan_data["security_scan_passed"] is True
    assert plan_data["rollback_guidance"] is not None
    run_id = plan_data["id"]

    # 7. Approve and Apply Terraform Plan
    apply_payload = {
        "run_id": run_id,
        "approved_by": "Staff Platform SRE",
    }
    apply_resp = await client.post(
        "/api/v1/developer-portal/iac/runs/apply", json=apply_payload, headers=headers
    )
    assert apply_resp.status_code == 200, apply_resp.text
    apply_data = apply_resp.json()
    assert apply_data["status"] == "APPLIED"
    assert apply_data["approved_by"] == "Staff Platform SRE"

    # 8. Trigger Configuration Drift Check
    drift_resp = await client.post(
        f"/api/v1/developer-portal/iac/workspaces/{ws_id}/drift", headers=headers
    )
    assert drift_resp.status_code == 200
    drift_data = drift_resp.json()
    assert drift_data["has_drift"] is False
    assert drift_data["status"] == "HEALTHY"
