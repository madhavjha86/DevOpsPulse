"""AI DevOps Copilot and Root Cause Analysis (RCA) API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.schemas.ai_copilot import (
    AIConversationCreate,
    AIConversationDetailResponse,
    AIConversationResponse,
    AIMessageCreate,
    AIMessageResponse,
    AIRootCauseAnalysisResponse,
    GenerateRCARequest,
    UpdateRCAStatusRequest,
)
from app.services.ai_copilot_service import AICopilotService

router = APIRouter(prefix="/ai", tags=["AI Intelligence & Copilot"])


# --------------------------------------------------------------------------
# COPILOT CONVERSATION ENDPOINTS
# --------------------------------------------------------------------------

@router.get(
    "/conversations",
    response_model=list[AIConversationResponse],
    summary="List AI Copilot conversation threads",
)
async def list_conversations(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AIConversationResponse]:
    """Retrieve all Copilot conversations for active workspace."""
    return await AICopilotService.get_conversations(
        db=db, user_id=tenant.user.id, organization_id=tenant.organization_id
    )


@router.post(
    "/conversations",
    response_model=AIConversationDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new AI Copilot conversation thread",
)
async def create_conversation(
    payload: AIConversationCreate,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIConversationDetailResponse:
    """Initialize a new conversation thread with optional initial prompt and context."""
    return await AICopilotService.create_conversation(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=AIConversationDetailResponse,
    summary="Get conversation thread details and full message history",
)
async def get_conversation(
    conversation_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIConversationDetailResponse:
    """Retrieve full conversation history for a given thread."""
    conv = await AICopilotService.get_conversation_detail(
        db=db, user_id=tenant.user.id, conversation_id=conversation_id
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found.",
        )
    return conv


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=AIMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message to the AI Copilot and receive streaming or immediate response",
)
async def send_message(
    conversation_id: int,
    payload: AIMessageCreate,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIMessageResponse:
    """Post a message to an active conversation and generate the assistant reply."""
    try:
        return await AICopilotService.send_message(
            db=db,
            user_id=tenant.user.id,
            conversation_id=conversation_id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an AI Copilot conversation thread",
)
async def delete_conversation(
    conversation_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a conversation and all its messages."""
    deleted = await AICopilotService.delete_conversation(
        db=db, user_id=tenant.user.id, conversation_id=conversation_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found.",
        )


# --------------------------------------------------------------------------
# ROOT CAUSE ANALYSIS (RCA) ENDPOINTS
# --------------------------------------------------------------------------

@router.post(
    "/rca/generate",
    response_model=AIRootCauseAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Root Cause Analysis for a failure",
)
async def generate_rca(
    payload: GenerateRCARequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIRootCauseAnalysisResponse:
    """Run AI root cause analysis on a failed workflow run, container crash, or error log."""
    return await AICopilotService.generate_rca(
        db=db,
        user_id=tenant.user.id,
        payload=payload,
        organization_id=tenant.organization_id,
    )


@router.get(
    "/rca",
    response_model=list[AIRootCauseAnalysisResponse],
    summary="List all generated Root Cause Analyses",
)
async def list_rcas(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
) -> list[AIRootCauseAnalysisResponse]:
    """Retrieve all historical Root Cause Analysis reports for workspace."""
    return await AICopilotService.list_rcas(
        db=db,
        user_id=tenant.user.id,
        limit=limit,
        organization_id=tenant.organization_id,
    )


@router.put(
    "/rca/{rca_id}/status",
    response_model=AIRootCauseAnalysisResponse,
    summary="Update RCA status (acknowledged, resolved)",
)
async def update_rca_status(
    rca_id: int,
    payload: UpdateRCAStatusRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIRootCauseAnalysisResponse:
    """Update RCA report resolution status."""
    updated = await AICopilotService.update_rca_status(
        db=db, user_id=tenant.user.id, rca_id=rca_id, status_value=payload.status
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Root Cause Analysis {rca_id} not found.",
        )
    return updated
