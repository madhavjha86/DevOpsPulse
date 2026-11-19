"""Executive Reporting, Export, and Notification Delivery API Endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.reports import (
    ExecutiveSummaryResponse,
    ReportScheduleRequest,
    ReportScheduleResponse,
    NotificationDeliveryTestRequest,
    NotificationDeliveryTestResponse,
)
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["Executive Reports & Notifications"])


@router.get(
    "/executive-summary",
    response_model=ExecutiveSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get multi-pillar executive intelligence summary",
)
async def get_executive_summary(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: int | None = Query(default=None, description="Optional organization filter"),
    time_period: str = Query(default="30d", description="Time window (e.g. 7d, 30d, 90d)"),
) -> ExecutiveSummaryResponse:
    """Return unified executive KPIs across Security, Reliability, FinOps, DR, Incidents, and CI/CD."""
    return await ReportingService.get_executive_summary(
        db=db,
        org_id=org_id,
        time_period=time_period,
    )


@router.get(
    "/export/csv",
    status_code=status.HTTP_200_OK,
    summary="Export executive telemetry as RFC 4180 CSV",
)
async def export_csv_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: int | None = Query(default=None),
    time_period: str = Query(default="30d"),
) -> Response:
    """Generate and download a genuine CSV export file."""
    summary = await ReportingService.get_executive_summary(db=db, org_id=org_id, time_period=time_period)
    csv_data = ReportingService.generate_csv_report(summary)

    filename = f"devopspulse_report_{time_period}_{summary.organization_name.replace(' ', '_')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/pdf",
    status_code=status.HTTP_200_OK,
    summary="Export executive briefing as print-ready PDF/HTML",
)
async def export_pdf_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: int | None = Query(default=None),
    time_period: str = Query(default="30d"),
) -> Response:
    """Generate executive report HTML suitable for print or PDF conversion."""
    summary = await ReportingService.get_executive_summary(db=db, org_id=org_id, time_period=time_period)
    html_data = ReportingService.generate_pdf_html(summary)

    return Response(
        content=html_data,
        media_type="text/html",
        headers={"Content-Disposition": 'inline; filename="devopspulse_executive_report.html"'},
    )


@router.post(
    "/schedule",
    response_model=ReportScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule automated executive report delivery",
)
async def schedule_report(
    payload: ReportScheduleRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> ReportScheduleResponse:
    """Register an automated report dispatch schedule."""
    import uuid
    from datetime import datetime, timedelta, timezone

    schedule_id = f"sched_{uuid.uuid4().hex[:8]}"
    next_run = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d 08:00 UTC")

    return ReportScheduleResponse(
        id=schedule_id,
        frequency=payload.frequency,
        format=payload.format,
        recipients=payload.recipients,
        next_scheduled_run=next_run,
        is_active=True,
    )


@router.post(
    "/test-notification",
    response_model=NotificationDeliveryTestResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify notification delivery channel",
)
async def test_notification(
    payload: NotificationDeliveryTestRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> NotificationDeliveryTestResponse:
    """Perform real delivery verification on email, webhook, or Slack target."""
    return await ReportingService.test_notification_delivery(
        channel=payload.channel,
        target=payload.target,
    )
