"""Repository tracking and management endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user, get_db
from app.models.user import User
from app.schemas.repository import (
    CommitResponse,
    ImportRepositoryRequest,
    IssueResponse,
    PullRequestResponse,
    RepositoryListResponse,
    RepositoryResponse,
)
from app.services.repository_service import RepositoryService

router = APIRouter(prefix="/repositories", tags=["Repositories"])


@router.get(
    "",
    response_model=RepositoryListResponse,
    status_code=status.HTTP_200_OK,
    summary="List connected repositories",
)
async def list_repositories(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepositoryListResponse:
    """Return paginated list of repositories tracked for the authenticated user."""
    return await RepositoryService.get_repositories(
        db=db,
        user_id=current_user.id,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.post(
    "/import",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import repository from GitHub",
)
async def import_repository(
    data: ImportRepositoryRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepositoryResponse:
    """Import a GitHub repository by 'owner/repo' using user's GitHub credentials."""
    return await RepositoryService.import_repository(
        db=db,
        user_id=current_user.id,
        full_name=data.github_repo_full_name,
    )


@router.get(
    "/{repo_id}",
    response_model=RepositoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get repository details",
)
async def get_repository(
    repo_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepositoryResponse:
    """Fetch details for a specific repository."""
    return await RepositoryService.get_repository(
        db=db,
        repo_id=repo_id,
        user_id=current_user.id,
    )


@router.post(
    "/{repo_id}/sync",
    response_model=RepositoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync repository with GitHub",
)
async def sync_repository(
    repo_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepositoryResponse:
    """Manually trigger synchronization of commits, PRs, and issues from GitHub."""
    return await RepositoryService.sync_repository(
        db=db,
        repo_id=repo_id,
        user_id=current_user.id,
    )


@router.delete(
    "/{repo_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete repository",
)
async def delete_repository(
    repo_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Delete a tracked repository and its associated data."""
    await RepositoryService.delete_repository(
        db=db,
        repo_id=repo_id,
        user_id=current_user.id,
    )
    return {"message": "Repository removed successfully"}


@router.get(
    "/{repo_id}/commits",
    response_model=list[CommitResponse],
    status_code=status.HTTP_200_OK,
    summary="List repository commits",
)
async def list_commits(
    repo_id: int,
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CommitResponse]:
    """Fetch paginated commits for a repository."""
    return await RepositoryService.get_commits(
        db=db,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.get(
    "/{repo_id}/pull-requests",
    response_model=list[PullRequestResponse],
    status_code=status.HTTP_200_OK,
    summary="List repository pull requests",
)
async def list_pull_requests(
    repo_id: int,
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PullRequestResponse]:
    """Fetch paginated pull requests for a repository."""
    return await RepositoryService.get_pull_requests(
        db=db,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.get(
    "/{repo_id}/issues",
    response_model=list[IssueResponse],
    status_code=status.HTTP_200_OK,
    summary="List repository issues",
)
async def list_issues(
    repo_id: int,
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[IssueResponse]:
    """Fetch paginated issues for a repository."""
    return await RepositoryService.get_issues(
        db=db,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
    )
