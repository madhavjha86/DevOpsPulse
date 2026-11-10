"""Kubernetes Infrastructure API routes for cluster, node, and pod observability."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.k8s_monitoring import (
    K8sClusterCreate,
    K8sClusterResponse,
    K8sClusterUpdate,
    K8sNodeItem,
    K8sOverviewResponse,
    K8sPodItem,
    K8sPodLogsResponse,
    K8sScaleRequest,
    K8sScaleResponse,
)
from app.services.k8s_service import KubernetesService

router = APIRouter(prefix="/infrastructure/k8s", tags=["Kubernetes Infrastructure"])


@router.get(
    "/clusters",
    response_model=list[K8sClusterResponse],
    summary="List all configured Kubernetes clusters",
)
async def list_clusters(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[K8sClusterResponse]:
    """Fetch all clusters registered by the user. Auto-seeds default local cluster if none exist."""
    clusters = await KubernetesService.get_user_clusters(db, current_user.id)
    if not clusters:
        default_payload = K8sClusterCreate(
            name="Local Minikube / Kind",
            api_server_url="https://127.0.0.1:6443",
            auth_type="token",
            namespace_filter="all",
            tls_verify=False,
        )
        created = await KubernetesService.create_cluster(db, current_user.id, default_payload)
        return [created]
    return clusters


@router.post(
    "/clusters",
    response_model=K8sClusterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Kubernetes cluster",
)
async def create_cluster(
    payload: K8sClusterCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> K8sClusterResponse:
    """Connect a new Kubernetes cluster to DevOpsPulse."""
    return await KubernetesService.create_cluster(db, current_user.id, payload)


@router.get(
    "/clusters/{cluster_id}",
    response_model=K8sClusterResponse,
    summary="Get cluster configuration details",
)
async def get_cluster(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> K8sClusterResponse:
    """Retrieve details for a specific cluster."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return K8sClusterResponse.model_validate(cluster)


@router.put(
    "/clusters/{cluster_id}",
    response_model=K8sClusterResponse,
    summary="Update cluster settings",
)
async def update_cluster(
    cluster_id: int,
    payload: K8sClusterUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> K8sClusterResponse:
    """Update settings for a cluster."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.update_cluster(db, cluster, payload)


@router.delete(
    "/clusters/{cluster_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Kubernetes cluster",
)
async def delete_cluster(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a configured cluster."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    await KubernetesService.delete_cluster(db, cluster)


@router.get(
    "/clusters/{cluster_id}/health",
    summary="Test cluster connectivity and get K8s version",
)
async def check_cluster_health(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Probe Kubernetes API-server health and version info."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.check_cluster_health(db, cluster)


@router.get(
    "/clusters/{cluster_id}/overview",
    response_model=K8sOverviewResponse,
    summary="Cluster summary overview (nodes, pods, crash loops)",
)
async def get_cluster_overview(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> K8sOverviewResponse:
    """Retrieve cluster scorecard with node/pod status breakdown."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.get_overview(db, cluster)


@router.get(
    "/clusters/{cluster_id}/nodes",
    response_model=list[K8sNodeItem],
    summary="List cluster nodes with Ready conditions and capacity",
)
async def get_cluster_nodes(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[K8sNodeItem]:
    """Retrieve all cluster nodes."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.get_nodes(cluster)


@router.get(
    "/clusters/{cluster_id}/pods",
    response_model=list[K8sPodItem],
    summary="List pods with container statuses and CrashLoopBackOff detection",
)
async def get_cluster_pods(
    cluster_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    namespace: str | None = Query(default=None, description="Optional namespace filter"),
) -> list[K8sPodItem]:
    """Retrieve pods with restart loop detection."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.get_pods(cluster, namespace=namespace)


@router.get(
    "/clusters/{cluster_id}/pods/{pod_name}/logs",
    response_model=K8sPodLogsResponse,
    summary="Stream logs from a pod container",
)
async def get_pod_logs(
    cluster_id: int,
    pod_name: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    namespace: str = Query(default="default", description="Pod namespace"),
    tail: int = Query(default=100, ge=10, le=1000, description="Tail lines count"),
) -> K8sPodLogsResponse:
    """Retrieve stdout/stderr logs from a pod."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.get_pod_logs(cluster, namespace=namespace, pod_name=pod_name, tail=tail)


@router.post(
    "/clusters/{cluster_id}/deployments/{deployment_name}/scale",
    response_model=K8sScaleResponse,
    summary="Scale Kubernetes deployment replica count",
)
async def scale_deployment(
    cluster_id: int,
    deployment_name: str,
    payload: K8sScaleRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    namespace: str = Query(default="default", description="Deployment namespace"),
) -> K8sScaleResponse:
    """Scale a deployment's replicas up or down."""
    cluster = await KubernetesService.get_cluster_by_id(db, cluster_id, current_user.id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kubernetes cluster with ID {cluster_id} not found",
        )
    return await KubernetesService.scale_deployment(
        cluster, namespace=namespace, deployment_name=deployment_name, replicas=payload.replicas
    )
