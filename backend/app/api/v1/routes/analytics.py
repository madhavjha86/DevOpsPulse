"""Analytics and metrics aggregation endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.analytics import (
    BuildTrendResponse,
    DashboardStats,
    DoraMetricsResponse,
    RecentActivityResponse,
    RepositoryActivityResponse,
    WorkflowPerformanceResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/dashboard",
    response_model=DashboardStats,
    status_code=status.HTTP_200_OK,
    summary="Get dashboard overview statistics",
)
async def get_dashboard_stats(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardStats:
    """Return top-level counts for repositories, commits, PRs, issues, builds, and success rate."""
    return await AnalyticsService.get_dashboard_stats(db, current_user.id)


@router.get(
    "/recent-activity",
    response_model=RecentActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get recent activity feed",
)
async def get_recent_activity(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=15, ge=1, le=50, description="Max items to retrieve"),
) -> RecentActivityResponse:
    """Return consolidated feed of recent commits, PRs, and workflow runs."""
    return await AnalyticsService.get_recent_activity(db, current_user.id, limit=limit)


@router.get(
    "/workflow-performance",
    response_model=WorkflowPerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get workflow performance timeseries",
)
async def get_workflow_performance(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=14, ge=1, le=90, description="Days of history to analyze"),
) -> WorkflowPerformanceResponse:
    """Return daily average workflow execution duration."""
    return await AnalyticsService.get_workflow_performance(db, current_user.id, days=days)


@router.get(
    "/repository-activity",
    response_model=RepositoryActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get repository commit activity timeseries",
)
async def get_repository_activity(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=14, ge=1, le=90, description="Days of history to analyze"),
) -> RepositoryActivityResponse:
    """Return daily commit frequencies across user repositories."""
    return await AnalyticsService.get_repository_activity(db, current_user.id, days=days)


@router.get(
    "/build-trends",
    response_model=BuildTrendResponse,
    status_code=status.HTTP_200_OK,
    summary="Get build success and failure trends",
)
async def get_build_trends(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=90, description="Days of history to analyze"),
) -> BuildTrendResponse:
    """Return daily counts of successful versus failed builds."""
    return await AnalyticsService.get_build_trends(db, current_user.id, days=days)


@router.get(
    "/dora",
    response_model=DoraMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get DORA metrics performance scorecard",
)
async def get_dora_metrics(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DoraMetricsResponse:
    """Return the four DORA metrics: Deployment Frequency, Lead Time, Change Failure Rate, MTTR."""
    return await AnalyticsService.get_dora_metrics(db, current_user.id)

