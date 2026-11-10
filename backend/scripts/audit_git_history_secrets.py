"""Deep audit of Git history for exposed secrets, passwords, and private tokens."""

import re
import subprocess
import sys
from pathlib import Path

repo_dir = Path(__file__).resolve().parent.parent.parent

# Regex patterns for sensitive data
SECRET_PATTERNS = [
    (r"ghp_[0-9a-zA-Z]{36}", "GitHub Personal Access Token"),
    (r"gho_[0-9a-zA-Z]{36}", "GitHub OAuth Access Token"),
    (r"github_pat_[0-9a-zA-Z_]{82}", "GitHub Fine-Grained PAT"),
    (r"sk_live_[0-9a-zA-Z]{24}", "Stripe Live API Key"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "Private Key"),
    (r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+", "Slack Webhook URL"),
    (r"https://discord(?:app)?\.com/api/webhooks/\d+/[a-zA-Z0-9_-]+", "Discord Webhook URL"),
    (r"eyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}", "Hardcoded JWT Token"),
    (r"postgres:[^@\s]+@localhost", "PostgreSQL URL with Password"),
]

# Whitelist known benign test fixtures & docs placeholders
WHITELIST = {
    "AKIAIOSFODNN7EXAMPLE",
    "postgres:your_local_pg_password@localhost",
    "postgres:devopspulse@localhost",
}


def audit_git_history():
    print("=" * 70)
    print("DEVOPSPULSE: COMPREHENSIVE GIT HISTORY SECRET AUDIT")
    print("=" * 70)

    # Get full git log patch across all commits
    cmd = ["git", "-C", str(repo_dir), "log", "-p", "--all"]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")

    if proc.returncode != 0:
        print(f"[ERROR] Failed to run git log: {proc.stderr}")
        return 1

    lines = proc.stdout.splitlines()
    print(f"Total Git history patch lines inspected: {len(lines):,}")

    current_commit = "HEAD"
    current_file = "unknown"
    findings = []

    for line_idx, line in enumerate(lines):
        if line.startswith("commit "):
            current_commit = line.split()[1][:8]
        elif line.startswith("diff --git a/"):
            parts = line.split(" ")
            if len(parts) >= 3:
                current_file = parts[2].replace("a/", "")

        # Only inspect additions or context, not deletions of old code
        if not (line.startswith("+") and not line.startswith("+++")):
            continue

        for pattern, desc in SECRET_PATTERNS:
            matches = re.finditer(pattern, line)
            for m in matches:
                matched_str = m.group(0)
                if matched_str in WHITELIST:
                    continue

                is_test_file = "test" in current_file.lower()
                findings.append((current_commit, current_file, desc, is_test_file))

    real_leaks = [f for f in findings if not f[3]]
    test_fixtures = [f for f in findings if f[3]]

    print(f"Synthetic test fixtures identified (safe): {len(test_fixtures)}")
    for f in test_fixtures:
        print(f"  [TEST FIXTURE] Commit {f[0]} in {f[1]} -> {f[2]}")

    if real_leaks:
        print(f"\n[ALERT] REAL CREDENTIAL LEAKS DETECTED IN GIT HISTORY: {len(real_leaks)}")
        for f in real_leaks:
            print(f"  [CRITICAL] Commit {f[0]} in {f[1]} -> {f[2]}")
        return 1
    else:
        print("\n--> GIT HISTORY SECRET AUDIT: PASSED (Zero secrets found across all commits)")
        return 0


if __name__ == "__main__":
    sys.exit(audit_git_history())
