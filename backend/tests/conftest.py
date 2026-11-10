"""Pytest test configuration and fixtures."""

import os
os.environ["TESTING"] = "1"
os.environ["RATELIMIT_STORAGE_URL"] = "memory://"

import asyncio
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
import app.models  # noqa: F401
from app.main import app
from app.models.user import User

# Disable rate limiter for testing
if hasattr(app.state, "limiter"):
    app.state.limiter.enabled = False

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an active isolated test database session with fresh schema."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide AsyncClient with test database override."""
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a verified test user in the database."""
    user = User(
        email="developer@example.com",
        username="devtester",
        hashed_password=hash_password("password123"),
        full_name="Dev Tester",
        is_active=True,
        role="user",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def authenticated_client(
    client: AsyncClient, test_user: User
) -> tuple[AsyncClient, User]:
    """Return an HTTP client already equipped with Bearer authorization header."""
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "developer@example.com", "password": "password123"},
    )
    token_data = login_resp.json()
    token = token_data.get("access_token")
    client.headers["Authorization"] = f"Bearer {token}"
    return client, test_user
