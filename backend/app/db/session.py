"""Async database engine, session factory, and dependency injection."""

from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

is_sqlite = "sqlite" in settings.DATABASE_URL
engine_kwargs: dict = {"echo": settings.DEBUG}
if not is_sqlite:
    engine_kwargs.update({"pool_size": 20, "max_overflow": 10, "pool_pre_ping": True})

async_engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_engine() -> Engine:
    """Return a synchronous engine for Alembic migrations."""
    sync_kwargs: dict = {"echo": settings.DEBUG}
    if "sqlite" not in settings.DATABASE_URL_SYNC:
        sync_kwargs["pool_pre_ping"] = True
    return create_engine(
        settings.DATABASE_URL_SYNC,
        **sync_kwargs,
    )
