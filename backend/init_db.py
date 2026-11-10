"""Script to initialize all database tables locally."""
import asyncio
from app.db.base import Base
from app.db.session import async_engine
import app.models  # Register all models with Base.metadata


async def main():
    safe_url = async_engine.url.render_as_string(hide_password=True)
    print(f"Connecting to database: {safe_url}...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("All 10 database tables initialized successfully!")


if __name__ == "__main__":
    asyncio.run(main())
