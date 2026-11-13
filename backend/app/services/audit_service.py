"""Audit logging service for tracking critical administrative and security events."""

import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """Service to persist audit log events."""

    @classmethod
    async def log_action(
        cls,
        db: AsyncSession,
        action: str,
        organization_id: int | None = None,
        user_id: int | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        """Create and commit an audit trail record."""
        details_str = json.dumps(details, default=str) if details is not None else None
        log_entry = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details_str,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log_entry)
        await db.flush()
        logger.info(
            "Audit event recorded: action=%s, org_id=%s, user_id=%s, resource=%s:%s",
            action,
            organization_id,
            user_id,
            resource_type,
            resource_id,
        )
        return log_entry
