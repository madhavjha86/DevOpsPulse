"""Pydantic schemas for Executive Reporting, Export, and Notification Delivery."""

from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field


class SecurityReportSummary(BaseModel):
    total_scans: int = 0
    total_findings: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    remediated_findings: int = 0
    posture_grade: str = "A"
    sbom_components_count: int = 0


class ReliabilityReportSummary(BaseModel):
    slos_monitored: int = 0
    slos_meeting_target: int = 0
    compliance_percentage: float = 100.0
    average_mttd_minutes: float = 0.0
    average_mttr_minutes: float = 0.0
    active_monitors_count: int = 0


class FinOpsReportSummary(BaseModel):
    total_spend_usd: float = 0.0
    forecasted_run_rate_usd: float = 0.0
    active_optimizations: int = 0
    potential_monthly_savings_usd: float = 0.0
    budgets_healthy: int = 0
    budgets_alerting: int = 0


class DisasterRecoveryReportSummary(BaseModel):
    backup_records_count: int = 0
    drills_executed: int = 0
    latest_rpo_minutes: float = 0.0
    latest_rto_minutes: float = 0.0
    dr_readiness_pct: float = 100.0


class IncidentReportSummary(BaseModel):
    total_incidents: int = 0
    active_incidents: int = 0
    p1_critical_active: int = 0
    p2_high_active: int = 0
    resolved_incidents: int = 0


class CicdReportSummary(BaseModel):
    total_deployments: int = 0
    successful_deployments: int = 0
    deployment_success_rate_pct: float = 100.0
    average_lead_time_hours: float = 0.0


class ExecutiveSummaryResponse(BaseModel):
    organization_id: int | None = None
    organization_name: str = "DevOpsPulse Organization"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    time_period: str = "30d"
    security: SecurityReportSummary
    reliability: ReliabilityReportSummary
    finops: FinOpsReportSummary
    disaster_recovery: DisasterRecoveryReportSummary
    incidents: IncidentReportSummary
    cicd: CicdReportSummary
    integrity_signature: str


class ReportScheduleRequest(BaseModel):
    frequency: Literal["DAILY", "WEEKLY", "MONTHLY"] = "WEEKLY"
    format: Literal["PDF", "CSV"] = "PDF"
    recipients: list[str] = Field(..., min_length=1)
    report_sections: list[str] = ["security", "reliability", "finops", "incidents", "dr", "cicd"]


class ReportScheduleResponse(BaseModel):
    id: str
    frequency: str
    format: str
    recipients: list[str]
    next_scheduled_run: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationDeliveryTestRequest(BaseModel):
    channel: Literal["EMAIL", "WEBHOOK", "SLACK"]
    target: str = Field(..., description="Destination email or webhook URL")


class NotificationDeliveryTestResponse(BaseModel):
    channel: str
    target: str
    delivery_status: Literal["DELIVERED", "FAILED", "CONFIG_MISSING"]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    latency_ms: float
    details: str
