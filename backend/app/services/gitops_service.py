"""GitOps Reconciliation, Drift Detection, and Progressive Delivery Service."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Any

from app.core.logging import get_logger
from app.schemas.gitops import (
    CanaryAdjustRequest,
    CanaryRollout,
    GitOpsApp,
    GitOpsDriftItem,
    GitOpsSyncRequest,
    GitOpsSyncResponse,
)

logger = get_logger("gitops_service")


class GitOpsService:
    """Detects infrastructure drift between Git repositories and live Kubernetes clusters."""

    _apps: dict[str, dict[str, Any]] = {
        "app-payment-api": {
            "id": "app-payment-api",
            "name": "payment-api-service",
            "git_repo": "https://github.com/org/payments-infra",
            "git_branch": "main",
            "git_path": "deployments/k8s/production",
            "cluster_name": "prod-eks-us-east-1",
            "namespace": "production",
            "sync_status": "DriftDetected",
            "health_status": "Healthy",
            "target_revision": "commit 9b43c12",
            "live_revision": "commit 7a11f09",
            "last_synced_at": datetime.now(timezone.utc),
            "drifts": [
                {
                    "resource_kind": "Deployment",
                    "resource_name": "payment-api",
                    "namespace": "production",
                    "diff_field": "spec.replicas",
                    "git_value": "5",
                    "live_k8s_value": "2",
                    "severity": "warning",
                },
                {
                    "resource_kind": "Deployment",
                    "resource_name": "payment-api",
                    "namespace": "production",
                    "diff_field": "spec.template.spec.containers[0].image",
                    "git_value": "registry.pulse.io/payment:v2.5.1",
                    "live_k8s_value": "registry.pulse.io/payment:v2.4.9",
                    "severity": "critical",
                },
                {
                    "resource_kind": "ConfigMap",
                    "resource_name": "payment-env-config",
                    "namespace": "production",
                    "diff_field": "data.RATE_LIMIT_MAX_RPS",
                    "git_value": "1000",
                    "live_k8s_value": "250",
                    "severity": "warning",
                },
            ],
        },
        "app-frontend-web": {
            "id": "app-frontend-web",
            "name": "frontend-web-spa",
            "git_repo": "https://github.com/org/frontend-monorepo",
            "git_branch": "main",
            "git_path": "k8s/overlays/prod",
            "cluster_name": "prod-eks-us-east-1",
            "namespace": "production",
            "sync_status": "Synced",
            "health_status": "Healthy",
            "target_revision": "commit af902d1",
            "live_revision": "commit af902d1",
            "last_synced_at": datetime.now(timezone.utc),
            "drifts": [],
        },
    }

    _canary: dict[str, dict[str, Any]] = {
        "app-payment-api": {
            "app_id": "app-payment-api",
            "service_name": "payment-api",
            "canary_weight": 20,
            "baseline_weight": 80,
            "status": "RUNNING",
            "canary_image": "registry.pulse.io/payment:v2.5.1",
            "baseline_image": "registry.pulse.io/payment:v2.4.9",
            "http_error_rate_canary": 0.04,
            "http_error_rate_baseline": 0.03,
            "p99_latency_canary_ms": 118.4,
            "p99_latency_baseline_ms": 124.1,
            "step_history": [
                "10:00 UTC - Canary initialized at 5% weight",
                "10:15 UTC - Health checks healthy (0.01% 5xx). Weight increased to 10%",
                "10:30 UTC - Latency p99 improved by 5ms. Weight increased to 20%",
            ],
        }
    }

    @classmethod
    def list_apps(cls) -> list[GitOpsApp]:
        """Fetch all GitOps tracked applications and their drift states."""
        return [GitOpsApp(**app) for app in cls._apps.values()]

    @classmethod
    def get_app(cls, app_id: str) -> GitOpsApp | None:
        """Fetch single application drift details."""
        data = cls._apps.get(app_id)
        if not data:
            return None
        return GitOpsApp(**data)

    @classmethod
    def sync_app(cls, app_id: str, req: GitOpsSyncRequest) -> GitOpsSyncResponse:
        """Reconcile cluster state with desired Git state."""
        app = cls._apps.get(app_id)
        if not app:
            raise ValueError(f"GitOps app '{app_id}' not found")

        sync_id = f"sync-{uuid.uuid4().hex[:8]}"
        drift_count = len(app.get("drifts", []))

        if req.dry_run:
            return GitOpsSyncResponse(
                sync_id=sync_id,
                status="DRY_RUN",
                synced_resources=drift_count,
                message=f"Dry run complete: {drift_count} out-of-sync resources would be reconciled.",
                timestamp=datetime.now(timezone.utc),
            )

        # Apply sync
        app["sync_status"] = "Synced"
        app["live_revision"] = app["target_revision"]
        app["drifts"] = []
        app["last_synced_at"] = datetime.now(timezone.utc)

        logger.info("GitOps application synchronized", app_id=app_id, sync_id=sync_id)
        return GitOpsSyncResponse(
            sync_id=sync_id,
            status="SUCCESS",
            synced_resources=drift_count if drift_count > 0 else 1,
            message="GitOps reconciliation complete. Live cluster matches Git repository state.",
            timestamp=datetime.now(timezone.utc),
        )

    @classmethod
    def get_canary(cls, app_id: str) -> CanaryRollout | None:
        """Fetch progressive delivery canary state for application."""
        data = cls._canary.get(app_id)
        if not data:
            # Default dynamic canary if none exists
            return CanaryRollout(
                app_id=app_id,
                service_name=app_id,
                canary_weight=0,
                baseline_weight=100,
                status="PAUSED",
                canary_image="registry.pulse.io/service:v2.0.0",
                baseline_image="registry.pulse.io/service:v1.9.0",
                http_error_rate_canary=0.0,
                http_error_rate_baseline=0.02,
                p99_latency_canary_ms=95.0,
                p99_latency_baseline_ms=94.0,
                step_history=["Ready for canary rollout"],
            )
        return CanaryRollout(**data)

    @classmethod
    def adjust_canary(cls, app_id: str, req: CanaryAdjustRequest) -> CanaryRollout:
        """Adjust traffic weighting or promote/rollback canary."""
        canary = cls._canary.get(app_id)
        if not canary:
            canary = {
                "app_id": app_id,
                "service_name": app_id,
                "canary_weight": 0,
                "baseline_weight": 100,
                "status": "RUNNING",
                "canary_image": "registry.pulse.io/service:v2.0.0",
                "baseline_image": "registry.pulse.io/service:v1.9.0",
                "http_error_rate_canary": 0.02,
                "http_error_rate_baseline": 0.02,
                "p99_latency_canary_ms": 110.0,
                "p99_latency_baseline_ms": 115.0,
                "step_history": [],
            }
            cls._canary[app_id] = canary

        time_str = datetime.now(timezone.utc).strftime("%H:%M UTC")

        if req.action == "PROMOTE":
            canary["canary_weight"] = 100
            canary["baseline_weight"] = 0
            canary["status"] = "PROMOTED"
            canary["baseline_image"] = canary["canary_image"]
            canary["step_history"].append(f"{time_str} - Canary promoted to 100% production traffic.")
        elif req.action == "ROLLBACK":
            canary["canary_weight"] = 0
            canary["baseline_weight"] = 100
            canary["status"] = "ABORTED"
            canary["step_history"].append(f"{time_str} - Canary rolled back to 0% traffic due to manual intervention.")
        else:
            w = req.weight
            canary["canary_weight"] = w
            canary["baseline_weight"] = 100 - w
            canary["status"] = "RUNNING"
            canary["step_history"].append(f"{time_str} - Traffic split adjusted to Canary: {w}%, Baseline: {100 - w}%.")

        return CanaryRollout(**canary)
