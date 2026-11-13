"""Business logic service for Multi-Tenant Organizations, Workspaces, and Member RBAC."""

from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
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
    OrganizationInviteAcceptPayload,
    OrganizationInviteAcceptResponse,
    OrganizationInviteCreate,
    OrganizationInviteVerifyResponse,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.services.audit_service import AuditService
from app.services.email_service import EmailService


class OrganizationService:
    """Manages tenant isolation, workspace lifecycle, memberships, and role assignments."""

    @classmethod
    def hash_token(cls, token: str) -> str:
        """Deterministic SHA-256 hash for secure database storage."""
        return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()

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
                        role=r_val,
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
                    role=role,
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
        await AuditService.log_action(
            db=db,
            action="organization.member.role_updated",
            organization_id=org_id,
            user_id=user.id,
            resource_type="organization_member",
            resource_id=member.id,
            details={"target_user_id": target_user_id, "new_role": new_role.value},
        )
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
        await AuditService.log_action(
            db=db,
            action="organization.member.removed",
            organization_id=org_id,
            user_id=user.id,
            resource_type="organization_member",
            resource_id=member.id,
            details={"target_user_id": target_user_id},
        )
        await db.commit()

    @classmethod
    async def create_invitation(
        cls, db: AsyncSession, user: User, org_id: int, payload: OrganizationInviteCreate
    ) -> OrganizationInvitationResponse:
        """Invite a colleague to a company organization workspace with 48h expiry and hashed token."""
        await cls.require_org_admin(db, user, org_id)

        email_clean = payload.email.strip().lower()

        # Check if already an active member of this organization
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

        # RBAC: Only Super Administrators can invite users with the SUPER_ADMIN role
        if payload.role.value == OrganizationRole.SUPER_ADMIN.value and not user.is_superuser:
            raise ForbiddenException(detail="Only Super Administrators can invite users with the SUPER_ADMIN role.")

        # Revoke any prior pending invitation for this (org_id, email)
        prior_res = await db.execute(
            select(OrganizationInvitation).where(
                OrganizationInvitation.organization_id == org_id,
                OrganizationInvitation.email == email_clean,
                OrganizationInvitation.status == "PENDING",
            )
        )
        for prior_inv in prior_res.scalars().all():
            prior_inv.status = "REVOKED"

        # Generate secure random token and store SHA-256 hash
        raw_token = secrets.token_urlsafe(32)
        token_hash = cls.hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

        invitation = OrganizationInvitation(
            organization_id=org_id,
            email=email_clean,
            role=payload.role.value,
            token=token_hash,
            invited_by_id=user.id,
            status="PENDING",
            expires_at=expires_at,
        )
        db.add(invitation)
        await db.flush()

        org_res = await db.execute(select(Organization.name).where(Organization.id == org_id))
        org_name = org_res.scalar() or "Workspace"

        settings = get_settings()
        invite_url = f"{settings.FRONTEND_URL}/invitations/accept?token={raw_token}"

        # Dispatch email through configured SMTP provider
        _, email_status = EmailService.send_invitation_email(
            to_email=email_clean,
            org_name=org_name,
            role=payload.role.value,
            inviter_name=user.full_name or user.username,
            invite_url=invite_url,
            expires_hours=48,
        )

        await AuditService.log_action(
            db=db,
            action="organization.invitation.created",
            organization_id=org_id,
            user_id=user.id,
            resource_type="organization_invitation",
            resource_id=invitation.id,
            details={
                "email": email_clean,
                "role": payload.role.value,
                "email_status": email_status,
                "expires_at": expires_at.isoformat(),
            },
        )
        await db.commit()
        await db.refresh(invitation)

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
            email_status=email_status,
            invite_url=invite_url,
            raw_token=raw_token,
        )

    @classmethod
    async def resend_invitation(
        cls, db: AsyncSession, user: User, org_id: int, invitation_id: int
    ) -> OrganizationInvitationResponse:
        """Regenerate single-use token, refresh 48h expiry, and resend invitation email."""
        await cls.require_org_admin(db, user, org_id)

        inv_res = await db.execute(
            select(OrganizationInvitation).where(
                OrganizationInvitation.id == invitation_id,
                OrganizationInvitation.organization_id == org_id,
            )
        )
        invitation = inv_res.scalar_one_or_none()
        if not invitation:
            raise NotFoundException(detail="Invitation not found.")

        if invitation.status == "ACCEPTED":
            raise BadRequestException(detail="Cannot resend an already accepted invitation.")

        raw_token = secrets.token_urlsafe(32)
        token_hash = cls.hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

        invitation.token = token_hash
        invitation.expires_at = expires_at
        invitation.status = "PENDING"

        org_res = await db.execute(select(Organization.name).where(Organization.id == org_id))
        org_name = org_res.scalar() or "Workspace"

        settings = get_settings()
        invite_url = f"{settings.FRONTEND_URL}/invitations/accept?token={raw_token}"

        _, email_status = EmailService.send_invitation_email(
            to_email=invitation.email,
            org_name=org_name,
            role=invitation.role,
            inviter_name=user.full_name or user.username,
            invite_url=invite_url,
            expires_hours=48,
        )

        await AuditService.log_action(
            db=db,
            action="organization.invitation.resent",
            organization_id=org_id,
            user_id=user.id,
            resource_type="organization_invitation",
            resource_id=invitation.id,
            details={
                "email": invitation.email,
                "role": invitation.role,
                "email_status": email_status,
                "expires_at": expires_at.isoformat(),
            },
        )
        await db.commit()
        await db.refresh(invitation)

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
            email_status=email_status,
            invite_url=invite_url,
            raw_token=raw_token,
        )

    @classmethod
    async def revoke_invitation(
        cls, db: AsyncSession, user: User, org_id: int, invitation_id: int
    ) -> OrganizationInvitationResponse:
        """Revoke a pending or expired invitation."""
        await cls.require_org_admin(db, user, org_id)

        inv_res = await db.execute(
            select(OrganizationInvitation).where(
                OrganizationInvitation.id == invitation_id,
                OrganizationInvitation.organization_id == org_id,
            )
        )
        invitation = inv_res.scalar_one_or_none()
        if not invitation:
            raise NotFoundException(detail="Invitation not found.")

        if invitation.status == "ACCEPTED":
            raise BadRequestException(detail="Cannot revoke an already accepted invitation.")

        invitation.status = "REVOKED"
        await AuditService.log_action(
            db=db,
            action="organization.invitation.revoked",
            organization_id=org_id,
            user_id=user.id,
            resource_type="organization_invitation",
            resource_id=invitation.id,
            details={"email": invitation.email, "role": invitation.role},
        )
        await db.commit()
        await db.refresh(invitation)

        org_res = await db.execute(select(Organization.name).where(Organization.id == org_id))
        org_name = org_res.scalar() or "Workspace"

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
            email_status="EMAIL_NOT_CONFIGURED",
        )

    @classmethod
    async def list_invitations(
        cls, db: AsyncSession, user: User, org_id: int
    ) -> list[OrganizationInvitationResponse]:
        """List invitations for an organization, automatically synchronizing expired tokens."""
        await cls.require_org_admin(db, user, org_id)

        now = datetime.now(timezone.utc)
        q = (
            select(OrganizationInvitation, Organization.name, User.full_name, User.username)
            .join(Organization, OrganizationInvitation.organization_id == Organization.id)
            .join(User, OrganizationInvitation.invited_by_id == User.id)
            .where(OrganizationInvitation.organization_id == org_id)
            .order_by(OrganizationInvitation.id.desc())
        )
        res = await db.execute(q)
        rows = res.all()

        dirty = False
        results = []
        for inv, org_name, fn, un in rows:
            exp_at = inv.expires_at
            if exp_at.tzinfo is None:
                exp_at = exp_at.replace(tzinfo=timezone.utc)
            if inv.status == "PENDING" and exp_at < now:
                inv.status = "EXPIRED"
                dirty = True

            results.append(
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
                    email_status="EMAIL_NOT_CONFIGURED",
                )
            )

        if dirty:
            await db.commit()

        return results

    @classmethod
    async def verify_invitation_token(
        cls, db: AsyncSession, token: str
    ) -> OrganizationInviteVerifyResponse:
        """Verify invitation token authenticity, expiration, and status for public onboarding."""
        token_clean = token.strip()
        token_hash = cls.hash_token(token_clean)

        # Match either hashed token or legacy raw token
        inv_res = await db.execute(
            select(OrganizationInvitation).where(
                (OrganizationInvitation.token == token_hash)
                | (OrganizationInvitation.token == token_clean)
            )
        )
        inv = inv_res.scalar_one_or_none()
        if not inv:
            raise NotFoundException(detail="Invalid invitation token.")

        if inv.status == "REVOKED":
            raise BadRequestException(detail="This invitation has been revoked by an administrator.")

        if inv.status == "ACCEPTED":
            raise BadRequestException(detail="This invitation has already been accepted.")

        exp_at = inv.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)
        if exp_at < datetime.now(timezone.utc):
            inv.status = "EXPIRED"
            await db.commit()
            raise BadRequestException(detail="This invitation token has expired.")

        org_res = await db.execute(select(Organization.name).where(Organization.id == inv.organization_id))
        org_name = org_res.scalar() or "Workspace"

        existing_user_res = await db.execute(select(User).where(User.email == inv.email.lower()))
        existing_user = existing_user_res.scalar_one_or_none()

        return OrganizationInviteVerifyResponse(
            valid=True,
            organization_id=inv.organization_id,
            organization_name=org_name,
            email=inv.email,
            role=inv.role,
            expires_at=inv.expires_at,
            user_exists=bool(existing_user),
            existing_user_name=existing_user.full_name or existing_user.username if existing_user else None,
        )

    @classmethod
    async def accept_invitation_onboarding(
        cls,
        db: AsyncSession,
        payload: OrganizationInviteAcceptPayload,
        current_user: User | None = None,
    ) -> OrganizationInviteAcceptResponse:
        """Accept an invitation, onboard a new user (setting their own password) or join an existing user."""
        token_clean = payload.token.strip()
        token_hash = cls.hash_token(token_clean)

        inv_res = await db.execute(
            select(OrganizationInvitation).where(
                (OrganizationInvitation.token == token_hash)
                | (OrganizationInvitation.token == token_clean)
            )
        )
        inv = inv_res.scalar_one_or_none()
        if not inv:
            raise NotFoundException(detail="Invalid invitation token.")

        if inv.status == "REVOKED":
            raise BadRequestException(detail="This invitation has been revoked by an administrator.")

        if inv.status == "ACCEPTED":
            raise BadRequestException(detail="This invitation has already been accepted.")

        exp_at = inv.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)
        if exp_at < datetime.now(timezone.utc):
            inv.status = "EXPIRED"
            await db.commit()
            raise BadRequestException(detail="This invitation token has expired.")

        # Check existing user
        existing_user_res = await db.execute(select(User).where(User.email == inv.email.lower()))
        existing_user = existing_user_res.scalar_one_or_none()

        is_new_user = False
        target_user: User

        if not existing_user:
            # Onboard new user
            if not payload.password or len(payload.password) < 8:
                raise BadRequestException(detail="Password is required and must be at least 8 characters.")

            base_username = payload.username.strip() if payload.username and payload.username.strip() else inv.email.split("@")[0]
            # Ensure unique username
            clean_username = re.sub(r"[^a-zA-Z0-9_-]", "", base_username) or "user"
            candidate_un = clean_username
            counter = 1
            while True:
                u_check = await db.execute(select(User.id).where(User.username == candidate_un))
                if not u_check.scalar_one_or_none():
                    break
                candidate_un = f"{clean_username}_{counter}"
                counter += 1

            new_user = User(
                email=inv.email.lower(),
                username=candidate_un,
                full_name=payload.full_name.strip() if payload.full_name else candidate_un,
                hashed_password=hash_password(payload.password),
                is_active=True,
                is_superuser=False,
                role="user",
            )
            db.add(new_user)
            await db.flush()

            # Create personal workspace for the newly onboarded user
            await cls.ensure_personal_workspace(db, new_user)
            target_user = new_user
            is_new_user = True
        else:
            # Existing account joining organization
            target_user = existing_user
            if current_user and current_user.email.lower() != target_user.email.lower():
                raise BadRequestException(
                    detail=f"Authenticated account ({current_user.email}) does not match invitation ({target_user.email})."
                )
            if not current_user and payload.password:
                if not verify_password(payload.password, target_user.hashed_password):
                    raise UnauthorizedException(detail="Incorrect password for existing account.")

        # Assign organization membership
        m_check = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == inv.organization_id,
                OrganizationMember.user_id == target_user.id,
            )
        )
        existing_member = m_check.scalar_one_or_none()
        if not existing_member:
            new_member = OrganizationMember(
                organization_id=inv.organization_id,
                user_id=target_user.id,
                role=inv.role,
            )
            db.add(new_member)
        else:
            existing_member.role = inv.role

        inv.status = "ACCEPTED"

        await AuditService.log_action(
            db=db,
            action="organization.invitation.accepted",
            organization_id=inv.organization_id,
            user_id=target_user.id,
            resource_type="organization_invitation",
            resource_id=inv.id,
            details={
                "email": inv.email,
                "role": inv.role,
                "is_new_user": is_new_user,
            },
        )
        await db.commit()

        # Generate JWT session tokens for immediate onboarding login
        access_token = create_access_token({"sub": str(target_user.id), "email": target_user.email})
        refresh_token = create_refresh_token({"sub": str(target_user.id), "email": target_user.email})

        org = await cls.get_organization(db, target_user, inv.organization_id)

        return OrganizationInviteAcceptResponse(
            organization=org,
            access_token=access_token,
            refresh_token=refresh_token,
            is_new_user=is_new_user,
            message="Successfully joined organization workspace",
        )

    @classmethod
    async def accept_invitation(
        cls, db: AsyncSession, user: User, token: str
    ) -> OrganizationResponse:
        """Legacy helper for authenticated users accepting directly by token string."""
        payload = OrganizationInviteAcceptPayload(token=token)
        res = await cls.accept_invitation_onboarding(db=db, payload=payload, current_user=user)
        return res.organization

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
        if not member or member.role not in (
            OrganizationRole.ORGANIZATION_ADMIN.value,
            OrganizationRole.SUPER_ADMIN.value,
        ):
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
