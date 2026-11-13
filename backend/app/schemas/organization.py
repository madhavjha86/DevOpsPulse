"""Pydantic schemas for Multi-Tenant Organizations, Workspaces, and RBAC."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

from app.models.organization import OrganizationRole, OrganizationType


class OrganizationCreate(BaseModel):
    """Payload to create a new Company or Team workspace."""

    name: str = Field(..., min_length=2, max_length=100, description="Organization or workspace name")
    description: str | None = Field(default=None, max_length=1000)
    slug: str | None = Field(default=None, max_length=120)
    type: Literal["COMPANY", "PERSONAL"] = Field(default="COMPANY")


class OrganizationUpdate(BaseModel):
    """Payload to update an organization's profile."""

    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class OrganizationResponse(BaseModel):
    """Organization workspace details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    type: str  # PERSONAL or COMPANY
    owner_id: int
    description: str | None = None
    avatar_url: str | None = None
    is_active: bool
    current_user_role: str = "VIEWER"
    role: str = "VIEWER"
    member_count: int = 1
    created_at: datetime


class OrganizationMemberResponse(BaseModel):
    """User membership in an organization."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    user_id: int
    username: str
    email: str
    full_name: str | None = None
    user_email: str | None = None
    user_full_name: str | None = None
    role: str  # ORGANIZATION_ADMIN, DEVOPS_ENGINEER, DEVELOPER, SECURITY_ENGINEER, VIEWER
    joined_at: datetime
    created_at: datetime | None = None


class OrganizationMemberUpdateRole(BaseModel):
    """Change role for an organization member."""

    role: OrganizationRole = Field(..., description="Assigned tenant RBAC role")


class OrganizationInviteCreate(BaseModel):
    """Invite a user to an organization."""

    email: str = Field(..., description="Invitee's email address")
    role: OrganizationRole = Field(default=OrganizationRole.DEVELOPER, description="Role granted upon acceptance")


class OrganizationInvitationResponse(BaseModel):
    """Active or pending organization invitation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    organization_name: str | None = None
    email: str
    role: str
    token: str = Field(description="SHA-256 hashed token representation stored in database")
    status: str  # PENDING, ACCEPTED, REVOKED, EXPIRED
    invited_by_name: str | None = None
    expires_at: datetime
    created_at: datetime
    email_status: str = Field(
        default="EMAIL_NOT_CONFIGURED",
        description="Status of invitation dispatch: EMAIL_NOT_CONFIGURED, SENT, or FAILED",
    )
    invite_url: str | None = Field(
        default=None,
        description="Direct onboarding URL containing single-use token (provided when created/resent)",
    )
    raw_token: str | None = Field(
        default=None,
        description="Plaintext token provided once at dispatch for manual distribution",
    )


class OrganizationInviteVerifyResponse(BaseModel):
    """Public verification details for an invitation token."""

    valid: bool
    organization_id: int
    organization_name: str
    email: str
    role: str
    expires_at: datetime
    user_exists: bool
    existing_user_name: str | None = None


class OrganizationInviteAcceptPayload(BaseModel):
    """Payload to accept an invitation and onboard/join organization."""

    token: str = Field(..., description="Raw invitation token from email/link")
    password: str | None = Field(
        default=None,
        min_length=8,
        description="Password set by the newly onboarded user (required if user does not exist)",
    )
    full_name: str | None = Field(default=None, max_length=150)
    username: str | None = Field(default=None, min_length=3, max_length=50)


class OrganizationInviteAcceptResponse(BaseModel):
    """Result of accepting an invitation."""

    organization: OrganizationResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False
    message: str = "Successfully joined organization workspace"


class TenantContextInfo(BaseModel):
    """Context summary for current active workspace."""

    organization_id: int
    organization_name: str
    organization_slug: str
    organization_type: str
    user_role: str
    is_admin: bool
    is_devops: bool
    is_security: bool
