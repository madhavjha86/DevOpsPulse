"""Workflow and Deployment Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel


class WorkflowRunResponse(BaseModel):
    """Public workflow run representation."""

    id: int
    repository_id: int
    github_id: int
    workflow_name: str
    run_number: int
    status: str
    conclusion: str | None = None
    branch: str | None = None
    event: str | None = None
    url: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunListResponse(BaseModel):
    """Paginated list of workflow runs."""

    workflow_runs: list[WorkflowRunResponse]
    total: int
    page: int
    per_page: int


class DeploymentResponse(BaseModel):
    """Public deployment representation."""

    id: int
    repository_id: int
    github_id: int
    environment: str
    status: str
    description: str | None = None
    ref: str | None = None
    sha: str | None = None
    deployed_at: datetime | None = None
    creator: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeploymentListResponse(BaseModel):
    """Paginated list of deployments."""

    deployments: list[DeploymentResponse]
    total: int
    page: int
    per_page: int


class WorkflowDispatchRequest(BaseModel):
    """Payload to trigger an on-demand workflow pipeline run."""

    repository_id: int
    workflow_name: str
    branch: str = "main"

