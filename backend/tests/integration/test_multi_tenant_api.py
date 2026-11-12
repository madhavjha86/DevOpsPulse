"""Integration tests for Multi-Tenant SaaS Workspace Architecture.

Validates:
1. Personal workspace auto-provisioning
2. Company workspace creation
3. Cross-tenant isolation and 403 Forbidden rejection
4. Member invitations and RBAC role assignment
5. Multi-role permission boundaries (Admin vs Developer)
6. Scoped data partition isolation between workspaces
"""

import pytest
from httpx import AsyncClient

from app.models.organization import OrganizationRole
from app.models.user import User


@pytest.mark.asyncio
async def test_multi_tenant_workspace_lifecycle(
    authenticated_client: tuple[AsyncClient, User]
):
    """End-to-end multi-tenant lifecycle: personal workspace, company creation, isolation, invites, and RBAC."""
    client, alice = authenticated_client
    alice_token = client.headers["Authorization"].replace("Bearer ", "")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    # 1. Check Alice's Personal Workspace
    alice_orgs_res = await client.get("/api/v1/organizations", headers=alice_headers)
    assert alice_orgs_res.status_code == 200
    alice_orgs = alice_orgs_res.json()
    assert len(alice_orgs) >= 1
    alice_personal_org = next(o for o in alice_orgs if o["type"] == "PERSONAL")
    assert alice_personal_org["role"] == OrganizationRole.ORGANIZATION_ADMIN.value

    # 2. Register Bob (second user)
    bob_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "bob@cyberdyne.com",
            "username": "bob_cyberdyne",
            "password": "Password123!",
            "full_name": "Bob Developer",
        },
    )
    assert bob_reg.status_code == 201
    bob_token = bob_reg.json()["access_token"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # Verify Bob has his own distinct personal workspace
    bob_orgs_res = await client.get("/api/v1/organizations", headers=bob_headers)
    assert bob_orgs_res.status_code == 200
    bob_orgs = bob_orgs_res.json()
    bob_personal_org = next(o for o in bob_orgs if o["type"] == "PERSONAL")
    assert bob_personal_org["id"] != alice_personal_org["id"]

    # 3. Alice creates Company Workspace "Acme Corp"
    acme_res = await client.post(
        "/api/v1/organizations",
        headers=alice_headers,
        json={"name": "Acme Corp", "type": "COMPANY"},
    )
    assert acme_res.status_code == 201
    acme_org = acme_res.json()
    acme_org_id = acme_org["id"]
    assert acme_org["name"] == "Acme Corp"
    assert acme_org["type"] == "COMPANY"

    # Alice header scoped to Acme Corp
    alice_acme_headers = {
        "Authorization": f"Bearer {alice_token}",
        "X-Organization-Id": str(acme_org_id),
    }

    # 4. CROSS-TENANT ACCESS DENIAL (Bob tries to access Acme Corp without membership)
    bob_cross_headers = {
        "Authorization": f"Bearer {bob_token}",
        "X-Organization-Id": str(acme_org_id),
    }
    # Attempt 1: Query incidents with Acme tenant ID
    cross_inc_res = await client.get("/api/v1/incidents", headers=bob_cross_headers)
    assert cross_inc_res.status_code == 403
    assert "Cross-tenant access denied" in cross_inc_res.json().get("detail", "")

    # Attempt 2: Query Acme members
    cross_mem_res = await client.get(
        f"/api/v1/organizations/{acme_org_id}/members", headers=bob_cross_headers
    )
    assert cross_mem_res.status_code == 403

    # 5. Alice creates an Incident in Acme Corp
    inc_payload = {
        "title": "Database Read Replica Latency Spike",
        "description": "High replication lag on US-East-1 reader",
        "severity": "HIGH",
        "priority": "P2",
        "service": "postgres-cluster",
        "environment": "production",
        "send_email": False,
        "send_slack": False,
    }
    create_inc_res = await client.post(
        "/api/v1/incidents", headers=alice_acme_headers, json=inc_payload
    )
    assert create_inc_res.status_code == 201
    created_incident = create_inc_res.json()
    assert created_incident["title"] == inc_payload["title"]

    # 6. WORKSPACE DATA ISOLATION (Alice switches back to Personal Workspace)
    alice_personal_headers = {
        "Authorization": f"Bearer {alice_token}",
        "X-Organization-Id": str(alice_personal_org["id"]),
    }
    personal_inc_res = await client.get("/api/v1/incidents", headers=alice_personal_headers)
    assert personal_inc_res.status_code == 200
    # The Acme incident MUST NOT exist in Alice's personal workspace
    assert not any(i["id"] == created_incident["id"] for i in personal_inc_res.json())

    # 7. Alice invites Bob to Acme Corp as DEVELOPER
    invite_res = await client.post(
        f"/api/v1/organizations/{acme_org_id}/invitations",
        headers=alice_acme_headers,
        json={"email": "bob@cyberdyne.com", "role": "DEVELOPER"},
    )
    assert invite_res.status_code == 201
    invite_data = invite_res.json()
    invite_token = invite_data["token"]
    assert invite_data["email"] == "bob@cyberdyne.com"
    assert invite_data["role"] == "DEVELOPER"

    # 8. Bob accepts the invitation
    accept_res = await client.post(
        f"/api/v1/organizations/invitations/{invite_token}/accept",
        headers=bob_headers,
    )
    assert accept_res.status_code == 200

    # 9. Bob can now access Acme Corp with his DEVELOPER role
    bob_acme_headers = {
        "Authorization": f"Bearer {bob_token}",
        "X-Organization-Id": str(acme_org_id),
    }
    bob_view_inc_res = await client.get("/api/v1/incidents", headers=bob_acme_headers)
    assert bob_view_inc_res.status_code == 200
    assert any(i["id"] == created_incident["id"] for i in bob_view_inc_res.json())

    # 10. RBAC RESTRICTION (Bob as DEVELOPER cannot invite members or alter roles)
    bob_unauthorized_invite = await client.post(
        f"/api/v1/organizations/{acme_org_id}/invitations",
        headers=bob_acme_headers,
        json={"email": "charlie@acme.com", "role": "VIEWER"},
    )
    assert bob_unauthorized_invite.status_code == 403
    detail_msg = bob_unauthorized_invite.json().get("detail", "").lower()
    assert "admin" in detail_msg
