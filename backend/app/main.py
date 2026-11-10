"""DevOpsPulse FastAPI Application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import limiter

settings = get_settings()
setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan management for initialization and shutdown hooks."""
    logger.info("Starting up DevOpsPulse backend", version=settings.VERSION, debug=settings.DEBUG)
    yield
    logger.info("Shutting down DevOpsPulse backend")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "DevOpsPulse: Open-Source Developer Productivity and CI/CD Monitoring Platform. "
        "Monitor GitHub workflows, track commits/pull requests, analyze build performance, "
        "and receive alerts on pipeline failures."
    ),
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Custom Exception Handlers
register_exception_handlers(app)

# Request Logging Middleware
app.add_middleware(RequestLoggingMiddleware)

# Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get(
    "/health",
    tags=["System"],
    status_code=status.HTTP_200_OK,
    summary="Health check endpoint",
)
async def health_check() -> dict[str, str]:
    """Return health status of the application."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.VERSION,
    }


@app.get(
    "/",
    tags=["System"],
    status_code=status.HTTP_200_OK,
    summary="Root API info",
)
async def root() -> dict[str, str]:
    """Root info redirecting to documentation."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_PREFIX,
    }
