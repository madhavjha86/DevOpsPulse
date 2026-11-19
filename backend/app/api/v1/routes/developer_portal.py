"""Developer Portal (Service Catalog) and Infrastructure as Code (Terraform) API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_db,
    get_tenant_context,
    require_tenant_developer,
)
from app.schemas.iac_and_catalog import (
    DeveloperPortalOverviewResponse,
    ServiceCatalogCreate,
    ServiceCatalogResponse,
    TerraformApplyRequest,
    TerraformRunResponse,
    TerraformWorkspaceCreate,
    TerraformWorkspaceResponse,
)
from app.services.iac_and_catalog_service import IacAndCatalogService

router = APIRouter(prefix="/developer-portal", tags=["Developer Portal & IaC Governance"])


@router.get(
    "/overview",
    response_model=DeveloperPortalOverviewResponse,
    summary="Get Developer Portal service catalog overview",
)
async def get_portal_overview(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeveloperPortalOverviewResponse:
    """Return Spotify-style Service Catalog items and Golden Path scaffolding templates."""
    return await IacAndCatalogService.get_portal_overview(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/services",
    response_model=ServiceCatalogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a microservice in the Developer Portal",
)
async def create_service_catalog_item(
    payload: ServiceCatalogCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ServiceCatalogResponse:
    """Register service ownership, tech stack, OpenAPI documentation, and tier."""
    return await IacAndCatalogService.create_catalog_item(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


# ---------------------------------------------------------------------------
# Infrastructure as Code (Terraform)
# ---------------------------------------------------------------------------


@router.get(
    "/iac/workspaces",
    response_model=list[TerraformWorkspaceResponse],
    summary="List Terraform IaC workspaces",
)
async def list_workspaces(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TerraformWorkspaceResponse]:
    """Retrieve Terraform workspaces with drift status and resource counts."""
    return await IacAndCatalogService.list_workspaces(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/iac/workspaces",
    response_model=TerraformWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new Terraform workspace",
)
async def create_workspace(
    payload: TerraformWorkspaceCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TerraformWorkspaceResponse:
    """Connect a Git repository directory containing Terraform configurations."""
    return await IacAndCatalogService.create_workspace(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.post(
    "/iac/workspaces/{workspace_id}/plan",
    response_model=TerraformRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Terraform change preview plan",
)
async def plan_workspace(
    workspace_id: int,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TerraformRunResponse:
    """Preview changes and evaluate Checkov/tfsec security compliance rules."""
    run = await IacAndCatalogService.plan_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=tenant.user.id,
        organization_id=tenant.organization_id,
    )
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terraform workspace {workspace_id} not found.",
        )
    return run


@router.post(
    "/iac/runs/apply",
    response_model=TerraformRunResponse,
    summary="Approve and apply Terraform plan",
)
async def apply_run(
    payload: TerraformApplyRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TerraformRunResponse:
    """Explicitly authorize and apply infrastructure modifications."""
    run = await IacAndCatalogService.apply_run(
        db=db, payload=payload, organization_id=tenant.organization_id
    )
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terraform run {payload.run_id} not found.",
        )
    return run


@router.post(
    "/iac/workspaces/{workspace_id}/drift",
    response_model=TerraformWorkspaceResponse,
    summary="Detect configuration drift against live cloud resources",
)
async def check_workspace_drift(
    workspace_id: int,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TerraformWorkspaceResponse:
    """Compare declared Terraform state with current cloud infrastructure."""
    ws = await IacAndCatalogService.check_drift(
        db=db, workspace_id=workspace_id, organization_id=tenant.organization_id
    )
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terraform workspace {workspace_id} not found.",
        )
    return ws
