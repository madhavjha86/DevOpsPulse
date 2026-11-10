"""Integration tests for Centralized Logs and Distributed Tracing API endpoints."""

from datetime import datetime, timezone
import pytest
from httpx import AsyncClient

from app.models.user import User


class TestTelemetryAPI:
    """Validate log ingestion, span processing, trace waterfall hierarchy, and stats."""

    @pytest.mark.asyncio
    async def test_unauthorized_telemetry_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        res = await client.get("/api/v1/telemetry/logs")
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_ingest_and_query_log(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Ingest a structured log and retrieve it via search and filtering."""
        client, user = authenticated_client

        log_payload = {
            "service_name": "checkout-service",
            "level": "WARN",
            "message": "Payment gateway latency exceeded 800ms threshold",
            "trace_id": "trace-test-log-101",
            "span_id": "span-log-202",
            "attributes": {"user_id": 42, "region": "us-east-1", "attempt": 2},
        }
        post_res = await client.post("/api/v1/telemetry/logs", json=log_payload)
        assert post_res.status_code == 201
        created = post_res.json()
        assert created["service_name"] == "checkout-service"
        assert created["level"] == "WARN"
        assert created["attributes"]["region"] == "us-east-1"

        # Search for this log specifically
        get_res = await client.get(
            "/api/v1/telemetry/logs",
            params={"service_name": "checkout-service", "level": "WARN", "search": "threshold"},
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["total"] >= 1
        assert any(l["trace_id"] == "trace-test-log-101" for l in data["logs"])

    @pytest.mark.asyncio
    async def test_ingest_spans_and_query_trace_waterfall(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Ingest root and child spans, then verify complete waterfall hierarchy."""
        client, user = authenticated_client
        now = datetime.now(timezone.utc)
        iso_start = now.isoformat()
        iso_end = now.isoformat()

        # Ingest Root Span
        root_span = {
            "trace_id": "trace-waterfall-demo-888",
            "span_id": "span-root-001",
            "parent_span_id": None,
            "name": "POST /orders/checkout",
            "service_name": "api-gateway",
            "kind": "SERVER",
            "start_time": iso_start,
            "end_time": iso_end,
            "status_code": "OK",
            "attributes": {"http.method": "POST", "http.status_code": 200},
        }
        res1 = await client.post("/api/v1/telemetry/spans", json=root_span)
        assert res1.status_code == 201

        # Ingest Child Span
        child_span = {
            "trace_id": "trace-waterfall-demo-888",
            "span_id": "span-child-002",
            "parent_span_id": "span-root-001",
            "name": "ProcessStripeCharge",
            "service_name": "payment-service",
            "kind": "CLIENT",
            "start_time": iso_start,
            "end_time": iso_end,
            "status_code": "ERROR",
            "status_message": "Card declined by issuing bank",
            "attributes": {"payment.provider": "stripe", "amount": 99.00},
        }
        res2 = await client.post("/api/v1/telemetry/spans", json=child_span)
        assert res2.status_code == 201

        # Query Traces list
        traces_res = await client.get("/api/v1/telemetry/traces")
        assert traces_res.status_code == 200
        traces = traces_res.json()
        target_trace = next((t for t in traces if t["trace_id"] == "trace-waterfall-demo-888"), None)
        assert target_trace is not None
        assert target_trace["root_service"] == "api-gateway"
        assert target_trace["has_error"] is True
        assert "payment-service" in target_trace["services"]

        # Fetch waterfall detail
        waterfall_res = await client.get("/api/v1/telemetry/traces/trace-waterfall-demo-888")
        assert waterfall_res.status_code == 200
        wf = waterfall_res.json()
        assert wf["trace_id"] == "trace-waterfall-demo-888"
        assert len(wf["spans"]) >= 2

    @pytest.mark.asyncio
    async def test_get_telemetry_services_and_stats(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Validate services listing and scorecard stats."""
        client, user = authenticated_client

        services_res = await client.get("/api/v1/telemetry/services")
        assert services_res.status_code == 200
        services = services_res.json()
        assert isinstance(services, list)
        assert len(services) > 0

        stats_res = await client.get("/api/v1/telemetry/stats")
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert "total_logs_24h" in stats
        assert "p95_latency_ms" in stats
        assert "active_services_count" in stats
        assert stats["total_logs_24h"] >= 0
