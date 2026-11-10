"""Safe ETL Migration Script: SQLite to PostgreSQL 18 for DevOpsPulse.

Preserves primary keys, foreign keys, timestamps, JSON text, and synchronizes sequences.
"""

import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import execute_values


# Dependency order for inserting rows without violating FK constraints
TABLE_ORDER = [
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


def run_migration(sqlite_path: str, pg_host: str, pg_port: int, pg_user: str, pg_db: str, pg_password: str):
    print("=" * 60)
    print("DEVOPSPULSE: SQLITE TO POSTGRESQL 18 ETL MIGRATION")
    print("=" * 60)
    print(f"Source SQLite: {sqlite_path}")
    print(f"Target PG DB : {pg_db} on {pg_host}:{pg_port} (User: {pg_user})")

    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite file not found: {sqlite_path}")

    # Connect to SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Connect to PostgreSQL
    pg_conn = psycopg2.connect(
        dbname=pg_db,
        user=pg_user,
        password=pg_password,
        host=pg_host,
        port=pg_port,
        connect_timeout=10,
    )
    pg_cur = pg_conn.cursor()

    total_migrated = 0
    migration_stats = {}

    try:
        # Start transaction
        for table in TABLE_ORDER:
            # 1. Fetch from SQLite
            sqlite_cur.execute(f'SELECT * FROM "{table}"')
            rows = sqlite_cur.fetchall()
            src_count = len(rows)

            if src_count == 0:
                print(f"  [{table:<25}] 0 rows in source. Skipping.")
                migration_stats[table] = {"source": 0, "target": 0, "status": "EMPTY"}
                continue

            # 2. Get columns
            col_names = [col[0] for col in sqlite_cur.description]
            cols_str = ", ".join([f'"{c}"' for c in col_names])

            # 3. Check existing rows in PG to prevent duplicates
            pg_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            pg_existing = pg_cur.fetchone()[0]

            if pg_existing > 0:
                print(f"  [{table:<25}] Target already has {pg_existing} rows. Checking count parity...")
                if pg_existing == src_count:
                    migration_stats[table] = {"source": src_count, "target": pg_existing, "status": "ALREADY_POPULATED"}
                    total_migrated += pg_existing
                    continue
                else:
                    raise ValueError(f"Target table {table} has {pg_existing} rows, source has {src_count}. Aborting to avoid overwrite.")

            # 4. Prepare data tuples
            data_tuples = []
            for r in rows:
                row_dict = dict(r)
                row_values = []
                for c in col_names:
                    val = row_dict[c]
                    # Convert integer 0/1 to boolean if column is boolean in PG
                    if c in ("is_active", "is_superuser", "is_private", "is_read", "tls_verify"):
                        if val is not None:
                            val = bool(val)
                    row_values.append(val)
                data_tuples.append(tuple(row_values))

            # 5. Insert into PG
            insert_query = f'INSERT INTO "{table}" ({cols_str}) VALUES %s'
            execute_values(pg_cur, insert_query, data_tuples)
            print(f"  [{table:<25}] Migrated {len(data_tuples)} rows successfully.")
            total_migrated += len(data_tuples)
            migration_stats[table] = {"source": src_count, "target": len(data_tuples), "status": "SUCCESS"}

            # 6. Synchronize sequence if 'id' column exists
            if "id" in col_names:
                seq_query = f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{table}"), 1),
                        (SELECT MAX(id) FROM "{table}") IS NOT NULL
                    );
                """
                try:
                    pg_cur.execute(seq_query)
                    val = pg_cur.fetchone()[0]
                    # print(f"    -> Sequence updated: {val}")
                except Exception as seq_err:
                    print(f"    -> Warning updating sequence on {table}: {seq_err}")

        # Commit transaction
        pg_conn.commit()
        print("-" * 60)
        print(f"ETL MIGRATION COMPLETED SUCCESSFULLY: {total_migrated} rows transferred.")
        print("-" * 60)

    except Exception as exc:
        pg_conn.rollback()
        print(f"FATAL ERROR DURING ETL MIGRATION: {exc}", file=sys.stderr)
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

    return migration_stats


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_db = os.path.join(base_dir, "devopspulse.db")
    sys.path.insert(0, base_dir)
    from app.core.config import get_settings
    settings = get_settings()

    if not settings.POSTGRES_PASSWORD or settings.POSTGRES_PASSWORD == "CHANGE_ME_LOCAL_PASSWORD":
        print("ERROR: PostgreSQL password not configured in backend/.env", file=sys.stderr)
        sys.exit(1)

    try:
        run_migration(
            sqlite_path=sqlite_db,
            pg_host=settings.POSTGRES_HOST,
            pg_port=settings.POSTGRES_PORT,
            pg_user=settings.POSTGRES_USER,
            pg_db=settings.POSTGRES_DB,
            pg_password=settings.POSTGRES_PASSWORD,
        )
    except Exception as e:
        sys.exit(1)
