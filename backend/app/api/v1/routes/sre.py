"""SRE Reliability Engineering, SLO/Error Budget, and APM Topology API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_db,
    get_tenant_context,
    require_tenant_developer,
)
from app.schemas.sre_reliability import (
    AlertRuleCreate,
    AlertRuleResponse,
    ApmMetricsResponse,
    OnCallScheduleCreate,
    OnCallScheduleResponse,
    ReliabilityOverviewResponse,
    ServiceDependencyMapResponse,
    SloCreate,
    SloResponse,
    SloSimulateBurnRequest,
)
from app.services.sre_service import SreService

router = APIRouter(prefix="/sre", tags=["SRE & Reliability Engineering"])


@router.get(
    "/overview",
    response_model=ReliabilityOverviewResponse,
    summary="Get SRE reliability scorecard, MTTD/MTTR and SLO targets",
)
async def get_reliability_overview(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReliabilityOverviewResponse:
    """Return enterprise reliability health, incident MTTD/MTTR, active on-call, and SLO summary."""
    return await SreService.get_overview(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


# ---------------------------------------------------------------------------
# Service Level Objectives (SLO) & Error Budgets
# ---------------------------------------------------------------------------


@router.get(
    "/slos",
    response_model=list[SloResponse],
    summary="List all Service Level Objectives",
)
async def list_slos(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SloResponse]:
    """Retrieve internal SLO targets, contractual SLAs, and error budget burn rates."""
    return await SreService.list_slos(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/slos",
    response_model=SloResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Define new Service Level Objective",
)
async def create_slo(
    payload: SloCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SloResponse:
    """Create an SLO with distinct internal target percentage vs contractual customer SLA."""
    return await SreService.create_slo(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/slos/{slo_id}/simulate-burn",
    response_model=SloResponse,
    summary="Simulate error surge and error budget burn rate",
)
async def simulate_slo_burn(
    slo_id: int,
    payload: SloSimulateBurnRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SloResponse:
    """Simulate an incident surge to test error budget consumption and burn rate thresholds."""
    updated = await SreService.simulate_burn(
        db=db,
        slo_id=slo_id,
        payload=payload,
        organization_id=tenant.organization_id,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SLO {slo_id} not found.",
        )
    return updated


# ---------------------------------------------------------------------------
# On-Call Schedules & Escalation Policies
# ---------------------------------------------------------------------------


@router.get(
    "/on-call",
    response_model=list[OnCallScheduleResponse],
    summary="List on-call rotation schedules",
)
async def list_on_call(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[OnCallScheduleResponse]:
    """Retrieve active primary/secondary on-call responders and escalation policies."""
    return await SreService.list_on_call(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/on-call",
    response_model=OnCallScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create on-call rotation schedule",
)
async def create_on_call(
    payload: OnCallScheduleCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OnCallScheduleResponse:
    """Register new on-call rotation with multi-tier escalation policy."""
    return await SreService.create_on_call(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


# ---------------------------------------------------------------------------
# Observability Custom Alert Rules
# ---------------------------------------------------------------------------


@router.get(
    "/alerts",
    response_model=list[AlertRuleResponse],
    summary="List observability metric alert rules",
)
async def list_alert_rules(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AlertRuleResponse]:
    """Retrieve metric alert rules for latency percentiles and error rates."""
    return await SreService.list_alerts(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/alerts",
    response_model=AlertRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom metric alert rule",
)
async def create_alert_rule(
    payload: AlertRuleCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleResponse:
    """Create a threshold alert rule evaluated against live telemetry."""
    return await SreService.create_alert(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.patch(
    "/alerts/{rule_id}/toggle",
    response_model=AlertRuleResponse,
    summary="Toggle alert rule active state",
)
async def toggle_alert_rule(
    rule_id: int,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleResponse:
    """Enable or disable an observability alert rule."""
    rule = await SreService.toggle_alert(
        db=db, rule_id=rule_id, organization_id=tenant.organization_id
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert rule {rule_id} not found.",
        )
    return rule


# ---------------------------------------------------------------------------
# Service Dependency Map & APM Performance
# ---------------------------------------------------------------------------


@router.get(
    "/topology",
    response_model=ServiceDependencyMapResponse,
    summary="Get distributed service dependency topology map",
)
async def get_service_topology(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ServiceDependencyMapResponse:
    """Retrieve microservice architectural dependency graph with live health status and call rates."""
    return await SreService.get_service_dependency_map(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.get(
    "/apm",
    response_model=ApmMetricsResponse,
    summary="Get APM latency percentiles and throughput",
)
async def get_apm_metrics(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    hours: int = Query(default=24, ge=1, le=168),
) -> ApmMetricsResponse:
    """Retrieve p50, p95, p99 latencies, throughput, and error rates across all services."""
    return await SreService.get_apm_metrics(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id, hours=hours
    )
