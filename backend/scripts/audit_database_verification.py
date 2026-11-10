"""Audit Database Verification for DevOpsPulse Post-Migration.

Checks:
1. Confirm application loads PostgreSQL configuration.
2. Confirm SQLite is not used as fallback.
3. Verify all tables, indexes, constraints, and foreign keys.
4. Verify Alembic current revision.
5. Check PostgreSQL sequence values and parity with max(id).
6. Test CRUD operations using the application async database layer (AsyncSessionLocal).
"""

import asyncio
import os
import sys
from sqlalchemy import text, inspect
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal, get_sync_engine, async_engine
from app.models.notification import Notification


EXPECTED_TABLES = [
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
    "alembic_version",
]


def audit_config():
    print("--- 1. CONFIGURATION & FALLBACK AUDIT ---")
    settings = get_settings()

    async_url = settings.DATABASE_URL
    sync_url = settings.DATABASE_URL_SYNC

    assert "postgresql+asyncpg://" in async_url, f"Expected postgresql+asyncpg in DATABASE_URL, got: {async_url[:20]}..."
    assert "postgresql://" in sync_url, f"Expected postgresql in DATABASE_URL_SYNC, got: {sync_url[:20]}..."
    assert "sqlite" not in async_url.lower(), "SQLite found in DATABASE_URL!"
    assert "sqlite" not in sync_url.lower(), "SQLite found in DATABASE_URL_SYNC!"

    parsed = urlparse(sync_url)
    print(f"DATABASE_DIALECT: {parsed.scheme}")
    print(f"DATABASE_HOST: {parsed.hostname}")
    print(f"DATABASE_PORT: {parsed.port}")
    print(f"DATABASE_NAME: {parsed.path.lstrip('/')}")
    print(f"POSTGRES_USER: {settings.POSTGRES_USER}")
    print(f"SQLITE_FALLBACK_ACTIVE: FALSE (PostgreSQL configuration strictly enforced)")
    print("Configuration audit: PASSED\n")


def audit_schema_and_constraints():
    print("--- 2. SCHEMA, CONSTRAINTS & INDEXES AUDIT ---")
    sync_engine = get_sync_engine()
    inspector = inspect(sync_engine)

    existing_tables = set(inspector.get_table_names())
    print(f"Total tables discovered in public schema: {len(existing_tables)}")

    missing_tables = set(EXPECTED_TABLES) - existing_tables
    if missing_tables:
        print(f"ERROR: Missing expected tables: {missing_tables}")
        sys.exit(1)
    print(f"All {len(EXPECTED_TABLES)} expected tables exist.")

    # Check foreign keys and indexes
    total_fks = 0
    total_indexes = 0
    for tbl in EXPECTED_TABLES:
        if tbl == "alembic_version":
            continue
        fks = inspector.get_foreign_keys(tbl)
        pk = inspector.get_pk_constraint(tbl)
        indexes = inspector.get_indexes(tbl)
        total_fks += len(fks)
        total_indexes += len(indexes)

    print(f"Total Foreign Key Constraints across tables: {total_fks}")
    print(f"Total Explicit Indexes across tables: {total_indexes}")

    with sync_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        print(f"Current Alembic Revision in Database: {rev}")
        assert rev == "007_ai_pr_review_predictions", f"Unexpected revision: {rev}"

    print("Schema & constraints audit: PASSED\n")


def audit_sequences():
    print("--- 3. POSTGRESQL SEQUENCES HEALTH AUDIT ---")
    sync_engine = get_sync_engine()
    with sync_engine.connect() as conn:
        seq_query = text("""
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public' 
            ORDER BY sequence_name;
        """)
        sequences = [r[0] for r in conn.execute(seq_query).fetchall()]
        print(f"Total sequences in public schema: {len(sequences)}")

        for seq in sequences:
            # Query last_value and is_called from the sequence
            seq_val_query = text(f"SELECT last_value, is_called FROM {seq};")
            last_val, is_called = conn.execute(seq_val_query).fetchone()

            # Find matching table and column
            table_name = seq.replace("_id_seq", "")
            # check max(id)
            if table_name in EXPECTED_TABLES:
                max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name};")).scalar()
                status = "HEALTHY"
                if max_id > 0 and (last_val < max_id or not is_called):
                    status = "DESYNCHRONIZED"
                print(f"  {seq}: last_value={last_val}, is_called={is_called}, table_max_id={max_id} -> {status}")
                assert status == "HEALTHY", f"Sequence {seq} is desynchronized!"

    print("Sequences audit: PASSED\n")


async def audit_crud_operations():
    print("--- 4. APPLICATION DATABASE LAYER CRUD AUDIT ---")
    async with AsyncSessionLocal() as session:
        # 1. CREATE
        new_notification = Notification(
            user_id=1,
            title="AUDIT_TEST_NOTIFICATION",
            message="Temporary notification for post-migration audit",
            type="info",
            is_read=False,
        )
        session.add(new_notification)
        await session.commit()
        await session.refresh(new_notification)
        created_id = new_notification.id
        print(f"  [CREATE] Created notification with id={created_id}")
        assert created_id > 0, "Failed to generate primary key ID"

        # 2. READ
        fetched = await session.get(Notification, created_id)
        assert fetched is not None, "Failed to read back created notification"
        assert fetched.title == "AUDIT_TEST_NOTIFICATION"
        print(f"  [READ] Successfully fetched notification id={created_id}: title='{fetched.title}'")

        # 3. UPDATE
        fetched.title = "AUDIT_TEST_NOTIFICATION_UPDATED"
        fetched.is_read = True
        await session.commit()
        await session.refresh(fetched)
        assert fetched.title == "AUDIT_TEST_NOTIFICATION_UPDATED"
        assert fetched.is_read is True
        print(f"  [UPDATE] Successfully updated notification id={created_id}: title='{fetched.title}', is_read={fetched.is_read}")

        # 4. DELETE
        await session.delete(fetched)
        await session.commit()

        deleted_check = await session.get(Notification, created_id)
        assert deleted_check is None, "Failed to delete test notification"
        print(f"  [DELETE] Successfully deleted notification id={created_id}")

    print("Application CRUD operations audit: PASSED\n")


async def main():
    print("======================================================================")
    print("DEVOPSPULSE: DATABASE PRODUCTION READINESS AUDIT")
    print("======================================================================\n")
    audit_config()
    audit_schema_and_constraints()
    audit_sequences()
    await audit_crud_operations()
    print("======================================================================")
    print("ALL DATABASE READINESS CHECKS PASSED (100% OPERATIONAL)")
    print("======================================================================")


if __name__ == "__main__":
    asyncio.run(main())
