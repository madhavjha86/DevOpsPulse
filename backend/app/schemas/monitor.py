"""Service Uptime & Health Monitor Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field


class MonitorCreateRequest(BaseModel):
    """Payload to register a new endpoint health monitor."""

    name: str = Field(..., min_length=2, max_length=100)
    url: str = Field(..., max_length=500)
    method: str = Field(default="GET", pattern=r"^(GET|POST|HEAD|PUT)$")
    interval_seconds: int = Field(default=60, ge=10, le=3600)


class MonitorProbeResult(BaseModel):
    """Result of probing a live endpoint."""

    status_code: int
    latency_ms: float
    is_up: bool
    checked_at: datetime
    message: str


class MonitorResponse(BaseModel):
    """Uptime monitor entity with health metrics."""

    id: int
    name: str
    url: str
    method: str
    interval_seconds: int
    status: str  # operational, degraded, down
    uptime_percentage: float
    avg_latency_ms: float
    last_checked_at: datetime | None = None
    recent_probes: list[int] = Field(default_factory=list)  # status codes of recent probes
