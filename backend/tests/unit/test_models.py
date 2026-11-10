"""Unit tests for SQLAlchemy models and relationships."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.notification import Notification
from app.models.repository import Repository
from app.models.github_account import GitHubAccount
from app.models.user import User


class TestModels:
    """Validate model instantiation and persistence."""

    @pytest.mark.asyncio
    async def test_user_creation(self, db_session: AsyncSession) -> None:
        user = User(
            email="jane@example.com",
            username="janedev",
            hashed_password=hash_password("password123"),
            full_name="Jane Developer",
            is_active=True,
            role="user",
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.email == "jane@example.com"
        assert user.role == "user"
        assert user.created_at is not None

    @pytest.mark.asyncio
    async def test_notification_creation(self, db_session: AsyncSession, test_user: User) -> None:
        notification = Notification(
            user_id=test_user.id,
            title="CI/CD Build Failed",
            message="Workflow 'build' run #44 failed on main branch",
            type="build_failure",
            reference_type="workflow_run",
            reference_id=44,
        )
        db_session.add(notification)
        await db_session.commit()
        await db_session.refresh(notification)

        assert notification.id is not None
        assert notification.is_read is False
        assert notification.title == "CI/CD Build Failed"
        assert notification.type == "build_failure"
