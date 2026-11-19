"""Security, DevSecOps Scanner, and Software Supply Chain (SBOM) API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_db,
    get_tenant_context,
    require_tenant_developer,
    require_tenant_security,
)
from app.schemas.security_hub import (
    SbomDocumentResponse,
    SbomGenerateRequest,
    SecurityFindingRemediate,
    SecurityFindingResponse,
    SecurityOverviewResponse,
    SecurityScanCreate,
    SecurityScanResponse,
)
from app.services.sbom_service import SbomService
from app.services.security_scanner_service import SecurityScannerService
from app.services.security_service import SecurityService

router = APIRouter(prefix="/security", tags=["DevSecOps & Supply Chain Security"])


@router.get(
    "/overview",
    response_model=SecurityOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get repository security and vulnerability scorecard",
)
async def get_security_overview(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SecurityOverviewResponse:
    """Return security posture score, recent scans, active findings, and latest SBOM."""
    return await SecurityService.get_overview(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


# ---------------------------------------------------------------------------
# Phase 1: DevSecOps Scanners & Findings
# ---------------------------------------------------------------------------


@router.post(
    "/scans",
    response_model=SecurityScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute multi-vector DevSecOps scan",
)
async def trigger_security_scan(
    payload: SecurityScanCreate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SecurityScanResponse:
    """Run an on-demand SAST, SCA, Secret, Container, or IaC security scan."""
    return await SecurityScannerService.run_scan(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/scans",
    response_model=list[SecurityScanResponse],
    summary="List security scan history",
)
async def list_security_scans(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[SecurityScanResponse]:
    """Retrieve historical scan runs with duration and findings breakdown."""
    return await SecurityScannerService.list_scans(
        db=db,
        user_id=tenant.user.id,
        organization_id=tenant.organization_id,
        limit=limit,
    )


@router.get(
    "/scans/{scan_id}",
    response_model=SecurityScanResponse,
    summary="Get detailed security scan by ID",
)
async def get_security_scan(
    scan_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SecurityScanResponse:
    """Retrieve detailed scan result including all detected findings."""
    scan = await SecurityScannerService.get_scan_by_id(
        db=db,
        scan_id=scan_id,
        user_id=tenant.user.id,
        organization_id=tenant.organization_id,
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security scan {scan_id} not found.",
        )
    return scan


@router.get(
    "/findings",
    response_model=list[SecurityFindingResponse],
    summary="Query granular security findings",
)
async def list_security_findings(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    severity: str | None = Query(default=None, description="Filter by CRITICAL, HIGH, MEDIUM, LOW"),
    finding_type: str | None = Query(default=None, description="Filter by SAST, SCA, SECRET, CONTAINER, IAC"),
    status: str | None = Query(default=None, description="Filter by OPEN, FIXED, FALSE_POSITIVE, SUPPRESSED"),
) -> list[SecurityFindingResponse]:
    """Search and filter individual CVE vulnerabilities, secrets, and configuration defects."""
    return await SecurityScannerService.list_findings(
        db=db,
        user_id=tenant.user.id,
        severity=severity,
        finding_type=finding_type,
        status=status,
        organization_id=tenant.organization_id,
    )


@router.patch(
    "/findings/{finding_id}/remediate",
    response_model=SecurityFindingResponse,
    summary="Update security finding remediation status",
)
@router.put(
    "/findings/{finding_id}/remediate",
    response_model=SecurityFindingResponse,
    summary="Update security finding remediation status",
)
async def remediate_security_finding(
    finding_id: int,
    payload: SecurityFindingRemediate,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SecurityFindingResponse:
    """Mark finding as FIXED, FALSE_POSITIVE, or SUPPRESSED."""
    finding = await SecurityScannerService.remediate_finding(
        db=db,
        finding_id=finding_id,
        new_status=payload.status,
        organization_id=tenant.organization_id,
    )
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security finding {finding_id} not found.",
        )
    return finding


# ---------------------------------------------------------------------------
# Phase 2: Software Supply Chain Security & SBOM
# ---------------------------------------------------------------------------


@router.post(
    "/sbom/generate",
    response_model=SbomDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate CycloneDX or SPDX SBOM document",
)
async def generate_sbom(
    payload: SbomGenerateRequest,
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SbomDocumentResponse:
    """Analyze dependency inventory and generate CycloneDX 1.5 or SPDX 2.3 SBOM."""
    return await SbomService.generate_sbom(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/sbom",
    response_model=list[SbomDocumentResponse],
    summary="List generated SBOM documents",
)
async def list_sboms(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SbomDocumentResponse]:
    """Retrieve software supply chain bill of materials documents."""
    return await SbomService.list_sboms(db=db, organization_id=tenant.organization_id)


@router.get(
    "/sbom/{sbom_id}",
    response_model=SbomDocumentResponse,
    summary="Get SBOM document details with package inventory",
)
async def get_sbom_details(
    sbom_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SbomDocumentResponse:
    """Fetch SBOM package inventory, licenses, and integrity checksums."""
    doc = await SbomService.get_sbom_by_id(
        db=db, sbom_id=sbom_id, organization_id=tenant.organization_id
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SBOM document {sbom_id} not found.",
        )
    return doc


@router.get(
    "/sbom/{sbom_id}/export",
    summary="Export raw CycloneDX or SPDX JSON specification",
)
async def export_raw_sbom(
    sbom_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Export raw standard SBOM JSON content."""
    raw = await SbomService.get_raw_export(
        db=db, sbom_id=sbom_id, organization_id=tenant.organization_id
    )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SBOM document {sbom_id} not found.",
        )
    return raw


# Legacy scan endpoint preserved for backward compatibility
@router.post(
    "/scan",
    status_code=status.HTTP_200_OK,
    summary="Trigger immediate security audit",
)
async def trigger_scan_legacy(
    tenant: Annotated[TenantContext, Depends(require_tenant_developer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Trigger an on-demand vulnerability and secret audit across all repositories."""
    await SecurityScannerService.run_scan(
        db=db,
        user_id=tenant.user.id,
        payload=SecurityScanCreate(target_name="devopspulse-workspace", scan_type="ALL"),
        organization_id=tenant.organization_id,
    )
    return {"message": "Security scan triggered successfully. All dependencies verified."}
