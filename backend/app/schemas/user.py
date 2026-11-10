"""User Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    """Public user representation."""

    id: int
    email: EmailStr
    username: str
    full_name: str | None = None
    is_active: bool
    role: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Fields that a user may update on their own profile."""

    full_name: str | None = Field(None, max_length=255)
    avatar_url: str | None = Field(None, max_length=500)


class UserListResponse(BaseModel):
    """Paginated list of users."""

    users: list[UserResponse]
    total: int
    page: int
    per_page: int
