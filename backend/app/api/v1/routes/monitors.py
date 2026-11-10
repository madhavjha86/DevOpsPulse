"""Uptime & Service Health endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.monitor import MonitorCreateRequest, MonitorProbeResult, MonitorResponse
from app.services.monitor_service import MonitorService

router = APIRouter(prefix="/monitors", tags=["Infrastructure Monitoring"])


@router.get(
    "",
    response_model=list[MonitorResponse],
    status_code=status.HTTP_200_OK,
    summary="List all infrastructure & service monitors",
)
async def list_monitors(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[MonitorResponse]:
    """Return live status, uptime percentage, and latency of monitored services."""
    return await MonitorService.list_monitors()


@router.post(
    "",
    response_model=MonitorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new service uptime monitor",
)
async def create_monitor(
    data: MonitorCreateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MonitorResponse:
    """Register a new URL or API endpoint for synthetic uptime monitoring."""
    return await MonitorService.create_monitor(data)


@router.post(
    "/{monitor_id}/probe",
    response_model=MonitorProbeResult,
    status_code=status.HTTP_200_OK,
    summary="Execute on-demand live ping probe",
)
async def probe_monitor(
    monitor_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MonitorProbeResult:
    """Trigger an immediate real-time HTTP probe to test connectivity and measure latency."""
    return await MonitorService.trigger_monitor_probe(monitor_id)


@router.delete(
    "/{monitor_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a monitor",
)
async def delete_monitor(
    monitor_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, str]:
    """Delete an existing monitor."""
    await MonitorService.delete_monitor(monitor_id)
    return {"message": "Monitor deleted"}
