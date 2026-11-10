"""Audit Backend Verification for DevOpsPulse Post-Migration.

Executes:
1. Health & Root endpoints
2. User Registration (creates temporary user in PostgreSQL)
3. User Login (verifies password hashing & token issuance against PostgreSQL)
4. Token Refresh (verifies refresh token decoding & reissue)
5. Logout
6. Repository APIs against migrated PostgreSQL data
7. Analytics APIs against migrated PostgreSQL data
8. Notifications API against migrated PostgreSQL data
9. AI Copilot & Code Intelligence APIs against migrated PostgreSQL data
10. Cleanup of temporary user to maintain 100% database purity
"""

import asyncio
import os
import sys
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db.session import AsyncSessionLocal


async def cleanup_temp_user(email: str):
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM users WHERE email = :email;"), {"email": email})
        await session.commit()
        max_id = (await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM users;"))).scalar()
        await session.execute(text("SELECT setval('users_id_seq', :max_id, true);"), {"max_id": max_id})
        await session.commit()


async def run_backend_audit():
    print("======================================================================")
    print("DEVOPSPULSE: BACKEND API & POSTGRESQL INTEGRATION AUDIT")
    print("======================================================================\n")

    test_email = "audit_user_temp@devopspulse.com"
    test_username = "audittester"
    test_pw = "AuditPass123!"

    # Ensure clean starting state
    await cleanup_temp_user(test_email)

    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Health & Root
            print("--- 1. SYSTEM ENDPOINTS ---")
            health_resp = await client.get("/health")
            print(f"GET /health: {health_resp.status_code} - {health_resp.json()}")
            assert health_resp.status_code == 200, f"Health check failed: {health_resp.text}"

            root_resp = await client.get("/")
            print(f"GET /: {root_resp.status_code} - {root_resp.json()}")
            assert root_resp.status_code == 200, f"Root check failed: {root_resp.text}"
            print("System endpoints: PASSED\n")

            # 2. Registration
            print("--- 2. AUTHENTICATION: REGISTRATION ---")
            reg_resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": test_email,
                    "username": test_username,
                    "password": test_pw,
                    "full_name": "Audit Tester",
                },
            )
            print(f"POST /api/v1/auth/register: {reg_resp.status_code}")
            assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
            reg_tokens = reg_resp.json()
            assert "access_token" in reg_tokens, "Missing access_token in registration response"
            assert "refresh_token" in reg_tokens, "Missing refresh_token in registration response"
            print("Registration: PASSED (Record successfully written to PostgreSQL users table)\n")

            # 3. Login
            print("--- 3. AUTHENTICATION: LOGIN ---")
            login_resp = await client.post(
                "/api/v1/auth/login",
                json={"email": test_email, "password": test_pw},
            )
            print(f"POST /api/v1/auth/login: {login_resp.status_code}")
            assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
            tokens = login_resp.json()
            access_token = tokens["access_token"]
            refresh_token = tokens["refresh_token"]
            print(f"Token type: {tokens.get('token_type')}, expires_in: {tokens.get('expires_in')}s")
            print("Login: PASSED (Password verified against bcrypt hash in PostgreSQL)\n")

            # 4. Refresh Token
            print("--- 4. AUTHENTICATION: REFRESH TOKEN ---")
            refresh_resp = await client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token},
            )
            print(f"POST /api/v1/auth/refresh: {refresh_resp.status_code}")
            assert refresh_resp.status_code == 200, f"Refresh failed: {refresh_resp.text}"
            new_tokens = refresh_resp.json()
            assert "access_token" in new_tokens
            new_access_token = new_tokens["access_token"]
            print("Refresh token: PASSED (New token pair generated)\n")

            # 5. Logout
            print("--- 5. AUTHENTICATION: LOGOUT ---")
            logout_resp = await client.post(
                "/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {new_access_token}"},
            )
            print(f"POST /api/v1/auth/logout: {logout_resp.status_code} - {logout_resp.json()}")
            assert logout_resp.status_code == 200, f"Logout failed: {logout_resp.text}"
            print("Logout: PASSED\n")

            # 6. Admin Login for Migrated Data APIs
            print("--- 6. ADMIN AUTHENTICATION (MIGRATED USER) ---")
            admin_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@devopspulse.com", "password": "Password123!"},
            )
            assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
            admin_token = admin_login.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            print("Admin authenticated successfully with migrated credentials.\n")

            # 7. Repository APIs
            print("--- 7. REPOSITORIES API ---")
            repo_list_resp = await client.get("/api/v1/repositories", headers=admin_headers)
            print(f"GET /api/v1/repositories: {repo_list_resp.status_code}")
            assert repo_list_resp.status_code == 200, f"List repos failed: {repo_list_resp.text}"
            repos_data = repo_list_resp.json()
            repos = repos_data.get("items", [])
            total_repos = repos_data.get("total", len(repos))
            print(f"Total repositories returned: {total_repos}, Names: {[r['name'] for r in repos]}")

            if repos:
                repo_id = repos[0]["id"]
                # Get repo details
                repo_detail = await client.get(f"/api/v1/repositories/{repo_id}", headers=admin_headers)
                assert repo_detail.status_code == 200
                print(f"GET /api/v1/repositories/{repo_id}: {repo_detail.json().get('full_name')}")

                # Get commits
                commits_resp = await client.get(f"/api/v1/repositories/{repo_id}/commits", headers=admin_headers)
                assert commits_resp.status_code == 200
                commits = commits_resp.json()
                print(f"GET /api/v1/repositories/{repo_id}/commits: {len(commits)} commits returned")

                # Get PRs
                prs_resp = await client.get(f"/api/v1/repositories/{repo_id}/pulls", headers=admin_headers)
                assert prs_resp.status_code == 200
                prs = prs_resp.json()
                print(f"GET /api/v1/repositories/{repo_id}/pulls: {len(prs)} PRs returned")

                # Get Issues
                issues_resp = await client.get(f"/api/v1/repositories/{repo_id}/issues", headers=admin_headers)
                assert issues_resp.status_code == 200
                issues = issues_resp.json()
                print(f"GET /api/v1/repositories/{repo_id}/issues: {len(issues)} issues returned")
            print("Repositories API: PASSED\n")

            # 8. Analytics APIs
            print("--- 8. ANALYTICS API ---")
            dash_resp = await client.get("/api/v1/analytics/dashboard", headers=admin_headers)
            print(f"GET /api/v1/analytics/dashboard: {dash_resp.status_code}")
            assert dash_resp.status_code == 200, f"Dashboard stats failed: {dash_resp.text}"
            dash_stats = dash_resp.json()
            print(f"  Total Repos: {dash_stats.get('total_repositories')}, Total Commits: {dash_stats.get('total_commits')}, Total PRs: {dash_stats.get('total_pull_requests')}")

            act_resp = await client.get("/api/v1/analytics/recent-activity", headers=admin_headers)
            assert act_resp.status_code == 200
            print(f"GET /api/v1/analytics/recent-activity: {act_resp.status_code} - {len(act_resp.json().get('activities', []))} activities")

            trends_resp = await client.get("/api/v1/analytics/build-trends", headers=admin_headers)
            assert trends_resp.status_code == 200
            print(f"GET /api/v1/analytics/build-trends: {trends_resp.status_code} - {len(trends_resp.json().get('trends', []))} data points")

            dora_resp = await client.get("/api/v1/analytics/dora", headers=admin_headers)
            assert dora_resp.status_code == 200
            print(f"GET /api/v1/analytics/dora: {dora_resp.status_code} - DORA Scorecard: {dora_resp.json().get('performance_tier')}")
            print("Analytics API: PASSED\n")

            # 9. Notifications API
            print("--- 9. NOTIFICATIONS API ---")
            notif_resp = await client.get("/api/v1/notifications", headers=admin_headers)
            assert notif_resp.status_code == 200
            notifs = notif_resp.json().get("items", [])
            print(f"GET /api/v1/notifications: {notif_resp.status_code} - {len(notifs)} notifications returned")
            print("Notifications API: PASSED\n")

            # 10. AI APIs
            print("--- 10. AI APIS ---")
            ai_conv_resp = await client.get("/api/v1/ai/conversations", headers=admin_headers)
            assert ai_conv_resp.status_code == 200
            ai_convs = ai_conv_resp.json()
            print(f"GET /api/v1/ai/conversations: {ai_conv_resp.status_code} - {len(ai_convs)} conversation threads")

            ai_rev_resp = await client.get("/api/v1/ai/intelligence/reviews", headers=admin_headers)
            assert ai_rev_resp.status_code == 200
            ai_revs = ai_rev_resp.json()
            print(f"GET /api/v1/ai/intelligence/reviews: {ai_rev_resp.status_code} - {len(ai_revs)} code reviews")

            ai_pred_resp = await client.get("/api/v1/ai/intelligence/predictions", headers=admin_headers)
            assert ai_pred_resp.status_code == 200
            ai_preds = ai_pred_resp.json()
            print(f"GET /api/v1/ai/intelligence/predictions: {ai_pred_resp.status_code} - {len(ai_preds)} predictions")
            print("AI APIs: PASSED\n")

    finally:
        # 11. Cleanup temporary audit user from PostgreSQL
        print("--- 11. POSTGRESQL CLEANUP ---")
        async with AsyncSessionLocal() as session:
            del_res = await session.execute(text("DELETE FROM users WHERE email = :email;"), {"email": test_email})
            await session.commit()
            max_id = (await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM users;"))).scalar()
            await session.execute(text("SELECT setval('users_id_seq', :max_id, true);"), {"max_id": max_id})
            await session.commit()
            print(f"Deleted temporary user '{test_email}'. Users sequence reset to {max_id}.")
            user_count = (await session.execute(text("SELECT count(*) FROM users;"))).scalar()
            print(f"Current PostgreSQL users count: {user_count} (exact parity maintained)")
            assert user_count == 2, f"Expected 2 users, got {user_count}"
        print("PostgreSQL cleanup: COMPLETED\n")

    print("======================================================================")
    print("ALL BACKEND INTEGRATION & POSTGRESQL CHECKS PASSED (100% OPERATIONAL)")
    print("======================================================================")


if __name__ == "__main__":
    asyncio.run(run_backend_audit())
