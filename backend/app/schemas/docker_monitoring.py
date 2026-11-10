"""Pydantic schemas for Docker Container Monitoring and Host Management."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class DockerHostBase(BaseModel):
    """Base fields for Docker host."""

    name: str = Field(..., min_length=1, max_length=100, description="Friendly name for the Docker host")
    host_url: str = Field(
        default="http://localhost:2375",
        description="Docker daemon connection endpoint (e.g., http://localhost:2375, unix:///var/run/docker.sock)",
    )
    tls_verify: bool = Field(default=False, description="Enable TLS verification for remote daemon")


class DockerHostCreate(DockerHostBase):
    """Schema for registering a new Docker host."""

    pass


class DockerHostUpdate(BaseModel):
    """Schema for updating an existing Docker host."""

    name: str | None = Field(default=None, max_length=100)
    host_url: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    tls_verify: bool | None = None


class DockerHostResponse(DockerHostBase):
    """Schema representing a saved Docker host with connection telemetry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_active: bool
    last_status: str
    last_connected_at: datetime | None = None
    server_version: str | None = None
    containers_count: int = 0
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class DockerPortMapping(BaseModel):
    """Port forwarding mapping between container and host."""

    host_ip: str | None = None
    host_port: int | None = None
    container_port: int
    protocol: str = "tcp"


class ContainerStats(BaseModel):
    """Real-time CPU and Memory telemetry snapshot."""

    cpu_percent: float = Field(default=0.0, description="CPU utilization percentage")
    memory_usage_mb: float = Field(default=0.0, description="Memory used in megabytes")
    memory_limit_mb: float = Field(default=0.0, description="Memory limit in megabytes")
    memory_percent: float = Field(default=0.0, description="Memory utilization percentage")
    network_rx_mb: float = Field(default=0.0, description="Network received megabytes")
    network_tx_mb: float = Field(default=0.0, description="Network transmitted megabytes")


class DockerContainerItem(BaseModel):
    """Container item summary."""

    id: str
    name: str
    image: str
    state: str = Field(description="Current state: running, exited, restarting, paused, created")
    status: str = Field(description="Human readable status string: e.g. Up 4 hours")
    created: str
    ports: list[DockerPortMapping] = []
    stats: ContainerStats | None = None


class DockerContainerListResponse(BaseModel):
    """List of containers for a Docker host."""

    host_id: int
    host_name: str
    host_status: str
    total_containers: int
    running_count: int
    stopped_count: int
    paused_count: int
    containers: list[DockerContainerItem]


class DockerActionRequest(BaseModel):
    """Request payload to control container state."""

    action: Literal["start", "stop", "restart", "pause", "unpause"]


class DockerActionResponse(BaseModel):
    """Result of container lifecycle action."""

    success: bool
    message: str
    container_id: str
    new_state: str | None = None


class DockerLogsResponse(BaseModel):
    """Container logs response."""

    container_id: str
    lines: list[str]
    total_lines: int


class DockerHealthResponse(BaseModel):
    """Connection health check response for a Docker host."""

    status: str
    connected: bool
    server_version: str | None = None
    os: str | None = None
    architecture: str | None = None
    containers_total: int = 0
    containers_running: int = 0
    containers_stopped: int = 0
    containers_paused: int = 0
    error_message: str | None = None
