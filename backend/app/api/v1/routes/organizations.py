"""Multi-Tenant Organization, Workspace, and Team RBAC API routes."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    TenantContext,
    get_current_active_user,
    get_db,
    get_tenant_context,
    require_tenant_admin,
)
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationInvitationResponse,
    OrganizationInviteCreate,
    OrganizationMemberResponse,
    OrganizationMemberUpdateRole,
    OrganizationResponse,
    OrganizationUpdate,
    TenantContextInfo,
)
from app.services.organization_service import OrganizationService

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
    "/invitations/{token}/accept",
    response_model=OrganizationResponse,
    summary="Accept an invitation and join organization",
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
