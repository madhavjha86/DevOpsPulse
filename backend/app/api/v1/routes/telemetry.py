"""Telemetry, Centralized Logging, and Distributed Tracing API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.schemas.telemetry import (
    TelemetryLogCreate,
    TelemetryLogQueryResponse,
    TelemetryLogResponse,
    TelemetrySpanCreate,
    TelemetrySpanResponse,
    TelemetryStatsResponse,
    TelemetryTraceDetailResponse,
    TelemetryTraceSummary,
)
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/telemetry", tags=["Observability & Telemetry"])


@router.post(
    "/logs",
    response_model=TelemetryLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest structured application log",
)
async def ingest_log(
    payload: TelemetryLogCreate,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TelemetryLogResponse:
    """Ingest a structured JSON log entry correlated with optional trace/span ID."""
    return await TelemetryService.ingest_log(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/logs",
    response_model=TelemetryLogQueryResponse,
    summary="Search and filter structured logs",
)
async def query_logs(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service_name: str | None = Query(None, description="Filter by service name"),
    level: str | None = Query(None, description="Filter by log level (INFO, WARN, ERROR, DEBUG)"),
    search: str | None = Query(None, description="Substring search on message"),
    trace_id: str | None = Query(None, description="Correlate logs for a specific trace ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> TelemetryLogQueryResponse:
    """Query logs with full-text search, service filter, level filter, and pagination."""
    return await TelemetryService.query_logs(
        db=db,
        user_id=tenant.user.id,
        service_name=service_name,
        level=level,
        search=search,
        trace_id=trace_id,
        limit=limit,
        offset=offset,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/spans",
    response_model=TelemetrySpanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest OpenTelemetry trace span",
)
async def ingest_span(
    payload: TelemetrySpanCreate,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TelemetrySpanResponse:
    """Ingest a single OpenTelemetry-compliant trace span."""
    return await TelemetryService.ingest_span(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/traces",
    response_model=list[TelemetryTraceSummary],
    summary="List distributed traces",
)
async def query_traces(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service_name: str | None = Query(None, description="Filter by service participating in trace"),
    has_error: bool | None = Query(None, description="Filter traces containing errors"),
    limit: int = Query(30, ge=1, le=100),
) -> list[TelemetryTraceSummary]:
    """Retrieve trace summaries across microservices with latency and error status."""
    return await TelemetryService.query_traces(
        db=db,
        user_id=tenant.user.id,
        service_name=service_name,
        has_error=has_error,
        limit=limit,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/traces/{trace_id}",
    response_model=TelemetryTraceDetailResponse,
    summary="Get full trace waterfall hierarchy",
)
async def get_trace_waterfall(
    trace_id: str,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TelemetryTraceDetailResponse:
    """Fetch complete trace with all child spans arranged in chronological waterfall order."""
    detail = await TelemetryService.get_trace_detail(
        db=db,
        user_id=tenant.user.id,
        trace_id=trace_id,
    )
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trace with ID '{trace_id}' was not found.",
        )
    return detail


@router.get(
    "/services",
    response_model=list[str],
    summary="List telemetry emitting services",
)
async def get_services(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[str]:
    """Return distinct microservice names currently emitting logs or traces."""
    return await TelemetryService.get_services(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.get(
    "/stats",
    response_model=TelemetryStatsResponse,
    summary="Get observability scorecard statistics",
)
async def get_stats(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TelemetryStatsResponse:
    """Return 24h log volume, error counts, p95 trace duration, and active microservices count."""
    return await TelemetryService.get_stats(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )
