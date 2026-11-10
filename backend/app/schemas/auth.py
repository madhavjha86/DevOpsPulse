"""Authentication Pydantic schemas."""

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    """JWT token pair returned after authentication."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str
    exp: int
    type: str


class LoginRequest(BaseModel):
    """User login credentials."""

    email: EmailStr
    password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    """New user registration data."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=255)


class RefreshTokenRequest(BaseModel):
    """Request to refresh an access token."""

    refresh_token: str


class GitHubOAuthCallback(BaseModel):
    """GitHub OAuth callback parameters."""

    code: str
    state: str | None = None


class PasswordChangeRequest(BaseModel):
    """Request to change password."""

    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
