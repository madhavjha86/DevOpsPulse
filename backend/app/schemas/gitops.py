"""GitOps Drift Detection and Progressive Delivery Schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class GitOpsDriftItem(BaseModel):
    """Detailed drift difference between desired Git configuration and live cluster state."""

    resource_kind: str
    resource_name: str
    namespace: str
    diff_field: str
    git_value: str
    live_k8s_value: str
    severity: Literal["info", "warning", "critical"] = "warning"


class GitOpsApp(BaseModel):
    """Application managed under GitOps declarative control."""

    id: str
    name: str
    git_repo: str
    git_branch: str
    git_path: str
    cluster_name: str
    namespace: str
    sync_status: Literal["Synced", "OutOfSync", "DriftDetected"]
    health_status: Literal["Healthy", "Degraded", "Progressing"]
    target_revision: str
    live_revision: str
    last_synced_at: datetime
    drifts: list[GitOpsDriftItem] = Field(default_factory=list)


class GitOpsSyncRequest(BaseModel):
    """Trigger manual or automated synchronization from Git repository to cluster."""

    prune: bool = Field(default=False, description="Remove live resources absent from Git repo")
    dry_run: bool = Field(default=False, description="Simulate sync without mutating live cluster")


class GitOpsSyncResponse(BaseModel):
    """Result of GitOps synchronization operation."""

    sync_id: str
    status: Literal["SUCCESS", "FAILED", "DRY_RUN"]
    synced_resources: int
    message: str
    timestamp: datetime


class CanaryRollout(BaseModel):
    """Progressive delivery canary / blue-green release status."""

    app_id: str
    service_name: str
    canary_weight: int = Field(..., ge=0, le=100, description="Percentage of traffic sent to canary")
    baseline_weight: int = Field(..., ge=0, le=100)
    status: Literal["RUNNING", "PAUSED", "PROMOTED", "ABORTED"]
    canary_image: str
    baseline_image: str
    http_error_rate_canary: float
    http_error_rate_baseline: float
    p99_latency_canary_ms: float
    p99_latency_baseline_ms: float
    step_history: list[str] = Field(default_factory=list)


class CanaryAdjustRequest(BaseModel):
    """Adjust canary traffic weight or promote/rollback."""

    weight: int = Field(default=10, ge=0, le=100)
    action: Literal["SET_WEIGHT", "PROMOTE", "ROLLBACK"] = "SET_WEIGHT"
