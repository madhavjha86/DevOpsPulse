"""AI Closed-Loop Auto-Remediation Routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import TenantContext, get_tenant_context, require_tenant_devops
from app.schemas.ai_remediation import (
    AIRemediationActionRequest,
    AIRemediationGenerateRequest,
    AIRemediationItem,
)
from app.services.ai_remediation_service import AIRemediationService

router = APIRouter(prefix="/ai/remediations", tags=["AI Remediation"])


@router.get(
    "",
    response_model=list[AIRemediationItem],
    summary="List all AI self-healing remediation proposals and audit history",
)
async def list_remediations(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> list[AIRemediationItem]:
    """Retrieve all pending, executed, and rejected self-healing actions."""
    return AIRemediationService.list_remediations()


@router.post(
    "/generate",
    response_model=AIRemediationItem,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI-powered remediation proposal for an incident or crash",
)
async def generate_remediation(
    payload: AIRemediationGenerateRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> AIRemediationItem:
    """Analyze error or alert context to produce a 1-click self-healing action."""
    return AIRemediationService.generate_remediation_proposal(payload)


@router.post(
    "/{remediation_id}/approve",
    response_model=AIRemediationItem,
    summary="Approve and execute a closed-loop remediation proposal",
)
async def approve_remediation(
    remediation_id: str,
    payload: AIRemediationActionRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> AIRemediationItem:
    """Execute live 1-click mitigation (memory bump, rollback, or pod restart)."""
    try:
        return AIRemediationService.execute_remediation(
            remediation_id=remediation_id,
            user_email=tenant.user.email,
            req=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{remediation_id}/reject",
    response_model=AIRemediationItem,
    summary="Reject and dismiss a remediation proposal",
)
async def reject_remediation(
    remediation_id: str,
    payload: AIRemediationActionRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> AIRemediationItem:
    """Reject a proposed remediation with optional reason notes."""
    try:
        return AIRemediationService.reject_remediation(
            remediation_id=remediation_id,
            user_email=tenant.user.email,
            req=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
