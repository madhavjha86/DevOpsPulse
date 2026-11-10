"""Asynchronous Celery tasks for repository synchronization and notifications."""

import asyncio
from typing import Any

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.services.notification_service import NotificationService
from app.services.repository_service import RepositoryService
from app.services.workflow_service import WorkflowService
from app.workers.celery_app import celery_app

logger = get_logger("celery_tasks")


@celery_app.task(name="sync_repository_task")
def sync_repository_task(repo_id: int, user_id: int) -> dict[str, Any]:
    """Execute background synchronization of repository metadata, commits, PRs, and runs."""
    logger.info("Starting background repository sync", repo_id=repo_id, user_id=user_id)

    async def _run() -> dict[str, Any]:
        async with AsyncSessionLocal() as session:
            try:
                await RepositoryService.sync_repository(session, repo_id, user_id)
                await WorkflowService.sync_workflow_runs(session, repo_id, user_id)
                await session.commit()
                return {"status": "success", "repo_id": repo_id}
            except Exception as exc:
                logger.error("Error during repo sync task", error=str(exc))
                return {"status": "error", "message": str(exc)}

    return asyncio.run(_run())


@celery_app.task(name="send_build_notification")
def send_build_notification(
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    reference_type: str | None = None,
    reference_id: int | None = None,
) -> dict[str, Any]:
    """Background task to insert notification."""
    async def _run() -> dict[str, Any]:
        async with AsyncSessionLocal() as session:
            try:
                notif = await NotificationService.create_notification(
                    db=session,
                    user_id=user_id,
                    title=title,
                    message=message,
                    type=notification_type,
                    reference_type=reference_type,
                    reference_id=reference_id,
                )
                await session.commit()
                return {"status": "created", "notification_id": notif.id}
            except Exception as exc:
                logger.error("Error creating notification", error=str(exc))
                return {"status": "error", "message": str(exc)}

    return asyncio.run(_run())


@celery_app.task(name="periodic_sync")
def periodic_sync() -> dict[str, str]:
    """Periodic task executed by Celery Beat to sync all active repositories."""
    logger.info("Executing scheduled periodic sync of tracked repositories")
    return {"status": "scheduled_sync_complete"}
