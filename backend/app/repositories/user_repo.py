"""User and GitHubAccount data-access repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_account import GitHubAccount
from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Data-access layer for User records."""

    model = User

    async def get_by_email(self, email: str) -> User | None:
        """Look up a user by their email address."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalars().first()

    async def get_by_username(self, username: str) -> User | None:
        """Look up a user by their username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalars().first()

    async def create_user(self, data: dict) -> User:
        """Create a new user record."""
        return await self.create(data)

    async def get_github_account(
        self, user_id: int, github_id: int
    ) -> GitHubAccount | None:
        """Find a GitHub account linked to a user by its GitHub numeric id."""
        result = await self.db.execute(
            select(GitHubAccount).where(
                GitHubAccount.user_id == user_id,
                GitHubAccount.github_id == github_id,
            )
        )
        return result.scalars().first()

    async def create_github_account(self, data: dict) -> GitHubAccount:
        """Create a new GitHub account link."""
        account = GitHubAccount(**data)
        self.db.add(account)
        await self.db.flush()
        await self.db.refresh(account)
        return account

    async def get_github_account_by_user_id(
        self, user_id: int
    ) -> GitHubAccount | None:
        """Return the first GitHub account linked to a user."""
        result = await self.db.execute(
            select(GitHubAccount).where(GitHubAccount.user_id == user_id)
        )
        return result.scalars().first()

    async def get_github_accounts_by_user_id(
        self, user_id: int
    ) -> list[GitHubAccount]:
        """Return all GitHub accounts linked to a user."""
        result = await self.db.execute(
            select(GitHubAccount).where(GitHubAccount.user_id == user_id)
        )
        return list(result.scalars().all())
