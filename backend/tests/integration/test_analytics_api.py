"""Integration tests for Analytics API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestAnalyticsAPI:
    """Dashboard statistics and trend charts tests."""

    @pytest.mark.asyncio
    async def test_dashboard_stats_endpoint(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.get("/api/v1/analytics/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_repositories" in data
        assert "total_commits" in data
        assert "build_success_rate" in data
        assert data["build_success_rate"] >= 0

    @pytest.mark.asyncio
    async def test_recent_activity_endpoint(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.get("/api/v1/analytics/recent-activity")
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert isinstance(data["activities"], list)

    @pytest.mark.asyncio
    async def test_build_trends_endpoint(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.get("/api/v1/analytics/build-trends?days=7")
        assert response.status_code == 200
        data = response.json()
        assert "labels" in data
        assert "success" in data
        assert "failure" in data
        assert len(data["labels"]) == 7
