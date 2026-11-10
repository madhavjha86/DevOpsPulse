"""Audit Frontend & Vite Proxy Integration for DevOpsPulse.

Executes:
1. Starts Uvicorn backend on http://127.0.0.1:8000 (connected to PostgreSQL 18)
2. Starts Vite dev server on http://127.0.0.1:3000
3. Probes Vite HTTP endpoints (root SPA, routes)
4. Probes API calls through Vite proxy (POST /api/v1/auth/login, GET /api/v1/analytics/dashboard)
5. Verifies zero proxy failures and correct data delivery
6. Cleanly terminates both servers
"""

import os
import sys
import time
import subprocess
import httpx

def main():
    print("======================================================================")
    print("DEVOPSPULSE: FRONTEND RUNTIME & VITE PROXY INTEGRATION AUDIT")
    print("======================================================================\n")

    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    # 1. Start Uvicorn
    print("--- 1. STARTING BACKEND (Uvicorn / PostgreSQL 18) ---")
    u_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--log-level",
        "warning",
    ]
    u_proc = subprocess.Popen(u_cmd, cwd=backend_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. Start Vite
    print("--- 2. STARTING FRONTEND (Vite Dev Server) ---")
    v_cmd = ["npx.cmd", "vite", "--port", "3000", "--host", "127.0.0.1"]
    v_proc = subprocess.Popen(v_cmd, cwd=frontend_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        # Wait for both servers
        print("Waiting for servers to become ready...")
        backend_ready = False
        frontend_ready = False

        start = time.time()
        while time.time() - start < 15:
            if not backend_ready:
                try:
                    r = httpx.get("http://127.0.0.1:8000/health", timeout=1.0)
                    if r.status_code == 200:
                        backend_ready = True
                except Exception:
                    pass

            if not frontend_ready:
                try:
                    r = httpx.get("http://127.0.0.1:3000/", timeout=1.0)
                    if r.status_code == 200:
                        frontend_ready = True
                except Exception:
                    pass

            if backend_ready and frontend_ready:
                break
            time.sleep(0.5)

        assert backend_ready, "Backend failed to start on port 8000 within 15s"
        assert frontend_ready, "Frontend failed to start on port 3000 within 15s"
        print("Both Backend (port 8000) and Frontend (port 3000) are LIVE!\n")

        # 3. Test Frontend HTML & SPA Routing
        print("--- 3. FRONTEND SPA ROUTE SERVING ---")
        pages_to_test = [
            "/",
            "/login",
            "/dashboard",
            "/repositories",
            "/workflows",
            "/deployments",
            "/dora",
            "/ai/copilot",
            "/ai/code-intelligence",
            "/observability/telemetry",
            "/infrastructure/docker",
            "/infrastructure/kubernetes",
            "/infrastructure/cloud",
        ]

        for path in pages_to_test:
            resp = httpx.get(f"http://127.0.0.1:3000{path}", timeout=5.0)
            assert resp.status_code == 200, f"Route {path} returned {resp.status_code}"
            assert "<div id=\"root\"></div>" in resp.text, f"Route {path} missing root div"
            print(f"  Vite SPA Route '{path}': 200 OK (Served HTML shell)")
        print("Frontend SPA routes: PASSED\n")

        # 4. Test API through Vite Proxy
        print("--- 4. VITE PROXY TO BACKEND & POSTGRESQL ---")
        proxy_login = httpx.post(
            "http://127.0.0.1:3000/api/v1/auth/login",
            json={"email": "admin@devopspulse.com", "password": "Password123!"},
            timeout=10.0,
        )
        print(f"POST http://127.0.0.1:3000/api/v1/auth/login (proxied to port 8000): {proxy_login.status_code}")
        assert proxy_login.status_code == 200, f"Proxy login failed: {proxy_login.text}"
        token = proxy_login.json()["access_token"]
        print("  Proxy Authentication: PASSED")

        proxy_dash = httpx.get(
            "http://127.0.0.1:3000/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        print(f"GET http://127.0.0.1:3000/api/v1/analytics/dashboard (proxied to port 8000): {proxy_dash.status_code}")
        assert proxy_dash.status_code == 200, f"Proxy dashboard failed: {proxy_dash.text}"
        stats = proxy_dash.json()
        print(f"  Dashboard Stats via Proxy: Repos={stats.get('total_repositories')}, Commits={stats.get('total_commits')}, PRs={stats.get('total_pull_requests')}")

        proxy_repos = httpx.get(
            "http://127.0.0.1:3000/api/v1/repositories",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        print(f"GET http://127.0.0.1:3000/api/v1/repositories (proxied to port 8000): {proxy_repos.status_code}")
        assert proxy_repos.status_code == 200
        repos = proxy_repos.json().get("repositories", [])
        print(f"  Repositories via Proxy: {[r['name'] for r in repos]}")
        print("Vite Proxy Integration: PASSED\n")

        print("======================================================================")
        print("ALL FRONTEND RUNTIME & PROXY CHECKS PASSED (100% OPERATIONAL)")
        print("======================================================================")

    finally:
        print("Shutting down test servers...")
        u_proc.terminate()
        v_proc.terminate()
        try:
            u_proc.wait(timeout=3)
        except Exception:
            u_proc.kill()
        try:
            v_proc.wait(timeout=3)
        except Exception:
            v_proc.kill()
        print("Test servers stopped cleanly.")

if __name__ == "__main__":
    main()
