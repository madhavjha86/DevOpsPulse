"""Docker Infrastructure Monitoring and Container Operations API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.docker_monitoring import (
    DockerActionRequest,
    DockerActionResponse,
    DockerContainerListResponse,
    DockerHealthResponse,
    DockerHostCreate,
    DockerHostResponse,
    DockerHostUpdate,
    DockerLogsResponse,
)
from app.services.docker_service import DockerService

router = APIRouter(prefix="/infrastructure/docker", tags=["Docker Infrastructure"])


@router.get(
    "/hosts",
    response_model=list[DockerHostResponse],
    summary="List all configured Docker hosts",
)
async def list_docker_hosts(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DockerHostResponse]:
    """Retrieve all Docker hosts registered by the authenticated user."""
    hosts = await DockerService.get_user_hosts(db, current_user.id)
    # If user has no hosts, auto-seed a default Local Docker Host entry
    if not hosts:
        default_payload = DockerHostCreate(
            name="Local Docker Daemon",
            host_url="http://localhost:2375",
            tls_verify=False,
        )
        created = await DockerService.create_host(db, current_user.id, default_payload)
        return [created]
    return hosts


@router.post(
    "/hosts",
    response_model=DockerHostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Docker host",
)
async def create_docker_host(
    payload: DockerHostCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerHostResponse:
    """Add a new Docker host daemon endpoint for container monitoring."""
    return await DockerService.create_host(db, current_user.id, payload)


@router.get(
    "/hosts/{host_id}",
    response_model=DockerHostResponse,
    summary="Get Docker host details",
)
async def get_docker_host(
    host_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerHostResponse:
    """Fetch details of a specific Docker host."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return DockerHostResponse.model_validate(host)


@router.put(
    "/hosts/{host_id}",
    response_model=DockerHostResponse,
    summary="Update Docker host configuration",
)
async def update_docker_host(
    host_id: int,
    payload: DockerHostUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerHostResponse:
    """Update settings for a Docker host."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return await DockerService.update_host(db, host, payload)


@router.delete(
    "/hosts/{host_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Docker host",
)
async def delete_docker_host(
    host_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a configured Docker host endpoint."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    await DockerService.delete_host(db, host)


@router.get(
    "/hosts/{host_id}/health",
    response_model=DockerHealthResponse,
    summary="Test Docker daemon connectivity and status",
)
async def check_docker_host_health(
    host_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerHealthResponse:
    """Trigger a live ping/health check against the Docker daemon."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return await DockerService.check_host_health(db, host)


@router.get(
    "/hosts/{host_id}/containers",
    response_model=DockerContainerListResponse,
    summary="List containers on a Docker host with live metrics",
)
async def get_docker_containers(
    host_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerContainerListResponse:
    """Retrieve real-time containers, operational states, and CPU/memory statistics."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return await DockerService.get_containers(db, host)


@router.get(
    "/hosts/{host_id}/containers/{container_id}/logs",
    response_model=DockerLogsResponse,
    summary="Fetch recent container stdout and stderr logs",
)
async def get_container_logs(
    host_id: int,
    container_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tail: int = Query(default=100, ge=10, le=1000, description="Number of tail lines to retrieve"),
) -> DockerLogsResponse:
    """Retrieve logs stream output from a specific container."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return await DockerService.get_container_logs(host, container_id, tail=tail)


@router.post(
    "/hosts/{host_id}/containers/{container_id}/action",
    response_model=DockerActionResponse,
    summary="Execute lifecycle action on a container (start, stop, restart, etc.)",
)
async def execute_container_action(
    host_id: int,
    container_id: str,
    payload: DockerActionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DockerActionResponse:
    """Control container runtime state directly from DevOpsPulse."""
    host = await DockerService.get_host_by_id(db, host_id, current_user.id)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Docker host with ID {host_id} not found",
        )
    return await DockerService.execute_container_action(host, container_id, payload.action)
