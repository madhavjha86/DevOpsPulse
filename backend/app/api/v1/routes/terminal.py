"""Web Terminal and Remote Shell Execution Routes."""

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import TenantContext, get_tenant_context_optional
from app.schemas.terminal import TerminalExecRequest, TerminalExecResponse, TerminalTargetItem
from app.services.terminal_service import TerminalService

router = APIRouter(prefix="/terminal", tags=["Terminal"])


@router.get(
    "/targets",
    response_model=list[TerminalTargetItem],
    summary="List available remote pods and containers for terminal connection",
)
async def list_terminal_targets(
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> list[TerminalTargetItem]:
    """Discover active Kubernetes pods, Docker containers, and host environments."""
    return TerminalService.get_available_targets()


@router.post(
    "/exec",
    response_model=TerminalExecResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute command inside remote pod or container",
)
async def execute_terminal_command(
    payload: TerminalExecRequest,
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
) -> TerminalExecResponse:
    """Safely execute shell commands with output capture and audit trail."""
    user_id = tenant.user.id if tenant and tenant.user else 1
    user_email = tenant.user.email if tenant and tenant.user else "devops@devopspulse.com"
    return await TerminalService.execute_command(
        user_id=user_id,
        user_email=user_email,
        req=payload,
    )


@router.get(
    "/history",
    summary="Get terminal execution audit logs",
)
async def get_terminal_history(
    tenant: Annotated[TenantContext | None, Depends(get_tenant_context_optional)] = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[dict[str, Any]]:
    """Retrieve audit history of executed terminal commands."""
    return TerminalService.get_audit_history(limit=limit)
