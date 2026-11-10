"""Pydantic schemas for Centralized Logs, OpenTelemetry Spans, and Tracing."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class TelemetryLogCreate(BaseModel):
    """Schema for ingesting a structured log line."""

    service_name: str = Field(..., min_length=1, max_length=100)
    level: Literal["INFO", "WARN", "ERROR", "DEBUG", "FATAL"] = Field(default="INFO")
    message: str = Field(..., min_length=1)
    timestamp: datetime | None = None
    trace_id: str | None = None
    span_id: str | None = None
    attributes: dict[str, Any] = {}


class TelemetryLogResponse(BaseModel):
    """Structured log record representation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    service_name: str
    level: str
    message: str
    timestamp: datetime
    trace_id: str | None = None
    span_id: str | None = None
    attributes: dict[str, Any] = {}


class TelemetryLogQueryResponse(BaseModel):
    """Paginated search query response for log records."""

    total: int
    logs: list[TelemetryLogResponse]


class TelemetrySpanCreate(BaseModel):
    """Schema for ingesting OpenTelemetry span."""

    trace_id: str = Field(..., min_length=8, max_length=64)
    span_id: str = Field(..., min_length=4, max_length=32)
    parent_span_id: str | None = None
    name: str = Field(..., min_length=1, max_length=255)
    service_name: str = Field(..., min_length=1, max_length=100)
    kind: Literal["SERVER", "CLIENT", "INTERNAL", "PRODUCER", "CONSUMER"] = "SERVER"
    start_time: datetime
    end_time: datetime
    status_code: Literal["OK", "ERROR", "UNSET"] = "OK"
    status_message: str | None = None
    attributes: dict[str, Any] = {}


class TelemetrySpanResponse(BaseModel):
    """Distributed tracing span record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    name: str
    service_name: str
    kind: str
    start_time: datetime
    end_time: datetime
    duration_ms: float
    status_code: str
    status_message: str | None = None
    attributes: dict[str, Any] = {}


class TelemetryTraceSummary(BaseModel):
    """High-level trace item for trace list explorer."""

    trace_id: str
    root_service: str
    root_name: str
    start_time: datetime
    duration_ms: float
    span_count: int
    has_error: bool
    services: list[str]


class TelemetryTraceDetailResponse(BaseModel):
    """Complete trace waterfall with all connected spans."""

    trace_id: str
    root_span_name: str
    duration_ms: float
    spans: list[TelemetrySpanResponse]


class TelemetryStatsResponse(BaseModel):
    """High-level observability statistics scorecard."""

    total_logs_24h: int
    error_logs_24h: int
    total_traces_24h: int
    p95_latency_ms: float
    active_services_count: int
