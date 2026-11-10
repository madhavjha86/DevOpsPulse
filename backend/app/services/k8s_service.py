"""Kubernetes API server client and cluster/pod observability service."""

from datetime import datetime, timezone
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.k8s_cluster import K8sCluster
from app.schemas.k8s_monitoring import (
    K8sClusterCreate,
    K8sClusterResponse,
    K8sClusterUpdate,
    K8sContainerStatus,
    K8sDeploymentItem,
    K8sNodeItem,
    K8sOverviewResponse,
    K8sPodItem,
    K8sPodLogsResponse,
    K8sScaleResponse,
)

logger = get_logger("k8s_service")


class KubernetesService:
    """Service communicating with Kubernetes API-Server for nodes, pods, and workload telemetry."""

    @classmethod
    def _get_client_kwargs(cls, cluster: K8sCluster) -> dict:
        """Build HTTP client parameters with bearer token auth and TLS settings."""
        headers: dict[str, str] = {
            "Accept": "application/json",
        }
        if cluster.bearer_token:
            clean_token = cluster.bearer_token.strip()
            headers["Authorization"] = f"Bearer {clean_token}"

        base_url = cluster.api_server_url.strip().rstrip("/")
        return {
            "base_url": base_url,
            "headers": headers,
            "verify": cluster.tls_verify,
            "timeout": 4.0,
        }

    @classmethod
    async def get_user_clusters(cls, db: AsyncSession, user_id: int) -> list[K8sClusterResponse]:
        """List all configured Kubernetes clusters for a user."""
        stmt = (
            select(K8sCluster)
            .where(K8sCluster.user_id == user_id)
            .order_by(K8sCluster.created_at.desc())
        )
        res = await db.execute(stmt)
        clusters = res.scalars().all()
        return [K8sClusterResponse.model_validate(c) for c in clusters]

    @classmethod
    async def get_cluster_by_id(
        cls, db: AsyncSession, cluster_id: int, user_id: int
    ) -> K8sCluster | None:
        """Fetch a specific cluster owned by user."""
        stmt = select(K8sCluster).where(
            K8sCluster.id == cluster_id,
            K8sCluster.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def create_cluster(
        cls, db: AsyncSession, user_id: int, payload: K8sClusterCreate
    ) -> K8sClusterResponse:
        """Register a new Kubernetes cluster endpoint."""
        cluster = K8sCluster(
            user_id=user_id,
            name=payload.name.strip(),
            api_server_url=payload.api_server_url.strip(),
            auth_type=payload.auth_type,
            bearer_token=payload.bearer_token.strip() if payload.bearer_token else None,
            ca_certificate=payload.ca_certificate,
            namespace_filter=payload.namespace_filter.strip(),
            tls_verify=payload.tls_verify,
            is_active=True,
            last_status="unknown",
        )
        db.add(cluster)
        await db.commit()
        await db.refresh(cluster)

        # Trigger health check
        await cls.check_cluster_health(db, cluster)
        await db.refresh(cluster)
        return K8sClusterResponse.model_validate(cluster)

    @classmethod
    async def update_cluster(
        cls, db: AsyncSession, cluster: K8sCluster, payload: K8sClusterUpdate
    ) -> K8sClusterResponse:
        """Update cluster settings."""
        if payload.name is not None:
            cluster.name = payload.name.strip()
        if payload.api_server_url is not None:
            cluster.api_server_url = payload.api_server_url.strip()
        if payload.bearer_token is not None:
            cluster.bearer_token = payload.bearer_token.strip() if payload.bearer_token else None
        if payload.namespace_filter is not None:
            cluster.namespace_filter = payload.namespace_filter.strip()
        if payload.tls_verify is not None:
            cluster.tls_verify = payload.tls_verify
        if payload.is_active is not None:
            cluster.is_active = payload.is_active

        await db.commit()
        await db.refresh(cluster)
        return K8sClusterResponse.model_validate(cluster)

    @classmethod
    async def delete_cluster(cls, db: AsyncSession, cluster: K8sCluster) -> bool:
        """Remove a configured cluster."""
        await db.delete(cluster)
        await db.commit()
        return True

    @classmethod
    async def check_cluster_health(cls, db: AsyncSession, cluster: K8sCluster) -> dict:
        """Probe Kubernetes API-Server /version and /livez."""
        kwargs = cls._get_client_kwargs(cluster)
        try:
            async with httpx.AsyncClient(**kwargs) as client:
                resp = await client.get("/version")
                if resp.status_code == 200:
                    vdata = resp.json()
                    git_ver = vdata.get("gitVersion", "Unknown")
                    cluster.last_status = "connected"
                    cluster.k8s_version = git_ver
                    cluster.last_connected_at = datetime.now(timezone.utc)
                    cluster.error_message = None
                    await db.commit()
                    return {
                        "status": "connected",
                        "connected": True,
                        "k8s_version": git_ver,
                        "major": vdata.get("major"),
                        "minor": vdata.get("minor"),
                    }
                elif resp.status_code in (401, 403):
                    msg = f"Authentication rejected by API-server: HTTP {resp.status_code}"
                    cluster.last_status = "auth_error"
                    cluster.error_message = msg
                    await db.commit()
                    return {"status": "auth_error", "connected": False, "error_message": msg}
                else:
                    msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    cluster.last_status = "error"
                    cluster.error_message = msg
                    await db.commit()
                    return {"status": "error", "connected": False, "error_message": msg}
        except Exception as exc:
            msg = f"Could not connect to Kubernetes API server at {cluster.api_server_url}: {type(exc).__name__}"
            logger.warning("Kubernetes cluster connection failed", cluster_id=cluster.id, error=str(exc))
            cluster.last_status = "unreachable"
            cluster.error_message = msg
            await db.commit()
            return {"status": "unreachable", "connected": False, "error_message": msg}

    @classmethod
    async def get_overview(cls, db: AsyncSession, cluster: K8sCluster) -> K8sOverviewResponse:
        """Calculate high-level cluster metrics: total nodes, pods, and CrashLoopBackOff counts."""
        kwargs = cls._get_client_kwargs(cluster)
        try:
            async with httpx.AsyncClient(**kwargs) as client:
                # 1. Version check
                v_resp = await client.get("/version")
                k8s_ver = v_resp.json().get("gitVersion") if v_resp.status_code == 200 else None

                # 2. Nodes
                nodes_resp = await client.get("/api/v1/nodes")
                nodes_total = 0
                nodes_ready = 0
                if nodes_resp.status_code == 200:
                    items = nodes_resp.json().get("items", [])
                    nodes_total = len(items)
                    for n in items:
                        for cond in n.get("status", {}).get("conditions", []):
                            if cond.get("type") == "Ready" and cond.get("status") == "True":
                                nodes_ready += 1
                                break

                # 3. Namespaces
                ns_resp = await client.get("/api/v1/namespaces")
                namespaces = ["default", "kube-system"]
                if ns_resp.status_code == 200:
                    namespaces = [
                        item.get("metadata", {}).get("name", "")
                        for item in ns_resp.json().get("items", [])
                        if item.get("metadata", {}).get("name")
                    ]

                # 4. Pods
                pods_url = "/api/v1/pods"
                if cluster.namespace_filter and cluster.namespace_filter != "all":
                    pods_url = f"/api/v1/namespaces/{cluster.namespace_filter}/pods"

                pods_resp = await client.get(pods_url)
                pods_total = 0
                pods_running = 0
                pods_pending = 0
                pods_failed = 0
                crash_loop_count = 0

                if pods_resp.status_code == 200:
                    pod_items = pods_resp.json().get("items", [])
                    pods_total = len(pod_items)
                    for p in pod_items:
                        phase = p.get("status", {}).get("phase", "Unknown")
                        if phase == "Running":
                            pods_running += 1
                        elif phase == "Pending":
                            pods_pending += 1
                        elif phase in ("Failed", "Error"):
                            pods_failed += 1

                        # CrashLoopBackOff detection
                        for cs in p.get("status", {}).get("containerStatuses", []):
                            waiting = cs.get("state", {}).get("waiting", {})
                            terminated = cs.get("lastState", {}).get("terminated", {})
                            reason = waiting.get("reason", "") or terminated.get("reason", "")
                            if reason in ("CrashLoopBackOff", "OOMKilled", "ImagePullBackOff"):
                                crash_loop_count += 1
                                break

                cluster.last_status = "connected"
                cluster.k8s_version = k8s_ver
                cluster.nodes_count = nodes_total
                cluster.pods_count = pods_total
                cluster.last_connected_at = datetime.now(timezone.utc)
                cluster.error_message = None
                await db.commit()

                return K8sOverviewResponse(
                    cluster_id=cluster.id,
                    cluster_name=cluster.name,
                    cluster_status="connected",
                    k8s_version=k8s_ver,
                    nodes_total=nodes_total,
                    nodes_ready=nodes_ready,
                    pods_total=pods_total,
                    pods_running=pods_running,
                    pods_pending=pods_pending,
                    pods_failed=pods_failed,
                    crash_loop_count=crash_loop_count,
                    namespaces=namespaces,
                )
        except Exception as exc:
            cluster.last_status = "unreachable"
            cluster.error_message = str(exc)
            await db.commit()
            return K8sOverviewResponse(
                cluster_id=cluster.id,
                cluster_name=cluster.name,
                cluster_status="unreachable",
                k8s_version=None,
                nodes_total=0,
                nodes_ready=0,
                pods_total=0,
                pods_running=0,
                pods_pending=0,
                pods_failed=0,
                crash_loop_count=0,
                namespaces=["default"],
            )

    @classmethod
    async def get_nodes(cls, cluster: K8sCluster) -> list[K8sNodeItem]:
        """Fetch nodes list with specs, capacity, and Ready conditions."""
        kwargs = cls._get_client_kwargs(cluster)
        try:
            async with httpx.AsyncClient(**kwargs) as client:
                resp = await client.get("/api/v1/nodes")
                if resp.status_code != 200:
                    return []

                nodes: list[K8sNodeItem] = []
                for n in resp.json().get("items", []):
                    name = n.get("metadata", {}).get("name", "unknown")
                    labels = n.get("metadata", {}).get("labels", {})
                    roles = [
                        k.split("/")[-1]
                        for k in labels.keys()
                        if "node-role.kubernetes.io/" in k
                    ]
                    if not roles:
                        roles = ["worker"]

                    status = "NotReady"
                    for cond in n.get("status", {}).get("conditions", []):
                        if cond.get("type") == "Ready" and cond.get("status") == "True":
                            status = "Ready"
                            break

                    node_info = n.get("status", {}).get("nodeInfo", {})
                    capacity = n.get("status", {}).get("capacity", {})

                    nodes.append(
                        K8sNodeItem(
                            name=name,
                            status=status,
                            roles=roles,
                            kubelet_version=node_info.get("kubeletVersion", "unknown"),
                            os_image=node_info.get("osImage", "unknown"),
                            architecture=node_info.get("architecture", "amd64"),
                            cpu_capacity=capacity.get("cpu", "0"),
                            memory_capacity=capacity.get("memory", "0Ki"),
                        )
                    )
                return nodes
        except Exception:
            return []

    @classmethod
    async def get_pods(
        cls, cluster: K8sCluster, namespace: str | None = None
    ) -> list[K8sPodItem]:
        """List pods with container statuses and CrashLoopBackOff detection."""
        kwargs = cls._get_client_kwargs(cluster)
        target_ns = namespace or (cluster.namespace_filter if cluster.namespace_filter != "all" else None)
        endpoint = f"/api/v1/namespaces/{target_ns}/pods" if target_ns else "/api/v1/pods"

        try:
            async with httpx.AsyncClient(**kwargs) as client:
                resp = await client.get(endpoint)
                if resp.status_code != 200:
                    return []

                pods: list[K8sPodItem] = []
                for p in resp.json().get("items", []):
                    meta = p.get("metadata", {})
                    name = meta.get("name", "unnamed")
                    ns = meta.get("namespace", "default")
                    spec = p.get("spec", {})
                    status_obj = p.get("status", {})
                    phase = status_obj.get("phase", "Unknown")
                    node_name = spec.get("nodeName")
                    pod_ip = status_obj.get("podIP")
                    start_time = status_obj.get("startTime")

                    is_crash_loop = False
                    is_oom_killed = False
                    restarts_total = 0
                    container_statuses: list[K8sContainerStatus] = []

                    for cs in status_obj.get("containerStatuses", []):
                        c_name = cs.get("name", "")
                        ready = cs.get("ready", False)
                        restarts = cs.get("restartCount", 0)
                        restarts_total += restarts

                        state_dict = cs.get("state", {})
                        state_name = "running" if "running" in state_dict else "waiting" if "waiting" in state_dict else "terminated"
                        
                        waiting_obj = state_dict.get("waiting", {})
                        term_obj = state_dict.get("terminated", {})
                        last_term_obj = cs.get("lastState", {}).get("terminated", {})

                        reason = (
                            waiting_obj.get("reason")
                            or term_obj.get("reason")
                            or last_term_obj.get("reason")
                        )
                        message = (
                            waiting_obj.get("message")
                            or term_obj.get("message")
                            or last_term_obj.get("message")
                        )

                        if reason in ("CrashLoopBackOff", "ImagePullBackOff"):
                            is_crash_loop = True
                        if reason == "OOMKilled":
                            is_oom_killed = True

                        container_statuses.append(
                            K8sContainerStatus(
                                name=c_name,
                                ready=ready,
                                restart_count=restarts,
                                state=state_name,
                                state_reason=reason,
                                state_message=message,
                            )
                        )

                    pods.append(
                        K8sPodItem(
                            name=name,
                            namespace=ns,
                            node_name=node_name,
                            phase=phase,
                            is_crash_loop=is_crash_loop,
                            is_oom_killed=is_oom_killed,
                            restarts_total=restarts_total,
                            pod_ip=pod_ip,
                            start_time=start_time,
                            containers=container_statuses,
                        )
                    )
                return pods
        except Exception:
            return []

    @classmethod
    async def get_pod_logs(
        cls, cluster: K8sCluster, namespace: str, pod_name: str, tail: int = 100
    ) -> K8sPodLogsResponse:
        """Fetch stdout and stderr logs for a pod."""
        kwargs = cls._get_client_kwargs(cluster)
        try:
            async with httpx.AsyncClient(**kwargs) as client:
                resp = await client.get(
                    f"/api/v1/namespaces/{namespace}/pods/{pod_name}/log",
                    params={"tailLines": str(tail), "timestamps": "true"},
                )
                if resp.status_code != 200:
                    return K8sPodLogsResponse(
                        pod_name=pod_name,
                        namespace=namespace,
                        lines=[f"Error fetching pod logs: HTTP {resp.status_code} {resp.text[:200]}"],
                        total_lines=1,
                    )

                lines = [line for line in resp.text.split("\n") if line.strip()]
                return K8sPodLogsResponse(
                    pod_name=pod_name,
                    namespace=namespace,
                    lines=lines,
                    total_lines=len(lines),
                )
        except Exception as exc:
            return K8sPodLogsResponse(
                pod_name=pod_name,
                namespace=namespace,
                lines=[f"Connection failed to api-server: {exc}"],
                total_lines=1,
            )

    @classmethod
    async def scale_deployment(
        cls, cluster: K8sCluster, namespace: str, deployment_name: str, replicas: int
    ) -> K8sScaleResponse:
        """Update replica count for a deployment."""
        kwargs = cls._get_client_kwargs(cluster)
        endpoint = f"/apis/apps/v1/namespaces/{namespace}/deployments/{deployment_name}/scale"
        headers = dict(kwargs.get("headers", {}))
        headers["Content-Type"] = "application/merge-patch+json"

        try:
            async with httpx.AsyncClient(
                base_url=kwargs["base_url"],
                headers=headers,
                verify=kwargs["verify"],
                timeout=kwargs["timeout"],
            ) as client:
                patch_payload = {"spec": {"replicas": replicas}}
                resp = await client.patch(endpoint, json=patch_payload)
                if resp.status_code in (200, 201):
                    return K8sScaleResponse(
                        success=True,
                        message=f"Deployment '{deployment_name}' scaled to {replicas} replicas.",
                        deployment_name=deployment_name,
                        target_replicas=replicas,
                    )
                return K8sScaleResponse(
                    success=False,
                    message=f"Scaling failed: HTTP {resp.status_code} {resp.text[:200]}",
                    deployment_name=deployment_name,
                    target_replicas=replicas,
                )
        except Exception as exc:
            return K8sScaleResponse(
                success=False,
                message=f"Request to api-server failed: {exc}",
                deployment_name=deployment_name,
                target_replicas=replicas,
            )
