"""Pydantic schemas for Enterprise AI Governance, Token FinOps, and Cost Attribution."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class AITokenIngestRequest(BaseModel):
    """External ingestion payload from Claude Code, Cursor, Codex, or developer IDE proxies."""

    tool_name: str = Field(..., description="Developer tool or client (e.g., 'Claude Code', 'Cursor IDE', 'OpenAI Codex')")
    provider: str = Field(default="openai", description="AI provider (anthropic, openai, groq, gemini, etc.)")
    model_name: str = Field(default="gpt-4o", description="Model identifier used")
    prompt_tokens: int = Field(default=0, ge=0, description="Input/prompt tokens consumed")
    completion_tokens: int = Field(default=0, ge=0, description="Output/completion tokens consumed")
    user_email: str | None = Field(default=None, description="Employee email for attribution")
    latency_ms: int = Field(default=0, ge=0, description="Response duration in milliseconds")
    session_id: str | None = Field(default=None, description="IDE or CLI session identifier")
    client_metadata: dict[str, Any] | None = Field(default=None, description="Extra client details (git repo, branch, IDE version)")


class AIEmployeeUsageItem(BaseModel):
    """Employee-level token consumption, cost attribution, and budget status."""

    user_id: int
    name: str
    email: str
    role: str
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float
    requests_count: int
    monthly_cost_limit: float
    monthly_token_limit: int
    budget_used_percentage: float
    budget_status: str  # NORMAL, WARNING, EXCEEDED
    enforcement_action: str


class AIGovernanceSummaryMetrics(BaseModel):
    """High-level enterprise summary KPIs."""

    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float
    active_developers: int
    total_requests: int
    avg_cost_per_dev: float
    timeframe_days: int


class AIGovernanceSummaryResponse(BaseModel):
    """Comprehensive AI Governance analytics dashboard response."""

    summary: AIGovernanceSummaryMetrics
    tool_breakdown: list[dict[str, Any]]
    model_breakdown: list[dict[str, Any]]
    daily_trend: list[dict[str, Any]]
    employees: list[AIEmployeeUsageItem]


class AIUserQuotaUpdateRequest(BaseModel):
    """Request payload to adjust an employee's monthly AI allowance."""

    monthly_cost_limit_usd: float = Field(default=50.0, ge=0.0)
    monthly_token_limit: int = Field(default=5000000, ge=0)
    enforcement_action: str = Field(default="NOTIFY", description="NOTIFY or BLOCK")
