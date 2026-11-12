"""Business logic service for Multi-Tenant Organizations, Workspaces, and Member RBAC."""

from datetime import datetime, timedelta, timezone
import re
import secrets
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.organization import (
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    OrganizationRole,
    OrganizationType,
)
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationInvitationResponse,
    OrganizationInviteCreate,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUpdate,
)


class OrganizationService:
    """Manages tenant isolation, workspace lifecycle, memberships, and role assignments."""

    @classmethod
    async def generate_slug(cls, db: AsyncSession, name: str) -> str:
        """Create a URL-safe, unique organization slug."""
        base_slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if not base_slug:
            base_slug = "workspace"
        slug = base_slug
        counter = 1
        while True:
            res = await db.execute(select(Organization.id).where(Organization.slug == slug))
            if not res.scalar_one_or_none():
                return slug
            slug = f"{base_slug}-{counter}"
            counter += 1

    @classmethod
    async def ensure_personal_workspace(cls, db: AsyncSession, user: User) -> Organization:
        """Ensure an individual developer has an active Personal Workspace."""
        q = (
            select(Organization)
            .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
            .where(
                Organization.owner_id == user.id,
                Organization.type == OrganizationType.PERSONAL.value,
            )
        )
        res = await db.execute(q)
        org = res.scalars().first()
        if org:
            return org

        # Create personal workspace
        slug = await cls.generate_slug(db, f"personal-{user.id}")
        org = Organization(
            name=f"{user.full_name or user.username}'s Personal Workspace",
            slug=slug,
            type=OrganizationType.PERSONAL.value,
            owner_id=user.id,
            description="Individual developer workspace for personal repositories and telemetry.",
            is_active=True,
        )
        db.add(org)
        await db.flush()

        member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=OrganizationRole.ORGANIZATION_ADMIN.value,
        )
        db.add(member)
        await db.commit()
        await db.refresh(org)
        return org

    @classmethod
    async def list_user_organizations(
        cls, db: AsyncSession, user: User
    ) -> list[OrganizationResponse]:
        """Return all workspaces (Personal & Company) accessible by the authenticated user."""
        await cls.ensure_personal_workspace(db, user)

        if user.is_superuser:
            # Super admins can see all organizations
            org_res = await db.execute(select(Organization).order_by(Organization.id.asc()))
            orgs = org_res.scalars().all()
            results: list[OrganizationResponse] = []
            for org in orgs:
                count_res = await db.execute(
                    select(func.count(OrganizationMember.id)).where(OrganizationMember.organization_id == org.id)
                )
                m_count = count_res.scalar() or 1

                # Check user's specific role if a member, else default to SUPER_ADMIN
                role_res = await db.execute(
                    select(OrganizationMember.role).where(
                        OrganizationMember.organization_id == org.id,
                        OrganizationMember.user_id == user.id,
                    )
                )
                r_val = role_res.scalar() or OrganizationRole.SUPER_ADMIN.value

                results.append(
                    OrganizationResponse(
                        id=org.id,
                        name=org.name,
                        slug=org.slug,
                        type=org.type,
                        owner_id=org.owner_id,
                        description=org.description,
                        avatar_url=org.avatar_url,
                        is_active=org.is_active,
                        current_user_role=r_val,
                        member_count=m_count,
                        created_at=org.created_at,
                    )
                )
            return results

        # Regular user: fetch memberships
        q = (
            select(Organization, OrganizationMember.role)
            .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user.id, Organization.is_active.is_(True))
            .order_by(Organization.type.desc(), Organization.id.asc())
        )
        res = await db.execute(q)
        rows = res.all()

        results = []
        for org, role in rows:
            count_res = await db.execute(
                select(func.count(OrganizationMember.id)).where(OrganizationMember.organization_id == org.id)
            )
            m_count = count_res.scalar() or 1
            results.append(
                OrganizationResponse(
                    id=org.id,
                    name=org.name,
                    slug=org.slug,
                    type=org.type,
                    owner_id=org.owner_id,
                    description=org.description,
                    avatar_url=org.avatar_url,
                    is_active=org.is_active,
                    current_user_role=role,
                    member_count=m_count,
                    created_at=org.created_at,
                )
            )
        return results

    @classmethod
    async def create_organization(
        cls, db: AsyncSession, user: User, payload: OrganizationCreate
    ) -> OrganizationResponse:
        """Register a new Company Workspace and assign the creator as ORGANIZATION_ADMIN."""
        slug = payload.slug or await cls.generate_slug(db, payload.name)
        org = Organization(
            name=payload.name,
            slug=slug,
            type=payload.type,
            owner_id=user.id,
            description=payload.description,
            is_active=True,
        )
        db.add(org)
        await db.flush()

        # Creator is always Organization Admin
        member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=OrganizationRole.ORGANIZATION_ADMIN.value,
        )
        db.add(member)
        await db.commit()
        await db.refresh(org)

        return OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            type=org.type,
            owner_id=org.owner_id,
            description=org.description,
            avatar_url=org.avatar_url,
            is_active=org.is_active,
            current_user_role=OrganizationRole.ORGANIZATION_ADMIN.value,
            member_count=1,
            created_at=org.created_at,
        )

    @classmethod
    async def get_organization(
        cls, db: AsyncSession, user: User, org_id: int
    ) -> OrganizationResponse:
        """Retrieve organization details and verify tenant authorization."""
        org_res = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_res.scalar_one_or_none()
        if not org:
            raise NotFoundException(detail=f"Organization {org_id} not found.")

        # Check membership
        role_res = await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user.id,
            )
        )
        role = role_res.scalar_one_or_none()
        if not role and not user.is_superuser:
            raise ForbiddenException(detail=f"Cross-tenant access denied: You do not belong to organization {org_id}.")

        effective_role = role or OrganizationRole.SUPER_ADMIN.value
        count_res = await db.execute(
            select(func.count(OrganizationMember.id)).where(OrganizationMember.organization_id == org_id)
        )
        m_count = count_res.scalar() or 1

        return OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            type=org.type,
            owner_id=org.owner_id,
            description=org.description,
            avatar_url=org.avatar_url,
            is_active=org.is_active,
            current_user_role=effective_role,
            member_count=m_count,
            created_at=org.created_at,
        )

    @classmethod
    async def list_members(
        cls, db: AsyncSession, user: User, org_id: int
    ) -> list[OrganizationMemberResponse]:
        """List all team members of an organization."""
        # Ensure user is member or superuser
        await cls.get_organization(db, user, org_id)

        q = (
            select(OrganizationMember, User)
            .join(User, OrganizationMember.user_id == User.id)
            .where(OrganizationMember.organization_id == org_id)
            .order_by(OrganizationMember.id.asc())
        )
        res = await db.execute(q)
        rows = res.all()

        return [
            OrganizationMemberResponse(
                id=m.id,
                organization_id=m.organization_id,
                user_id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                user_email=u.email,
                user_full_name=u.full_name,
                role=m.role,
                joined_at=m.joined_at,
                created_at=m.created_at,
            )
            for m, u in rows
        ]

    @classmethod
    async def update_member_role(
        cls, db: AsyncSession, user: User, org_id: int, target_user_id: int, new_role: OrganizationRole
    ) -> OrganizationMemberResponse:
        """Update a member's role within an organization (requires ORGANIZATION_ADMIN)."""
        await cls.require_org_admin(db, user, org_id)

        member_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == target_user_id,
            )
        )
        member = member_res.scalar_one_or_none()
        if not member:
            raise NotFoundException(detail=f"Member with user ID {target_user_id} not found in this organization.")

        if new_role.value == OrganizationRole.SUPER_ADMIN.value and not user.is_superuser:
            raise ForbiddenException(detail="Only Super Administrators can assign the SUPER_ADMIN role.")

        member.role = new_role.value
        await db.commit()
        await db.refresh(member)

        user_res = await db.execute(select(User).where(User.id == target_user_id))
        target_user = user_res.scalar_one()

        return OrganizationMemberResponse(
            id=member.id,
            organization_id=member.organization_id,
            user_id=target_user.id,
            username=target_user.username,
            email=target_user.email,
            full_name=target_user.full_name,
            user_email=target_user.email,
            user_full_name=target_user.full_name,
            role=member.role,
            joined_at=member.joined_at,
            created_at=member.created_at,
        )

    @classmethod
    async def remove_member(
        cls, db: AsyncSession, user: User, org_id: int, target_user_id: int
    ) -> None:
        """Remove a member from an organization."""
        # Member can remove themselves, or admin can remove
        if user.id != target_user_id:
            await cls.require_org_admin(db, user, org_id)

        org_res = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_res.scalar_one_or_none()
        if org and org.owner_id == target_user_id:
            raise BadRequestException(detail="Cannot remove organization owner. Transfer ownership first.")

        member_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == target_user_id,
            )
        )
        member = member_res.scalar_one_or_none()
        if not member:
            raise NotFoundException(detail="Member not found in organization.")

        await db.delete(member)
        await db.commit()

    @classmethod
    async def create_invitation(
        cls, db: AsyncSession, user: User, org_id: int, payload: OrganizationInviteCreate
    ) -> OrganizationInvitationResponse:
        """Invite a colleague to a company organization workspace."""
        await cls.require_org_admin(db, user, org_id)

        email_clean = payload.email.strip().lower()

        # Check if already member
        existing_user_res = await db.execute(select(User).where(User.email == email_clean))
        existing_user = existing_user_res.scalar_one_or_none()
        if existing_user:
            m_res = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.user_id == existing_user.id,
                )
            )
            if m_res.scalar_one_or_none():
                raise BadRequestException(detail=f"User {email_clean} is already a member of this organization.")

        if payload.role.value == OrganizationRole.SUPER_ADMIN.value and not user.is_superuser:
            raise ForbiddenException(detail="Only Super Administrators can invite users with the SUPER_ADMIN role.")

        token = secrets.token_urlsafe(32)
        invitation = OrganizationInvitation(
            organization_id=org_id,
            email=email_clean,
            role=payload.role.value,
            token=token,
            invited_by_id=user.id,
            status="PENDING",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        org_res = await db.execute(select(Organization.name).where(Organization.id == org_id))
        org_name = org_res.scalar()

        return OrganizationInvitationResponse(
            id=invitation.id,
            organization_id=invitation.organization_id,
            organization_name=org_name,
            email=invitation.email,
            role=invitation.role,
            token=invitation.token,
            status=invitation.status,
            invited_by_name=user.full_name or user.username,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
        )

    @classmethod
    async def list_invitations(
        cls, db: AsyncSession, user: User, org_id: int
    ) -> list[OrganizationInvitationResponse]:
        """List active and pending invitations for an organization."""
        await cls.require_org_admin(db, user, org_id)

        q = (
            select(OrganizationInvitation, Organization.name, User.full_name, User.username)
            .join(Organization, OrganizationInvitation.organization_id == Organization.id)
            .join(User, OrganizationInvitation.invited_by_id == User.id)
            .where(OrganizationInvitation.organization_id == org_id)
            .order_by(OrganizationInvitation.id.desc())
        )
        res = await db.execute(q)
        rows = res.all()

        return [
            OrganizationInvitationResponse(
                id=inv.id,
                organization_id=inv.organization_id,
                organization_name=org_name,
                email=inv.email,
                role=inv.role,
                token=inv.token,
                status=inv.status,
                invited_by_name=fn or un,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
            )
            for inv, org_name, fn, un in rows
        ]

    @classmethod
    async def accept_invitation(
        cls, db: AsyncSession, user: User, token: str
    ) -> OrganizationResponse:
        """Accept an invitation token and join the organization with assigned role."""
        inv_res = await db.execute(
            select(OrganizationInvitation).where(
                OrganizationInvitation.token == token,
                OrganizationInvitation.status == "PENDING",
            )
        )
        inv = inv_res.scalar_one_or_none()
        if not inv:
            raise NotFoundException(detail="Invalid or expired invitation token.")

        if inv.expires_at < datetime.now(timezone.utc):
            inv.status = "EXPIRED"
            await db.commit()
            raise BadRequestException(detail="This invitation token has expired.")

        # Check existing membership
        existing_m_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == inv.organization_id,
                OrganizationMember.user_id == user.id,
            )
        )
        existing_m = existing_m_res.scalar_one_or_none()
        if not existing_m:
            new_m = OrganizationMember(
                organization_id=inv.organization_id,
                user_id=user.id,
                role=inv.role,
            )
            db.add(new_m)

        inv.status = "ACCEPTED"
        await db.commit()

        return await cls.get_organization(db, user, inv.organization_id)

    @classmethod
    async def require_org_admin(
        cls, db: AsyncSession, user: User, org_id: int
    ) -> OrganizationMember:
        """Enforce that the user is an ORGANIZATION_ADMIN or platform SUPER_ADMIN."""
        if user.is_superuser:
            # Grant access as platform superuser
            return OrganizationMember(
                organization_id=org_id,
                user_id=user.id,
                role=OrganizationRole.SUPER_ADMIN.value,
            )

        q = select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user.id,
        )
        res = await db.execute(q)
        member = res.scalar_one_or_none()
        if not member or member.role != OrganizationRole.ORGANIZATION_ADMIN.value:
            raise ForbiddenException(
                detail="Organization Administrator privileges required for this action."
            )
        return member

    @classmethod
    async def resolve_tenant_context(
        cls, db: AsyncSession, user: User, requested_org_id: int | None = None
    ) -> tuple[Organization, str]:
        """Resolve target tenant workspace and verify user membership."""
        if requested_org_id:
            # User explicitly requested an organization
            org_res = await db.execute(select(Organization).where(Organization.id == requested_org_id))
            org = org_res.scalar_one_or_none()
            if not org:
                raise NotFoundException(detail=f"Requested organization {requested_org_id} not found.")

            if user.is_superuser:
                return org, OrganizationRole.SUPER_ADMIN.value

            m_res = await db.execute(
                select(OrganizationMember.role).where(
                    OrganizationMember.organization_id == requested_org_id,
                    OrganizationMember.user_id == user.id,
                )
            )
            role = m_res.scalar_one_or_none()
            if not role:
                raise ForbiddenException(
                    detail=f"Cross-tenant access denied: You do not belong to organization '{org.name}' (ID: {requested_org_id})."
                )
            return org, role

        # Fallback to user's personal organization or primary membership
        q = (
            select(Organization, OrganizationMember.role)
            .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user.id, Organization.is_active.is_(True))
            .order_by(Organization.type.desc(), Organization.id.asc())
        )
        res = await db.execute(q)
        first_row = res.first()
        if first_row:
            return first_row[0], first_row[1]

        # No org found; automatically create personal workspace
        personal_org = await cls.ensure_personal_workspace(db, user)
        return personal_org, OrganizationRole.ORGANIZATION_ADMIN.value
