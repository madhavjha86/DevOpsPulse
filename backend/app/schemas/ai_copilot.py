"""Pydantic schemas for AI DevOps Copilot conversations and Root Cause Analysis (RCA)."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class AIMessageCreate(BaseModel):
    """Payload to send a message to the AI DevOps Copilot."""

    content: str = Field(..., min_length=1, max_length=10000)
    context_metadata: dict[str, Any] = Field(default_factory=dict)


class AIMessageResponse(BaseModel):
    """A message in an AI Copilot chat thread."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant", "system"]
    content: str
    context_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AIConversationCreate(BaseModel):
    """Payload to start a new Copilot discussion."""

    title: str | None = Field(default=None, max_length=255)
    initial_message: str | None = Field(default=None, max_length=10000)
    context_metadata: dict[str, Any] = Field(default_factory=dict)


class AIConversationResponse(BaseModel):
    """Summary of an AI Copilot conversation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class AIConversationDetailResponse(BaseModel):
    """Full AI Copilot conversation thread with messages."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[AIMessageResponse] = []


class GenerateRCARequest(BaseModel):
    """Request to generate Root Cause Analysis on a failed workflow or log error."""

    workflow_run_id: int | None = None
    repository_id: int | None = None
    log_excerpt: str | None = Field(default=None, max_length=50000)
    job_name: str | None = None


class AIRootCauseAnalysisResponse(BaseModel):
    """Root Cause Analysis report with remediation steps and suggested patch."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_run_id: int | None = None
    repository_id: int | None = None
    failure_category: str
    severity: str
    summary: str
    root_cause: str
    remediation_steps: list[str] = []
    suggested_fix_diff: str | None = None
    confidence_score: float
    status: str
    created_at: datetime


class UpdateRCAStatusRequest(BaseModel):
    """Update RCA workflow status."""

    status: Literal["acknowledged", "resolved"]
