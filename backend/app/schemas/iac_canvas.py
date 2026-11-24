"""Cloud Architecture Canvas and Terraform IaC Generator Schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class CanvasNode(BaseModel):
    """A cloud resource node placed on the visual architecture canvas."""

    id: str
    type: Literal[
        "vpc",
        "subnet",
        "ec2",
        "rds",
        "s3",
        "eks",
        "alb",
        "lambda",
        "redis",
    ]
    label: str
    x: float = Field(default=0.0)
    y: float = Field(default=0.0)
    config: dict[str, Any] = Field(default_factory=dict)


class CanvasEdge(BaseModel):
    """A network or dependency connection between two cloud resource nodes."""

    id: str
    source: str
    target: str
    label: str | None = None


class CanvasDiagram(BaseModel):
    """Complete visual architecture diagram document."""

    id: str
    name: str
    description: str | None = None
    provider: Literal["aws", "gcp", "azure"] = "aws"
    region: str = "us-east-1"
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)
    updated_at: datetime


class CanvasGenerateTerraformRequest(BaseModel):
    """Payload to synthesize Terraform HCL from canvas nodes & connections."""

    provider: Literal["aws", "gcp", "azure"] = "aws"
    region: str = "us-east-1"
    environment: str = "production"
    nodes: list[CanvasNode]
    edges: list[CanvasEdge] = Field(default_factory=list)


class CanvasGenerateTerraformResponse(BaseModel):
    """Generated Terraform HCL code and architectural review analysis."""

    hcl_code: str
    resource_count: int
    estimated_cost_monthly_usd: float
    security_warnings: list[str]
    architecture_summary: str


class CanvasApplyRequest(BaseModel):
    """Request to plan or apply generated Terraform code."""

    hcl_code: str
    environment: Literal["staging", "production"] = "staging"
    dry_run: bool = True


class CanvasApplyResponse(BaseModel):
    """Result of Terraform Plan / Apply execution."""

    plan_status: str
    output: str
    resources_to_add: int
    resources_to_change: int
    resources_to_destroy: int
    duration_seconds: float
