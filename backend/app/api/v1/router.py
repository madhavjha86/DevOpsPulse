"""Aggregate API v1 router combining all route endpoints."""

from fastapi import APIRouter

from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.github import router as github_router
from app.api.v1.routes.monitors import router as monitors_router
from app.api.v1.routes.docker import router as docker_router
from app.api.v1.routes.kubernetes import router as k8s_router
from app.api.v1.routes.cloud import router as cloud_router
from app.api.v1.routes.telemetry import router as telemetry_router
from app.api.v1.routes.ai_copilot import router as ai_router
from app.api.v1.routes.ai_code_intelligence import router as ai_intelligence_router
from app.api.v1.routes.notifications import router as notifications_router
from app.api.v1.routes.repositories import router as repositories_router
from app.api.v1.routes.security import router as security_router
from app.api.v1.routes.users import router as users_router
from app.api.v1.routes.webhooks import router as webhooks_router
from app.api.v1.routes.workflows import router as workflows_router

from app.api.v1.routes.cloud_cost import router as cloud_cost_router
from app.api.v1.routes.incidents import router as incidents_router
from app.api.v1.routes.team_productivity import router as team_productivity_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(repositories_router)
api_router.include_router(workflows_router)
api_router.include_router(analytics_router)
api_router.include_router(notifications_router)
api_router.include_router(webhooks_router)
api_router.include_router(github_router)
api_router.include_router(monitors_router)
api_router.include_router(security_router)
api_router.include_router(docker_router)
api_router.include_router(k8s_router)
api_router.include_router(cloud_router)
api_router.include_router(cloud_cost_router)
api_router.include_router(telemetry_router)
api_router.include_router(ai_router)
api_router.include_router(ai_intelligence_router)
api_router.include_router(incidents_router)
api_router.include_router(team_productivity_router)
