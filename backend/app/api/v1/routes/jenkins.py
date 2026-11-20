"""Jenkins CI/CD integration endpoints."""

from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.jenkins import (
    JenkinsBuildResponse,
    JenkinsJobTriggerRequest,
    JenkinsLogResponse,
    JenkinsServerCreate,
    JenkinsServerResponse,
)
from app.services.jenkins_service import JenkinsService

router = APIRouter(prefix="/jenkins", tags=["Jenkins CI/CD"])


@router.get(
    "/servers",
    response_model=list[JenkinsServerResponse],
    status_code=status.HTTP_200_OK,
    summary="List Jenkins servers and active pipeline jobs",
)
async def list_jenkins_servers(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[JenkinsServerResponse]:
    """Retrieve all configured Jenkins controllers, jobs, and latest builds."""
    return await JenkinsService.get_servers(
        db=db,
        user_id=current_user.id,
        organization_id=getattr(current_user, "organization_id", None),
    )


@router.post(
    "/servers",
    response_model=JenkinsServerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Jenkins controller",
)
async def create_jenkins_server(
    payload: JenkinsServerCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JenkinsServerResponse:
    """Connect a new Jenkins controller and test connectivity."""
    return await JenkinsService.create_server(
        db=db,
        user_id=current_user.id,
        payload=payload,
        organization_id=getattr(current_user, "organization_id", None),
    )


@router.post(
    "/servers/{server_id}/jobs/{job_name}/build",
    response_model=JenkinsBuildResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger a remote Jenkins pipeline job",
)
async def trigger_jenkins_build(
    server_id: int,
    job_name: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: JenkinsJobTriggerRequest | None = None,
) -> JenkinsBuildResponse:
    """Trigger a build on a configured Jenkins server."""
    return await JenkinsService.trigger_build(
        db=db,
        server_id=server_id,
        job_name=job_name,
        user_id=current_user.id,
        organization_id=getattr(current_user, "organization_id", None),
        payload=payload,
    )


@router.get(
    "/servers/{server_id}/jobs/{job_name}/builds/{build_number}/logs",
    response_model=JenkinsLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Jenkins build console logs",
)
async def get_jenkins_build_logs(
    server_id: int,
    job_name: str,
    build_number: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JenkinsLogResponse:
    """Fetch console execution output for a specific Jenkins build."""
    return await JenkinsService.get_build_logs(
        db=db,
        server_id=server_id,
        job_name=job_name,
        build_number=build_number,
        organization_id=getattr(current_user, "organization_id", None),
    )


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Ingest Jenkins build notification webhook",
)
async def jenkins_webhook(
    payload: dict[str, Any],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Process automated Jenkins pipeline completion or progress notification."""
    return await JenkinsService.process_webhook(db=db, payload=payload)
