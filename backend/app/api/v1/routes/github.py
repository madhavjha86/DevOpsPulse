"""Direct GitHub integration proxy endpoints."""

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user, get_db
from app.core.exceptions import BadRequestException
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.services.github_service import GitHubService

router = APIRouter(prefix="/github", tags=["GitHub Direct"])


@router.get(
    "/repos",
    response_model=list[dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="List repositories from connected GitHub account",
)
async def list_github_repos(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    """Query GitHub API directly for repositories available to user."""
    user_repo = UserRepository(db)
    gh_account = await user_repo.get_github_account_by_user_id(current_user.id)
    if not gh_account:
        raise BadRequestException(detail="No connected GitHub account found")

    client = GitHubService(access_token=gh_account.access_token)
    return await client.get_user_repos(page=pagination.page, per_page=pagination.per_page)


@router.get(
    "/repos/{owner}/{repo}",
    response_model=dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get GitHub repository details",
)
async def get_github_repo(
    owner: str,
    repo: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Fetch live repository details directly from GitHub."""
    user_repo = UserRepository(db)
    gh_account = await user_repo.get_github_account_by_user_id(current_user.id)
    token = gh_account.access_token if gh_account else None

    client = GitHubService(access_token=token)
    return await client.get_repo(owner, repo)
