"""API dependencies for database sessions, authentication, and request parameters."""

from typing import Annotated
from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.db.session import get_db
from app.models.organization import Organization, OrganizationRole
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.services.organization_service import OrganizationService

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate JWT token from Bearer header and return authenticated User."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise UnauthorizedException(detail="Invalid token type, access token required")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException(detail="Invalid token subject")

    repo = UserRepository(db)
    user = await repo.get(int(user_id_str))
    if not user:
        raise UnauthorizedException(detail="User not found")

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure the authenticated user account is active."""
    if not current_user.is_active:
        raise ForbiddenException(detail="Inactive user account")
    return current_user


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Extract authenticated user if Bearer token is provided, else return None without raising error."""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        repo = UserRepository(db)
        user = await repo.get(int(user_id_str))
        if user and user.is_active:
            return user
        return None
    except Exception:
        return None


async def require_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Ensure the user has administrator privileges."""
    if not (current_user.is_superuser or current_user.role == "admin"):
        raise ForbiddenException(detail="Administrator access required")
    return current_user


class TenantContext:
    """Encapsulates the active tenant workspace boundary and user authorization role."""

    def __init__(self, user: User, organization: Organization, role: str) -> None:
        self.user = user
        self.organization = organization
        self.role = role

    @property
    def organization_id(self) -> int:
        return self.organization.id

    @property
    def is_super_admin(self) -> bool:
        return self.user.is_superuser or self.role == OrganizationRole.SUPER_ADMIN.value

    @property
    def is_admin(self) -> bool:
        return self.is_super_admin or self.role == OrganizationRole.ORGANIZATION_ADMIN.value

    @property
    def is_devops(self) -> bool:
        return self.is_admin or self.role == OrganizationRole.DEVOPS_ENGINEER.value

    @property
    def is_developer(self) -> bool:
        return self.is_admin or self.is_devops or self.role == OrganizationRole.DEVELOPER.value

    @property
    def is_security(self) -> bool:
        return self.is_admin or self.role == OrganizationRole.SECURITY_ENGINEER.value

    @property
    def is_viewer(self) -> bool:
        return True


async def get_tenant_context(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_organization_id: Annotated[int | None, Header(alias="X-Organization-Id")] = None,
) -> TenantContext:
    """Resolve active tenant workspace and verify user authorization or reject cross-tenant requests."""
    org, role = await OrganizationService.resolve_tenant_context(
        db=db, user=current_user, requested_org_id=x_organization_id
    )
    return TenantContext(user=current_user, organization=org, role=role)


async def require_tenant_admin(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContext:
    """Require Organization Administrator or Super Admin permissions."""
    if not tenant.is_admin:
        raise ForbiddenException(detail="Organization Administrator privileges required.")
    return tenant


async def require_tenant_devops(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContext:
    """Require DevOps Engineer or Admin permissions."""
    if not tenant.is_devops:
        raise ForbiddenException(detail="DevOps Engineer or Administrator permissions required.")
    return tenant


async def require_tenant_developer(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContext:
    """Require Developer, DevOps, or Admin permissions."""
    if not tenant.is_developer:
        raise ForbiddenException(detail="Developer or higher permissions required.")
    return tenant


async def require_tenant_security(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContext:
    """Require Security Engineer or Admin permissions."""
    if not tenant.is_security:
        raise ForbiddenException(detail="Security Engineer or Administrator permissions required.")
    return tenant


async def require_tenant_writer(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> TenantContext:
    """Ensure user is not read-only (VIEWER role cannot modify resources)."""
    if tenant.role == OrganizationRole.VIEWER.value and not tenant.is_super_admin:
        raise ForbiddenException(detail="Viewer role is read-only. Mutation operations are prohibited.")
    return tenant


class PaginationParams:
    """Reusable query parameters for pagination."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number (1-based)"),
        per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ) -> None:
        self.page = page
        self.per_page = per_page
        self.skip = (page - 1) * per_page
        self.limit = per_page
