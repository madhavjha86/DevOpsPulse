"""Integration tests for Docker Infrastructure Monitoring API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestDockerInfrastructureAPI:
    """Validate Docker host registration, diagnostics, container listing, and lifecycle actions."""

    @pytest.mark.asyncio
    async def test_unauthorized_docker_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = await client.get("/api/v1/infrastructure/docker/hosts")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_docker_hosts_auto_seeds_default(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """First fetch auto-seeds a default Local Docker Host entry."""
        client, user = authenticated_client
        response = await client.get("/api/v1/infrastructure/docker/hosts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == "Local Docker Daemon"
        assert "host_url" in data[0]

    @pytest.mark.asyncio
    async def test_create_and_delete_docker_host(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """User can register a custom Docker host and delete it."""
        client, user = authenticated_client
        create_payload = {
            "name": "Staging Node 01",
            "host_url": "http://192.168.1.100:2375",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/docker/hosts", json=create_payload)
        assert res.status_code == 201
        created = res.json()
        assert created["name"] == "Staging Node 01"
        host_id = created["id"]

        # Fetch host by ID
        get_res = await client.get(f"/api/v1/infrastructure/docker/hosts/{host_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Staging Node 01"

        # Update host
        update_res = await client.put(
            f"/api/v1/infrastructure/docker/hosts/{host_id}",
            json={"name": "Staging Node Updated"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Staging Node Updated"

        # Delete host
        del_res = await client.delete(f"/api/v1/infrastructure/docker/hosts/{host_id}")
        assert del_res.status_code == 204

        # Verify not found after deletion
        not_found = await client.get(f"/api/v1/infrastructure/docker/hosts/{host_id}")
        assert not_found.status_code == 404

    @pytest.mark.asyncio
    async def test_check_docker_host_health_graceful_handling(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Health check against an offline/unreachable Docker daemon returns structured status without 500."""
        client, user = authenticated_client
        create_payload = {
            "name": "Unreachable Node",
            "host_url": "http://127.0.0.1:59999",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/docker/hosts", json=create_payload)
        assert res.status_code == 201
        host_id = res.json()["id"]

        health_res = await client.get(f"/api/v1/infrastructure/docker/hosts/{host_id}/health")
        assert health_res.status_code == 200
        health = health_res.json()
        assert health["status"] in ("unreachable", "error", "connected")
        assert isinstance(health["connected"], bool)

    @pytest.mark.asyncio
    async def test_list_containers_graceful_offline_handling(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Listing containers for an offline daemon returns clean empty list and status."""
        client, user = authenticated_client
        create_payload = {
            "name": "Offline Daemon",
            "host_url": "http://127.0.0.1:59998",
            "tls_verify": False,
        }
        res = await client.post("/api/v1/infrastructure/docker/hosts", json=create_payload)
        assert res.status_code == 201
        host_id = res.json()["id"]

        containers_res = await client.get(f"/api/v1/infrastructure/docker/hosts/{host_id}/containers")
        assert containers_res.status_code == 200
        cdata = containers_res.json()
        assert cdata["host_id"] == host_id
        assert cdata["host_status"] in ("unreachable", "connected", "error")
        assert isinstance(cdata["containers"], list)
