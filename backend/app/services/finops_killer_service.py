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

    _waste_resources: dict[str, dict[str, Any]] = {
        "res-ebs-1": {
            "id": "res-ebs-1",
            "resource_type": "UNATTACHED_EBS",
            "resource_id": "vol-0a84f391c01b",
            "name": "legacy-db-scratch-500gb",
            "region": "us-east-1",
            "monthly_waste_usd": 62.50,
            "idle_days": 42,
            "status": "ACTIVE_WASTE",
            "reason": "gp3 500GB volume detached since previous staging tear-down 42 days ago.",
        },
        "res-ec2-1": {
            "id": "res-ec2-1",
            "resource_type": "IDLE_EC2",
            "resource_id": "i-0941bc8813fa",
            "name": "dev-qa-worker-c5xlarge",
            "region": "us-east-1",
            "monthly_waste_usd": 124.10,
            "idle_days": 18,
            "status": "ACTIVE_WASTE",
            "reason": "Average CPU utilization < 1.2% and network I/O near zero for past 18 days.",
        },
        "res-alb-1": {
            "id": "res-alb-1",
            "resource_type": "ORPHANED_ALB",
            "resource_id": "arn:aws:elasticloadbalancing:us-east-1:123456789:loadbalancer/app/old-ingress/8421",
            "name": "old-v1-ingress-alb",
            "region": "us-east-1",
            "monthly_waste_usd": 27.80,
            "idle_days": 31,
            "status": "ACTIVE_WASTE",
            "reason": "No target groups registered or healthy targets; receives 0 incoming HTTP requests.",
        },
        "res-eip-1": {
            "id": "res-eip-1",
            "resource_type": "ABANDONED_EIP",
            "resource_id": "eipalloc-0176b92a",
            "name": "unassigned-staging-ip",
            "region": "us-east-1",
            "monthly_waste_usd": 3.65,
            "idle_days": 65,
            "status": "ACTIVE_WASTE",
            "reason": "AWS charges $0.005/hr for unused Elastic IP addresses not bound to running EC2 instances.",
        },
        "res-snap-1": {
            "id": "res-snap-1",
            "resource_type": "OBSOLETE_SNAPSHOT",
            "resource_id": "snap-0c48201b",
            "name": "temp-migration-dump-2023",
            "region": "us-east-1",
            "monthly_waste_usd": 18.20,
            "idle_days": 210,
            "status": "ACTIVE_WASTE",
            "reason": "EBS snapshot older than retention SLA (90 days). Root volume was destroyed last year.",
        },
    }

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
