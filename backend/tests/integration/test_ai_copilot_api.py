"""Integration tests for AI DevOps Copilot and Root Cause Analysis (RCA) API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestAICopilotAPI:
    """Validate Copilot conversational intelligence and automated RCA."""

    @pytest.mark.asyncio
    async def test_unauthorized_ai_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        res = await client.get("/api/v1/ai/conversations")
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_list_conversations_auto_seeds_demo(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """First fetch auto-seeds a welcome DevOps Copilot discussion."""
        client, user = authenticated_client
        res = await client.get("/api/v1/ai/conversations")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "Performance" in data[0]["title"] or "Docker" in data[0]["title"]

    @pytest.mark.asyncio
    async def test_create_conversation_and_send_message(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Create conversation thread, exchange messages, and verify AI response."""
        client, user = authenticated_client

        # Create thread with initial prompt
        create_payload = {
            "title": "Kubernetes CrashLoop Investigation",
            "initial_message": "How do I troubleshoot a CrashLoopBackOff error on my pod?",
        }
        create_res = await client.post("/api/v1/ai/conversations", json=create_payload)
        assert create_res.status_code == 201
        thread = create_res.json()
        assert thread["title"] == "Kubernetes CrashLoop Investigation"
        assert len(thread["messages"]) == 2
        assert thread["messages"][0]["role"] == "user"
        assert thread["messages"][1]["role"] == "assistant"
        assert "kubectl" in thread["messages"][1]["content"]

        conv_id = thread["id"]

        # Send follow-up message
        msg_payload = {
            "content": "Can you generate a production GitHub Actions CI/CD workflow YAML?",
        }
        msg_res = await client.post(
            f"/api/v1/ai/conversations/{conv_id}/messages", json=msg_payload
        )
        assert msg_res.status_code == 201
        reply = msg_res.json()
        assert reply["role"] == "assistant"
        assert "docker/build-push-action" in reply["content"]

        # Fetch conversation thread history
        detail_res = await client.get(f"/api/v1/ai/conversations/{conv_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert len(detail["messages"]) == 4

        # Delete conversation
        del_res = await client.delete(f"/api/v1/ai/conversations/{conv_id}")
        assert del_res.status_code == 204

    @pytest.mark.asyncio
    async def test_generate_and_update_rca(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Trigger AI Root Cause Analysis on a simulated build failure and triage its status."""
        client, user = authenticated_client

        rca_payload = {
            "log_excerpt": (
                "FAILED tests/test_payment.py::test_stripe_charge - AssertionError: assert 500 == 200\n"
                "Traceback (most recent call last):\n"
                "  File 'tests/test_payment.py', line 45, in test_stripe_charge\n"
                "    assert response.status_code == 200\n"
            ),
            "job_name": "Integration Test Suite",
        }
        res = await client.post("/api/v1/ai/rca/generate", json=rca_payload)
        assert res.status_code == 201
        rca = res.json()
        assert rca["failure_category"] == "TEST_FAILURE"
        assert rca["severity"] in ("MEDIUM", "HIGH")
        assert len(rca["remediation_steps"]) >= 2
        assert rca["confidence_score"] >= 0.8
        assert rca["status"] == "generated"

        rca_id = rca["id"]

        # List all RCAs
        list_res = await client.get("/api/v1/ai/rca")
        assert list_res.status_code == 200
        rcas = list_res.json()
        assert any(r["id"] == rca_id for r in rcas)

        # Update status to acknowledged
        update_res = await client.put(
            f"/api/v1/ai/rca/{rca_id}/status", json={"status": "acknowledged"}
        )
        assert update_res.status_code == 200
        assert update_res.json()["status"] == "acknowledged"

        # Update status to resolved
        res_res = await client.put(
            f"/api/v1/ai/rca/{rca_id}/status", json={"status": "resolved"}
        )
        assert res_res.status_code == 200
        assert res_res.json()["status"] == "resolved"
