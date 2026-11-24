"""GitOps Drift Detection and Progressive Delivery API Routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import TenantContext, get_tenant_context_optional
from app.schemas.gitops import (
    CanaryAdjustRequest,
    CanaryRollout,
    GitOpsApp,
    GitOpsSyncRequest,
    GitOpsSyncResponse,
)
from app.services.gitops_service import GitOpsService

router = APIRouter(prefix="/gitops", tags=["GitOps & Progressive Delivery"])


@router.get(
    "/apps",
    response_model=list[GitOpsApp],
    summary="List all GitOps managed applications with drift status",
)
async def list_gitops_apps(
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> list[GitOpsApp]:
    """Retrieve GitOps applications, synchronization states, and active drift diffs."""
    return GitOpsService.list_apps()


@router.get(
    "/apps/{app_id}",
    response_model=GitOpsApp,
    summary="Get single GitOps application drift diff details",
)
async def get_gitops_app(
    app_id: str,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> GitOpsApp:
    """Fetch live vs Git discrepancies for a specific workload."""
    app = GitOpsService.get_app(app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"GitOps app '{app_id}' not found")
    return app


@router.post(
    "/apps/{app_id}/sync",
    response_model=GitOpsSyncResponse,
    summary="Reconcile live cluster with Git repository desired state",
)
async def sync_gitops_app(
    app_id: str,
    payload: GitOpsSyncRequest,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> GitOpsSyncResponse:
    """1-Click Sync to eliminate drift between Git and live Kubernetes."""
    try:
        return GitOpsService.sync_app(app_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/apps/{app_id}/canary",
    response_model=CanaryRollout,
    summary="Get canary / progressive delivery rollout status",
)
async def get_canary_rollout(
    app_id: str,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> CanaryRollout:
    """Fetch live traffic split, error rate comparison, and p99 latency."""
    return GitOpsService.get_canary(app_id)


@router.post(
    "/apps/{app_id}/canary/adjust",
    response_model=CanaryRollout,
    summary="Adjust canary traffic weight or promote/rollback release",
)
async def adjust_canary_rollout(
    app_id: str,
    payload: CanaryAdjustRequest,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> CanaryRollout:
    """Update traffic split percentage or perform instant 1-click promotion/rollback."""
    return GitOpsService.adjust_canary(app_id, payload)
