"""Integration tests for Repository management API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestRepositoriesAPI:
    """Repository API integration tests."""

    @pytest.mark.asyncio
    async def test_list_repositories_empty(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.get("/api/v1/repositories")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["repositories"] == []

    @pytest.mark.asyncio
    async def test_import_repository_requires_connected_github_account(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.post(
            "/api/v1/repositories/import",
            json={"github_repo_full_name": "facebook/react"},
        )
        # Should reject because no GitHub account linked
        assert response.status_code == 400
        assert "GitHub account" in response.json()["detail"]
