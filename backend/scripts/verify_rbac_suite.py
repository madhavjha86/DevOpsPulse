"""Comprehensive RBAC and Tenant Isolation Verification Suite.

Tests against live PostgreSQL 18 database with all 6 permanent roles:
1. SUPER_ADMIN: admin@devopspulse.com
2. ORGANIZATION_ADMIN: orgadmin@devopspulse.local
3. DEVOPS_ENGINEER: devops@devopspulse.local
4. DEVELOPER: developer@company.com
5. SECURITY_ENGINEER: security@devopspulse.local
6. VIEWER: viewer@devopspulse.local
"""

import asyncio
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import ASGITransport, AsyncClient
from app.main import app

# Disable slow rate limiting during test verification
if hasattr(app.state, "limiter"):
    app.state.limiter.enabled = False

ROLES_CREDS = {
    "SUPER_ADMIN": {"email": "admin@devopspulse.com", "password": "Password123!"},
    "ORGANIZATION_ADMIN": {"email": "orgadmin@devopspulse.local", "password": "OrgAdmin2026!DevOps"},
    "DEVOPS_ENGINEER": {"email": "devops@devopspulse.local", "password": "DevOps2026!Pulse"},
    "DEVELOPER": {"email": "developer@company.com", "password": "Password123!"},
    "SECURITY_ENGINEER": {"email": "security@devopspulse.local", "password": "Security2026!Audit"},
    "VIEWER": {"email": "viewer@devopspulse.local", "password": "Viewer2026!ReadOnly"},
}

COMPANY_ORG_ID = 7
ACME_ORG_ID = 8

test_results = []

def record(test_name: str, passed: bool, detail: str = ""):
    status_str = "PASS" if passed else "FAIL"
    test_results.append((test_name, status_str, detail))
    print(f"[{status_str}] {test_name}: {detail}")


