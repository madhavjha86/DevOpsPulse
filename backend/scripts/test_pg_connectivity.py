"""Read-only PostgreSQL connectivity check for DevOpsPulse without modifying or migrating any data."""

import os
import sys
import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import get_settings


def check_connectivity():
    settings = get_settings()

    if not settings.POSTGRES_PASSWORD or settings.POSTGRES_PASSWORD == "CHANGE_ME_LOCAL_PASSWORD":
        print("CONNECTIVITY_STATUS: PENDING (POSTGRES_PASSWORD needs to be set in backend/.env)")
        return 2

    # Test connecting to localhost PostgreSQL
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            connect_timeout=3,
        )
        cur = conn.cursor()
        cur.execute("SELECT version();")
        pg_version = cur.fetchone()[0]
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (settings.POSTGRES_DB,))
        db_exists = cur.fetchone() is not None
        cur.close()
        conn.close()

        print("POSTGRESQL_SERVICE: RUNNING")
        print("AUTHENTICATION: SUCCESS")
        print(f"DATABASE_{settings.POSTGRES_DB.upper()}_EXISTS: {db_exists}")
        if not db_exists:
            print(f"NOTE: Database '{settings.POSTGRES_DB}' will need to be created before schema migration.")
        return 0
    except psycopg2.OperationalError as e:
        err_msg = str(e)
        if "password authentication failed" in err_msg:
            print("CONNECTIVITY_STATUS: AUTHENTICATION_FAILED (Password did not match PostgreSQL user)")
        elif "connection to server" in err_msg and "failed" in err_msg:
            print(f"CONNECTIVITY_STATUS: CONNECTION_FAILED (Port {settings.POSTGRES_PORT} unreachable)")
        else:
            print(f"CONNECTIVITY_STATUS: OPERATIONAL_ERROR: {type(e).__name__}")
        return 1
    except Exception as e:
        print(f"CONNECTIVITY_STATUS: ERROR: {type(e).__name__}")
        return 1


if __name__ == "__main__":
    sys.exit(check_connectivity())
