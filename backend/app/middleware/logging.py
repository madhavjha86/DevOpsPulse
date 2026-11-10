"""Structured request logging middleware."""

import time
from collections.abc import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs each incoming HTTP request with timing, status code, and client IP."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        finally:
            process_time = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code if response else 500
            client_host = request.client.host if request.client else "unknown"

            # Skip health check noise in logs
            if request.url.path not in ("/health", "/healthz"):
                logger.info(
                    "HTTP request processed",
                    method=request.method,
                    path=request.url.path,
                    status_code=status_code,
                    duration_ms=process_time,
                    client_ip=client_host,
                )
