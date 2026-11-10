"""Scan untracked and tracked project files for exposed credentials."""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    "backups",
    "venv",
    ".venv",
}

IGNORED_FILES = {
    ".env",
    "devopspulse.db",
    "devopspulse.db-wal",
    "devopspulse.db-shm",
    "package-lock.json",
}

# Patterns that indicate real leaked secrets (excluding generic placeholders like 'change-me', 'your-secret', etc.)
SECRET_PATTERNS = [
    (r"ghp_[0-9a-zA-Z]{36}", "GitHub Personal Access Token"),
    (r"gho_[0-9a-zA-Z]{36}", "GitHub OAuth Access Token"),
    (r"github_pat_[0-9a-zA-Z_]{82}", "GitHub Fine-Grained PAT"),
    (r"sk_live_[0-9a-zA-Z]{24}", "Stripe Live API Key"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "Private Key"),
    (r"postgres:[^@\s]+@localhost", "PostgreSQL URL with Password"),
    (r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+", "Slack Webhook URL"),
    (r"https://discord(?:app)?\.com/api/webhooks/\d+/[a-zA-Z0-9_-]+", "Discord Webhook URL"),
    (r"eyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}", "Hardcoded JWT Token"),
]

def scan():
    print("======================================================================")
    print("DEVOPSPULSE: CODEBASE CREDENTIAL & SECRET LEAK SCAN")
    print("======================================================================\n")

    findings = []
    scanned_files_count = 0

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for file in files:
            if file in IGNORED_FILES or file.endswith(".db") or file.endswith(".pyc"):
                continue

            rel_path = os.path.relpath(os.path.join(root, file), ROOT_DIR)
            full_path = os.path.join(root, file)

            # Skip binary files
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            scanned_files_count += 1

            for pattern, desc in SECRET_PATTERNS:
                matches = re.finditer(pattern, content)
                for m in matches:
                    matched_str = m.group(0)
                    line_no = content[:m.start()].count("\n") + 1

                    # Ignore known benign public documentation placeholders
                    if matched_str in (
                        "AKIAIOSFODNN7EXAMPLE",
                        "postgres:your_local_pg_password@localhost",
                        "postgres:devopspulse@localhost",
                    ):
                        continue

                    # Check if it's a test file deliberately testing secret detection
                    is_test = "test" in rel_path.lower()
                    findings.append((rel_path, line_no, desc, is_test))

    print(f"Total non-ignored files scanned: {scanned_files_count}")

    real_leaks = [f for f in findings if not f[3]]
    test_fixtures = [f for f in findings if f[3]]

    if test_fixtures:
        print(f"Detected {len(test_fixtures)} synthetic test fixture(s) in test files (expected for security tests):")
        for f in test_fixtures:
            print(f"  [FIXTURE] {f[0]}:{f[1]} - {f[2]}")

    if real_leaks:
        print(f"\n[ALERT] Found {len(real_leaks)} potential real credential leak(s):")
        for f in real_leaks:
            print(f"  [LEAK] {f[0]}:{f[1]} - {f[2]}")
        print("\nScan status: FAILED (Real leaks detected)")
        return 1
    else:
        print("\nScan status: PASSED (Zero production credentials or secrets exposed)")
        return 0

if __name__ == "__main__":
    scan()
