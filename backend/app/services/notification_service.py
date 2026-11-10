"""Notification dispatch and status tracking business logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.notification_repo import NotificationRepo
from app.schemas.notification import NotificationListResponse, NotificationResponse


class NotificationService:
    """Service handling user notifications."""

    @staticmethod
    async def get_notifications(
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        """Fetch paginated notifications with total and unread counts."""
        repo = NotificationRepo(db)
        skip = (page - 1) * per_page
        items, total = await repo.get_by_user(
            user_id=user_id,
            skip=skip,
            limit=per_page,
            unread_only=unread_only,
        )
        unread_count = await repo.get_unread_count(user_id)
        return NotificationListResponse(
            notifications=[NotificationResponse.model_validate(n) for n in items],
            total=total,
            unread_count=unread_count,
            page=page,
            per_page=per_page,
        )

    @staticmethod
    async def mark_as_read(
        db: AsyncSession, user_id: int, notification_ids: list[int]
    ) -> int:
        """Mark specific notifications as read."""
        repo = NotificationRepo(db)
        count = await repo.mark_as_read(notification_ids, user_id)
        await db.commit()
        return count

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: int) -> int:
        """Mark all notifications for user as read."""
        repo = NotificationRepo(db)
        count = await repo.mark_all_as_read(user_id)
        await db.commit()
        return count

    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: int,
        title: str,
        message: str,
        type: str,
        reference_type: str | None = None,
        reference_id: int | None = None,
    ) -> NotificationResponse:
        """Create and store a new user notification."""
        repo = NotificationRepo(db)
        notif = await repo.create_notification({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "is_read": False,
        })
        await db.commit()
        return NotificationResponse.model_validate(notif)
