"""Cloud Infrastructure Monitoring API endpoints for AWS, Azure, and GCP."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.cloud_monitoring import (
    CloudAccountCreate,
    CloudAccountResponse,
    CloudAccountUpdate,
    CloudMetricsResponse,
    CloudOverviewResponse,
)
from app.services.cloud_service import CloudMonitoringService

router = APIRouter(prefix="/infrastructure/cloud", tags=["Cloud Infrastructure"])


@router.get(
    "/accounts",
    response_model=list[CloudAccountResponse],
    summary="List all configured cloud provider accounts",
)
async def list_cloud_accounts(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CloudAccountResponse]:
    """Retrieve all cloud provider accounts. Auto-seeds default AWS entry if none exist."""
    accounts = await CloudMonitoringService.get_user_accounts(db, current_user.id)
    if not accounts:
        default_payload = CloudAccountCreate(
            provider="aws",
            name="AWS Production Account",
            region="us-east-1",
        )
        created = await CloudMonitoringService.create_account(db, current_user.id, default_payload)
        return [created]
    return accounts


@router.post(
    "/accounts",
    response_model=CloudAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new cloud provider account",
)
async def create_cloud_account(
    payload: CloudAccountCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CloudAccountResponse:
    """Connect a new AWS, Azure, or GCP account with encrypted credentials."""
    return await CloudMonitoringService.create_account(db, current_user.id, payload)


@router.get(
    "/accounts/{account_id}",
    response_model=CloudAccountResponse,
    summary="Get cloud account details",
)
async def get_cloud_account(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CloudAccountResponse:
    """Fetch details of a specific cloud account."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    return CloudMonitoringService._to_response(account)


@router.put(
    "/accounts/{account_id}",
    response_model=CloudAccountResponse,
    summary="Update cloud account configuration",
)
async def update_cloud_account(
    account_id: int,
    payload: CloudAccountUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CloudAccountResponse:
    """Update settings for a cloud account."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    return await CloudMonitoringService.update_account(db, account, payload)


@router.delete(
    "/accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a cloud account",
)
async def delete_cloud_account(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a configured cloud provider account."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    await CloudMonitoringService.delete_account(db, account)


@router.get(
    "/accounts/{account_id}/health",
    summary="Test cloud credentials and provider API connectivity",
)
async def check_cloud_account_health(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Test cloud API credentials and connection health."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    return await CloudMonitoringService.check_account_health(db, account)


@router.get(
    "/accounts/{account_id}/overview",
    response_model=CloudOverviewResponse,
    summary="Cloud account resource inventory and cost estimate",
)
async def get_cloud_overview(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CloudOverviewResponse:
    """Retrieve compute VMs, cloud databases, and serverless resources overview."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    return await CloudMonitoringService.get_overview(db, account)


@router.get(
    "/accounts/{account_id}/metrics",
    response_model=CloudMetricsResponse,
    summary="Get 24h CPU and Network telemetry timeseries",
)
async def get_cloud_metrics(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CloudMetricsResponse:
    """Retrieve 24-hour resource telemetry stream."""
    account = await CloudMonitoringService.get_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cloud account with ID {account_id} not found",
        )
    return await CloudMonitoringService.get_metrics_timeseries(account)
