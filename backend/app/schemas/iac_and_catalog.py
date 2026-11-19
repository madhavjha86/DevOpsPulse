"""Infrastructure as Code (Terraform) and Developer Portal Pydantic schemas."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

WorkspaceStatus = Literal["HEALTHY", "DRIFT_DETECTED", "PLANNING", "APPLIED", "FAILED"]
RunType = Literal["PLAN", "APPLY", "DRIFT_CHECK", "VALIDATION"]
RunStatus = Literal["PENDING", "PLANNED", "CONFIRMED", "APPLIED", "REJECTED", "FAILED"]
ServiceTier = Literal["TIER_1_CRITICAL", "TIER_2_CORE", "TIER_3_SUPPORTING"]
ServiceLifecycle = Literal["PRODUCTION", "BETA", "EXPERIMENTAL", "DEPRECATED"]
HealthStatus = Literal["HEALTHY", "DEGRADED", "DOWN"]


class TerraformWorkspaceCreate(BaseModel):
    """Payload to register a Terraform infrastructure workspace."""

    name: str = Field(..., max_length=100)
    repository_url: str = Field(..., max_length=255)
    working_directory: str = Field(default="terraform", max_length=255)
    terraform_version: str = Field(default="1.8.2", max_length=50)
    description: str | None = None


class TerraformWorkspaceResponse(BaseModel):
    """Terraform workspace state and drift summary."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    repository_url: str
    working_directory: str
    terraform_version: str
    current_state_version: int
    resource_count: int
    status: str
    has_drift: bool
    last_drift_check_at: datetime | None = None
    last_applied_at: datetime | None = None
    auto_approve_enabled: bool
    description: str | None = None
    created_at: datetime


class TerraformPlanRequest(BaseModel):
    """Payload to generate an infrastructure change plan."""

    workspace_id: int


class TerraformApplyRequest(BaseModel):
    """Payload to approve and apply an existing Terraform plan."""

    run_id: int
    approved_by: str = Field(default="DevOps Lead", max_length=100)


class TerraformRunResponse(BaseModel):
    """Terraform execution run with preview, security checks, and rollback advice."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    run_type: str
    status: str
    resources_to_add: int
    resources_to_change: int
    resources_to_destroy: int
    is_destructive: bool
    plan_output: str | None = None
    security_scan_passed: bool
    security_issues_count: int
    approved_by: str | None = None
    rollback_guidance: str | None = None
    created_at: datetime


class ServiceCatalogCreate(BaseModel):
    """Payload to register a microservice in the Developer Portal."""

    name: str = Field(..., max_length=100)
    display_name: str = Field(..., max_length=150)
    description: str
    tier: ServiceTier = Field(default="TIER_1_CRITICAL")
    owner_team: str = Field(..., max_length=100)
    tech_stack: str = Field(..., max_length=150)
    lifecycle: ServiceLifecycle = Field(default="PRODUCTION")
    health_status: HealthStatus = Field(default="HEALTHY")
    environment: str = Field(default="PRODUCTION", max_length=50)
    repository_url: str | None = None
    documentation_url: str | None = None
    api_spec_url: str | None = None


class ServiceCatalogResponse(BaseModel):
    """Developer portal service entity."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_name: str
    description: str
    tier: str
    owner_team: str
    tech_stack: str
    lifecycle: str
    health_status: str
    environment: str
    repository_url: str | None = None
    documentation_url: str | None = None
    api_spec_url: str | None = None
    created_at: datetime


class GoldenPathResponse(BaseModel):
    """Microservice scaffolding template."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    description: str
    repository_template_url: str
    ci_template: str
    is_recommended: bool


class DeveloperPortalOverviewResponse(BaseModel):
    """Developer Portal catalog summary."""

    total_services: int
    tier_1_count: int
    healthy_services_count: int
    templates_count: int
    services: list[ServiceCatalogResponse]
    templates: list[GoldenPathResponse]
