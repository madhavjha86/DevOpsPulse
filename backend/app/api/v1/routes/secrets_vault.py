"""Zero-Trust Secrets Vault and Environment Sync API Routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import TenantContext, get_tenant_context, require_tenant_admin, require_tenant_devops
from app.schemas.secrets_vault import (
    SecretCreateRequest,
    SecretItem,
    SecretLeakScanResult,
    SecretRevealResponse,
    SecretSyncK8sRequest,
    SecretSyncK8sResponse,
)
from app.services.secrets_vault_service import SecretsVaultService

router = APIRouter(prefix="/secrets/vault", tags=["Secrets Vault"])


@router.get(
    "",
    response_model=list[SecretItem],
    summary="List masked secrets in vault across environments",
)
async def list_secrets(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    environment: str | None = Query(default=None, description="Filter by environment (development/staging/production)"),
) -> list[SecretItem]:
    """Retrieve all masked credentials with metadata."""
    return SecretsVaultService.list_secrets(environment=environment)


@router.post(
    "",
    response_model=SecretItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create and encrypt a new secret",
)
async def create_secret(
    payload: SecretCreateRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> SecretItem:
    """Store sensitive API keys, DB credentials, or tokens."""
    return SecretsVaultService.create_secret(payload)


@router.get(
    "/{secret_id}/reveal",
    response_model=SecretRevealResponse,
    summary="Reveal unmasked secret value (Admin/DevOps only)",
)
async def reveal_secret(
    secret_id: str,
    tenant: Annotated[TenantContext, Depends(require_tenant_admin)],
) -> SecretRevealResponse:
    """Authorized unmasking with audit logging."""
    try:
        return SecretsVaultService.reveal_secret(secret_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{secret_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a secret from vault",
)
async def delete_secret(
    secret_id: str,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> None:
    """Permanently delete an encrypted secret."""
    SecretsVaultService.delete_secret(secret_id)


@router.post(
    "/leak-scan",
    response_model=SecretLeakScanResult,
    summary="Run automated secret leak scanner across codebase and commits",
)
async def run_secret_leak_scan(
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> SecretLeakScanResult:
    """Scan repositories for exposed API tokens and hardcoded credentials."""
    return SecretsVaultService.run_leak_scan()


@router.post(
    "/sync-k8s",
    response_model=SecretSyncK8sResponse,
    summary="1-Click inject vault secrets into a Kubernetes Secret object",
)
async def sync_secrets_to_kubernetes(
    payload: SecretSyncK8sRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_devops)],
) -> SecretSyncK8sResponse:
    """Reconcile and inject environment secrets into cluster pod environment."""
    return SecretsVaultService.sync_to_k8s(payload)
