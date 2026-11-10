"""Verification Script for DevOpsPulse SQLite -> PostgreSQL Migration."""

import os
import sys
import sqlite3
import psycopg2

TABLES = [
    "users",
    "github_accounts",
    "repositories",
    "commits",
    "pull_requests",
    "issues",
    "workflow_runs",
    "deployments",
    "notifications",
    "audit_logs",
    "docker_hosts",
    "k8s_clusters",
    "cloud_accounts",
    "telemetry_logs",
    "telemetry_spans",
    "ai_conversations",
    "ai_messages",
    "ai_root_cause_analyses",
    "ai_pr_reviews",
    "ai_failure_predictions",
]


def get_pg_password():
    pw = os.environ.get("PGPASSWORD") or os.environ.get("POSTGRES_PASSWORD")
    if pw:
        return pw.strip().strip("'\"")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_file = os.path.join(base_dir, ".pg_auth_cache")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            c = f.read().strip().strip("'\"")
            if c:
                return c
    env_file = os.path.join(base_dir, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                cleaned = line.strip()
                if cleaned.startswith("#"):
                    cleaned = cleaned.lstrip("#").strip()
                if cleaned.startswith("POSTGRES_PASSWORD="):
                    val = cleaned.split("=", 1)[1].strip().strip("'\"")
                    if val and val != "your-postgres-password":
                        return val
                elif "postgresql" in cleaned and "@" in cleaned:
                    import re
                    m = re.search(r"postgresql(?:\+\w+)?://[^:]+:([^@]+)@", cleaned)
                    if m:
                        val = m.group(1).strip().strip("'\"")
                        if val and val != "your-postgres-password":
                            return val
    return None


def verify_integrity(sqlite_path: str, pg_host: str, pg_port: int, pg_user: str, pg_db: str, pg_password: str):
    print("=" * 70)
    print("DEVOPSPULSE: MIGRATION INTEGRITY & PARITY VERIFICATION")
    print("=" * 70)

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(
        dbname=pg_db,
        user=pg_user,
        password=pg_password,
        host=pg_host,
        port=pg_port,
        connect_timeout=10,
    )
    pg_cur = pg_conn.cursor()

    all_matched = True
    print(f"{'Table Name':<28} | {'SQLite Rows':<12} | {'PostgreSQL Rows':<15} | {'Status':<10}")
    print("-" * 70)

    total_sqlite = 0
    total_pg = 0

    for table in TABLES:
        sqlite_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        s_count = sqlite_cur.fetchone()[0]
        total_sqlite += s_count

        pg_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        p_count = pg_cur.fetchone()[0]
        total_pg += p_count

        status = "MATCH" if s_count == p_count else "MISMATCH"
        if status != "MATCH":
            all_matched = False
        print(f"{table:<28} | {s_count:<12} | {p_count:<15} | {status:<10}")

    print("-" * 70)
    print(f"{'TOTAL APPLICATION RECORDS':<28} | {total_sqlite:<12} | {total_pg:<15} | {'MATCH' if total_sqlite == total_pg else 'MISMATCH':<10}")

    # Check Alembic version in PG
    pg_cur.execute("SELECT version_num FROM alembic_version;")
    rev = pg_cur.fetchone()
    pg_rev = rev[0] if rev else "NONE"
    print(f"\nPostgreSQL Alembic Revision: {pg_rev}")

    # Check Sequences
    print("\n--- PostgreSQL Sequence Health Check ---")
    seq_ok = True
    for table in TABLES:
        pg_cur.execute(f"SELECT pg_get_serial_sequence('{table}', 'id');")
        seq_res = pg_cur.fetchone()[0]
        if seq_res:
            pg_cur.execute(f'SELECT COALESCE(MAX(id), 0) FROM "{table}";')
            max_id = pg_cur.fetchone()[0]
            pg_cur.execute(f"SELECT last_value, is_called FROM {seq_res};")
            last_val, is_called = pg_cur.fetchone()
            # If is_called is True, nextval will be last_val + 1. If table is empty, is_called might be False.
            status_seq = "HEALTHY" if (last_val >= max_id) else "BEHIND"
            if status_seq != "HEALTHY":
                seq_ok = False
            print(f"  {table:<25} sequence={seq_res} (max_id={max_id}, last_val={last_val}, is_called={is_called}) -> {status_seq}")

    sqlite_conn.close()
    pg_conn.close()

    if all_matched and seq_ok:
        print("\nALL PARITY AND SEQUENCE INTEGRITY CHECKS PASSED (100% SUCCESS)!")
        return 0
    else:
        print("\nINTEGRITY CHECKS FAILED! REVIEW MISMATCHES ABOVE.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_db = os.path.join(base_dir, "devopspulse.db")
    sys.path.insert(0, base_dir)
    from app.core.config import get_settings
    settings = get_settings()

    if not settings.POSTGRES_PASSWORD or settings.POSTGRES_PASSWORD == "CHANGE_ME_LOCAL_PASSWORD":
        print("ERROR: PostgreSQL password not configured in backend/.env", file=sys.stderr)
        sys.exit(1)

    ret = verify_integrity(
        sqlite_path=sqlite_db,
        pg_host=settings.POSTGRES_HOST,
        pg_port=settings.POSTGRES_PORT,
        pg_user=settings.POSTGRES_USER,
        pg_db=settings.POSTGRES_DB,
        pg_password=settings.POSTGRES_PASSWORD,
    )
    sys.exit(ret)
