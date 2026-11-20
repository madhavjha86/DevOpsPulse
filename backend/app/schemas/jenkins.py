"""Pydantic schemas for Jenkins CI/CD controllers, jobs, and builds."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class JenkinsServerCreate(BaseModel):
    """Payload to register a new Jenkins controller."""

    name: str = Field(..., min_length=2, max_length=100)
    server_url: str = Field(..., max_length=500)
    username: str | None = Field(default=None, max_length=100)
    api_token: str | None = Field(default=None, max_length=500)


class JenkinsServerUpdate(BaseModel):
    """Payload to update an existing Jenkins controller."""

    name: str | None = None
    server_url: str | None = None
    username: str | None = None
    api_token: str | None = None
    is_active: bool | None = None


class JenkinsBuildResponse(BaseModel):
    """Jenkins execution run schema."""

    id: int
    jenkins_job_id: int
    build_number: int
    build_url: str
    status: str  # SUCCESS, FAILURE, UNSTABLE, ABORTED, IN_PROGRESS
    duration_ms: int | None = None
    timestamp: datetime
    branch: str | None = None
    commit_sha: str | None = None
    triggered_by: str | None = None
    estimated_duration_ms: int | None = None
    console_log_snippet: str | None = None

    model_config = {"from_attributes": True}


class JenkinsJobResponse(BaseModel):
    """Jenkins job or pipeline representation."""

    id: int
    jenkins_server_id: int
    name: str
    job_url: str
    job_type: str
    color: str
    last_build_number: int | None = None
    last_build_status: str | None = None
    is_buildable: bool
    recent_builds: list[JenkinsBuildResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class JenkinsServerResponse(BaseModel):
    """Registered Jenkins server entity with health status."""

    id: int
    name: str
    server_url: str
    username: str | None = None
    is_active: bool
    last_status: str
    last_synced_at: datetime | None = None
    error_message: str | None = None
    jobs_count: int = 0
    jobs: list[JenkinsJobResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class JenkinsJobTriggerRequest(BaseModel):
    """Parameters to trigger a remote build."""

    parameters: dict[str, str] = Field(default_factory=dict)


class JenkinsLogResponse(BaseModel):
    """Console output from a Jenkins build."""

    job_name: str
    build_number: int
    logs: str
    has_more_data: bool = False
