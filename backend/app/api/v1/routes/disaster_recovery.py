"""Disaster Recovery (DR), Backup Verification, and API Key Governance API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_db,
    get_tenant_context,
    require_tenant_developer,
)
from app.schemas.disaster_recovery_and_keys import (
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyResponse,
    BackupCreateRequest,
    BackupRecordResponse,
    DisasterRecoveryOverviewResponse,
    DrillResponse,
    DrillRunRequest,
)
from app.services.disaster_recovery_service import DisasterRecoveryService

router = APIRouter(prefix="/disaster-recovery", tags=["Disaster Recovery & API Key Governance"])


@router.get(
    "/overview",
    response_model=DisasterRecoveryOverviewResponse,
    summary="Get Disaster Recovery readiness scorecard and verification history",
)
async def get_dr_overview(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DisasterRecoveryOverviewResponse:
    """Return RPO/RTO metrics, recovery readiness score, certified drills, and backup snapshots."""
    return await DisasterRecoveryService.get_overview(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/drills",
    response_model=DrillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute disaster recovery verification drill",
)
async def execute_dr_drill(
    payload: DrillRunRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DrillResponse:
    """Trigger an actual disaster recovery test drill and record measured RPO/RTO."""
    return await DisasterRecoveryService.execute_drill(
        db=db, user_id=tenant.user.id, payload=payload, organization_id=tenant.organization_id
    )


@router.post(
    "/backups",
    response_model=BackupRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger on-demand database backup snapshot",
)
async def create_backup(
    payload: BackupCreateRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BackupRecordResponse:
    """Create a verifiable database backup snapshot and generate SHA-256 integrity hash."""
    return await DisasterRecoveryService.create_backup(
        db=db, user_id=tenant.user.id, payload=payload, organization_id=tenant.organization_id
    )


# ---------------------------------------------------------------------------
# Scoped Organization API Keys
# ---------------------------------------------------------------------------


@router.get(
    "/api-keys",
    response_model=list[ApiKeyResponse],
    summary="List organization API keys",
)
async def list_api_keys(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ApiKeyResponse]:
    """Retrieve active and revoked organization API keys."""
    return await DisasterRecoveryService.list_api_keys(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create scoped organization API key",
)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKeyCreatedResponse:
    """Create a secure SHA-256 hashed API key token (returned once upon generation)."""
    return await DisasterRecoveryService.create_api_key(
        db=db, user_id=tenant.user.id, payload=payload, organization_id=tenant.organization_id
    )


@router.delete(
    "/api-keys/{key_id}",
    response_model=ApiKeyResponse,
    summary="Revoke an organization API key",
)
async def revoke_api_key(
    key_id: int,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKeyResponse:
    """Revoke an active API key token immediately."""
    key = await DisasterRecoveryService.revoke_api_key(
        db=db, key_id=key_id, organization_id=tenant.organization_id
    )
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key {key_id} not found.",
        )
    return key
