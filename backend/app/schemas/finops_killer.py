"""FinOps 1-Click Cloud Waste Killer Schemas."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class WasteResource(BaseModel):
    """An idle, abandoned, or unattached cloud resource draining monthly budget."""

    id: str
    resource_type: Literal[
        "UNATTACHED_EBS",
        "IDLE_EC2",
        "ORPHANED_ALB",
        "OBSOLETE_SNAPSHOT",
        "ABANDONED_EIP",
    ]
    resource_id: str
    name: str
    region: str
    monthly_waste_usd: float
    idle_days: int
    status: Literal["ACTIVE_WASTE", "TERMINATED", "EXEMPTED"] = "ACTIVE_WASTE"
    reason: str


class FinOpsKillerSummary(BaseModel):
    """Overview of identified cloud waste and savings potential."""

    total_monthly_waste_usd: float
    total_waste_resources_count: int
    killed_savings_recovered_usd: float
    resources: list[WasteResource]


class TerminateResourceRequest(BaseModel):
    """Payload to kill selected waste resources with 1-click."""

    resource_ids: list[str] = Field(..., min_length=1)
    notes: str | None = Field(default=None, max_length=200)


class TerminateResourceResponse(BaseModel):
    """Result of waste termination action."""

    terminated_count: int
    monthly_savings_recovered_usd: float
    message: str
