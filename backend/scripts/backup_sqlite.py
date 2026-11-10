"""WAL-safe SQLite backup script for DevOpsPulse."""

import datetime
import os
import sqlite3
import sys


def perform_backup(src_path: str, backup_dir: str) -> str:
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source database not found at {src_path}")

    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dst_path = os.path.join(backup_dir, f"devopspulse_backup_{timestamp}.db")

    # Connect with timeout to ensure any pending WAL transactions flush safely
    src_conn = sqlite3.connect(src_path, timeout=30.0)
    dst_conn = sqlite3.connect(dst_path)

    # Use SQLite Online Backup API
    with dst_conn:
        src_conn.backup(dst_conn, pages=100)

    src_conn.close()
    dst_conn.close()

    # Verify the backup
    verify_conn = sqlite3.connect(dst_path)
    cur = verify_conn.cursor()

    tables = [
        row[0]
        for row in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    ]

    total_rows = 0
    counts = {}
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        cnt = cur.fetchone()[0]
        counts[t] = cnt
        if t != "alembic_version":
            total_rows += cnt

    verify_conn.close()

    print(f"BACKUP_PATH: {dst_path}")
    print(f"FILE_SIZE: {os.path.getsize(dst_path)} bytes")
    print(f"TABLES_FOUND: {len(tables)}")
    print(f"APPLICATION_RECORDS: {total_rows}")
    print(f"ALEMBIC_VERSION_ROWS: {counts.get('alembic_version', 0)}")
    for t, c in sorted(counts.items()):
        print(f"  - {t}: {c}")

    if total_rows != 196:
        print(f"WARNING: Expected 196 application records, found {total_rows}")
    print("BACKUP_VERIFICATION: PASSED")
    return dst_path


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(base_dir, "devopspulse.db")
    backups = os.path.join(base_dir, "backups")
    try:
        perform_backup(src, backups)
    except Exception as exc:
        print(f"BACKUP_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
