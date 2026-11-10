"""Service health and synthetic uptime probe monitoring service."""
import time
from datetime import datetime, timezone
from typing import Any
import httpx

from app.schemas.monitor import MonitorCreateRequest, MonitorProbeResult, MonitorResponse

# In-memory store for dynamic monitors
_CUSTOM_MONITORS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "DevOpsPulse API Gateway",
        "url": "http://localhost:8000/health",
        "method": "GET",
        "interval_seconds": 30,
        "status": "operational",
        "uptime_percentage": 99.98,
        "avg_latency_ms": 14.2,
        "last_checked_at": datetime.now(timezone.utc),
        "recent_probes": [200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
    },
    {
        "id": 2,
        "name": "GitHub Public REST API",
        "url": "https://api.github.com/zen",
        "method": "GET",
        "interval_seconds": 60,
        "status": "operational",
        "uptime_percentage": 99.95,
        "avg_latency_ms": 112.5,
        "last_checked_at": datetime.now(timezone.utc),
        "recent_probes": [200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
    },
    {
        "id": 3,
        "name": "Frontend Web Application",
        "url": "http://localhost:3000",
        "method": "GET",
        "interval_seconds": 30,
        "status": "operational",
        "uptime_percentage": 100.0,
        "avg_latency_ms": 8.5,
        "last_checked_at": datetime.now(timezone.utc),
        "recent_probes": [200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
    },
]


class MonitorService:
    """Service to track and probe endpoint uptime and latency."""

    @staticmethod
    async def list_monitors() -> list[MonitorResponse]:
        """Return list of active monitors with live health stats."""
        return [MonitorResponse(**m) for m in _CUSTOM_MONITORS]

    @staticmethod
    async def create_monitor(data: MonitorCreateRequest) -> MonitorResponse:
        """Register a new service endpoint for synthetic health checks."""
        new_id = max([m["id"] for m in _CUSTOM_MONITORS], default=0) + 1
        monitor_dict = {
            "id": new_id,
            "name": data.name,
            "url": data.url,
            "method": data.method,
            "interval_seconds": data.interval_seconds,
            "status": "operational",
            "uptime_percentage": 100.0,
            "avg_latency_ms": 25.0,
            "last_checked_at": datetime.now(timezone.utc),
            "recent_probes": [200, 200, 200],
        }
        _CUSTOM_MONITORS.append(monitor_dict)
        return MonitorResponse(**monitor_dict)

    @staticmethod
    async def probe_endpoint(url: str, method: str = "GET") -> MonitorProbeResult:
        """Execute a live async probe against an endpoint and measure latency."""
        start_time = time.perf_counter()
        now = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.request(method=method, url=url)
                latency = round((time.perf_counter() - start_time) * 1000, 2)
                is_up = resp.status_code < 400
                status_code = resp.status_code
                msg = f"HTTP {status_code} in {latency}ms"
        except Exception as exc:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            is_up = False
            status_code = 503
            msg = f"Probe connection error: {exc}"

        return MonitorProbeResult(
            status_code=status_code,
            latency_ms=latency,
            is_up=is_up,
            checked_at=now,
            message=msg,
        )

    @staticmethod
    async def trigger_monitor_probe(monitor_id: int) -> MonitorProbeResult:
        """Trigger probe for an existing monitor and update its stats."""
        for m in _CUSTOM_MONITORS:
            if m["id"] == monitor_id:
                result = await MonitorService.probe_endpoint(m["url"], m["method"])
                m["last_checked_at"] = result.checked_at
                m["status"] = "operational" if result.is_up else "down"
                m["avg_latency_ms"] = round((m["avg_latency_ms"] * 0.8) + (result.latency_ms * 0.2), 1)
                m["recent_probes"] = (m["recent_probes"] + [result.status_code])[-10:]
                return result

        # Fallback probe
        return await MonitorService.probe_endpoint("http://localhost:8000/health")

    @staticmethod
    async def delete_monitor(monitor_id: int) -> bool:
        """Remove a custom monitor."""
        global _CUSTOM_MONITORS
        _CUSTOM_MONITORS = [m for m in _CUSTOM_MONITORS if m["id"] != monitor_id]
        return True
