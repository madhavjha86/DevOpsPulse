"""Notification Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Public notification representation."""

    id: int
    title: str
    message: str
    type: str
    is_read: bool
    reference_type: str | None = None
    reference_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Paginated list of notifications."""

    notifications: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    per_page: int


class NotificationPreferences(BaseModel):
    """User notification preferences."""

    build_failures: bool = True
    build_successes: bool = False
    workflow_completed: bool = True


class MarkReadRequest(BaseModel):
    """Request to mark specific notifications as read."""

    notification_ids: list[int] = Field(..., min_length=1)
