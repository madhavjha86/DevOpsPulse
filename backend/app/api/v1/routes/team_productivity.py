"""Engineering Team Productivity Analytics API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.team_productivity import (
    TeamCreate,
    TeamProductivityOverview,
    TeamResponse,
)
from app.services.team_productivity_service import TeamProductivityService

router = APIRouter(prefix="/analytics/team-productivity", tags=["Team Productivity Analytics"])


@router.get(
    "/overview",
    response_model=TeamProductivityOverview,
    summary="Get engineering team productivity analytics and DORA metrics",
)
async def get_team_productivity_overview(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    team_id: int | None = Query(default=None, description="Optional team ID filter"),
) -> TeamProductivityOverview:
    """Retrieve team-level DORA metrics, PR review durations, and collaboration bottlenecks (zero individual developer rankings)."""
    return await TeamProductivityService.get_overview(
        db=db, user_id=current_user.id, team_id=team_id
    )


@router.get(
    "/teams",
    response_model=list[TeamResponse],
    summary="List configured engineering teams",
)
async def list_teams(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TeamResponse]:
    """Retrieve all engineering teams monitored for collective throughput."""
    return await TeamProductivityService.list_teams(db=db, user_id=current_user.id)


@router.post(
    "/teams",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or configure a new engineering team",
)
async def create_team(
    payload: TeamCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeamResponse:
    """Register a new engineering team and associate designated repositories."""
    return await TeamProductivityService.create_team(
        db=db, user_id=current_user.id, payload=payload
    )
