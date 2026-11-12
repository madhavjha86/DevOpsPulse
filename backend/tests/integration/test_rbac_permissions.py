"""Integration tests for all 6 DevOpsPulse Roles and Tenant Boundary Enforcement.

Tests:
1. SUPER_ADMIN: platform-wide access and superuser overrides.
2. ORGANIZATION_ADMIN: workspace management, member invites, role updates; prevented from granting SUPER_ADMIN.
3. DEVOPS_ENGINEER: pipelines, docker hosts, k8s clusters; forbidden from member management and cloud billing.
4. DEVELOPER: repositories, commits, PRs; forbidden from infrastructure mutations and member management.
5. SECURITY_ENGINEER: security hub scans and audits; forbidden from pipelines and infrastructure mutations.
6. VIEWER: read-only access across all modules; all mutations (POST, PUT, DELETE) blocked with 403.
7. Cross-tenant isolation: strict 403 Forbidden on foreign workspace IDs.
8. Privilege escalation prevention: self-promotion and unauthorized role elevation rejected.
"""

import pytest
from httpx import AsyncClient

from app.models.organization import (
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationType,
)
from app.models.user import User


@pytest.fixture
async def rbac_test_setup(db_session):
    """Set up 6 role-based users, a primary company org, and an isolated second company org."""
    from app.core.security import hash_password

    # 1. Create 6 Users
    users_data = [
        {"email": "admin@devopspulse.com", "username": "admin", "full_name": "System Admin", "role": "admin", "is_superuser": True},
        {"email": "orgadmin@devopspulse.local", "username": "orgadmin", "full_name": "Org Admin", "role": "admin", "is_superuser": False},
        {"email": "devops@devopspulse.local", "username": "devops", "full_name": "DevOps Engineer", "role": "user", "is_superuser": False},
        {"email": "developer@company.com", "username": "developer", "full_name": "Developer Alex", "role": "user", "is_superuser": False},
        {"email": "security@devopspulse.local", "username": "security", "full_name": "Security Engineer", "role": "user", "is_superuser": False},
        {"email": "viewer@devopspulse.local", "username": "viewer", "full_name": "Viewer User", "role": "viewer", "is_superuser": False},
    ]

    users = {}
    for u in users_data:
        user = User(
            email=u["email"],
            username=u["username"],
            full_name=u["full_name"],
            role=u["role"],
            is_superuser=u["is_superuser"],
            is_active=True,
            hashed_password=hash_password("Password123!"),
        )
        db_session.add(user)
        await db_session.flush()
        users[u["email"]] = user

    # 2. Create Shared Company Workspace: "DevOpsPulse Test Organization"
    company_org = Organization(
        name="DevOpsPulse Test Organization",
        slug="devopspulse-test-org",
        type=OrganizationType.COMPANY.value,
        owner_id=users["orgadmin@devopspulse.local"].id,
        description="Shared company workspace",
        is_active=True,
    )
    db_session.add(company_org)
    await db_session.flush()

    # 3. Create Isolated Company Workspace: "Acme Global Corp"
    acme_org = Organization(
        name="Acme Global Corp",
        slug="acme-global-corp",
        type=OrganizationType.COMPANY.value,
        owner_id=users["admin@devopspulse.com"].id,
        description="Isolated second tenant",
        is_active=True,
    )
    db_session.add(acme_org)
    await db_session.flush()

    # 4. Enroll all 6 users in the shared company workspace with respective roles
    role_mapping = [
        ("admin@devopspulse.com", OrganizationRole.SUPER_ADMIN.value),
        ("orgadmin@devopspulse.local", OrganizationRole.ORGANIZATION_ADMIN.value),
        ("devops@devopspulse.local", OrganizationRole.DEVOPS_ENGINEER.value),
        ("developer@company.com", OrganizationRole.DEVELOPER.value),
        ("security@devopspulse.local", OrganizationRole.SECURITY_ENGINEER.value),
        ("viewer@devopspulse.local", OrganizationRole.VIEWER.value),
    ]

    for email, role_name in role_mapping:
        mem = OrganizationMember(
            organization_id=company_org.id,
            user_id=users[email].id,
            role=role_name,
        )
        db_session.add(mem)

    # 5. Enroll ONLY Super Admin in Acme Corp
    acme_mem = OrganizationMember(
        organization_id=acme_org.id,
        user_id=users["admin@devopspulse.com"].id,
        role=OrganizationRole.ORGANIZATION_ADMIN.value,
    )
    db_session.add(acme_mem)
    await db_session.commit()

    return {
        "users": users,
        "company_org": company_org,
        "acme_org": acme_org,
    }


