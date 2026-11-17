"""Audit logging service for tracking critical administrative and security events."""

import csv
import io
import json
import logging
import math
from typing import Any
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    """Service to persist and query audit log events for enterprise compliance."""

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

    @classmethod
    async def get_organization_audit_logs(
        cls,
        db: AsyncSession,
        organization_id: int,
        action: str | None = None,
        user_id: int | None = None,
        search: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict[str, Any]:
        """Fetch paginated audit log entries for an organization."""
        base_query = (
            select(AuditLog, User)
            .outerjoin(User, AuditLog.user_id == User.id)
            .where(AuditLog.organization_id == organization_id)
        )

        if action:
            base_query = base_query.where(AuditLog.action == action)
        if user_id:
            base_query = base_query.where(AuditLog.user_id == user_id)
        if search and search.strip():
            term = f"%{search.strip()}%"
            base_query = base_query.where(
                or_(
                    AuditLog.action.ilike(term),
                    AuditLog.details.ilike(term),
                    AuditLog.resource_type.ilike(term),
                    User.email.ilike(term),
                    User.username.ilike(term),
                )
            )

        # Count total
        count_query = select(func.count(AuditLog.id)).where(AuditLog.organization_id == organization_id)
        if action:
            count_query = count_query.where(AuditLog.action == action)
        if user_id:
            count_query = count_query.where(AuditLog.user_id == user_id)
        if search and search.strip():
            term = f"%{search.strip()}%"
            count_query = count_query.outerjoin(User, AuditLog.user_id == User.id).where(
                or_(
                    AuditLog.action.ilike(term),
                    AuditLog.details.ilike(term),
                    AuditLog.resource_type.ilike(term),
                    User.email.ilike(term),
                    User.username.ilike(term),
                )
            )

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        # Execute paginated query
        offset_val = (page - 1) * per_page
        query = (
            base_query.order_by(desc(AuditLog.created_at))
            .offset(offset_val)
            .limit(per_page)
        )
        res = await db.execute(query)
        rows = res.all()

        items: list[dict[str, Any]] = []
        for audit, user_obj in rows:
            parsed_details: dict[str, Any] | None = None
            if audit.details:
                try:
                    parsed_details = json.loads(audit.details)
                except Exception:
                    parsed_details = {"raw": audit.details}

            items.append({
                "id": audit.id,
                "organization_id": audit.organization_id,
                "user_id": audit.user_id,
                "user_email": user_obj.email if user_obj else None,
                "user_name": (user_obj.full_name or user_obj.username) if user_obj else None,
                "action": audit.action,
                "resource_type": audit.resource_type,
                "resource_id": audit.resource_id,
                "details": parsed_details,
                "ip_address": audit.ip_address,
                "user_agent": audit.user_agent,
                "created_at": audit.created_at,
            })

        pages = max(1, math.ceil(total / per_page)) if total > 0 else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }

    @classmethod
    async def export_audit_logs_csv(
        cls,
        db: AsyncSession,
        organization_id: int,
        action: str | None = None,
        user_id: int | None = None,
        search: str | None = None,
        limit: int = 1000,
    ) -> str:
        """Export organization audit trail as CSV formatted string for compliance audits."""
        base_query = (
            select(AuditLog, User)
            .outerjoin(User, AuditLog.user_id == User.id)
            .where(AuditLog.organization_id == organization_id)
        )

        if action:
            base_query = base_query.where(AuditLog.action == action)
        if user_id:
            base_query = base_query.where(AuditLog.user_id == user_id)
        if search and search.strip():
            term = f"%{search.strip()}%"
            base_query = base_query.where(
                or_(
                    AuditLog.action.ilike(term),
                    AuditLog.details.ilike(term),
                    AuditLog.resource_type.ilike(term),
                    User.email.ilike(term),
                    User.username.ilike(term),
                )
            )

        query = base_query.order_by(desc(AuditLog.created_at)).limit(limit)
        res = await db.execute(query)
        rows = res.all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID",
            "Timestamp (UTC)",
            "Action",
            "Actor Email",
            "Actor Name",
            "Resource Type",
            "Resource ID",
            "IP Address",
            "Details",
        ])

        for audit, user_obj in rows:
            writer.writerow([
                audit.id,
                audit.created_at.isoformat() if audit.created_at else "",
                audit.action,
                user_obj.email if user_obj else "System",
                (user_obj.full_name or user_obj.username) if user_obj else "Automated / System",
                audit.resource_type or "",
                str(audit.resource_id or ""),
                audit.ip_address or "",
                audit.details or "",
            ])

        return output.getvalue()
