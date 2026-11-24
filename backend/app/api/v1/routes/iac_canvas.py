"""Cloud Architecture Canvas and Terraform API Endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import TenantContext, get_tenant_context, require_tenant_devops
from app.schemas.iac_canvas import (
    CanvasApplyRequest,
    CanvasApplyResponse,
    CanvasDiagram,
    CanvasGenerateTerraformRequest,
    CanvasGenerateTerraformResponse,
)
from app.services.iac_canvas_service import IACCanvasService

router = APIRouter(prefix="/iac/canvas", tags=["IaC Canvas"])


@router.get(
    "/diagrams",
    response_model=list[CanvasDiagram],
    summary="List all saved visual architecture canvas diagrams",
)
async def list_diagrams(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> list[CanvasDiagram]:
    """Retrieve templates and user created visual topologies."""
    return IACCanvasService.list_diagrams()


@router.get(
    "/diagrams/{diagram_id}",
    response_model=CanvasDiagram,
    summary="Get architecture diagram details by ID",
)
async def get_diagram(
    diagram_id: str,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> CanvasDiagram:
    """Retrieve diagram nodes, edges, and configurations."""
    diagram = IACCanvasService.get_diagram(diagram_id)
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Architecture diagram '{diagram_id}' not found",
        )
    return diagram


@router.post(
    "/diagrams",
    response_model=CanvasDiagram,
    status_code=status.HTTP_201_CREATED,
    summary="Save or update visual architecture canvas diagram",
)
async def save_diagram(
    diagram: CanvasDiagram,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> CanvasDiagram:
    """Persist architecture diagram for team collaboration."""
    return IACCanvasService.save_diagram(diagram)


@router.post(
    "/generate",
    response_model=CanvasGenerateTerraformResponse,
    summary="Generate Terraform HCL and architecture cost estimation from canvas nodes",
)
async def generate_terraform_hcl(
    payload: CanvasGenerateTerraformRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> CanvasGenerateTerraformResponse:
    """Convert visual canvas blocks into production HashiCorp HCL with cost & security insights."""
    return IACCanvasService.generate_terraform(payload)


@router.post(
    "/apply",
    response_model=CanvasApplyResponse,
    summary="Plan and apply generated Terraform code",
)
async def apply_terraform_code(
    payload: CanvasApplyRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> CanvasApplyResponse:
    """Simulate or execute Terraform apply pipeline."""
    return IACCanvasService.apply_terraform(payload)
