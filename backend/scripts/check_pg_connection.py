"""Check PostgreSQL connectivity and ensure devopspulse database exists without exposing secrets."""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def get_pg_password():
    # 1. Environment variable
    pw = os.environ.get("PGPASSWORD") or os.environ.get("POSTGRES_PASSWORD")
    if pw:
        return pw.strip().strip("'\"")

    # 2. Check backend/.env
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
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
    # Default candidate
    return "postgres"


def main():
    user = os.environ.get("POSTGRES_USER", "postgres")
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    password = get_pg_password()

    # Step 1: Connect to maintenance db 'postgres'
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
            port=port,
            connect_timeout=5,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        print("PG_SERVER_CONNECTIVITY: SUCCESS")
        cur.execute("SELECT version();")
        pg_ver = cur.fetchone()[0]
        print(f"PG_VERSION: {pg_ver.split(',')[0]}")
    except Exception as exc:
        print(f"PG_CONNECTIVITY_ERROR: Connection to postgres@{host}:{port} failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    # Step 2: Check if 'devopspulse' database exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'devopspulse';")
    exists = cur.fetchone() is not None

    if exists:
        print("DATABASE_DEVOPSPULSE: EXISTS")
    else:
        print("DATABASE_DEVOPSPULSE: NOT_FOUND -> CREATING...")
        try:
            cur.execute("CREATE DATABASE devopspulse;")
            print("DATABASE_DEVOPSPULSE: CREATED_SUCCESSFULLY")
        except Exception as exc:
            print(f"CREATE_DATABASE_ERROR: {exc}", file=sys.stderr)
            cur.close()
            conn.close()
            return 2

    cur.close()
    conn.close()

    # Step 3: Test connection directly to 'devopspulse'
    try:
        dp_conn = psycopg2.connect(
            dbname="devopspulse",
            user=user,
            password=password,
            host=host,
            port=port,
            connect_timeout=5,
        )
        dp_cur = dp_conn.cursor()
        dp_cur.execute("SELECT current_user, current_database(), has_database_privilege(current_user, current_database(), 'CREATE');")
        c_user, c_db, can_create = dp_cur.fetchone()
        print(f"DEVOPSPULSE_CONNECT: SUCCESS (User: {c_user}, DB: {c_db}, CanCreateTables: {can_create})")
        dp_cur.close()
        dp_conn.close()
        return 0
    except Exception as exc:
        print(f"DEVOPSPULSE_CONNECT_ERROR: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
