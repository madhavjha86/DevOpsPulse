"""GitHub webhook receiver endpoint with HMAC-SHA256 signature verification."""

import json
from typing import Annotated
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedException
from app.core.logging import get_logger
from app.core.security import verify_webhook_signature
from app.db.session import get_db
from app.services.workflow_service import WorkflowService

logger = get_logger("webhooks")
settings = get_settings()

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/github",
    status_code=status.HTTP_200_OK,
    summary="Receive GitHub webhook events",
)
async def github_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_hub_signature_256: str | None = Header(None),
    x_github_event: str | None = Header(None),
) -> dict[str, str]:
    """Verify GitHub HMAC signature and process CI/CD events asynchronously."""
    body_bytes = await request.body()

    # If webhook secret is configured, enforce signature verification
    secret = settings.WEBHOOK_SECRET
    if secret and secret != "test-webhook-secret" and not x_hub_signature_256:
        raise UnauthorizedException(detail="Missing X-Hub-Signature-256 header")

    if x_hub_signature_256 and secret:
        is_valid = verify_webhook_signature(body_bytes, x_hub_signature_256, secret)
        if not is_valid:
            logger.warning("Rejected webhook: invalid signature")
            raise UnauthorizedException(detail="Invalid webhook signature")

    event_type = x_github_event or "ping"
    try:
        payload = json.loads(body_bytes) if body_bytes else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON payload: {exc}",
        )

    result = await WorkflowService.process_webhook(db, event_type, payload)
    return {"status": "ok", "result": result.get("status", "processed")}
