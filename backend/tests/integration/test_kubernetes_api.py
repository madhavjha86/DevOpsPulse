"""Integration tests for Kubernetes Cluster & Pod Observability API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestKubernetesInfrastructureAPI:
    """Validate Kubernetes cluster registration, health diagnostics, pod listing, and scaling."""

    @pytest.mark.asyncio
    async def test_unauthorized_k8s_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = await client.get("/api/v1/infrastructure/k8s/clusters")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_clusters_auto_seeds_default(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """First fetch auto-seeds a default Local Minikube / Kind cluster entry."""
        client, user = authenticated_client
        response = await client.get("/api/v1/infrastructure/k8s/clusters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "api_server_url" in data[0]
        assert data[0]["name"] == "Local Minikube / Kind"

    @pytest.mark.asyncio
    async def test_create_and_delete_k8s_cluster(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """User can register a custom Kubernetes cluster and delete it."""
        client, user = authenticated_client
        payload = {
            "name": "EKS Prod Cluster",
            "api_server_url": "https://k8s-prod.company.com:6443",
            "auth_type": "token",
            "bearer_token": "k8s-mock-serviceaccount-token-xyz",
            "namespace_filter": "production",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/k8s/clusters", json=payload)
        assert res.status_code == 201
        created = res.json()
        assert created["name"] == "EKS Prod Cluster"
        assert created["namespace_filter"] == "production"
        cluster_id = created["id"]

        # Fetch cluster by ID
        get_res = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "EKS Prod Cluster"

        # Update cluster
        update_res = await client.put(
            f"/api/v1/infrastructure/k8s/clusters/{cluster_id}",
            json={"name": "EKS Prod Cluster Updated"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "EKS Prod Cluster Updated"

        # Delete cluster
        del_res = await client.delete(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}")
        assert del_res.status_code == 204

        # Verify not found after deletion
        not_found = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}")
        assert not_found.status_code == 404

    @pytest.mark.asyncio
    async def test_check_cluster_health_graceful_handling(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Health probe on unreachable api-server returns clean status without 500."""
        client, user = authenticated_client
        payload = {
            "name": "Offline Cluster",
            "api_server_url": "https://127.0.0.1:58888",
            "auth_type": "none",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/k8s/clusters", json=payload)
        assert res.status_code == 201
        cluster_id = res.json()["id"]

        health_res = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}/health")
        assert health_res.status_code == 200
        data = health_res.json()
        assert data["status"] in ("unreachable", "connected", "error", "auth_error")
        assert isinstance(data["connected"], bool)

    @pytest.mark.asyncio
    async def test_cluster_overview_and_resources_graceful_offline(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Overview, nodes, and pods endpoints return structured data even when cluster is offline."""
        client, user = authenticated_client
        payload = {
            "name": "Offline Node 2",
            "api_server_url": "https://127.0.0.1:58887",
            "auth_type": "none",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/k8s/clusters", json=payload)
        assert res.status_code == 201
        cluster_id = res.json()["id"]

        # Overview
        overview_res = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}/overview")
        assert overview_res.status_code == 200
        overview = overview_res.json()
        assert overview["cluster_id"] == cluster_id
        assert overview["cluster_status"] in ("unreachable", "connected")
        assert overview["crash_loop_count"] >= 0

        # Nodes
        nodes_res = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}/nodes")
        assert nodes_res.status_code == 200
        assert isinstance(nodes_res.json(), list)

        # Pods
        pods_res = await client.get(f"/api/v1/infrastructure/k8s/clusters/{cluster_id}/pods")
        assert pods_res.status_code == 200
        assert isinstance(pods_res.json(), list)
