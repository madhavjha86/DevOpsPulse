"""Multi-Tenant Organization, Workspace, and Team RBAC API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_current_active_user,
    get_current_user_optional,
    get_db,
    get_tenant_context,
    require_tenant_admin,
)
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationInvitationResponse,
    OrganizationInviteAcceptPayload,
    OrganizationInviteAcceptResponse,
    OrganizationInviteCreate,
    OrganizationInviteVerifyResponse,
    OrganizationMemberResponse,
    OrganizationMemberUpdateRole,
    OrganizationResponse,
    OrganizationUpdate,
    PaginatedAuditLogsResponse,
    TenantContextInfo,
    WebhookCreateRequest,
    WebhookResponse,
    WebhookTestResponse,
)
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService
from app.services.webhook_dispatcher import WebhookDispatcher

router = APIRouter(prefix="/organizations", tags=["Multi-Tenant Organizations"])


@router.get(
    "",
    response_model=list[OrganizationResponse],
    summary="List all accessible workspaces (Personal and Company)",
)
async def list_organizations(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[OrganizationResponse]:
    """Retrieve all organizations where the user has active membership."""
    return await OrganizationService.list_user_organizations(db=db, user=current_user)


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Company or Team workspace",
)
async def create_organization(
    payload: OrganizationCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationResponse:
    """Create a new organization workspace. The creator is granted ORGANIZATION_ADMIN role."""
    return await OrganizationService.create_organization(
        db=db, user=current_user, payload=payload
    )


@router.get(
    "/active",
    response_model=TenantContextInfo,
    summary="Get active workspace and tenant authorization context",
)
async def get_active_tenant_context(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContextInfo:
    """Return active workspace boundary resolved via X-Organization-Id header or default membership."""
    return TenantContextInfo(
        organization_id=tenant.organization.id,
        organization_name=tenant.organization.name,
        organization_slug=tenant.organization.slug,
        organization_type=tenant.organization.type,
        user_role=tenant.role,
        is_admin=tenant.is_admin,
        is_devops=tenant.is_devops,
        is_security=tenant.is_security,
    )


@router.get(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Get organization workspace details",
)
async def get_organization(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationResponse:
    """Fetch organization profile and verify cross-tenant access permissions."""
    return await OrganizationService.get_organization(db=db, user=current_user, org_id=org_id)


@router.get(
    "/{org_id}/members",
    response_model=list[OrganizationMemberResponse],
    summary="List organization workspace members and assigned roles",
)
async def list_members(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[OrganizationMemberResponse]:
    """List all users in the organization with their assigned RBAC roles."""
    return await OrganizationService.list_members(db=db, user=current_user, org_id=org_id)


@router.put(
    "/{org_id}/members/{target_user_id}/role",
    response_model=OrganizationMemberResponse,
    summary="Assign or change role for an organization member",
)
async def update_member_role(
    org_id: int,
    target_user_id: int,
    payload: OrganizationMemberUpdateRole,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationMemberResponse:
    """Update role for a member. Requires ORGANIZATION_ADMIN or SUPER_ADMIN permissions."""
    return await OrganizationService.update_member_role(
        db=db,
        user=current_user,
        org_id=org_id,
        target_user_id=target_user_id,
        new_role=payload.role,
    )


@router.delete(
    "/{org_id}/members/{target_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from an organization workspace",
)
async def remove_member(
    org_id: int,
    target_user_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a member. Requires ORGANIZATION_ADMIN or member self-leaving."""
    await OrganizationService.remove_member(
        db=db, user=current_user, org_id=org_id, target_user_id=target_user_id
    )


