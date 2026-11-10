"""Run Playwright E2E tests against live DevOpsPulse stack."""

import os
import sys
import time
import subprocess
import httpx

def run():
    print("======================================================================")
    print("DEVOPSPULSE: PLAYWRIGHT END-TO-END SUITE")
    print("======================================================================\n")

    frontend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(frontend_dir)
    backend_dir = os.path.join(root_dir, "backend")

    # 1. Start Uvicorn
    print("1. Starting Backend (port 8000)...")
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
    print("2. Starting Frontend (port 3000)...")
    v_cmd = ["npx.cmd", "vite", "--port", "3000", "--host", "127.0.0.1"]
    v_proc = subprocess.Popen(v_cmd, cwd=frontend_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    exit_code = 1
    try:
        # Wait for servers
        start = time.time()
        b_ok = False
        f_ok = False
        while time.time() - start < 15:
            if not b_ok:
                try:
                    if httpx.get("http://127.0.0.1:8000/health", timeout=1.0).status_code == 200:
                        b_ok = True
                except Exception:
                    pass
            if not f_ok:
                try:
                    if httpx.get("http://127.0.0.1:3000/", timeout=1.0).status_code == 200:
                        f_ok = True
                except Exception:
                    pass
            if b_ok and f_ok:
                break
            time.sleep(0.5)

        assert b_ok and f_ok, "Servers failed to boot in 15 seconds"
        print("Both Backend and Frontend are ready! Running Playwright tests...\n")

        # 3. Run Playwright
        p_cmd = ["npx.cmd", "playwright", "test"]
        res = subprocess.run(p_cmd, cwd=frontend_dir, text=True)
        exit_code = res.returncode

    finally:
        print("\nStopping servers...")
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
        print("Servers stopped.")

    sys.exit(exit_code)

if __name__ == "__main__":
    run()
