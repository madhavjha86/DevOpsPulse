"""Pydantic schemas for Smart Incident Management."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

IncidentSeverity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
IncidentPriority = Literal["P1", "P2", "P3", "P4"]
IncidentStatus = Literal["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "CLOSED"]


class IncidentCreate(BaseModel):
    """Payload to report/create a new incident."""

    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5, max_length=10000)
    severity: IncidentSeverity = "MEDIUM"
    priority: IncidentPriority = "P2"
    service: str = Field(default="api-service", max_length=100)
    environment: str = Field(default="production", max_length=50)
    assignee_id: int | None = None
    repository_id: int | None = None
    workflow_run_id: int | None = None
    slack_channel: str | None = Field(default=None, max_length=100)
    send_email: bool = True
    send_slack: bool = False


class IncidentUpdate(BaseModel):
    """Payload to update basic incident details."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=5)
    severity: IncidentSeverity | None = None
    priority: IncidentPriority | None = None
    service: str | None = None
    environment: str | None = None
    assignee_id: int | None = None


class IncidentStatusUpdate(BaseModel):
    """Payload to transition incident lifecycle state."""

    status: IncidentStatus
    resolution_notes: str | None = Field(default=None, max_length=5000)
    comment: str | None = Field(default=None, max_length=2000)


class IncidentAssignUpdate(BaseModel):
    """Payload to reassign an incident."""

    assignee_id: int | None
    comment: str | None = Field(default=None, max_length=2000)


class IncidentCommentCreate(BaseModel):
    """Payload to add a timeline comment to an incident."""

    message: str = Field(..., min_length=1, max_length=5000)


class IncidentEventResponse(BaseModel):
    """Single timeline event in an incident audit history."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    user_id: int | None = None
    user_name: str | None = None
    event_type: str
    from_value: str | None = None
    to_value: str | None = None
    message: str
    created_at: datetime


class IncidentResponse(BaseModel):
    """Summary representation of an incident."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    assignee_id: int | None = None
    assignee_name: str | None = None
    repository_id: int | None = None
    repository_name: str | None = None
    workflow_run_id: int | None = None
    root_cause_analysis_id: int | None = None
    title: str
    description: str
    severity: str
    priority: str
    status: str
    service: str
    environment: str
    slack_channel: str | None = None
    slack_notification_sent: bool = False
    email_notification_sent: bool = False
    resolved_at: datetime | None = None
    resolution_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class IncidentDetailResponse(IncidentResponse):
    """Full incident details including chronological timeline events."""

    timeline_events: list[IncidentEventResponse] = []


class IncidentStatsSummary(BaseModel):
    """Incident KPI overview scorecard."""

    total_incidents: int
    open_incidents: int
    critical_incidents: int
    investigating_incidents: int
    resolved_incidents: int
    mttr_minutes: float
    by_severity: dict[str, int]
    by_service: dict[str, int]