async def login_and_get_headers(client: AsyncClient, email: str, org_id: int) -> dict[str, str]:
    """Helper to authenticate and return authorization headers with X-Organization-Id."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
    token = login_res.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-Id": str(org_id),
    }


@pytest.mark.asyncio
async def test_all_six_roles_login(client: AsyncClient, rbac_test_setup):
    """Verify that all six role-based accounts can successfully log in and obtain tokens."""
    for email in [
        "admin@devopspulse.com",
        "orgadmin@devopspulse.local",
        "devops@devopspulse.local",
        "developer@company.com",
        "security@devopspulse.local",
        "viewer@devopspulse.local",
    ]:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["token_type"].lower() == "bearer"
        assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_super_admin_permissions(client: AsyncClient, rbac_test_setup):
    """SUPER_ADMIN has unrestricted platform access and cross-tenant override."""
    company_id = rbac_test_setup["company_org"].id
    acme_id = rbac_test_setup["acme_org"].id
    headers = await login_and_get_headers(client, "admin@devopspulse.com", company_id)

    # 1. Read company org data
    org_res = await client.get(f"/api/v1/organizations/{company_id}", headers=headers)
    assert org_res.status_code == 200

    # 2. Access isolated Acme org
    acme_headers = {"Authorization": headers["Authorization"], "X-Organization-Id": str(acme_id)}
    acme_res = await client.get(f"/api/v1/organizations/{acme_id}", headers=acme_headers)
    assert acme_res.status_code == 200

    # 3. Super Admin can assign any role including SUPER_ADMIN
    target_user_id = rbac_test_setup["users"]["developer@company.com"].id
    role_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "SUPER_ADMIN"},
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "SUPER_ADMIN"


@pytest.mark.asyncio
async def test_organization_admin_permissions(client: AsyncClient, rbac_test_setup):
    """ORGANIZATION_ADMIN can manage members and integrations in their org, but not grant SUPER_ADMIN."""
    company_id = rbac_test_setup["company_org"].id
    acme_id = rbac_test_setup["acme_org"].id
    headers = await login_and_get_headers(client, "orgadmin@devopspulse.local", company_id)

    # 1. Permitted: List and manage members
    members_res = await client.get(f"/api/v1/organizations/{company_id}/members", headers=headers)
    assert members_res.status_code == 200
    assert len(members_res.json()) >= 6

    # 2. Permitted: Update a member role to DEVOPS_ENGINEER
    target_user_id = rbac_test_setup["users"]["developer@company.com"].id
    role_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "DEVOPS_ENGINEER"},
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "DEVOPS_ENGINEER"

    # 3. Permitted: Create cloud accounts in company workspace
    cloud_res = await client.post(
        "/api/v1/infrastructure/cloud/accounts",
        headers=headers,
        json={
            "provider": "AWS",
            "account_name": "Prod AWS",
            "account_id": "111222333444",
            "region": "us-east-1",
            "credentials": {"access_key_id": "AKIAIOSFODNN7EXAMPLE", "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"},
        },
    )
    assert cloud_res.status_code == 201

    # 4. Forbidden: Privilege Escalation — Org Admin cannot grant SUPER_ADMIN
    esc_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "SUPER_ADMIN"},
    )
    assert esc_res.status_code == 403

    # 5. Forbidden: Cross-tenant access to Acme Corp
    cross_headers = {"Authorization": headers["Authorization"], "X-Organization-Id": str(acme_id)}
    cross_res = await client.get(f"/api/v1/organizations/{acme_id}", headers=cross_headers)
    assert cross_res.status_code == 403


@pytest.mark.asyncio
async def test_devops_engineer_permissions(client: AsyncClient, rbac_test_setup):
    """DEVOPS_ENGINEER can manage infrastructure and workflows, but cannot manage members or billing."""
    company_id = rbac_test_setup["company_org"].id
    headers = await login_and_get_headers(client, "devops@devopspulse.local", company_id)

    # 1. Permitted: Create Docker host
    docker_res = await client.post(
        "/api/v1/infrastructure/docker/hosts",
        headers=headers,
        json={"name": "Worker Node 1", "host_url": "tcp://10.0.0.1:2375", "tls_verify": False},
    )
    assert docker_res.status_code == 201

    # 2. Permitted: Create Kubernetes cluster
    k8s_res = await client.post(
        "/api/v1/infrastructure/k8s/clusters",
        headers=headers,
        json={"name": "K8s Staging", "api_server_url": "https://10.0.0.2:6443", "auth_type": "token", "tls_verify": False},
    )
    assert k8s_res.status_code == 201

    # 3. Permitted: Dispatch CI/CD workflow
    dispatch_res = await client.post(
        "/api/v1/workflows/dispatch",
        headers=headers,
        json={"repository_id": 1, "workflow_name": "deploy.yml", "branch": "main"},
    )
    assert dispatch_res.status_code in (201, 200)

    # 4. Forbidden: Member management (updating role)
    target_user_id = rbac_test_setup["users"]["developer@company.com"].id
    role_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "DEVELOPER"},
    )
    assert role_res.status_code == 403

    # 5. Forbidden: Member invitation
    invite_res = await client.post(
        f"/api/v1/organizations/{company_id}/invitations",
        headers=headers,
        json={"email": "newbie@devopspulse.local", "role": "DEVELOPER"},
    )
    assert invite_res.status_code == 403

    # 6. Forbidden: Cloud account credentials management
    cloud_res = await client.post(
        "/api/v1/infrastructure/cloud/accounts",
        headers=headers,
        json={"provider": "AWS", "account_name": "DevOps AWS", "account_id": "999888777", "region": "us-east-1"},
    )
    assert cloud_res.status_code == 403


@pytest.mark.asyncio
async def test_developer_permissions(client: AsyncClient, rbac_test_setup):
    """DEVELOPER can manage repositories and view incidents, but cannot manage infrastructure or members."""
    company_id = rbac_test_setup["company_org"].id
    headers = await login_and_get_headers(client, "developer@company.com", company_id)

    # 1. Permitted: List repositories
    repos_res = await client.get("/api/v1/repositories", headers=headers)
    assert repos_res.status_code == 200

    # 2. Permitted: Create incident / bug report
    inc_res = await client.post(
        "/api/v1/incidents",
        headers=headers,
        json={"title": "High Memory in Auth Service", "service": "auth-service", "severity": "HIGH", "description": "Memory leak detected"},
    )
    assert inc_res.status_code == 201

    # 3. Forbidden: Docker infrastructure mutation
    docker_res = await client.post(
        "/api/v1/infrastructure/docker/hosts",
        headers=headers,
        json={"name": "Hacker Docker", "host_url": "tcp://hacked:2375"},
    )
    assert docker_res.status_code == 403

    # 4. Forbidden: Kubernetes infrastructure mutation
    k8s_res = await client.post(
        "/api/v1/infrastructure/k8s/clusters",
        headers=headers,
        json={"name": "Hacker K8s", "api_server_url": "https://hacked:6443"},
    )
    assert k8s_res.status_code == 403

    # 5. Forbidden: Workflow dispatch
    wf_res = await client.post(
        "/api/v1/workflows/dispatch",
        headers=headers,
        json={"repository_id": 1, "workflow_name": "prod-deploy.yml", "branch": "main"},
    )
    assert wf_res.status_code == 403

    # 6. Forbidden: Member management
    target_user_id = rbac_test_setup["users"]["viewer@devopspulse.local"].id
    role_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "DEVELOPER"},
    )
    assert role_res.status_code == 403


@pytest.mark.asyncio
async def test_security_engineer_permissions(client: AsyncClient, rbac_test_setup):
    """SECURITY_ENGINEER can trigger security scans and view overviews, but cannot mutate infra or pipelines."""
    company_id = rbac_test_setup["company_org"].id
    headers = await login_and_get_headers(client, "security@devopspulse.local", company_id)

    # 1. Permitted: View security overview
    sec_res = await client.get("/api/v1/security/overview", headers=headers)
    assert sec_res.status_code == 200

    # 2. Permitted: Trigger security scan
    scan_res = await client.post("/api/v1/security/scan", headers=headers)
    assert scan_res.status_code == 200

    # 3. Forbidden: Workflow pipeline dispatch
    wf_res = await client.post(
        "/api/v1/workflows/dispatch",
        headers=headers,
        json={"repository_id": 1, "workflow_name": "build.yml", "branch": "main"},
    )
    assert wf_res.status_code == 403

    # 4. Forbidden: Docker infrastructure mutation
    docker_res = await client.post(
        "/api/v1/infrastructure/docker/hosts",
        headers=headers,
        json={"name": "Sec Docker", "host_url": "tcp://sec:2375"},
    )
    assert docker_res.status_code == 403

    # 5. Forbidden: Member management
    target_user_id = rbac_test_setup["users"]["developer@company.com"].id
    role_res = await client.put(
        f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
        headers=headers,
        json={"role": "VIEWER"},
    )
    assert role_res.status_code == 403


@pytest.mark.asyncio
async def test_viewer_permissions_read_only(client: AsyncClient, rbac_test_setup):
    """VIEWER has read-only access across modules; all mutations are rejected with 403 Forbidden."""
    company_id = rbac_test_setup["company_org"].id
    headers = await login_and_get_headers(client, "viewer@devopspulse.local", company_id)

    # 1. Permitted: Read modules
    assert (await client.get("/api/v1/analytics/dora", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/analytics/team-productivity/overview", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/repositories", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/incidents", headers=headers)).status_code == 200
    assert (await client.get(f"/api/v1/organizations/{company_id}/members", headers=headers)).status_code == 200

    # 2. Forbidden: Create incident (POST)
    assert (
        await client.post(
            "/api/v1/incidents",
            headers=headers,
            json={"title": "Viewer Incident", "service": "api", "severity": "LOW"},
        )
    ).status_code == 403

    # 3. Forbidden: Import repository (POST)
    assert (
        await client.post(
            "/api/v1/repositories/import",
            headers=headers,
            json={"github_repo_full_name": "org/repo"},
        )
    ).status_code == 403

    # 4. Forbidden: Create Docker host (POST)
    assert (
        await client.post(
            "/api/v1/infrastructure/docker/hosts",
            headers=headers,
            json={"name": "Viewer Host", "host_url": "tcp://viewer:2375"},
        )
    ).status_code == 403

    # 5. Forbidden: Dispatch workflow (POST)
    assert (
        await client.post(
            "/api/v1/workflows/dispatch",
            headers=headers,
            json={"repository_id": 1, "workflow_name": "test.yml", "branch": "main"},
        )
    ).status_code == 403

    # 6. Forbidden: Update member role (PUT)
    target_user_id = rbac_test_setup["users"]["viewer@devopspulse.local"].id
    assert (
        await client.put(
            f"/api/v1/organizations/{company_id}/members/{target_user_id}/role",
            headers=headers,
            json={"role": "ORGANIZATION_ADMIN"},
        )
    ).status_code == 403


@pytest.mark.asyncio
async def test_cross_tenant_isolation(client: AsyncClient, rbac_test_setup):
    """Enforce complete cross-tenant boundary isolation between separate organizations."""
    acme_id = rbac_test_setup["acme_org"].id

    for test_email in [
        "orgadmin@devopspulse.local",
        "devops@devopspulse.local",
        "developer@company.com",
        "security@devopspulse.local",
        "viewer@devopspulse.local",
    ]:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": "Password123!"},
        )
        token = login_res.json()["access_token"]

        # Attempt to access Acme Global Corp using Acme's organization ID
        foreign_headers = {
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": str(acme_id),
        }

        # 1. Organization details
        org_attempt = await client.get(f"/api/v1/organizations/{acme_id}", headers=foreign_headers)
        assert org_attempt.status_code == 403, f"{test_email} breached cross-tenant boundary on get organization!"

        # 2. Member list
        members_attempt = await client.get(f"/api/v1/organizations/{acme_id}/members", headers=foreign_headers)
        assert members_attempt.status_code == 403, f"{test_email} breached cross-tenant boundary on list members!"

        # 3. Repositories
        repos_attempt = await client.get("/api/v1/repositories", headers=foreign_headers)
        assert repos_attempt.status_code == 403, f"{test_email} breached cross-tenant boundary on repositories!"
