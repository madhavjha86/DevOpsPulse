"""Smart Incident Management API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.incident import (
    IncidentAssignUpdate,
    IncidentCommentCreate,
    IncidentCreate,
    IncidentDetailResponse,
    IncidentResponse,
    IncidentStatsSummary,
    IncidentStatusUpdate,
)
from app.services.incident_service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Smart Incident Management"])


@router.get(
    "",
    response_model=list[IncidentResponse],
    summary="List tracked incidents with filters",
)
async def list_incidents(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None, description="Filter by status (OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED)"),
    severity: str | None = Query(default=None, description="Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    service: str | None = Query(default=None, description="Filter by affected service"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[IncidentResponse]:
    """Retrieve filtered list of operational outages and incidents."""
    return await IncidentService.list_incidents(
        db=db,
        user_id=current_user.id,
        status=status,
        severity=severity,
        service=service,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident",
)
async def create_incident(
    payload: IncidentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentResponse:
    """Report a new outage or service disruption and dispatch alerts."""
    return await IncidentService.create_incident(
        db=db, user_id=current_user.id, payload=payload
    )


@router.get(
    "/stats",
    response_model=IncidentStatsSummary,
    summary="Get incident metrics and MTTR summary",
)
@router.get(
    "/stats/summary",
    response_model=IncidentStatsSummary,
    summary="Get incident metrics and MTTR summary",
)
async def get_incident_stats(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentStatsSummary:
    """Retrieve aggregate MTTR, open incident count, and severity distributions."""
    return await IncidentService.get_incident_stats(db=db, user_id=current_user.id)


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    summary="Get incident details with audit timeline",
)
async def get_incident(
    incident_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentDetailResponse:
    """Fetch complete incident record including chronological timeline events."""
    incident = await IncidentService.get_incident(
        db=db, user_id=current_user.id, incident_id=incident_id
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found.",
        )
    return incident


@router.put(
    "/{incident_id}/status",
    response_model=IncidentDetailResponse,
    summary="Update incident lifecycle status",
)
async def update_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentDetailResponse:
    """Transition incident through Open -> Acknowledged -> Investigating -> Resolved."""
    updated = await IncidentService.update_status(
        db=db, user_id=current_user.id, incident_id=incident_id, payload=payload
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found.",
        )
    return updated


@router.put(
    "/{incident_id}/assign",
    response_model=IncidentDetailResponse,
    summary="Reassign incident ownership",
)
async def assign_incident(
    incident_id: int,
    payload: IncidentAssignUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentDetailResponse:
    """Assign an incident to an engineer or SRE team member."""
    updated = await IncidentService.assign_incident(
        db=db, user_id=current_user.id, incident_id=incident_id, payload=payload
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found.",
        )
    return updated


@router.post(
    "/{incident_id}/comments",
    response_model=IncidentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a timeline comment to an incident",
)
async def add_incident_comment(
    incident_id: int,
    payload: IncidentCommentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentDetailResponse:
    """Append a timestamped comment into the incident audit timeline."""
    updated = await IncidentService.add_comment(
        db=db, user_id=current_user.id, incident_id=incident_id, payload=payload
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found.",
        )
    return updated
