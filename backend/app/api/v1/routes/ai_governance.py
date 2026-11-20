"""Enterprise AI Governance, Token FinOps, and Cost Attribution API Routes."""

from __future__ import annotations

import csv
import io
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.models.user import User
from app.schemas.ai_governance import (
    AIGovernanceSummaryResponse,
    AITokenIngestRequest,
    AIUserQuotaUpdateRequest,
)
from app.services.ai_governance_service import AIGovernanceService

router = APIRouter(prefix="/ai-governance", tags=["Enterprise AI Governance"])


@router.get("/summary", response_model=AIGovernanceSummaryResponse)
async def get_governance_summary(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    timeframe: int = Query(default=30, ge=1, le=365, description="Timeframe in days"),
):
    """Retrieve complete enterprise AI FinOps metrics, employee breakdown, and model distributions."""
    org_id = tenant.organization_id or 1
    summary_data = await AIGovernanceService.get_governance_summary(
        db=db,
        organization_id=org_id,
        user_id=tenant.user.id,
        timeframe_days=timeframe,
    )
    return summary_data


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_external_tokens(
    payload: AITokenIngestRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ingest AI token consumption telemetry from Claude Code, Cursor IDE, Codex, or developer proxies."""
    org_id = tenant.organization_id or 1

    # Resolve user: by email if provided, otherwise default to authenticated user
    target_user_id = tenant.user.id
    if payload.user_email:
        user_res = await db.execute(select(User).where(User.email == payload.user_email.strip().lower()))
        matched_user = user_res.scalar_one_or_none()
        if matched_user:
            target_user_id = matched_user.id

    ledger = await AIGovernanceService.record_usage(
        db=db,
        organization_id=org_id,
        user_id=target_user_id,
        tool_name=payload.tool_name,
        provider=payload.provider,
        model_name=payload.model_name,
        prompt_tokens=payload.prompt_tokens,
        completion_tokens=payload.completion_tokens,
        latency_ms=payload.latency_ms,
        session_id=payload.session_id,
        client_metadata=payload.client_metadata,
    )

    return {
        "status": "recorded",
        "ledger_id": ledger.id,
        "total_tokens": ledger.total_tokens,
        "estimated_cost_usd": ledger.estimated_cost_usd,
    }


@router.put("/users/{target_user_id}/quota")
async def update_employee_quota(
    target_user_id: int,
    payload: AIUserQuotaUpdateRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Adjust individual monthly budget limit and enforcement for an employee / developer."""
    org_id = tenant.organization_id or 1
    quota = await AIGovernanceService.update_quota(
        db=db,
        organization_id=org_id,
        target_user_id=target_user_id,
        monthly_cost_limit_usd=payload.monthly_cost_limit_usd,
        monthly_token_limit=payload.monthly_token_limit,
        enforcement_action=payload.enforcement_action,
    )
    return {
        "status": "updated",
        "user_id": quota.user_id,
        "monthly_cost_limit_usd": quota.monthly_cost_limit_usd,
        "monthly_token_limit": quota.monthly_token_limit,
        "enforcement_action": quota.enforcement_action,
    }


@router.get("/export")
async def export_governance_csv(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    timeframe: int = Query(default=30, ge=1, le=365),
):
    """Export complete AI Token & Cost attribution report for Finance / Engineering Management in CSV format."""
    org_id = tenant.organization_id or 1
    summary_data = await AIGovernanceService.get_governance_summary(
        db=db,
        organization_id=org_id,
        user_id=tenant.user.id,
        timeframe_days=timeframe,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Headers
    writer.writerow([
        "Employee Name",
        "Email",
        "Role",
        "Total Tokens",
        "Prompt Tokens",
        "Completion Tokens",
        "Total Cost (USD)",
        "Requests Count",
        "Monthly Cost Budget ($)",
        "Budget Used (%)",
        "Budget Status",
    ])

    for emp in summary_data.get("employees", []):
        writer.writerow([
            emp["name"],
            emp["email"],
            emp["role"],
            emp["total_tokens"],
            emp["prompt_tokens"],
            emp["completion_tokens"],
            f"${emp['total_cost_usd']:.4f}",
            emp["requests_count"],
            f"${emp['monthly_cost_limit']:.2f}",
            f"{emp['budget_used_percentage']:.1f}%",
            emp["budget_status"],
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=devopspulse-ai-governance-{timeframe}d.csv"},
    )
