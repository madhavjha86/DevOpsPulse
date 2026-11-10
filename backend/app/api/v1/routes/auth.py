"""Authentication endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Register a new user account with email, username, and password."""
    return await AuthService.register(db, data)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User login",
)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with email and password to receive JWT access and refresh tokens."""
    return await AuthService.login(db, data)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh access token",
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Provide a valid refresh token to obtain a new access and refresh token pair."""
    return await AuthService.refresh_token(db, data.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out",
)
async def logout(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, str]:
    """Client-side token disposal endpoint."""
    return {"message": "Successfully logged out"}


@router.get(
    "/github/authorize",
    summary="Initiate GitHub OAuth",
)
async def github_authorize() -> dict[str, str]:
    """Get the GitHub OAuth authorization URL to redirect users."""
    url = AuthService.github_oauth_url()
    return {"authorization_url": url}


@router.get(
    "/github/callback",
    response_model=TokenResponse,
    summary="GitHub OAuth callback",
)
async def github_callback(
    code: str = Query(..., description="Authorization code from GitHub"),
    state: str | None = Query(None, description="State parameter for CSRF verification"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> TokenResponse:
    """Exchange GitHub authorization code for user access tokens."""
    return await AuthService.github_oauth_callback(db, code, state)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change user password",
)
async def change_password(
    data: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Change the authenticated user's password."""
    await AuthService.change_password(db, current_user.id, data)
    return {"message": "Password changed successfully"}
