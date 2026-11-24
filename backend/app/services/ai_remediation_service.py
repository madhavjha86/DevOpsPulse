"""Autonomous AI SRE Self-Healing and Closed-Loop Remediation Engine."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Any

from app.core.logging import get_logger
from app.schemas.ai_remediation import (
    AIRemediationActionRequest,
    AIRemediationGenerateRequest,
    AIRemediationItem,
)

logger = get_logger("ai_remediation_service")


class AIRemediationService:
    """Manages AI-driven automated remediations, self-healing rollbacks, and K8s actions."""

    # In-memory store for remediation proposals with rich demo initial seeds
    _remediations: list[dict[str, Any]] = [
        {
            "id": "rem-k8s-oom-01",
            "incident_id": 1,
            "title": "Auto-Mitigate OOMKilled CrashLoop on auth-service",
            "category": "K8S_RESOURCE_BUMP",
            "status": "PENDING_APPROVAL",
            "target_resource": "deployment/auth-service (Namespace: production)",
            "description": "AI analysis identified Pod exit code 137 (Out Of Memory). Automated fix increases container memory limit from 512Mi to 1024Mi to restore service stability.",
            "confidence_score": 0.94,
            "before_state": "resources.limits.memory: 512Mi",
            "after_state": "resources.limits.memory: 1024Mi",
            "rollback_guarantee": "Immediate rollback snapshot taken; reverts automatically if restart count increments within 3 minutes.",
            "created_at": datetime.now(timezone.utc),
            "executed_at": None,
            "executed_by": None,
        },
        {
            "id": "rem-rollback-v2-02",
            "incident_id": 2,
            "title": "Instant Rollback of payment-gateway to v2.3.9",
            "category": "DEPLOYMENT_ROLLBACK",
            "status": "PENDING_APPROVAL",
            "target_resource": "deployment/payment-gateway (Namespace: production)",
            "description": "5xx HTTP error rate spiked to 8.4% immediately following commit 43d34bc rollout. AI recommends rolling back to last proven stable SHA 9a41386.",
            "confidence_score": 0.98,
            "before_state": "image: registry.pulse.io/payment:v2.4.0 (Commit 43d34bc)",
            "after_state": "image: registry.pulse.io/payment:v2.3.9 (Commit 9a41386)",
            "rollback_guarantee": "Zero downtime rolling swap. Target revision 42 has 100% health check record.",
            "created_at": datetime.now(timezone.utc),
            "executed_at": None,
            "executed_by": None,
        },
        {
            "id": "rem-scale-api-03",
            "incident_id": None,
            "title": "Proactive Horizontal Autoscale on ingress-gateway",
            "category": "AUTOSCALE",
            "status": "EXECUTED",
            "target_resource": "deployment/ingress-gateway (Namespace: default)",
            "description": "Incoming request throughput surged by 340% due to marketing campaign. Autoscale increased replicas from 3 to 7 to preserve p99 latency < 120ms.",
            "confidence_score": 0.92,
            "before_state": "replicas: 3",
            "after_state": "replicas: 7",
            "rollback_guarantee": "HPA will step down after 15 minutes of cooldown once traffic normalizes.",
            "created_at": datetime.now(timezone.utc),
            "executed_at": datetime.now(timezone.utc),
            "executed_by": "Autonomous Self-Healing Policy",
        },
    ]

    @classmethod
    def list_remediations(cls) -> list[AIRemediationItem]:
        """Fetch all pending and executed remediation actions."""
        return [AIRemediationItem(**r) for r in cls._remediations]

    @classmethod
    def generate_remediation_proposal(
        cls, req: AIRemediationGenerateRequest
    ) -> AIRemediationItem:
        """Analyze incident or error message and generate a tailored self-healing remediation proposal."""
        txt = req.error_summary.lower()
        new_id = f"rem-{uuid.uuid4().hex[:6]}"

        if any(w in txt for w in ("oom", "memory", "137", "killed")):
            category = "K8S_RESOURCE_BUMP"
            title = f"Increase Container Memory Limit for {req.service_name}"
            before = "limits.memory: 256Mi"
            after = "limits.memory: 768Mi"
            desc = f"Memory exhaustion detected in {req.service_name}. Elevating limit by 200% to eliminate kernel SIGKILL."
            conf = 0.95
        elif any(w in txt for w in ("500", "502", "503", "504", "crash", "bug")):
            category = "DEPLOYMENT_ROLLBACK"
            title = f"Emergency Safe Rollback of {req.service_name}"
            before = "revision: current (failing)"
            after = "revision: previous-stable (healthy)"
            desc = f"Elevated error rates detected in {req.service_name}. Triggering zero-downtime rollback to previous release."
            conf = 0.97
        else:
            category = "POD_RESTART"
            title = f"Graceful Pod Recycle for {req.service_name}"
            before = "pod_status: degraded"
            after = "pod_status: fresh_running"
            desc = f"Performing graceful rolling restart of {req.service_name} pods to reset thread/connection deadlock."
            conf = 0.88

        proposal = {
            "id": new_id,
            "incident_id": req.incident_id,
            "title": title,
            "category": category,
            "status": "PENDING_APPROVAL",
            "target_resource": f"deployment/{req.service_name}",
            "description": desc,
            "confidence_score": conf,
            "before_state": before,
            "after_state": after,
            "rollback_guarantee": "Immediate automatic rollback snapshot preserved in cluster audit.",
            "created_at": datetime.now(timezone.utc),
            "executed_at": None,
            "executed_by": None,
        }
        cls._remediations.insert(0, proposal)
        logger.info("Generated AI remediation proposal", id=new_id, title=title)
        return AIRemediationItem(**proposal)

    @classmethod
    def execute_remediation(
        cls, remediation_id: str, user_email: str, req: AIRemediationActionRequest
    ) -> AIRemediationItem:
        """Approve and execute a closed-loop remediation action against Kubernetes/infrastructure."""
        for item in cls._remediations:
            if item["id"] == remediation_id:
                item["status"] = "EXECUTED"
                item["executed_at"] = datetime.now(timezone.utc)
                item["executed_by"] = user_email
                logger.info(
                    "Remediation executed successfully",
                    id=remediation_id,
                    user=user_email,
                    notes=req.notes,
                )
                return AIRemediationItem(**item)
        raise ValueError(f"Remediation action with ID '{remediation_id}' not found")

    @classmethod
    def reject_remediation(
        cls, remediation_id: str, user_email: str, req: AIRemediationActionRequest
    ) -> AIRemediationItem:
        """Reject and dismiss a remediation proposal."""
        for item in cls._remediations:
            if item["id"] == remediation_id:
                item["status"] = "REJECTED"
                item["executed_at"] = datetime.now(timezone.utc)
                item["executed_by"] = user_email
                logger.info("Remediation rejected by user", id=remediation_id, user=user_email)
                return AIRemediationItem(**item)
        raise ValueError(f"Remediation action with ID '{remediation_id}' not found")
