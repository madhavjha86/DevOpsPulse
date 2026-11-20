"""Uptime & Service Health endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.schemas.monitor import (
    MonitorCreateRequest,
    MonitorProbeResult,
    MonitorResponse,
    SystemHealthResponse,
)
from app.services.monitor_service import MonitorService

router = APIRouter(prefix="/monitors", tags=["Infrastructure Monitoring"])


@router.get(
    "/system-health",
    response_model=SystemHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Get live core system health status across DB, Redis, and Workers",
)
async def get_system_health(
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> SystemHealthResponse:
    """Return genuine health telemetry for PostgreSQL, Redis, API, and Celery workers."""
    return await MonitorService.check_system_health(db)


@router.get(
    "",
    response_model=list[MonitorResponse],
    status_code=status.HTTP_200_OK,
    summary="List all infrastructure & service monitors",
)
async def list_monitors(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MonitorResponse]:
    """Return live status, uptime percentage, and latency of monitored services."""
    return await MonitorService.list_monitors(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "",
    response_model=MonitorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new service uptime monitor",
)
async def create_monitor(
    data: MonitorCreateRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MonitorResponse:
    """Register a new URL or API endpoint for synthetic uptime monitoring."""
    return await MonitorService.create_monitor(
        db=db, user_id=tenant.user.id, data=data, organization_id=tenant.organization_id
    )


@router.post(
    "/{monitor_id}/probe",
    response_model=MonitorProbeResult,
    status_code=status.HTTP_200_OK,
    summary="Execute on-demand live ping probe",
)
async def probe_monitor(
    monitor_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MonitorProbeResult:
    """Trigger an immediate real-time HTTP probe to test connectivity and measure latency."""
    return await MonitorService.trigger_monitor_probe(
        db=db, monitor_id=monitor_id, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.delete(
    "/{monitor_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a monitor",
)
async def delete_monitor(
    monitor_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Delete an existing monitor."""
    await MonitorService.delete_monitor(
        db=db, monitor_id=monitor_id, user_id=tenant.user.id, organization_id=tenant.organization_id
    )
    return {"message": "Monitor deleted"}
