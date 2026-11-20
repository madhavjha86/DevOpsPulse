"""Cloud Cost Intelligence API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_db,
    get_tenant_context,
    require_tenant_admin,
    require_tenant_devops,
)
from app.schemas.cloud_cost import (
    BudgetCreate,
    BudgetResponse,
    CloudCostOverviewResponse,
    CostAnomalyItem,
    CostAnomalyStatusUpdate,
    CostOptimizationItem,
)
from app.services.cloud_cost_service import CloudCostService

router = APIRouter(prefix="/cloud/cost", tags=["Cloud Cost Intelligence"])


@router.get(
    "/overview",
    response_model=CloudCostOverviewResponse,
    summary="Get multi-cloud cost intelligence overview",
)
async def get_cost_overview(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    demo: bool = Query(default=True, description="Include simulated demo telemetry if no live cloud accounts connected"),
) -> CloudCostOverviewResponse:
    """Retrieve monthly spend, service breakdown, budget alerts, and optimization recommendations."""
    return await CloudCostService.get_overview(
        db=db,
        user_id=tenant.user.id,
        include_demo=demo,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/budgets",
    response_model=list[BudgetResponse],
    summary="List active cloud budgets and alert thresholds",
)
async def list_budgets(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BudgetResponse]:
    """Retrieve all configured spending limits and warning alerts."""
    return await CloudCostService.list_budgets(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/budgets",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new spend budget and alert threshold",
)
async def create_budget(
    payload: BudgetCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BudgetResponse:
    """Set a monthly budget target with automated warning/critical notification triggers."""
    return await CloudCostService.create_budget(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/optimizations",
    response_model=list[CostOptimizationItem],
    summary="List cost optimization recommendations",
)
async def list_optimizations(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None, description="Filter by status (OPEN, APPLIED, DISMISSED)"),
) -> list[CostOptimizationItem]:
    """Retrieve potential cloud resource cost reductions and right-sizing suggestions."""
    return await CloudCostService.list_optimizations(
        db=db,
        user_id=tenant.user.id,
        status=status,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/optimizations/{optimization_id}/apply",
    response_model=CostOptimizationItem,
    summary="Mark cost optimization recommendation as applied",
)
@router.put(
    "/optimizations/{optimization_id}/apply",
    response_model=CostOptimizationItem,
    summary="Mark cost optimization recommendation as applied",
)
async def apply_optimization(
    optimization_id: int,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CostOptimizationItem:
    """Acknowledge or apply an idle resource shutdown or right-sizing recommendation."""
    opt = await CloudCostService.apply_optimization(
        db=db,
        user_id=tenant.user.id,
        optimization_id=optimization_id,
        organization_id=tenant.organization_id,
    )
    if not opt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization {optimization_id} not found.",
        )
    return opt


@router.post(
    "/optimizations/{optimization_id}/dismiss",
    response_model=dict,
    summary="Dismiss cost optimization recommendation",
)
@router.put(
    "/optimizations/{optimization_id}/dismiss",
    response_model=dict,
    summary="Dismiss cost optimization recommendation",
)
async def dismiss_optimization(
    optimization_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Dismiss a cost recommendation from active view."""
    success = await CloudCostService.dismiss_optimization(
        db=db, user_id=tenant.user.id, optimization_id=optimization_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization {optimization_id} not found.",
        )
    return {"ok": True}


@router.get(
    "/anomalies",
    response_model=list[CostAnomalyItem],
    summary="List detected cloud cost anomalies and spend spikes",
)
async def list_anomalies(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None, description="Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)"),
) -> list[CostAnomalyItem]:
    """Retrieve cost anomaly alerts and detected surge events."""
    return await CloudCostService.list_anomalies(
        db=db,
        user_id=tenant.user.id,
        status=status,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/anomalies/{anomaly_id}/status",
    response_model=CostAnomalyItem,
    summary="Update status of a cost anomaly (acknowledge or resolve)",
)
@router.put(
    "/anomalies/{anomaly_id}/status",
    response_model=CostAnomalyItem,
    summary="Update status of a cost anomaly (acknowledge or resolve)",
)
async def update_anomaly_status(
    anomaly_id: int,
    payload: CostAnomalyStatusUpdate,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CostAnomalyItem:
    """Acknowledge or resolve an active cost surge alert."""
    anomaly = await CloudCostService.update_anomaly_status(
        db=db,
        user_id=tenant.user.id,
        anomaly_id=anomaly_id,
        new_status=payload.status,
        organization_id=tenant.organization_id,
    )
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly {anomaly_id} not found.",
        )
    return anomaly


@router.post(
    "/anomalies/simulate",
    response_model=CostAnomalyItem,
    status_code=status.HTTP_201_CREATED,
    summary="Simulate a cost spike and dispatch alert to configured webhooks",
)
async def simulate_cost_spike(
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CostAnomalyItem:
    """Trigger a simulated compute spike and notify Slack/Discord/Teams alert channels."""
    return await CloudCostService.simulate_cost_spike(
        db=db,
        user_id=tenant.user.id,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/sync/aws",
    summary="Synchronize real AWS billing data from AWS Cost Explorer",
)
async def sync_aws_billing(
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=90, description="Number of past days to synchronize"),
) -> dict:
    """Ingest actual AWS Cost Explorer billing data for the organization's configured AWS account."""
    from datetime import date, timedelta
    from app.models.cloud_account import CloudAccount
    from app.services.aws_cost_explorer_service import AWSCostExplorerService
    from sqlalchemy import select

    q = select(CloudAccount).where(
        CloudAccount.provider == "aws",
        CloudAccount.is_active == True,
    )
    if tenant.organization_id is not None:
        q = q.where(CloudAccount.organization_id == tenant.organization_id)
    else:
        q = q.where(CloudAccount.user_id == tenant.user.id)

    res = await db.execute(q)
    account = res.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No configured AWS cloud account found for this workspace.",
        )

    today = date.today()
    start_date = today - timedelta(days=days)
    service = AWSCostExplorerService(account)
    return await service.sync_cost_and_usage(db=db, start_date=start_date, end_date=today)

