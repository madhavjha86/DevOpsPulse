"""Pydantic schemas for Cloud Cost Intelligence."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

CloudProvider = Literal["ALL", "AWS", "AZURE", "GCP"]


class ServiceCostItem(BaseModel):
    """Breakdown entry for a single cloud service."""

    service_name: str
    amount: float
    percentage: float
    provider: str


class DailyCostPoint(BaseModel):
    """Single date cost breakdown across providers."""

    date: str
    amount: float
    aws: float = 0.0
    azure: float = 0.0
    gcp: float = 0.0


class ProviderCostStatus(BaseModel):
    """Connection and spend status for a specific cloud provider."""

    provider: str
    status: Literal["CONNECTED", "NOT_CONFIGURED", "ERROR", "DEMO_MODE"]
    account_name: str | None = None
    monthly_spend: float = 0.0
    is_connected: bool = False
    details: str | None = None


class BudgetCreate(BaseModel):
    """Payload to create or configure a cloud budget."""

    name: str = Field(..., min_length=2, max_length=100)
    provider: str = Field(default="ALL", max_length=50)
    monthly_budget: float = Field(..., gt=0)
    warning_threshold: float = Field(default=80.0, ge=1.0, le=100.0)
    critical_threshold: float = Field(default=100.0, ge=1.0, le=200.0)
    alert_email: str | None = Field(default=None, max_length=255)
    alert_slack_channel: str | None = Field(default=None, max_length=100)


class BudgetResponse(BaseModel):
    """Configured budget details with real-time spend progress."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    provider: str
    monthly_budget: float
    warning_threshold: float
    critical_threshold: float
    current_spend: float
    forecasted_spend: float
    percentage_used: float
    status: Literal["OK", "WARNING", "CRITICAL"]
    alert_email: str | None = None
    is_active: bool = True
    created_at: datetime


class CostOptimizationItem(BaseModel):
    """Actionable cloud cost recommendation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    title: str
    category: str  # IDLE_RESOURCE, RIGHTSIZING, STORAGE_LIFECYCLE, RESERVED_INSTANCE
    resource_id: str
    estimated_monthly_savings: float
    difficulty: str  # EASY, MEDIUM, COMPLEX
    recommendation: str
    status: str  # OPEN, APPLIED, DISMISSED
    created_at: datetime


class CloudCostOverviewResponse(BaseModel):
    """High-level multi-cloud cost intelligence dashboard."""

    total_monthly_spend: float
    projected_month_end: float
    monthly_change_percent: float
    currency: str = "USD"
    providers: list[ProviderCostStatus]
    daily_trend: list[DailyCostPoint]
    top_services: list[ServiceCostItem]
    active_budgets: list[BudgetResponse]
    total_potential_savings: float
    optimizations_count: int
    is_demo_mode: bool = False