async def run_suite():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        tokens = {}
        headers = {}

        print("\n=== STEP 1: AUTHENTICATION & TOKEN GENERATION FOR ALL 6 ROLES ===")
        for role_name, creds in ROLES_CREDS.items():
            res = await client.post(
                "/api/v1/auth/login",
                json={"email": creds["email"], "password": creds["password"]},
            )
            passed = res.status_code == 200 and "access_token" in res.json()
            if passed:
                token = res.json()["access_token"]
                tokens[role_name] = token
                headers[role_name] = {
                    "Authorization": f"Bearer {token}",
                    "X-Organization-Id": str(COMPANY_ORG_ID),
                }
                record(f"Login & Token: {role_name}", True, f"Token generated for {creds['email']}")
            else:
                record(f"Login & Token: {role_name}", False, f"HTTP {res.status_code} - {res.text}")

        print("\n=== STEP 2: SUPER_ADMIN PERMISSIONS ===")
        h_super = headers["SUPER_ADMIN"]
        # Can read company org
        res1 = await client.get(f"/api/v1/organizations/{COMPANY_ORG_ID}", headers=h_super)
        record("SUPER_ADMIN: Read Primary Org", res1.status_code == 200, f"HTTP {res1.status_code}")
        # Can access foreign Acme Corp org (Global Super Admin override)
        h_super_acme = {"Authorization": h_super["Authorization"], "X-Organization-Id": str(ACME_ORG_ID)}
        res2 = await client.get(f"/api/v1/organizations/{ACME_ORG_ID}", headers=h_super_acme)
        record("SUPER_ADMIN: Global Override Cross-Tenant", res2.status_code == 200, f"HTTP {res2.status_code}")
        # Can assign role to member
        res3 = await client.put(
            f"/api/v1/organizations/{COMPANY_ORG_ID}/members/2/role",
            headers=h_super,
            json={"role": "DEVELOPER"},
        )
        record("SUPER_ADMIN: Assign Member Role", res3.status_code == 200, f"HTTP {res3.status_code}")

        print("\n=== STEP 3: ORGANIZATION_ADMIN PERMISSIONS ===")
        h_orgadmin = headers["ORGANIZATION_ADMIN"]
        # Can list members
        res_m = await client.get(f"/api/v1/organizations/{COMPANY_ORG_ID}/members", headers=h_orgadmin)
        record("ORGANIZATION_ADMIN: List Workspace Members", res_m.status_code == 200 and len(res_m.json()) >= 6, f"Members count: {len(res_m.json()) if res_m.status_code == 200 else 'N/A'}")
        # Can create cloud account
        res_ca = await client.post(
            "/api/v1/infrastructure/cloud/accounts",
            headers=h_orgadmin,
            json={
                "provider": "aws",
                "name": "OrgAdmin AWS Account",
                "region": "us-east-1",
                "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
                "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
        )
        record("ORGANIZATION_ADMIN: Configure Cloud Integration", res_ca.status_code == 201, f"HTTP {res_ca.status_code}")
        # Forbidden: Cross-tenant access to Acme Corp
        h_orgadmin_acme = {"Authorization": h_orgadmin["Authorization"], "X-Organization-Id": str(ACME_ORG_ID)}
        res_cross = await client.get(f"/api/v1/organizations/{ACME_ORG_ID}", headers=h_orgadmin_acme)
        record("ORGANIZATION_ADMIN: Cross-Tenant Block (Acme Corp)", res_cross.status_code == 403, f"HTTP {res_cross.status_code} (Expected 403)")
        # Forbidden: Privilege Escalation (Grant SUPER_ADMIN)
        res_esc = await client.put(
            f"/api/v1/organizations/{COMPANY_ORG_ID}/members/4/role",
            headers=h_orgadmin,
            json={"role": "SUPER_ADMIN"},
        )
        record("ORGANIZATION_ADMIN: Blocked from Granting SUPER_ADMIN", res_esc.status_code == 403, f"HTTP {res_esc.status_code} (Expected 403)")

        print("\n=== STEP 4: DEVOPS_ENGINEER PERMISSIONS ===")
        h_devops = headers["DEVOPS_ENGINEER"]
        # Can create Docker Host
        res_dh = await client.post(
            "/api/v1/infrastructure/docker/hosts",
            headers=h_devops,
            json={"name": "DevOps Docker Node", "host_url": "tcp://192.168.1.100:2375", "tls_verify": False},
        )
        record("DEVOPS_ENGINEER: Create Docker Host", res_dh.status_code == 201, f"HTTP {res_dh.status_code}")
        # Can create K8s Cluster
        res_k8s = await client.post(
            "/api/v1/infrastructure/k8s/clusters",
            headers=h_devops,
            json={"name": "DevOps K8s Cluster", "api_server_url": "https://192.168.1.101:6443", "auth_type": "token", "tls_verify": False},
        )
        record("DEVOPS_ENGINEER: Create K8s Cluster", res_k8s.status_code == 201, f"HTTP {res_k8s.status_code}")
        # Can dispatch workflow
        res_wf = await client.post(
            "/api/v1/workflows/dispatch",
            headers=h_devops,
            json={"repository_id": 5, "workflow_name": "build.yml", "branch": "main"},
        )
        record("DEVOPS_ENGINEER: Dispatch CI/CD Workflow", res_wf.status_code in (200, 201), f"HTTP {res_wf.status_code}")
        # Forbidden: Member role update
        res_m_up = await client.put(
            f"/api/v1/organizations/{COMPANY_ORG_ID}/members/2/role",
            headers=h_devops,
            json={"role": "ORGANIZATION_ADMIN"},
        )
        record("DEVOPS_ENGINEER: Blocked Member Role Update", res_m_up.status_code == 403, f"HTTP {res_m_up.status_code} (Expected 403)")
        # Forbidden: Cloud Account creation
        res_ca_deny = await client.post(
            "/api/v1/infrastructure/cloud/accounts",
            headers=h_devops,
            json={"provider": "aws", "name": "Denied AWS", "region": "us-east-1"},
        )
        record("DEVOPS_ENGINEER: Blocked Cloud Account Mutation", res_ca_deny.status_code == 403, f"HTTP {res_ca_deny.status_code} (Expected 403)")

        print("\n=== STEP 5: DEVELOPER PERMISSIONS ===")
        h_dev = headers["DEVELOPER"]
        # Can list repositories
        res_repos = await client.get("/api/v1/repositories", headers=h_dev)
        record("DEVELOPER: Access Repositories", res_repos.status_code == 200, f"HTTP {res_repos.status_code}")
        # Can report incident
        res_inc = await client.post(
            "/api/v1/incidents",
            headers=h_dev,
            json={"title": "Dev API Latency", "service": "gateway", "severity": "MEDIUM", "description": "High latency in gateway"},
        )
        record("DEVELOPER: Report Incident", res_inc.status_code == 201, f"HTTP {res_inc.status_code}")
        # Forbidden: Docker mutation
        res_dh_deny = await client.post(
            "/api/v1/infrastructure/docker/hosts",
            headers=h_dev,
            json={"name": "Dev Unauthorized Host", "host_url": "tcp://unauth:2375"},
        )
        record("DEVELOPER: Blocked Docker Infrastructure Mutation", res_dh_deny.status_code == 403, f"HTTP {res_dh_deny.status_code} (Expected 403)")
        # Forbidden: Workflow dispatch
        res_wf_deny = await client.post(
            "/api/v1/workflows/dispatch",
            headers=h_dev,
            json={"repository_id": 5, "workflow_name": "prod.yml", "branch": "main"},
        )
        record("DEVELOPER: Blocked Workflow Dispatch", res_wf_deny.status_code == 403, f"HTTP {res_wf_deny.status_code} (Expected 403)")
        # Forbidden: Member role update
        res_role_deny = await client.put(
            f"/api/v1/organizations/{COMPANY_ORG_ID}/members/6/role",
            headers=h_dev,
            json={"role": "DEVELOPER"},
        )
        record("DEVELOPER: Blocked Member Role Update", res_role_deny.status_code == 403, f"HTTP {res_role_deny.status_code} (Expected 403)")

        print("\n=== STEP 6: SECURITY_ENGINEER PERMISSIONS ===")
        h_sec = headers["SECURITY_ENGINEER"]
        # Can view security overview
        res_sec_ov = await client.get("/api/v1/security/overview", headers=h_sec)
        record("SECURITY_ENGINEER: View Security Posture", res_sec_ov.status_code == 200, f"HTTP {res_sec_ov.status_code}")
        # Can trigger security scan
        res_scan = await client.post("/api/v1/security/scan", headers=h_sec)
        record("SECURITY_ENGINEER: Trigger Security Audit Scan", res_scan.status_code == 200, f"HTTP {res_scan.status_code}")
        # Forbidden: Infrastructure Docker mutation
        res_sec_dh = await client.post(
            "/api/v1/infrastructure/docker/hosts",
            headers=h_sec,
            json={"name": "Sec Unauthorized Docker", "host_url": "tcp://unauth:2375"},
        )
        record("SECURITY_ENGINEER: Blocked Docker Infrastructure Mutation", res_sec_dh.status_code == 403, f"HTTP {res_sec_dh.status_code} (Expected 403)")
        # Forbidden: Workflow dispatch
        res_sec_wf = await client.post(
            "/api/v1/workflows/dispatch",
            headers=h_sec,
            json={"repository_id": 5, "workflow_name": "deploy.yml", "branch": "main"},
        )
        record("SECURITY_ENGINEER: Blocked Workflow Pipeline Dispatch", res_sec_wf.status_code == 403, f"HTTP {res_sec_wf.status_code} (Expected 403)")

        print("\n=== STEP 7: VIEWER READ-ONLY ENFORCEMENT (ALL MUTATIONS 403) ===")
        h_view = headers["VIEWER"]
        # Permitted: Read modules
        res_v_dora = await client.get("/api/v1/analytics/dora", headers=h_view)
        res_v_team = await client.get("/api/v1/analytics/team-productivity/overview", headers=h_view)
        res_v_repos = await client.get("/api/v1/repositories", headers=h_view)
        res_v_inc = await client.get("/api/v1/incidents", headers=h_view)
        record("VIEWER: Read DORA Metrics", res_v_dora.status_code == 200, f"HTTP {res_v_dora.status_code}")
        record("VIEWER: Read Team Productivity", res_v_team.status_code == 200, f"HTTP {res_v_team.status_code}")
        record("VIEWER: Read Repositories", res_v_repos.status_code == 200, f"HTTP {res_v_repos.status_code}")
        record("VIEWER: Read Incidents", res_v_inc.status_code == 200, f"HTTP {res_v_inc.status_code}")

        # Forbidden: Mutation operations
        v_post_inc = await client.post("/api/v1/incidents", headers=h_view, json={"title": "V", "service": "v", "severity": "LOW"})
        record("VIEWER: Blocked Create Incident (POST)", v_post_inc.status_code == 403, f"HTTP {v_post_inc.status_code} (Expected 403)")

        v_post_repo = await client.post("/api/v1/repositories/import", headers=h_view, json={"github_repo_full_name": "test/v"})
        record("VIEWER: Blocked Import Repository (POST)", v_post_repo.status_code == 403, f"HTTP {v_post_repo.status_code} (Expected 403)")

        v_post_dh = await client.post("/api/v1/infrastructure/docker/hosts", headers=h_view, json={"name": "V Host", "host_url": "tcp://v:2375"})
        record("VIEWER: Blocked Create Docker Host (POST)", v_post_dh.status_code == 403, f"HTTP {v_post_dh.status_code} (Expected 403)")

        v_post_wf = await client.post("/api/v1/workflows/dispatch", headers=h_view, json={"repository_id": 5, "workflow_name": "v.yml", "branch": "main"})
        record("VIEWER: Blocked Dispatch Workflow (POST)", v_post_wf.status_code == 403, f"HTTP {v_post_wf.status_code} (Expected 403)")

        v_put_role = await client.put(f"/api/v1/organizations/{COMPANY_ORG_ID}/members/6/role", headers=h_view, json={"role": "ORGANIZATION_ADMIN"})
        record("VIEWER: Blocked Role Self-Promotion (PUT)", v_put_role.status_code == 403, f"HTTP {v_put_role.status_code} (Expected 403)")

        print("\n=== STEP 8: CROSS-TENANT ISOLATION SUITE ===")
        # Test all 5 non-superadmin roles trying to access Acme Corp
        for role_key in ["ORGANIZATION_ADMIN", "DEVOPS_ENGINEER", "DEVELOPER", "SECURITY_ENGINEER", "VIEWER"]:
            token = tokens[role_key]
            foreign_h = {
                "Authorization": f"Bearer {token}",
                "X-Organization-Id": str(ACME_ORG_ID),
            }
            res_cross_org = await client.get(f"/api/v1/organizations/{ACME_ORG_ID}", headers=foreign_h)
            res_cross_rep = await client.get("/api/v1/repositories", headers=foreign_h)
            passed = res_cross_org.status_code == 403 and res_cross_rep.status_code == 403
            record(f"Cross-Tenant Denial: {role_key}", passed, f"Org HTTP: {res_cross_org.status_code}, Repos HTTP: {res_cross_rep.status_code}")

    print("\n" + "="*70)
    print("FINAL SUMMARY OF RBAC & TENANT ISOLATION VERIFICATION SUITE")
    print("="*70)
    total = len(test_results)
    passed_count = sum(1 for _, st, _ in test_results if st == "PASS")
    failed_count = total - passed_count
    print(f"Total Tests Run: {total}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")
    if failed_count == 0:
        print("ALL RBAC AND CROSS-TENANT PERMISSION CHECKS PASSED PERFECTLY!")
    else:
        print("SOME TESTS FAILED! Review details above.")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(run_suite())
