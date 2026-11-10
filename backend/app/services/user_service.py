"""User management business logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserResponse, UserUpdate


class UserService:
    """Service handling user profile fetching, updating, and account connections."""

    @staticmethod
    async def get_user(db: AsyncSession, user_id: int) -> UserResponse:
        """Fetch user by id."""
        repo = UserRepository(db)
        user = await repo.get(user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        return UserResponse.model_validate(user)

    @staticmethod
    async def update_user(
        db: AsyncSession, user_id: int, data: UserUpdate
    ) -> UserResponse:
        """Update profile fields for user."""
        repo = UserRepository(db)
        user = await repo.get(user_id)
        if not user:
            raise NotFoundException(detail="User not found")

        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            user = await repo.update(user_id, update_data)
            await db.commit()

        return UserResponse.model_validate(user)

    @staticmethod
    async def get_github_accounts(db: AsyncSession, user_id: int) -> list[dict]:
        """Fetch list of linked GitHub accounts for user."""
        repo = UserRepository(db)
        accounts = await repo.get_github_accounts_by_user_id(user_id)
        return [
            {
                "id": acc.id,
                "github_id": acc.github_id,
                "github_username": acc.github_username,
                "avatar_url": acc.avatar_url,
                "token_scope": acc.token_scope,
                "created_at": acc.created_at,
            }
            for acc in accounts
        ]
