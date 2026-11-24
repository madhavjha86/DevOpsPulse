"""FinOps 1-Click Cloud Waste Killer API Routes."""

from typing import Annotated
from fastapi import APIRouter, Depends

from app.api.deps import TenantContext, get_tenant_context_optional
from app.schemas.finops_killer import (
    FinOpsKillerSummary,
    TerminateResourceRequest,
    TerminateResourceResponse,
)
from app.services.finops_killer_service import FinOpsKillerService

router = APIRouter(prefix="/finops/killer", tags=["FinOps Waste Killer"])


@router.get(
    "/summary",
    response_model=FinOpsKillerSummary,
    summary="Get summary of unattached, idle, and abandoned waste cloud resources",
)
async def get_finops_killer_summary(
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> FinOpsKillerSummary:
    """Detect unattached EBS volumes, idle EC2 instances, orphaned ALBs, and obsolete snapshots."""
    return FinOpsKillerService.get_summary()


@router.post(
    "/terminate",
    response_model=TerminateResourceResponse,
    summary="1-Click terminate selected waste resources to cut cloud bill",
)
async def terminate_waste_resources(
    payload: TerminateResourceRequest,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> TerminateResourceResponse:
    """Safely terminate waste resources and instantly recover cloud budget."""
    return FinOpsKillerService.terminate_waste(payload)
