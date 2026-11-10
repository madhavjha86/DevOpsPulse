"""Workflow runs and deployment monitoring endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user, get_db
from app.models.user import User
from app.schemas.workflow import (
    DeploymentListResponse,
    DeploymentResponse,
    WorkflowDispatchRequest,
    WorkflowRunListResponse,
    WorkflowRunResponse,
)
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.get(
    "",
    response_model=WorkflowRunListResponse,
    status_code=status.HTTP_200_OK,
    summary="List workflow runs",
)
async def list_workflow_runs(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    repo_id: int | None = Query(None, description="Filter by repository id"),
    status_filter: str | None = Query(None, alias="status", description="Filter by run status"),
    conclusion: str | None = Query(None, description="Filter by conclusion (e.g. success, failure)"),
) -> WorkflowRunListResponse:
    """Return paginated workflow runs across user repositories with status filtering."""
    return await WorkflowService.get_workflow_runs(
        db=db,
        user_id=current_user.id,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
        status=status_filter,
        conclusion=conclusion,
    )


@router.get(
    "/repository/{repo_id}",
    response_model=WorkflowRunListResponse,
    status_code=status.HTTP_200_OK,
    summary="List workflow runs for a specific repository",
)
async def list_repo_workflow_runs(
    repo_id: int,
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = Query(None, alias="status"),
    conclusion: str | None = Query(None),
) -> WorkflowRunListResponse:
    """Fetch workflow runs for a specific repository."""
    return await WorkflowService.get_workflow_runs(
        db=db,
        user_id=current_user.id,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
        status=status_filter,
        conclusion=conclusion,
    )


@router.post(
    "/repository/{repo_id}/sync",
    response_model=list[WorkflowRunResponse],
    status_code=status.HTTP_200_OK,
    summary="Sync workflow runs for repository",
)
async def sync_repo_workflow_runs(
    repo_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkflowRunResponse]:
    """Fetch latest GitHub Actions runs for repository and store in database."""
    return await WorkflowService.sync_workflow_runs(
        db=db,
        repo_id=repo_id,
        user_id=current_user.id,
    )


@router.get(
    "/deployments",
    response_model=DeploymentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all deployments",
)
async def list_deployments(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeploymentListResponse:
    """Return paginated list of deployments across all user repositories."""
    return await WorkflowService.get_deployments(
        db=db,
        user_id=current_user.id,
        repo_id=None,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.get(
    "/deployments/repository/{repo_id}",
    response_model=DeploymentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List repository deployments",
)
async def list_repo_deployments(
    repo_id: int,
    pagination: Annotated[PaginationParams, Depends()],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeploymentListResponse:
    """Fetch deployments for a specific repository."""
    return await WorkflowService.get_deployments(
        db=db,
        user_id=current_user.id,
        repo_id=repo_id,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.post(
    "/deployments/repository/{repo_id}/sync",
    response_model=list[DeploymentResponse],
    status_code=status.HTTP_200_OK,
    summary="Sync deployments for repository",
)
async def sync_repo_deployments(
    repo_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DeploymentResponse]:
    """Fetch deployments from GitHub and record them."""
    return await WorkflowService.sync_deployments(
        db=db,
        repo_id=repo_id,
        user_id=current_user.id,
    )


@router.post(
    "/dispatch",
    response_model=WorkflowRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dispatch a manual CI/CD workflow pipeline run",
)
async def dispatch_workflow(
    data: WorkflowDispatchRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkflowRunResponse:
    """Trigger an on-demand CI/CD workflow pipeline dispatch."""
    return await WorkflowService.dispatch_workflow(db, current_user.id, data)

