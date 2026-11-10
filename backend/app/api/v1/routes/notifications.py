"""In-app notifications management endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user, get_db
from app.models.user import User
from app.schemas.notification import (
    MarkReadRequest,
    NotificationListResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List user notifications",
)
async def list_notifications(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    unread_only: bool = Query(default=False, description="Filter only unread notifications"),
) -> NotificationListResponse:
    """Return paginated notifications for the authenticated user."""
    return await NotificationService.get_notifications(
        db=db,
        user_id=current_user.id,
        page=pagination.page,
        per_page=pagination.per_page,
        unread_only=unread_only,
    )


@router.post(
    "/mark-read",
    status_code=status.HTTP_200_OK,
    summary="Mark notifications as read",
)
async def mark_notifications_read(
    data: MarkReadRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    """Mark specified notification IDs as read."""
    count = await NotificationService.mark_as_read(
        db=db,
        user_id=current_user.id,
        notification_ids=data.notification_ids,
    )
    return {"marked_count": count}


@router.post(
    "/mark-all-read",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
async def mark_all_notifications_read(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    """Mark all unread notifications for user as read."""
    count = await NotificationService.mark_all_as_read(
        db=db,
        user_id=current_user.id,
    )
    return {"marked_count": count}


@router.get(
    "/unread-count",
    status_code=status.HTTP_200_OK,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    """Return count of unread notifications for badge display."""
    from app.repositories.notification_repo import NotificationRepo
    repo = NotificationRepo(db)
    count = await repo.get_unread_count(current_user.id)
    return {"unread_count": count}
