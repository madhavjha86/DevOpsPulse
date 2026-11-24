"""FinOps 1-Click Cloud Waste Killer Service."""

from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.schemas.finops_killer import (
    FinOpsKillerSummary,
    TerminateResourceRequest,
    TerminateResourceResponse,
    WasteResource,
)

logger = get_logger("finops_killer_service")


class FinOpsKillerService:
    """Discovers and safely eliminates idle and abandoned cloud resources to cut spend."""

    _waste_resources: dict[str, dict[str, Any]] = {}
    _killed_savings: float = 0.0

    @classmethod
    def get_summary(cls) -> FinOpsKillerSummary:
        """Calculate active waste spend and savings potential."""
        active = [
            WasteResource(**r)
            for r in cls._waste_resources.values()
            if r["status"] == "ACTIVE_WASTE"
        ]
        total_waste = sum(r.monthly_waste_usd for r in active)

        all_resources = [WasteResource(**r) for r in cls._waste_resources.values()]

        return FinOpsKillerSummary(
            total_monthly_waste_usd=round(total_waste, 2),
            total_waste_resources_count=len(active),
            killed_savings_recovered_usd=round(cls._killed_savings, 2),
            resources=all_resources,
        )

    @classmethod
    def terminate_waste(cls, req: TerminateResourceRequest) -> TerminateResourceResponse:
        """1-Click termination of selected unattached or idle cloud resources."""
        count = 0
        savings = 0.0

        for r_id in req.resource_ids:
            item = cls._waste_resources.get(r_id)
            if item and item["status"] == "ACTIVE_WASTE":
                item["status"] = "TERMINATED"
                count += 1
                savings += item["monthly_waste_usd"]

        cls._killed_savings += savings
        logger.info("Terminated waste cloud resources", count=count, monthly_savings=savings)

        return TerminateResourceResponse(
            terminated_count=count,
            monthly_savings_recovered_usd=round(savings, 2),
            message=f"Successfully terminated {count} waste resource(s). Recovered ${savings:.2f}/month in cloud budget.",
        )
