"""Notification data-access repository."""

from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import BaseRepository


class NotificationRepo(BaseRepository[Notification]):
    """Data-access layer for Notification records."""

    model = Notification

    async def get_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int]:
        """Return paginated notifications for a user."""
        filters: list[Any] = [Notification.user_id == user_id]
        if unread_only:
            filters.append(Notification.is_read == False)  # noqa: E712

        count_q = select(func.count()).select_from(Notification)
        for f in filters:
            count_q = count_q.where(f)
        count_result = await self.db.execute(count_q)
        total = count_result.scalar() or 0

        query = select(Notification)
        for f in filters:
            query = query.where(f)
        query = query.order_by(Notification.id.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        return items, total

    async def get_unread_count(self, user_id: int) -> int:
        """Count unread notifications for a user."""
        result = await self.db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
        return result.scalar() or 0

    async def mark_as_read(
        self, notification_ids: list[int], user_id: int
    ) -> int:
        """Mark specific notifications as read. Returns rows affected."""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.id.in_(notification_ids),
                Notification.user_id == user_id,
            )
            .values(is_read=True)
        )
        await self.db.flush()
        return result.rowcount  # type: ignore[return-value]

    async def mark_all_as_read(self, user_id: int) -> int:
        """Mark every unread notification for a user as read."""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(is_read=True)
        )
        await self.db.flush()
        return result.rowcount  # type: ignore[return-value]

    async def create_notification(self, data: dict[str, Any]) -> Notification:
        """Insert a new notification."""
        return await self.create(data)
