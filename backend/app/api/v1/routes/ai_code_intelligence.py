"""AI Pull Request Code Reviewer and CI/CD Failure Prediction API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.ai_code_intelligence import (
    AIFailurePredictionResponse,
    AIPullRequestReviewResponse,
    GeneratePRReviewRequest,
    PredictFailureRequest,
)
from app.services.ai_code_intelligence_service import AICodeIntelligenceService

router = APIRouter(prefix="/ai/intelligence", tags=["AI Code & CI Intelligence"])


@router.post(
    "/reviews/generate",
    response_model=AIPullRequestReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI Pull Request code review",
)
async def review_pull_request(
    payload: GeneratePRReviewRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIPullRequestReviewResponse:
    """Run automated code review on PR diff checking security, performance, and best practices."""
    return await AICodeIntelligenceService.review_pull_request(
        db=db, user_id=current_user.id, payload=payload
    )


@router.get(
    "/reviews",
    response_model=list[AIPullRequestReviewResponse],
    summary="List historical AI Pull Request code reviews",
)
async def list_pr_reviews(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
) -> list[AIPullRequestReviewResponse]:
    """Retrieve all automated code reviews generated for pull requests."""
    return await AICodeIntelligenceService.list_pr_reviews(
        db=db, user_id=current_user.id, limit=limit
    )


@router.post(
    "/predictions/evaluate",
    response_model=AIFailurePredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Evaluate CI/CD failure probability for a commit",
)
async def predict_failure(
    payload: PredictFailureRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIFailurePredictionResponse:
    """Predict failure likelihood and blast radius before running pipeline."""
    return await AICodeIntelligenceService.predict_failure(
        db=db, user_id=current_user.id, payload=payload
    )


@router.get(
    "/predictions",
    response_model=list[AIFailurePredictionResponse],
    summary="List historical CI/CD failure predictions",
)
async def list_predictions(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
) -> list[AIFailurePredictionResponse]:
    """Retrieve past failure risk scores and recommendations."""
    return await AICodeIntelligenceService.list_predictions(
        db=db, user_id=current_user.id, limit=limit
    )
