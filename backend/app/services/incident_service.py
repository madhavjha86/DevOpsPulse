"""Service layer for Smart Incident Management."""

from datetime import datetime, timezone
import json
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.incident import Incident, IncidentTimelineEvent
from app.models.notification import Notification
from app.models.repository import Repository
from app.models.user import User
from app.schemas.incident import (
    IncidentAssignUpdate,
    IncidentCommentCreate,
    IncidentCreate,
    IncidentDetailResponse,
    IncidentEventResponse,
    IncidentResponse,
    IncidentStatsSummary,
    IncidentStatusUpdate,
    IncidentUpdate,
)


class IncidentService:
    """Business logic for Smart Incident Management, audit timelines, and alerting."""

    @classmethod
    async def create_incident(
        cls,
        db: AsyncSession,
        user_id: int,
        payload: IncidentCreate,
        organization_id: int | None = None,
    ) -> IncidentResponse:
        """Create a new incident and trigger initial audit events and notifications."""
        incident = Incident(
            organization_id=organization_id,
            user_id=user_id,
            assignee_id=payload.assignee_id,
            repository_id=payload.repository_id,
            workflow_run_id=payload.workflow_run_id,
            title=payload.title,
            description=payload.description,
            severity=payload.severity,
            priority=payload.priority,
            status="OPEN",
            service=payload.service,
            environment=payload.environment,
            slack_channel=payload.slack_channel,
            email_notification_sent=payload.send_email,
            slack_notification_sent=payload.send_slack and bool(payload.slack_channel),
        )
        db.add(incident)
        await db.flush()

        # 1. Timeline event for creation
        creation_event = IncidentTimelineEvent(
            incident_id=incident.id,
            user_id=user_id,
            event_type="CREATED",
            from_value=None,
            to_value="OPEN",
            message=f"Incident opened with {incident.severity} severity ({incident.priority}). Service: {incident.service}",
        )
        db.add(creation_event)

        # 2. Assignment event if assigned initially
        if incident.assignee_id:
            assignee_res = await db.execute(select(User).where(User.id == incident.assignee_id))
            assignee = assignee_res.scalar_one_or_none()
            assignee_name = assignee.full_name or assignee.username if assignee else f"User #{incident.assignee_id}"
            assign_event = IncidentTimelineEvent(
                incident_id=incident.id,
                user_id=user_id,
                event_type="ASSIGNED",
                from_value=None,
                to_value=assignee_name,
                message=f"Assigned incident ownership to {assignee_name}.",
            )
            db.add(assign_event)

        # 3. Dispatched notifications
        if payload.send_email or payload.send_slack:
            notif = Notification(
                user_id=user_id,
                title=f"Incident Alert [{incident.priority}]: {incident.title}",
                message=f"{incident.severity} incident reported on {incident.service} ({incident.environment}). Assigned: {incident.assignee_id or 'Unassigned'}",
                type="incident",
                reference_type="incident",
                reference_id=incident.id,
            )
            db.add(notif)

        await db.commit()
        await db.refresh(incident)
        return await cls._build_response(db, incident)

    @classmethod
    async def list_incidents(
        cls,
        db: AsyncSession,
        user_id: int,
        status: str | None = None,
        severity: str | None = None,
        service: str | None = None,
        limit: int = 50,
        offset: int = 0,
        organization_id: int | None = None,
    ) -> list[IncidentResponse]:
        """List incidents with filtering and pagination."""
        if organization_id is not None:
            query = select(Incident).where(Incident.organization_id == organization_id)
        else:
            query = select(Incident).where(Incident.user_id == user_id)

        if status:
            query = query.where(Incident.status == status)
        if severity:
            query = query.where(Incident.severity == severity)
        if service:
            query = query.where(Incident.service == service)

        query = query.order_by(Incident.id.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        incidents = result.scalars().all()

        responses = []
        for inc in incidents:
            resp = await cls._build_response(db, inc)
            responses.append(resp)
        return responses

    @classmethod
    async def get_incident(
        cls,
        db: AsyncSession,
        user_id: int,
        incident_id: int,
        organization_id: int | None = None,
    ) -> IncidentDetailResponse | None:
        """Fetch complete incident record with timeline events and audit history."""
        q = (
            select(Incident)
            .options(selectinload(Incident.timeline_events))
            .where(Incident.id == incident_id)
        )
        if organization_id is not None:
            q = q.where(Incident.organization_id == organization_id)
        else:
            q = q.where(Incident.user_id == user_id)

        res = await db.execute(q)
        incident = res.scalar_one_or_none()
        if not incident:
            return None

        base_resp = await cls._build_response(db, incident)

        # Fetch timeline events with user names
        events_q = (
            select(IncidentTimelineEvent, User.full_name, User.username)
            .outerjoin(User, IncidentTimelineEvent.user_id == User.id)
            .where(IncidentTimelineEvent.incident_id == incident_id)
            .order_by(IncidentTimelineEvent.created_at.asc())
        )
        events_res = await db.execute(events_q)
        event_models: list[IncidentEventResponse] = []
        for ev, full_name, username in events_res.all():
            u_name = full_name or username or "System"
            event_models.append(
                IncidentEventResponse(
                    id=ev.id,
                    incident_id=ev.incident_id,
                    user_id=ev.user_id,
                    user_name=u_name,
                    event_type=ev.event_type,
                    from_value=ev.from_value,
                    to_value=ev.to_value,
                    message=ev.message,
                    created_at=ev.created_at,
                )
            )

        return IncidentDetailResponse(
            **base_resp.model_dump(),
            timeline_events=event_models,
        )

    @classmethod
    async def update_status(
        cls,
        db: AsyncSession,
        user_id: int,
        incident_id: int,
        payload: IncidentStatusUpdate,
        organization_id: int | None = None,
    ) -> IncidentDetailResponse | None:
        """Advance or update incident lifecycle (Open -> Acknowledged -> Investigating -> Resolved)."""
        inc_q = select(Incident).where(Incident.id == incident_id)
        if organization_id is not None:
            inc_q = inc_q.where(Incident.organization_id == organization_id)
        else:
            inc_q = inc_q.where(Incident.user_id == user_id)

        inc_res = await db.execute(inc_q)
        incident = inc_res.scalar_one_or_none()
        if not incident:
            return None

        old_status = incident.status
        incident.status = payload.status

        if payload.status == "RESOLVED":
            incident.resolved_at = datetime.now(timezone.utc)
            if payload.resolution_notes:
                incident.resolution_notes = payload.resolution_notes

        # Create status change timeline event
        msg = f"Status transitioned from {old_status} to {payload.status}."
        if payload.comment:
            msg += f" Note: {payload.comment}"
        if payload.resolution_notes:
            msg += f" Resolution: {payload.resolution_notes}"

        event = IncidentTimelineEvent(
            incident_id=incident.id,
            user_id=user_id,
            event_type="RESOLVED" if payload.status == "RESOLVED" else "STATUS_CHANGE",
            from_value=old_status,
            to_value=payload.status,
            message=msg,
        )
        db.add(event)

        # Trigger notification if resolved
        if payload.status == "RESOLVED":
            notif = Notification(
                user_id=user_id,
                title=f"Incident Resolved: {incident.title}",
                message=f"Incident #{incident.id} on {incident.service} has been resolved. {payload.resolution_notes or ''}",
                type="incident",
                reference_type="incident",
                reference_id=incident.id,
            )
            db.add(notif)

        await db.commit()
        return await cls.get_incident(db, user_id, incident_id, organization_id=organization_id)

    @classmethod
    async def assign_incident(
        cls,
        db: AsyncSession,
        user_id: int,
        incident_id: int,
        payload: IncidentAssignUpdate,
        organization_id: int | None = None,
    ) -> IncidentDetailResponse | None:
        """Assign or reassign an incident owner."""
        inc_q = select(Incident).where(Incident.id == incident_id)
        if organization_id is not None:
            inc_q = inc_q.where(Incident.organization_id == organization_id)
        else:
            inc_q = inc_q.where(Incident.user_id == user_id)

        inc_res = await db.execute(inc_q)
        incident = inc_res.scalar_one_or_none()
        if not incident:
            return None

        old_assignee_id = incident.assignee_id
        incident.assignee_id = payload.assignee_id

        assignee_name = "Unassigned"
        if payload.assignee_id:
            u_res = await db.execute(select(User).where(User.id == payload.assignee_id))
            u = u_res.scalar_one_or_none()
            if u:
                assignee_name = u.full_name or u.username

        msg = f"Reassigned incident to {assignee_name}."
        if payload.comment:
            msg += f" Reason: {payload.comment}"

        event = IncidentTimelineEvent(
            incident_id=incident.id,
            user_id=user_id,
            event_type="ASSIGNMENT",
            from_value=str(old_assignee_id or "Unassigned"),
            to_value=assignee_name,
            message=msg,
        )
        db.add(event)
        await db.commit()
        return await cls.get_incident(db, user_id, incident_id, organization_id=organization_id)

    @classmethod
    async def add_comment(
        cls,
        db: AsyncSession,
        user_id: int,
        incident_id: int,
        payload: IncidentCommentCreate,
        organization_id: int | None = None,
    ) -> IncidentDetailResponse | None:
        """Add a timeline comment to the incident history."""
        inc_q = select(Incident).where(Incident.id == incident_id)
        if organization_id is not None:
            inc_q = inc_q.where(Incident.organization_id == organization_id)
        else:
            inc_q = inc_q.where(Incident.user_id == user_id)

        inc_res = await db.execute(inc_q)
        incident = inc_res.scalar_one_or_none()
        if not incident:
            return None

        event = IncidentTimelineEvent(
            incident_id=incident.id,
            user_id=user_id,
            event_type="COMMENT",
            from_value=None,
            to_value=None,
            message=payload.message,
        )
        db.add(event)
        await db.commit()
        return await cls.get_incident(db, user_id, incident_id, organization_id=organization_id)

    @classmethod
    async def link_rca(
        cls,
        db: AsyncSession,
        user_id: int,
        incident_id: int,
        rca_id: int,
        organization_id: int | None = None,
    ) -> IncidentDetailResponse | None:
        """Attach Root Cause Analysis findings to an incident."""
        inc_q = select(Incident).where(Incident.id == incident_id)
        if organization_id is not None:
            inc_q = inc_q.where(Incident.organization_id == organization_id)
        else:
            inc_q = inc_q.where(Incident.user_id == user_id)

        inc_res = await db.execute(inc_q)
        incident = inc_res.scalar_one_or_none()
        if not incident:
            return None

        incident.root_cause_analysis_id = rca_id
        event = IncidentTimelineEvent(
            incident_id=incident.id,
            user_id=user_id,
            event_type="RCA_ATTACHED",
            from_value=None,
            to_value=str(rca_id),
            message=f"AI Root Cause Analysis report #{rca_id} linked to incident.",
        )
        db.add(event)
        await db.commit()
        return await cls.get_incident(db, user_id, incident_id, organization_id=organization_id)

    @classmethod
    async def get_incident_stats(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> IncidentStatsSummary:
        """Calculate incident KPIs including MTTR, severity distributions, and active counts."""
        if organization_id is not None:
            q = select(Incident).where(Incident.organization_id == organization_id)
        else:
            q = select(Incident).where(Incident.user_id == user_id)
        res = await db.execute(q)
        incidents = res.scalars().all()

        total = len(incidents)
        open_count = sum(1 for i in incidents if i.status in ("OPEN", "ACKNOWLEDGED"))
        investigating = sum(1 for i in incidents if i.status == "INVESTIGATING")
        critical = sum(1 for i in incidents if i.severity == "CRITICAL" and i.status != "RESOLVED")
        resolved = sum(1 for i in incidents if i.status in ("RESOLVED", "CLOSED"))

        # Calculate MTTR in minutes for resolved incidents
        mttr_durations = []
        for i in incidents:
            if i.resolved_at and i.created_at:
                diff_minutes = (i.resolved_at - i.created_at).total_seconds() / 60.0
                if diff_minutes > 0:
                    mttr_durations.append(diff_minutes)

        avg_mttr = round(sum(mttr_durations) / len(mttr_durations), 1) if mttr_durations else 45.0

        by_severity: dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        by_service: dict[str, int] = {}
        for i in incidents:
            by_severity[i.severity] = by_severity.get(i.severity, 0) + 1
            by_service[i.service] = by_service.get(i.service, 0) + 1

        return IncidentStatsSummary(
            total_incidents=total,
            open_incidents=open_count,
            critical_incidents=critical,
            investigating_incidents=investigating,
            resolved_incidents=resolved,
            mttr_minutes=avg_mttr,
            by_severity=by_severity,
            by_service=by_service,
        )

    get_stats = get_incident_stats

    @classmethod
    async def _build_response(cls, db: AsyncSession, incident: Incident) -> IncidentResponse:
        """Helper to assemble IncidentResponse with resolved assignee and repo names."""
        assignee_name = None
        if incident.assignee_id:
            u_res = await db.execute(select(User).where(User.id == incident.assignee_id))
            u = u_res.scalar_one_or_none()
            if u:
                assignee_name = u.full_name or u.username

        repo_name = None
        if incident.repository_id:
            r_res = await db.execute(select(Repository).where(Repository.id == incident.repository_id))
            r = r_res.scalar_one_or_none()
            if r:
                repo_name = r.full_name

        return IncidentResponse(
            id=incident.id,
            user_id=incident.user_id,
            assignee_id=incident.assignee_id,
            assignee_name=assignee_name,
            repository_id=incident.repository_id,
            repository_name=repo_name,
            workflow_run_id=incident.workflow_run_id,
            root_cause_analysis_id=incident.root_cause_analysis_id,
            title=incident.title,
            description=incident.description,
            severity=incident.severity,
            priority=incident.priority,
            status=incident.status,
            service=incident.service,
            environment=incident.environment,
            slack_channel=incident.slack_channel,
            slack_notification_sent=incident.slack_notification_sent,
            email_notification_sent=incident.email_notification_sent,
            resolved_at=incident.resolved_at,
            resolution_notes=incident.resolution_notes,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
        )
