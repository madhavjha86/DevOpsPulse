"""Pydantic schemas for Cloud Monitoring (AWS CloudWatch, Azure Monitor, GCP)."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

CloudProvider = Literal["aws", "azure", "gcp"]


class CloudAccountCreate(BaseModel):
    """Schema for connecting a new cloud provider account."""

    provider: CloudProvider = Field(..., description="Cloud provider type: aws, azure, gcp")
    name: str = Field(..., min_length=1, max_length=100, description="Friendly account name")
    region: str = Field(default="us-east-1", description="Default cloud region")

    # AWS Credentials
    aws_access_key_id: str | None = Field(default=None, description="AWS IAM Access Key ID")
    aws_secret_access_key: str | None = Field(default=None, description="AWS IAM Secret Access Key")

    # Azure Credentials
    azure_subscription_id: str | None = Field(default=None, description="Azure Subscription UUID")
    azure_tenant_id: str | None = Field(default=None, description="Azure Tenant ID")
    azure_client_id: str | None = Field(default=None, description="Azure Application (client) ID")
    azure_client_secret: str | None = Field(default=None, description="Azure Client Secret")

    # GCP Credentials
    gcp_project_id: str | None = Field(default=None, description="GCP Project ID")
    gcp_service_account_json: str | None = Field(default=None, description="GCP Service Account JSON Key")


class CloudAccountUpdate(BaseModel):
    """Schema for updating cloud account metadata."""

    name: str | None = Field(default=None, max_length=100)
    region: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class CloudAccountResponse(BaseModel):
    """Safe cloud account representation with credentials masked."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    provider: str
    name: str
    region: str
    masked_identifier: str
    last_status: str  # connected, unconfigured, unreachable, auth_error
    last_sync_at: datetime | None = None
    resources_count: int = 0
    error_message: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CloudResourceItem(BaseModel):
    """Discovered cloud resource item (compute, database, serverless, storage)."""

    id: str
    name: str
    type: str  # ec2_instance, azure_vm, gcp_compute, rds_database, lambda_function, cloud_storage
    status: str  # running, stopped, available, degraded
    region: str
    spec: str  # e.g., t3.medium (2 vCPU, 4GB RAM)
    metrics: dict[str, float] = {}


class CloudMetricsResponse(BaseModel):
    """CloudWatch / Azure Monitor / GCP metric timeseries."""

    account_id: int
    provider: str
    timestamps: list[str]
    cpu_utilization: list[float]
    network_io_mb: list[float]
    estimated_monthly_cost_usd: float


class CloudOverviewResponse(BaseModel):
    """Cloud account dashboard overview."""

    account_id: int
    provider: str
    account_name: str
    status: str
    total_vms: int = 0
    running_vms: int = 0
    total_databases: int = 0
    total_serverless: int = 0
    estimated_monthly_cost: float = 0.0
    resources: list[CloudResourceItem] = []
