"""Integration tests for GitHub webhook endpoint."""

import hashlib
import hmac
import json
import pytest
from httpx import AsyncClient

from app.core.config import get_settings

settings = get_settings()


class TestWebhookAPI:
    """GitHub webhook signature and processing tests."""

    def _sign(self, payload: bytes, secret: str) -> str:
        return "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    @pytest.mark.asyncio
    async def test_webhook_with_valid_signature(self, client: AsyncClient) -> None:
        payload = json.dumps({"action": "ping", "hook_id": 12345}).encode("utf-8")
        secret = settings.WEBHOOK_SECRET
        sig = self._sign(payload, secret)

        response = await client.post(
            "/api/v1/webhooks/github",
            content=payload,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Event": "ping",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_webhook_with_invalid_signature_fails(self, client: AsyncClient) -> None:
        payload = json.dumps({"action": "ping"}).encode("utf-8")
        response = await client.post(
            "/api/v1/webhooks/github",
            content=payload,
            headers={
                "X-Hub-Signature-256": "sha256=invalidhashvalue1234567890",
                "X-GitHub-Event": "ping",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 401
