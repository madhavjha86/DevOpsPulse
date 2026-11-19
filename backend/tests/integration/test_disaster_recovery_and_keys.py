"""Integration tests for Disaster Recovery (Phase 7) and Scoped API Key Governance (Phase 11)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_disaster_recovery_and_api_keys_suite(client: AsyncClient, db_session: AsyncSession):
    # 1. Register test user and workspace
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr_coordinator@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "DR Coordinator",
            "username": "dr_coordinator",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "Global Resiliency Corp",
            "slug": "global-resiliency-corp",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]
    headers["X-Organization-Id"] = str(org_id)

    # 2. Get Disaster Recovery Overview (verifies RPO, RTO, Backups, and Certified Drills)
    dr_resp = await client.get("/api/v1/disaster-recovery/overview", headers=headers)
    assert dr_resp.status_code == 200, dr_resp.text
    dr_data = dr_resp.json()

    assert dr_data["target_rpo_minutes"] == 15.0
    assert dr_data["actual_rpo_minutes"] <= 15.0
    assert dr_data["target_rto_minutes"] == 30.0
    assert dr_data["actual_rto_minutes"] <= 30.0
    assert dr_data["readiness_score"] >= 90
    assert dr_data["readiness_grade"] == "A+"
    assert dr_data["total_backups_count"] >= 2
    assert dr_data["latest_backup_completed"] is True
    assert len(dr_data["drills"]) >= 1
    assert dr_data["drills"][0]["status"] == "PASSED"

    # 3. Execute a verifiable Disaster Recovery test drill
    drill_payload = {
        "drill_name": "Multi-Region Postgres Failover Certification Drill",
        "target_system": "PostgreSQL Primary & Read Replicas",
    }
    exec_drill_resp = await client.post(
        "/api/v1/disaster-recovery/drills", json=drill_payload, headers=headers
    )
    assert exec_drill_resp.status_code == 201, exec_drill_resp.text
    drill_result = exec_drill_resp.json()
    assert drill_result["drill_name"] == "Multi-Region Postgres Failover Certification Drill"
    assert drill_result["status"] == "PASSED"
    assert drill_result["data_loss_bytes"] == 0
    assert drill_result["rpo_actual_minutes"] <= 15.0
    assert drill_result["rto_actual_minutes"] <= 30.0

    # 4. Trigger on-demand database backup snapshot
    backup_payload = {
        "backup_name": "on-demand-release-pre-flight-snapshot",
        "target_database": "devopspulse-production-db",
        "backup_type": "FULL_SNAPSHOT",
    }
    backup_resp = await client.post(
        "/api/v1/disaster-recovery/backups", json=backup_payload, headers=headers
    )
    assert backup_resp.status_code == 201, backup_resp.text
    backup_data = backup_resp.json()
    assert backup_data["backup_name"] == "on-demand-release-pre-flight-snapshot"
    assert backup_data["status"] == "COMPLETED"
    assert backup_data["size_bytes"] > 0
    assert len(backup_data["checksum_sha256"]) == 64

    # 5. List Organization API Keys
    keys_resp = await client.get("/api/v1/disaster-recovery/api-keys", headers=headers)
    assert keys_resp.status_code == 200
    keys = keys_resp.json()
    assert len(keys) >= 1
    assert "key_prefix" in keys[0]

    # 6. Generate a new Scoped Organization API Key
    create_key_payload = {
        "name": "ArgoCD GitOps Deployment Key",
        "scopes": "read:telemetry,write:iac,admin",
        "expires_in_days": 60,
    }
    create_key_resp = await client.post(
        "/api/v1/disaster-recovery/api-keys", json=create_key_payload, headers=headers
    )
    assert create_key_resp.status_code == 201, create_key_resp.text
    created_key = create_key_resp.json()
    assert created_key["name"] == "ArgoCD GitOps Deployment Key"
    assert created_key["raw_key"].startswith("dp_live_")
    key_id = created_key["id"]

    # 7. Revoke API Key
    revoke_resp = await client.delete(
        f"/api/v1/disaster-recovery/api-keys/{key_id}", headers=headers
    )
    assert revoke_resp.status_code == 200, revoke_resp.text
    assert revoke_resp.json()["is_active"] is False
