"""SRE Reliability Engineering and Advanced Observability Pydantic schemas."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

SloType = Literal["AVAILABILITY", "LATENCY", "ERROR_RATE", "THROUGHPUT"]
SloStatus = Literal["HEALTHY", "WARNING", "BREACHED"]
MetricType = Literal["LATENCY_P99", "LATENCY_P95", "ERROR_RATE", "CPU_USAGE", "MEMORY_USAGE"]


class SloCreate(BaseModel):
    """Payload to create a new Service Level Objective (SLO)."""

    name: str = Field(..., max_length=255)
    service_name: str = Field(..., max_length=100)
    sli_type: SloType = Field(default="AVAILABILITY")
    target_percentage: float = Field(default=99.9, ge=50.0, le=100.0)
    contractual_sla_percentage: float = Field(default=99.5, ge=50.0, le=100.0)
    time_window_days: int = Field(default=30, ge=1, le=365)
    warning_threshold: float = Field(default=20.0, ge=1.0, le=99.0)
    description: str | None = None


class SloResponse(BaseModel):
    """Full SLO representation with calculated Error Budget and Burn Rates."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    service_name: str
    sli_type: str
    target_percentage: float
    contractual_sla_percentage: float
    time_window_days: int
    current_sli: float
    error_budget_percentage: float
    error_budget_remaining_percentage: float
    error_budget_burn_rate_1h: float
    error_budget_burn_rate_6h: float
    error_budget_burn_rate_24h: float
    warning_threshold: float
    status: str
    description: str | None = None
    created_at: datetime


class SloSimulateBurnRequest(BaseModel):
    """Payload to simulate an error surge and observe error budget burn."""

    burn_rate_multiplier: float = Field(default=5.0, ge=0.1, le=50.0)
    reduce_budget_percent: float = Field(default=25.0, ge=1.0, le=100.0)


class OnCallScheduleCreate(BaseModel):
    """Payload to configure on-call escalation rotation."""

    name: str = Field(..., max_length=100)
    primary_engineer: str = Field(..., max_length=100)
    secondary_engineer: str = Field(..., max_length=100)
    rotation_type: str = Field(default="WEEKLY", max_length=50)
    escalation_policy: str = Field(
        default="P1: 5min Slack -> SMS -> Team Lead -> VP Eng", max_length=255
    )
    handoff_day: str = Field(default="Monday", max_length=20)


class OnCallScheduleResponse(BaseModel):
    """On-call responder roster and escalation status."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    primary_engineer: str
    secondary_engineer: str
    rotation_type: str
    escalation_policy: str
    is_active: bool
    handoff_day: str
    created_at: datetime


class AlertRuleCreate(BaseModel):
    """Payload to establish custom observability alert rule."""

    name: str = Field(..., max_length=255)
    service_name: str = Field(..., max_length=100)
    metric_type: str = Field(default="LATENCY_P99")
    operator: str = Field(default=">", max_length=10)
    threshold_value: float = Field(...)
    duration_minutes: int = Field(default=5, ge=1, le=120)
    severity: str = Field(default="HIGH", max_length=50)
    notification_channel: str = Field(default="WEBHOOK", max_length=100)


class AlertRuleResponse(BaseModel):
    """Observability alert rule model."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    service_name: str
    metric_type: str
    operator: str
    threshold_value: float
    duration_minutes: int
    severity: str
    notification_channel: str
    is_active: bool
    created_at: datetime


class ServiceDependencyNode(BaseModel):
    """Node in distributed microservice dependency graph."""

    id: str
    name: str
    type: str  # gateway, service, database, cache, queue
    status: str  # HEALTHY, DEGRADED, DOWN
    request_rate_rpm: float
    error_rate_pct: float
    latency_p95_ms: float


class ServiceDependencyEdge(BaseModel):
    """Directed dependency link between two services."""

    source: str
    target: str
    call_count: int
    avg_latency_ms: float
    error_count: int


class ServiceDependencyMapResponse(BaseModel):
    """Full architectural dependency topology."""

    nodes: list[ServiceDependencyNode]
    edges: list[ServiceDependencyEdge]


class ApmServiceMetric(BaseModel):
    """Granular APM percentiles for a specific microservice."""

    service_name: str
    request_count: int
    error_count: int
    error_rate_pct: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    avg_duration_ms: float


class ApmMetricsResponse(BaseModel):
    """Aggregated Application Performance Monitoring (APM) report."""

    time_window_hours: int
    total_spans: int
    system_p95_ms: float
    services: list[ApmServiceMetric]


class ReliabilityOverviewResponse(BaseModel):
    """Executive SRE & Reliability Dashboard overview."""

    overall_uptime_percentage: float
    mttd_minutes: float  # Mean Time to Detect
    mttr_minutes: float  # Mean Time to Resolve
    total_incidents_30d: int
    active_slos_count: int
    slos_meeting_target: int
    slos_warning_count: int
    slos_breached_count: int
    active_on_call: OnCallScheduleResponse | None = None
    slos: list[SloResponse] = []
