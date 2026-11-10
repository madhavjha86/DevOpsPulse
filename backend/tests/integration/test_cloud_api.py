"""Integration tests for Cloud Provider Monitoring (AWS, Azure, GCP) API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestCloudInfrastructureAPI:
    """Validate Cloud provider account registration, credential encryption, health, and metrics."""

    @pytest.mark.asyncio
    async def test_unauthorized_cloud_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = await client.get("/api/v1/infrastructure/cloud/accounts")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_cloud_accounts_auto_seeds_default(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """First fetch auto-seeds a default AWS account entry."""
        client, user = authenticated_client
        response = await client.get("/api/v1/infrastructure/cloud/accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["provider"] == "aws"
        assert "masked_identifier" in data[0]

    @pytest.mark.asyncio
    async def test_create_and_delete_aws_account(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """User can register an AWS account with encrypted credentials and delete it."""
        client, user = authenticated_client
        payload = {
            "provider": "aws",
            "name": "AWS Production East",
            "region": "us-east-1",
            "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
            "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        res = await client.post("/api/v1/infrastructure/cloud/accounts", json=payload)
        assert res.status_code == 201
        created = res.json()
        assert created["name"] == "AWS Production East"
        assert created["provider"] == "aws"
        # Ensure raw secret is never leaked back to client
        assert "wJalrXUtn" not in str(created)
        assert created["masked_identifier"] == "AKIA...MPLE"
        account_id = created["id"]

        # Fetch account by ID
        get_res = await client.get(f"/api/v1/infrastructure/cloud/accounts/{account_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "AWS Production East"

        # Update account
        update_res = await client.put(
            f"/api/v1/infrastructure/cloud/accounts/{account_id}",
            json={"name": "AWS Production East Updated", "region": "us-west-2"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "AWS Production East Updated"
        assert update_res.json()["region"] == "us-west-2"

        # Delete account
        del_res = await client.delete(f"/api/v1/infrastructure/cloud/accounts/{account_id}")
        assert del_res.status_code == 204

        # Verify not found after deletion
        not_found = await client.get(f"/api/v1/infrastructure/cloud/accounts/{account_id}")
        assert not_found.status_code == 404

    @pytest.mark.asyncio
    async def test_create_azure_and_gcp_accounts(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Register Azure and GCP accounts and verify credential encryption and masking."""
        client, user = authenticated_client

        # 1. Azure
        azure_payload = {
            "provider": "azure",
            "name": "Azure Enterprise Staging",
            "region": "eastus",
            "azure_subscription_id": "12345678-1234-1234-1234-123456789abc",
            "azure_tenant_id": "tenant-uuid-0001",
            "azure_client_id": "client-uuid-0002",
            "azure_client_secret": "super-secret-azure-key",
        }
        az_res = await client.post("/api/v1/infrastructure/cloud/accounts", json=azure_payload)
        assert az_res.status_code == 201
        az_data = az_res.json()
        assert az_data["provider"] == "azure"
        assert "super-secret" not in str(az_data)
        assert az_data["masked_identifier"] == "sub-...9abc"

        # 2. GCP
        gcp_payload = {
            "provider": "gcp",
            "name": "GCP Cloud Core",
            "region": "us-central1",
            "gcp_project_id": "pulse-prod-382910",
            "gcp_service_account_json": '{"type": "service_account", "project_id": "pulse-prod-382910"}',
        }
        gcp_res = await client.post("/api/v1/infrastructure/cloud/accounts", json=gcp_payload)
        assert gcp_res.status_code == 201
        gcp_data = gcp_res.json()
        assert gcp_data["provider"] == "gcp"
        assert gcp_data["masked_identifier"] == "pulse-prod-382910"

    @pytest.mark.asyncio
    async def test_check_cloud_account_health_graceful_handling(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Health check returns structured diagnostics without crashing or 500 error."""
        client, user = authenticated_client
        payload = {
            "provider": "aws",
            "name": "AWS Test Dummy",
            "region": "us-east-1",
        }
        res = await client.post("/api/v1/infrastructure/cloud/accounts", json=payload)
        assert res.status_code == 201
        account_id = res.json()["id"]

        health_res = await client.get(f"/api/v1/infrastructure/cloud/accounts/{account_id}/health")
        assert health_res.status_code == 200
        hdata = health_res.json()
        assert hdata["status"] in ("unconfigured", "connected", "auth_error", "unreachable")
        assert "message" in hdata

    @pytest.mark.asyncio
    async def test_get_cloud_overview_and_metrics(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Overview and metrics endpoints return structured resource and timeseries data."""
        client, user = authenticated_client
        payload = {
            "provider": "aws",
            "name": "AWS Inventory Test",
            "region": "us-east-1",
            "aws_access_key_id": "AKIAVALIDKEYFORTEST1",
            "aws_secret_access_key": "VALIDSECRETKEYTEST",
        }
        res = await client.post("/api/v1/infrastructure/cloud/accounts", json=payload)
        assert res.status_code == 201
        account_id = res.json()["id"]

        # Overview
        ov_res = await client.get(f"/api/v1/infrastructure/cloud/accounts/{account_id}/overview")
        assert ov_res.status_code == 200
        ov_data = ov_res.json()
        assert ov_data["account_id"] == account_id
        assert ov_data["provider"] == "aws"
        assert isinstance(ov_data["resources"], list)

        # Metrics
        m_res = await client.get(f"/api/v1/infrastructure/cloud/accounts/{account_id}/metrics")
        assert m_res.status_code == 200
        m_data = m_res.json()
        assert m_data["account_id"] == account_id
        assert len(m_data["timestamps"]) == len(m_data["cpu_utilization"])
        assert m_data["estimated_monthly_cost_usd"] >= 0
