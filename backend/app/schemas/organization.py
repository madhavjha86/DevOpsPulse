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
    token: str
    status: str
    invited_by_name: str | None = None
    expires_at: datetime
    created_at: datetime


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
