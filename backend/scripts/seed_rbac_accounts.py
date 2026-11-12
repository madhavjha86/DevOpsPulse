"""Seed and configure 6 permanent role-based accounts and test organizations in PostgreSQL."""

from datetime import datetime, timezone
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.db.session import get_sync_engine
from app.models.organization import (
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationType,
)
from app.models.user import User

ACCOUNTS_CONFIG = [
    {
        "role_key": "SUPER_ADMIN",
        "email": "admin@devopspulse.com",
        "username": "admin",
        "full_name": "System Administrator",
        "system_role": "admin",
        "is_superuser": True,
        "default_password": "Password123!",
        "org_role": OrganizationRole.SUPER_ADMIN.value,
        "personal_slug": "personal-1",
    },
    {
        "role_key": "ORGANIZATION_ADMIN",
        "email": "orgadmin@devopspulse.local",
        "username": "orgadmin",
        "full_name": "Organization Admin",
        "system_role": "admin",
        "is_superuser": False,
        "default_password": "OrgAdmin2026!DevOps",
        "org_role": OrganizationRole.ORGANIZATION_ADMIN.value,
        "personal_slug": "personal-orgadmin",
    },
    {
        "role_key": "DEVOPS_ENGINEER",
        "email": "devops@devopspulse.local",
        "username": "devops",
        "full_name": "DevOps Engineer",
        "system_role": "user",
        "is_superuser": False,
        "default_password": "DevOps2026!Pulse",
        "org_role": OrganizationRole.DEVOPS_ENGINEER.value,
        "personal_slug": "personal-devops",
    },
    {
        "role_key": "DEVELOPER",
        "email": "developer@company.com",
        "username": "developer",
        "full_name": "Alex Rivera",
        "system_role": "user",
        "is_superuser": False,
        "default_password": "Password123!",
        "org_role": OrganizationRole.DEVELOPER.value,
        "personal_slug": "personal-2",
    },
    {
        "role_key": "SECURITY_ENGINEER",
        "email": "security@devopspulse.local",
        "username": "security",
        "full_name": "Security Engineer",
        "system_role": "user",
        "is_superuser": False,
        "default_password": "Security2026!Audit",
        "org_role": OrganizationRole.SECURITY_ENGINEER.value,
        "personal_slug": "personal-security",
    },
    {
        "role_key": "VIEWER",
        "email": "viewer@devopspulse.local",
        "username": "viewer",
        "full_name": "Viewer User",
        "system_role": "viewer",
        "is_superuser": False,
        "default_password": "Viewer2026!ReadOnly",
        "org_role": OrganizationRole.VIEWER.value,
        "personal_slug": "personal-viewer",
    },
]


