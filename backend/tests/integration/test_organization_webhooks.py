"""Integration tests for Outbound Webhook Alerting (Slack, Discord, Teams, Custom)."""

from unittest.mock import AsyncMock, patch
import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import OrganizationRole
from app.models.user import User
from app.services.organization_service import OrganizationService
from app.services.webhook_dispatcher import WebhookDispatcher


@pytest.mark.asyncio
async def test_webhook_crud_and_test_ping(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test full lifecycle of outbound webhooks: Create, List, Test Ping, and Delete."""
    # 1. Register owner user and create an organization
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wh_owner@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "Webhook Owner",
            "username": "wh_owner",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "Alerts Test Org",
            "slug": "alerts-test-org",
            "type": "COMPANY",
        },
    )
    assert create_org_resp.status_code == 201
    org_id = create_org_resp.json()["id"]

    # 2. Create Slack Webhook
    create_wh_resp = await client.post(
        f"/api/v1/organizations/{org_id}/webhooks",
        headers=headers,
        json={
            "name": "#devops-alerts",
            "target_type": "SLACK",
            "url": "https://hooks.slack.com/services/T00/B00/X00",
            "events": ["incident.created", "incident.resolved", "incident.critical"],
            "secret": "my-shared-slack-secret",
        },
    )
    assert create_wh_resp.status_code == 201
    wh_data = create_wh_resp.json()
    assert wh_data["name"] == "#devops-alerts"
    assert wh_data["target_type"] == "SLACK"
    assert wh_data["has_secret"] is True
    assert "incident.created" in wh_data["events"]
    webhook_id = wh_data["id"]

    # 3. List Webhooks
    list_wh_resp = await client.get(
        f"/api/v1/organizations/{org_id}/webhooks",
        headers=headers,
    )
    assert list_wh_resp.status_code == 200
    all_webhooks = list_wh_resp.json()
    assert len(all_webhooks) == 1
    assert all_webhooks[0]["id"] == webhook_id

    # 4. Dispatch Test Ping (Mocked HTTP response in WebhookDispatcher)
    mock_client_instance = AsyncMock()
    mock_client_instance.__aenter__.return_value.post.return_value = httpx.Response(
        status_code=200,
        text="ok",
        request=httpx.Request("POST", "https://hooks.slack.com/services/T00/B00/X00"),
    )
    with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client_instance):
        test_resp = await client.post(
            f"/api/v1/organizations/{org_id}/webhooks/{webhook_id}/test",
            headers=headers,
        )
        assert test_resp.status_code == 200
        test_data = test_resp.json()
        assert test_data["success"] is True
        assert test_data["status_code"] == 200
        assert "Delivered test alert successfully" in test_data["message"]

    # 5. Verify payload formatting
    slack_payload, _ = WebhookDispatcher.format_payload(
        target_type="SLACK",
        event_type="incident.created",
        title="Incident Alert: High Memory Usage",
        details={"severity": "CRITICAL", "service": "auth-service"},
    )
    assert "attachments" in slack_payload
    assert slack_payload["attachments"][0]["color"] == "#E11D48"

    discord_payload, _ = WebhookDispatcher.format_payload(
        target_type="DISCORD",
        event_type="incident.resolved",
        title="Incident Resolved: Auth Service",
        details={"service": "auth-service", "new_status": "RESOLVED"},
    )
    assert "embeds" in discord_payload
    assert discord_payload["embeds"][0]["color"] == 0x10B981

    teams_payload, _ = WebhookDispatcher.format_payload(
        target_type="TEAMS",
        event_type="incident.created",
        title="Teams Alert",
        details={"service": "worker-api"},
    )
    assert teams_payload["@type"] == "MessageCard"

    # 6. Delete Webhook
    del_resp = await client.delete(
        f"/api/v1/organizations/{org_id}/webhooks/{webhook_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verify list is empty
    empty_list_resp = await client.get(
        f"/api/v1/organizations/{org_id}/webhooks",
        headers=headers,
    )
    assert empty_list_resp.status_code == 200
    assert len(empty_list_resp.json()) == 0


@pytest.mark.asyncio
async def test_incident_lifecycle_triggers_webhook_dispatch(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify that creating and resolving incidents dispatches webhook notifications."""
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "inc_wh_owner@devopspulse.io",
            "password": "StrongPassword123!",
            "full_name": "Incident Webhook Owner",
            "username": "inc_wh_owner",
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_org_resp = await client.post(
        "/api/v1/organizations",
        headers=headers,
        json={
            "name": "Incident Alert Org",
            "slug": "incident-alert-org",
            "type": "COMPANY",
        },
    )
    org_id = create_org_resp.json()["id"]

    # Create active webhook channel
    wh_resp = await client.post(
        f"/api/v1/organizations/{org_id}/webhooks",
        headers=headers,
        json={
            "name": "#war-room-alerts",
            "target_type": "SLACK",
            "url": "https://hooks.slack.com/services/T01/B01/W01",
            "events": ["incident.created", "incident.critical", "incident.resolved"],
        },
    )
    assert wh_resp.status_code == 201

    mock_client_instance = AsyncMock()
    mock_client_instance.__aenter__.return_value.post.return_value = httpx.Response(
        status_code=200,
        text="ok",
        request=httpx.Request("POST", "https://hooks.slack.com/services/T01/B01/W01"),
    )

    with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client_instance):
        # Create critical incident
        inc_resp = await client.post(
            "/api/v1/incidents",
            headers=headers,
            json={
                "title": "Payment Gateway 502 Outage",
                "description": "Downstream payment processor returned elevated HTTP 502 rates",
                "severity": "CRITICAL",
                "priority": "P1",
                "service": "payment-api",
                "environment": "production",
            },
        )
        assert inc_resp.status_code == 201
        inc_id = inc_resp.json()["id"]

        # Resolve incident
        res_resp = await client.put(
            f"/api/v1/incidents/{inc_id}/status",
            headers=headers,
            json={
                "status": "RESOLVED",
                "resolution_notes": "Provider restarted upstream edge gateway; latency normalized",
            },
        )
        assert res_resp.status_code == 200
        assert res_resp.json()["status"] == "RESOLVED"

        # Webhook was dispatched
        assert mock_client_instance.__aenter__.return_value.post.call_count >= 2

