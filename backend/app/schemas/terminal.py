"""Terminal and Remote Execution Schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class TerminalExecRequest(BaseModel):
    """Request payload to execute a command in a remote shell/pod/container."""

    target_type: Literal["k8s", "docker", "host"] = Field(
        ..., description="Execution target environment"
    )
    target_id: str = Field(
        ..., description="Pod name, container ID, or 'local-host'"
    )
    command: str = Field(
        ..., min_length=1, max_length=2000, description="Shell command string to execute"
    )
    namespace: str | None = Field(
        default="default", description="Kubernetes namespace (if target_type == 'k8s')"
    )
    working_dir: str | None = Field(
        default=None, description="Working directory inside target"
    )


class TerminalExecResponse(BaseModel):
    """Result of command execution in target environment."""

    session_id: str
    target_type: str
    target_id: str
    command: str
    output: str
    exit_code: int
    duration_ms: float
    timestamp: datetime


class TerminalTargetItem(BaseModel):
    """Available target for remote terminal connection."""

    id: str
    name: str
    type: Literal["k8s", "docker", "host"]
    namespace: str | None = None
    status: str
    details: str
