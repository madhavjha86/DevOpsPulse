"""Test live Uvicorn server startup and HTTP probing."""

import os
import sys
import time
import subprocess
import httpx

def main():
    print("Starting Uvicorn server process on http://127.0.0.1:8000...")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--log-level",
        "info",
    ]
    log_file = os.path.join(backend_dir, "uvicorn_live_test.log")
    with open(log_file, "w", encoding="utf-8") as lf:
        proc = subprocess.Popen(cmd, cwd=backend_dir, stdout=lf, stderr=subprocess.STDOUT, text=True)

    try:
        # Wait up to 10 seconds for port 8000 to be open
        ready = False
        start = time.time()
        while time.time() - start < 10:
            try:
                r = httpx.get("http://127.0.0.1:8000/health", timeout=1.0)
                if r.status_code == 200:
                    ready = True
                    break
            except Exception:
                time.sleep(0.5)

        if not ready:
            print("ERROR: Uvicorn did not respond on http://127.0.0.1:8000 within 10s!")
            proc.terminate()
            with open(log_file, "r", encoding="utf-8", errors="ignore") as lf:
                print("Uvicorn output:\n", lf.read())
            sys.exit(1)

        print("Uvicorn is LIVE and healthy on http://127.0.0.1:8000!")

        # Test login over live HTTP
        login_res = httpx.post(
            "http://127.0.0.1:8000/api/v1/auth/login",
            json={"email": "admin@devopspulse.com", "password": "Password123!"},
            timeout=10.0,
        )
        print(f"HTTP POST /api/v1/auth/login: {login_res.status_code}")
        assert login_res.status_code == 200, f"Live login failed: {login_res.text}"
        token = login_res.json()["access_token"]

        # Test dashboard over live HTTP
        dash_res = httpx.get(
            "http://127.0.0.1:8000/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        print(f"HTTP GET /api/v1/analytics/dashboard: {dash_res.status_code} - Repos: {dash_res.json().get('total_repositories')}, Commits: {dash_res.json().get('total_commits')}")
        assert dash_res.status_code == 200, f"Live dashboard failed: {dash_res.text}"

        # Test repositories over live HTTP
        repo_res = httpx.get(
            "http://127.0.0.1:8000/api/v1/repositories",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        repo_items = repo_res.json().get('repositories', [])
        print(f"HTTP GET /api/v1/repositories: {repo_res.status_code} - Repos ({len(repo_items)}): {[r['name'] for r in repo_items]}")
        assert repo_res.status_code == 200
        assert len(repo_items) == 2, f"Expected 2 repositories, got {len(repo_items)}"

        print("Live Uvicorn HTTP probe: 100% SUCCESSFUL!")

    except Exception as e:
        print(f"Error encountered: {e}")
        raise
    finally:
        print("Stopping Uvicorn server...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Uvicorn stopped cleanly.")

if __name__ == "__main__":
    main()
