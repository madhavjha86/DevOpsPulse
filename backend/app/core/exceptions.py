"""Custom exceptions and FastAPI exception handlers."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DevOpsPulseException(Exception):
    """Base exception for DevOpsPulse application."""

    def __init__(self, detail: str = "An error occurred", status_code: int = 500) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(self.detail)


class NotFoundException(DevOpsPulseException):
    """Resource not found."""

    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail=detail, status_code=404)


class UnauthorizedException(DevOpsPulseException):
    """Authentication required or failed."""

    def __init__(self, detail: str = "Not authenticated") -> None:
        super().__init__(detail=detail, status_code=401)


class ForbiddenException(DevOpsPulseException):
    """Insufficient permissions."""

    def __init__(self, detail: str = "Forbidden") -> None:
        super().__init__(detail=detail, status_code=403)


class BadRequestException(DevOpsPulseException):
    """Invalid request data."""

    def __init__(self, detail: str = "Bad request") -> None:
        super().__init__(detail=detail, status_code=400)


class GitHubAPIException(DevOpsPulseException):
    """Error communicating with the GitHub API."""

    def __init__(self, detail: str = "GitHub API error", status_code: int = 502) -> None:
        super().__init__(detail=detail, status_code=status_code)


class RateLimitException(DevOpsPulseException):
    """Rate limit exceeded (GitHub or internal)."""

    def __init__(self, detail: str = "Rate limit exceeded") -> None:
        super().__init__(detail=detail, status_code=429)


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom exception handlers on the FastAPI application."""

    @app.exception_handler(DevOpsPulseException)
    async def devopspulse_exception_handler(
        request: Request,
        exc: DevOpsPulseException,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "detail": exc.detail,
                "status_code": exc.status_code,
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(
        request: Request,
        exc: ValueError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "error": True,
                "detail": str(exc),
                "status_code": 400,
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "detail": "Internal server error",
                "status_code": 500,
            },
        )