def seed_rbac_data():
    engine = get_sync_engine()
    with Session(engine) as session:
        print("[1/5] Processing 6 Role-Based Accounts...")
        user_map: dict[str, User] = {}
        
        for cfg in ACCOUNTS_CONFIG:
            email = cfg["email"]
            user = session.query(User).filter(User.email == email).first()
            if user:
                print(f"  Existing user found: {email} (ID: {user.id})")
                # Preserve existing password, update metadata and flags
                user.full_name = cfg["full_name"]
                user.role = cfg["system_role"]
                user.is_superuser = cfg["is_superuser"]
                user.is_active = True
                # If password not set or invalid, only then set default
                if not user.hashed_password:
                    user.hashed_password = hash_password(cfg["default_password"])
            else:
                print(f"  Creating new user: {email}")
                user = User(
                    email=email,
                    username=cfg["username"],
                    full_name=cfg["full_name"],
                    hashed_password=hash_password(cfg["default_password"]),
                    is_active=True,
                    is_superuser=cfg["is_superuser"],
                    role=cfg["system_role"],
                )
                session.add(user)
                session.flush()
                print(f"  Created user: {email} (ID: {user.id})")
            
            user_map[cfg["role_key"]] = user

        session.commit()

        print("\n[2/5] Ensuring Personal Workspaces...")
        for cfg in ACCOUNTS_CONFIG:
            user = user_map[cfg["role_key"]]
            p_org = (
                session.query(Organization)
                .filter(
                    Organization.owner_id == user.id,
                    Organization.type == OrganizationType.PERSONAL.value,
                )
                .first()
            )
            if not p_org:
                p_org = Organization(
                    name=f"{user.full_name}'s Personal Workspace",
                    slug=cfg["personal_slug"],
                    type=OrganizationType.PERSONAL.value,
                    owner_id=user.id,
                    description=f"Personal workspace for {user.full_name}.",
                    is_active=True,
                )
                session.add(p_org)
                session.flush()
                print(f"  Created personal workspace: {p_org.name} (Org ID: {p_org.id})")

            # Ensure owner membership in personal workspace
            p_mem = (
                session.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == p_org.id,
                    OrganizationMember.user_id == user.id,
                )
                .first()
            )
            if not p_mem:
                p_mem = OrganizationMember(
                    organization_id=p_org.id,
                    user_id=user.id,
                    role=OrganizationRole.ORGANIZATION_ADMIN.value,
                )
                session.add(p_mem)

        session.commit()

        print("\n[3/5] Ensuring Company Workspace: 'DevOpsPulse Test Organization'...")
        orgadmin_user = user_map["ORGANIZATION_ADMIN"]
        company_org = (
            session.query(Organization)
            .filter(Organization.slug == "devopspulse-test-org")
            .first()
        )
        if not company_org:
            company_org = Organization(
                name="DevOpsPulse Test Organization",
                slug="devopspulse-test-org",
                type=OrganizationType.COMPANY.value,
                owner_id=orgadmin_user.id,
                description="Primary shared company workspace for DevOpsPulse multi-tenant testing.",
                is_active=True,
            )
            session.add(company_org)
            session.flush()
            print(f"  Created company workspace: {company_org.name} (Org ID: {company_org.id})")
        else:
            print(f"  Found company workspace: {company_org.name} (Org ID: {company_org.id})")

        print("\n[4/5] Assigning Role Memberships in 'DevOpsPulse Test Organization'...")
        for cfg in ACCOUNTS_CONFIG:
            user = user_map[cfg["role_key"]]
            assigned_role = cfg["org_role"]
            mem = (
                session.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == company_org.id,
                    OrganizationMember.user_id == user.id,
                )
                .first()
            )
            if not mem:
                mem = OrganizationMember(
                    organization_id=company_org.id,
                    user_id=user.id,
                    role=assigned_role,
                )
                session.add(mem)
                print(f"  Enrolled {user.email} -> {assigned_role}")
            else:
                mem.role = assigned_role
                print(f"  Updated {user.email} -> {assigned_role}")

        session.commit()

        print("\n[5/5] Ensuring Isolated Secondary Company: 'Acme Global Corp' (for isolation testing)...")
        superadmin_user = user_map["SUPER_ADMIN"]
        acme_org = (
            session.query(Organization)
            .filter(Organization.slug == "acme-global-corp")
            .first()
        )
        if not acme_org:
            acme_org = Organization(
                name="Acme Global Corp",
                slug="acme-global-corp",
                type=OrganizationType.COMPANY.value,
                owner_id=superadmin_user.id,
                description="Isolated enterprise tenant workspace for cross-tenant boundary verification.",
                is_active=True,
            )
            session.add(acme_org)
            session.flush()
            acme_mem = OrganizationMember(
                organization_id=acme_org.id,
                user_id=superadmin_user.id,
                role=OrganizationRole.ORGANIZATION_ADMIN.value,
            )
            session.add(acme_mem)
            print(f"  Created Acme Global Corp (Org ID: {acme_org.id})")
        else:
            print(f"  Found Acme Global Corp (Org ID: {acme_org.id})")

        # Ensure active repository in DevOpsPulse Test Organization
        from app.models.repository import Repository
        company_repo = session.query(Repository).filter(Repository.id == 5).first()
        if company_repo:
            company_repo.organization_id = company_org.id
            print(f"  Assigned repository ID {company_repo.id} ({company_repo.full_name}) to workspace {company_org.id}")

        session.commit()

        print("\n=== SUMMARY OF ALL 6 ROLES IN DEVOPSPULSE ===")
        members = (
            session.query(OrganizationMember, User)
            .join(User, OrganizationMember.user_id == User.id)
            .filter(OrganizationMember.organization_id == company_org.id)
            .all()
        )
        for m, u in members:
            print(f"  • {m.role.ljust(22)}: {u.email.ljust(30)} (User ID: {u.id}, Active: {u.is_active})")

        print("\nSeeding completed successfully.")


if __name__ == "__main__":
    seed_rbac_data()