@router.post(
    "/{org_id}/invitations",
    response_model=OrganizationInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a team member to the organization",
)
async def create_invitation(
    org_id: int,
    payload: OrganizationInviteCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInvitationResponse:
    """Send an invitation to join an organization with a designated role."""
    return await OrganizationService.create_invitation(
        db=db, user=current_user, org_id=org_id, payload=payload
    )


@router.get(
    "/{org_id}/invitations",
    response_model=list[OrganizationInvitationResponse],
    summary="List pending invitations for the organization",
)
async def list_invitations(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[OrganizationInvitationResponse]:
    """Retrieve all pending and active invitations."""
    return await OrganizationService.list_invitations(
        db=db, user=current_user, org_id=org_id
    )


@router.post(
    "/{org_id}/invitations/{invitation_id}/resend",
    response_model=OrganizationInvitationResponse,
    summary="Resend an invitation email and refresh expiration token",
)
async def resend_invitation(
    org_id: int,
    invitation_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInvitationResponse:
    """Regenerate single-use invitation token, refresh 48h expiry, and resend email."""
    return await OrganizationService.resend_invitation(
        db=db, user=current_user, org_id=org_id, invitation_id=invitation_id
    )


@router.post(
    "/{org_id}/invitations/{invitation_id}/revoke",
    response_model=OrganizationInvitationResponse,
    summary="Revoke an invitation",
)
async def revoke_invitation(
    org_id: int,
    invitation_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInvitationResponse:
    """Revoke a pending or expired invitation."""
    return await OrganizationService.revoke_invitation(
        db=db, user=current_user, org_id=org_id, invitation_id=invitation_id
    )


@router.delete(
    "/{org_id}/invitations/{invitation_id}",
    response_model=OrganizationInvitationResponse,
    summary="Revoke an invitation (DELETE)",
)
async def delete_invitation(
    org_id: int,
    invitation_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInvitationResponse:
    """Delete/revoke an invitation."""
    return await OrganizationService.revoke_invitation(
        db=db, user=current_user, org_id=org_id, invitation_id=invitation_id
    )


@router.get(
    "/invitations/verify",
    response_model=OrganizationInviteVerifyResponse,
    summary="Verify invitation token authenticity for onboarding",
)
async def verify_invitation(
    token: Annotated[str, Query(..., description="Raw invitation token")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInviteVerifyResponse:
    """Public verification endpoint to check if an invitation token is valid and unexpired."""
    return await OrganizationService.verify_invitation_token(db=db, token=token)


@router.post(
    "/invitations/accept",
    response_model=OrganizationInviteAcceptResponse,
    summary="Accept an invitation and complete onboarding / join workspace",
)
async def accept_invitation_onboarding(
    payload: OrganizationInviteAcceptPayload,
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationInviteAcceptResponse:
    """Accept an invitation, creating a new user (with custom password) or linking an existing user."""
    return await OrganizationService.accept_invitation_onboarding(
        db=db, payload=payload, current_user=current_user
    )


@router.post(
    "/invitations/{token}/accept",
    response_model=OrganizationResponse,
    summary="Legacy accept invitation endpoint",
)
async def accept_invitation(
    token: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationResponse:
    """Join an organization using a valid invitation token."""
    return await OrganizationService.accept_invitation(
        db=db, user=current_user, token=token
    )


@router.get(
    "/{org_id}/audit-logs",
    response_model=PaginatedAuditLogsResponse,
    summary="List organization audit logs and compliance activity",
)
async def list_organization_audit_logs(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    action: str | None = Query(default=None, description="Filter by event action (e.g. member.invited, member.role_updated)"),
    user_id: int | None = Query(default=None, description="Filter by actor user ID"),
    search: str | None = Query(default=None, description="Search keyword in action, details, or user email"),
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> PaginatedAuditLogsResponse:
    """Retrieve paginated audit trail records (requires Organization Admin or Security Engineer role)."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    logs_data = await AuditService.get_organization_audit_logs(
        db=db,
        organization_id=org_id,
        action=action,
        user_id=user_id,
        search=search,
        page=page,
        per_page=per_page,
    )
    return PaginatedAuditLogsResponse(**logs_data)


@router.get(
    "/{org_id}/audit-logs/export",
    summary="Export organization audit trail as CSV",
)
async def export_organization_audit_logs(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    action: str | None = Query(default=None, description="Filter by event action"),
    user_id: int | None = Query(default=None, description="Filter by actor user ID"),
    search: str | None = Query(default=None, description="Search keyword"),
) -> Response:
    """Download organization audit trail as CSV for compliance audits (SOC2 / ISO 27001)."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    csv_content = await AuditService.export_audit_logs_csv(
        db=db,
        organization_id=org_id,
        action=action,
        user_id=user_id,
        search=search,
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="devopspulse_audit_logs_org_{org_id}.csv"'
        },
    )


@router.get(
    "/{org_id}/webhooks",
    response_model=list[WebhookResponse],
    summary="List outbound alert webhooks",
)
async def list_organization_webhooks(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WebhookResponse]:
    """List configured outbound webhooks for Slack, Teams, Discord, and alerting."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    webhooks = await WebhookDispatcher.list_webhooks(db, org_id)
    return [
        WebhookResponse(
            id=w.id,
            organization_id=w.organization_id,
            name=w.name,
            target_type=w.target_type,
            url=w.url,
            events=[e.strip() for e in w.events.split(",") if e.strip()],
            has_secret=bool(w.secret),
            is_active=w.is_active,
            last_status_code=w.last_status_code,
            last_delivery_status=w.last_delivery_status,
            last_error=w.last_error,
            last_dispatched_at=w.last_dispatched_at,
            created_at=w.created_at,
        )
        for w in webhooks
    ]


@router.post(
    "/{org_id}/webhooks",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create outbound alert webhook",
)
async def create_organization_webhook(
    org_id: int,
    payload: WebhookCreateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WebhookResponse:
    """Register a new outbound notification channel for Slack, Discord, Teams, or Custom Webhooks."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    webhook = await WebhookDispatcher.create_webhook(
        db=db,
        organization_id=org_id,
        name=payload.name,
        target_type=payload.target_type,
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
    )
    # Log audit action
    await AuditService.log_action(
        db=db,
        action="webhook.created",
        organization_id=org_id,
        user_id=current_user.id,
        resource_type="webhook",
        resource_id=webhook.id,
        details={
            "name": webhook.name,
            "target_type": webhook.target_type,
            "events": webhook.events,
        },
    )
    return WebhookResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        name=webhook.name,
        target_type=webhook.target_type,
        url=webhook.url,
        events=[e.strip() for e in webhook.events.split(",") if e.strip()],
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        last_status_code=webhook.last_status_code,
        last_delivery_status=webhook.last_delivery_status,
        last_error=webhook.last_error,
        last_dispatched_at=webhook.last_dispatched_at,
        created_at=webhook.created_at,
    )


@router.delete(
    "/{org_id}/webhooks/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete outbound alert webhook",
)
async def delete_organization_webhook(
    org_id: int,
    webhook_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a configured outbound webhook."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    deleted = await WebhookDispatcher.delete_webhook(db, org_id, webhook_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook {webhook_id} not found in this organization.",
        )
    await AuditService.log_action(
        db=db,
        action="webhook.deleted",
        organization_id=org_id,
        user_id=current_user.id,
        resource_type="webhook",
        resource_id=webhook_id,
        details={"webhook_id": webhook_id},
    )


@router.post(
    "/{org_id}/webhooks/{webhook_id}/test",
    response_model=WebhookTestResponse,
    summary="Send test ping to webhook",
)
async def test_organization_webhook(
    org_id: int,
    webhook_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WebhookTestResponse:
    """Dispatch an immediate verification test alert to the webhook destination and report response status & latency."""
    await OrganizationService.require_org_security_or_admin(db, current_user, org_id)
    res = await WebhookDispatcher.send_test_ping(db, org_id, webhook_id)
    if not res.get("status_code") and res.get("message") == "Webhook not found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook {webhook_id} not found.",
        )
    return WebhookTestResponse(**res)
