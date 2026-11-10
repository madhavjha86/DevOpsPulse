"""Utility to sync and URL-encode POSTGRES_PASSWORD into DATABASE_URL and DATABASE_URL_SYNC in backend/.env without exposing secrets."""

import os
import sys
from urllib.parse import quote_plus


def sync_env():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    if not os.path.exists(env_path):
        print("ERROR: backend/.env not found", file=sys.stderr)
        return 1

    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    user = "postgres"
    password = ""
    host = "localhost"
    port = "5432"
    db = "devopspulse"

    for line in lines:
        cleaned = line.strip()
        if cleaned.startswith("#"):
            continue
        if cleaned.startswith("POSTGRES_USER="):
            user = cleaned.split("=", 1)[1].strip().strip("'\"")
        elif cleaned.startswith("POSTGRES_PASSWORD="):
            password = cleaned.split("=", 1)[1].strip().strip("'\"")
        elif cleaned.startswith("POSTGRES_HOST="):
            host = cleaned.split("=", 1)[1].strip().strip("'\"")
        elif cleaned.startswith("POSTGRES_PORT="):
            port = cleaned.split("=", 1)[1].strip().strip("'\"")
        elif cleaned.startswith("POSTGRES_DB="):
            db = cleaned.split("=", 1)[1].strip().strip("'\"")

    if not password or password == "CHANGE_ME_LOCAL_PASSWORD":
        print("STATUS: PENDING_PASSWORD_UPDATE (POSTGRES_PASSWORD is placeholder)")
        return 0

    enc_user = quote_plus(user)
    enc_pw = quote_plus(password)
    async_url = f"postgresql+asyncpg://{enc_user}:{enc_pw}@{host}:{port}/{db}"
    sync_url = f"postgresql://{enc_user}:{enc_pw}@{host}:{port}/{db}"

    new_lines = []
    for line in lines:
        cleaned = line.strip()
        if cleaned.startswith("DATABASE_URL="):
            new_lines.append(f"DATABASE_URL={async_url}\n")
        elif cleaned.startswith("DATABASE_URL_SYNC="):
            new_lines.append(f"DATABASE_URL_SYNC={sync_url}\n")
        else:
            new_lines.append(line)

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print("STATUS: URLS_ENCODED_AND_SYNCED")
    return 0


if __name__ == "__main__":
    sys.exit(sync_env())
