"""Pydantic schemas for Kubernetes Cluster and Pod Monitoring."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class K8sClusterBase(BaseModel):
    """Base fields for Kubernetes Cluster."""

    name: str = Field(..., min_length=1, max_length=100, description="Cluster name (e.g., EKS Production, Minikube)")
    api_server_url: str = Field(
        default="https://127.0.0.1:6443",
        description="Kubernetes API server endpoint (e.g., https://127.0.0.1:6443)",
    )
    auth_type: Literal["token", "certificate", "none"] = Field(
        default="token", description="Authentication mechanism"
    )
    bearer_token: str | None = Field(default=None, description="ServiceAccount bearer token")
    ca_certificate: str | None = Field(default=None, description="Optional PEM CA certificate")
    namespace_filter: str = Field(
        default="all", description="Default namespace filter (e.g. all, default, kube-system)"
    )
    tls_verify: bool = Field(default=False, description="Verify TLS certificate of api-server")


class K8sClusterCreate(K8sClusterBase):
    """Schema for registering a new Kubernetes cluster."""

    pass


class K8sClusterUpdate(BaseModel):
    """Schema for updating cluster configuration."""

    name: str | None = Field(default=None, max_length=100)
    api_server_url: str | None = Field(default=None, max_length=255)
    bearer_token: str | None = None
    namespace_filter: str | None = None
    tls_verify: bool | None = None
    is_active: bool | None = None


class K8sClusterResponse(BaseModel):
    """Cluster representation returned to client with token masked."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    api_server_url: str
    auth_type: str
    namespace_filter: str
    tls_verify: bool
    is_active: bool
    last_status: str
    last_connected_at: datetime | None = None
    k8s_version: str | None = None
    nodes_count: int = 0
    pods_count: int = 0
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class K8sNodeItem(BaseModel):
    """Cluster node specifications and conditions."""

    name: str
    status: str  # Ready, NotReady
    roles: list[str] = []
    kubelet_version: str
    os_image: str
    architecture: str
    cpu_capacity: str
    memory_capacity: str


class K8sContainerStatus(BaseModel):
    """Pod container runtime status and backoff diagnostics."""

    name: str
    ready: bool
    restart_count: int
    state: str  # running, waiting, terminated
    state_reason: str | None = None  # CrashLoopBackOff, ImagePullBackOff, OOMKilled
    state_message: str | None = None


class K8sPodItem(BaseModel):
    """Pod item with health and failure detection."""

    name: str
    namespace: str
    node_name: str | None = None
    phase: str  # Running, Pending, Succeeded, Failed, Unknown
    is_crash_loop: bool = False
    is_oom_killed: bool = False
    restarts_total: int = 0
    pod_ip: str | None = None
    start_time: str | None = None
    containers: list[K8sContainerStatus] = []


class K8sDeploymentItem(BaseModel):
    """Kubernetes Deployment workload."""

    name: str
    namespace: str
    replicas_desired: int
    replicas_ready: int
    replicas_available: int
    updated_replicas: int
    image: str
    created: str


class K8sOverviewResponse(BaseModel):
    """Cluster-level summary statistics."""

    cluster_id: int
    cluster_name: str
    cluster_status: str
    k8s_version: str | None = None
    nodes_total: int = 0
    nodes_ready: int = 0
    pods_total: int = 0
    pods_running: int = 0
    pods_pending: int = 0
    pods_failed: int = 0
    crash_loop_count: int = 0
    namespaces: list[str] = []


class K8sPodLogsResponse(BaseModel):
    """Pod logs output."""

    pod_name: str
    namespace: str
    lines: list[str]
    total_lines: int


class K8sScaleRequest(BaseModel):
    """Scale deployment replicas request."""

    replicas: int = Field(ge=0, le=100, description="Target replica count")


class K8sScaleResponse(BaseModel):
    """Scale operation result."""

    success: bool
    message: str
    deployment_name: str
    target_replicas: int
