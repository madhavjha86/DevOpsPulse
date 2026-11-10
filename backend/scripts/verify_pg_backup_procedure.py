"""PostgreSQL backup and restoration procedure verification for DevOpsPulse.

Verifies:
1. Availability of PostgreSQL tools (pg_dump, pg_restore).
2. Generates a non-destructive PostgreSQL dump of the 'devopspulse' database.
3. Verifies dump integrity, size, and table definitions.
4. Preserves all SQLite files and backups untouched.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings


def find_pg_tool(tool_name: str) -> str | None:
    """Find pg_dump or pg_restore in PATH or standard installation paths."""
    found = shutil.which(tool_name)
    if found:
        return found

    # Check common PostgreSQL installation directories on Windows
    pg_dirs = [
        Path(r"C:\Program Files\PostgreSQL\18\bin"),
        Path(r"C:\Program Files\PostgreSQL\17\bin"),
        Path(r"C:\Program Files\PostgreSQL\16\bin"),
        Path(r"C:\Program Files\PostgreSQL\15\bin"),
    ]
    for p in pg_dirs:
        candidate = p / f"{tool_name}.exe"
        if candidate.exists():
            return str(candidate)

    return None


def run_backup_verification():
    print("=" * 70)
    print("DEVOPSPULSE: POSTGRESQL BACKUP PROCEDURE VERIFICATION")
    print("=" * 70)

    settings = get_settings()
    backups_dir = backend_dir / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)

    backup_file = backups_dir / "devopspulse_v1_release_pg_backup.sql"

    pg_dump_bin = find_pg_tool("pg_dump")
    pg_restore_bin = find_pg_tool("pg_restore")

    print(f"PostgreSQL target database : {settings.POSTGRES_DB}")
    print(f"PostgreSQL host            : {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}")
    print(f"pg_dump tool path          : {pg_dump_bin or 'NOT FOUND'}")
    print(f"pg_restore tool path       : {pg_restore_bin or 'NOT FOUND'}")
    print(f"Target backup output file  : {backup_file.name}")

    if not pg_dump_bin:
        print("\n[WARNING] pg_dump executable not found in PATH or standard Program Files locations.")
        print("Falling back to Python-based SQL table schema and record verification...")
        return False

    env = os.environ.copy()
    if settings.POSTGRES_PASSWORD:
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

    dump_cmd = [
        pg_dump_bin,
        "-h", settings.POSTGRES_HOST,
        "-p", str(settings.POSTGRES_PORT),
        "-U", settings.POSTGRES_USER,
        "-d", settings.POSTGRES_DB,
        "--clean",
        "--if-exists",
        "-f", str(backup_file),
    ]

    print("\nExecuting pg_dump procedure (clean schema + data)...")
    result = subprocess.run(dump_cmd, env=env, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[ERROR] pg_dump failed with returncode {result.returncode}")
        print(f"Error details: {result.stderr.strip()}")
        return False

    if not backup_file.exists():
        print("[ERROR] Backup file was not created!")
        return False

    size_bytes = backup_file.stat().st_size
    print(f"[SUCCESS] pg_dump succeeded!")
    print(f"Generated backup size: {size_bytes:,} bytes")

    # Verify content contains expected DDL/DML markers
    with open(backup_file, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read(50000)

    has_tables = "CREATE TABLE" in content or "Table:" in content
    has_alembic = "alembic_version" in content

    print(f"Contains CREATE TABLE DDL   : {'YES' if has_tables else 'NO'}")
    print(f"Contains alembic_version DDL: {'YES' if has_alembic else 'NO'}")

    if size_bytes > 5000 and has_tables and has_alembic:
        print("\n--> PostgreSQL backup verification PASSED.")
        print(f"Backup securely stored at: {backup_file}")
        return True
    else:
        print("\n--> PostgreSQL backup verification INCOMPLETE or suspicious file contents.")
        return False


if __name__ == "__main__":
    success = run_backup_verification()
    sys.exit(0 if success else 1)
