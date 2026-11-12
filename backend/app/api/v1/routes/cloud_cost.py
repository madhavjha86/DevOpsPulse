"""Cloud Cost Intelligence API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.cloud_cost import (
    BudgetCreate,
    BudgetResponse,
    CloudCostOverviewResponse,
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
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    demo: bool = Query(default=True, description="Include simulated demo telemetry if no live cloud accounts connected"),
) -> CloudCostOverviewResponse:
    """Retrieve monthly spend, service breakdown, budget alerts, and optimization recommendations."""
    return await CloudCostService.get_overview(
        db=db, user_id=current_user.id, include_demo=demo
    )


@router.get(
    "/budgets",
    response_model=list[BudgetResponse],
    summary="List active cloud budgets and alert thresholds",
)
async def list_budgets(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BudgetResponse]:
    """Retrieve all configured spending limits and warning alerts."""
    return await CloudCostService.list_budgets(db=db, user_id=current_user.id)


@router.post(
    "/budgets",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new spend budget and alert threshold",
)
async def create_budget(
    payload: BudgetCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BudgetResponse:
    """Set a monthly budget target with automated warning/critical notification triggers."""
    return await CloudCostService.create_budget(
        db=db, user_id=current_user.id, payload=payload
    )


@router.get(
    "/optimizations",
    response_model=list[CostOptimizationItem],
    summary="List cost optimization recommendations",
)
async def list_optimizations(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None, description="Filter by status (OPEN, APPLIED, DISMISSED)"),
) -> list[CostOptimizationItem]:
    """Retrieve potential cloud resource cost reductions and right-sizing suggestions."""
    return await CloudCostService.list_optimizations(
        db=db, user_id=current_user.id, status=status
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
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CostOptimizationItem:
    """Acknowledge or apply an idle resource shutdown or right-sizing recommendation."""
    opt = await CloudCostService.apply_optimization(
        db=db, user_id=current_user.id, optimization_id=optimization_id
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
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Dismiss a cost recommendation from active view."""
    success = await CloudCostService.dismiss_optimization(
        db=db, user_id=current_user.id, optimization_id=optimization_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization {optimization_id} not found.",
        )
    return {"ok": True}
