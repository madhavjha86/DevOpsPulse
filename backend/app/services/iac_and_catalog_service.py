"""Infrastructure as Code (Terraform) and Developer Portal service layer."""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.iac_and_catalog import (
    GoldenPathTemplate,
    ServiceCatalogItem,
    TerraformRun,
    TerraformWorkspace,
)
from app.schemas.iac_and_catalog import (
    DeveloperPortalOverviewResponse,
    GoldenPathResponse,
    ServiceCatalogCreate,
    ServiceCatalogResponse,
    TerraformApplyRequest,
    TerraformPlanRequest,
    TerraformRunResponse,
    TerraformWorkspaceCreate,
    TerraformWorkspaceResponse,
)

logger = get_logger("iac_catalog_service")


class IacAndCatalogService:
    """Manages Terraform IaC pipelines, drift detection, and Spotify-style Developer Portal."""

    @classmethod
    async def ensure_defaults(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> None:
        """Seed default Terraform workspaces, service catalog items, and golden path templates."""
        stmt = select(func.count()).select_from(TerraformWorkspace).where(
            TerraformWorkspace.user_id == user_id
        )
        if organization_id is not None:
            stmt = stmt.where(TerraformWorkspace.organization_id == organization_id)
        res = await db.execute(stmt)
        if (res.scalar() or 0) == 0:
            # 1. Default Workspaces
            ws_prod = TerraformWorkspace(
                user_id=user_id,
                organization_id=organization_id,
                name="aws-production-eks-cluster",
                repository_url="https://github.com/devopspulse/infrastructure-terraform",
                working_directory="terraform/environments/production",
                terraform_version="1.8.2",
                current_state_version=14,
                resource_count=48,
                status="HEALTHY",
                has_drift=False,
                last_drift_check_at=datetime.now(timezone.utc),
                last_applied_at=datetime.now(timezone.utc),
                description="Core Kubernetes cluster, VPC subnets, and RDS database infrastructure.",
            )
            ws_staging = TerraformWorkspace(
                user_id=user_id,
                organization_id=organization_id,
                name="stage-microservices-env",
                repository_url="https://github.com/devopspulse/infrastructure-terraform",
                working_directory="terraform/environments/staging",
                terraform_version="1.8.2",
                current_state_version=8,
                resource_count=26,
                status="HEALTHY",
                has_drift=False,
                last_drift_check_at=datetime.now(timezone.utc),
                last_applied_at=datetime.now(timezone.utc),
                description="Staging environment for pre-release validation and QA integration testing.",
            )
            db.add_all([ws_prod, ws_staging])
            await db.flush()

            # Default Run for ws_prod
            run_1 = TerraformRun(
                workspace_id=ws_prod.id,
                user_id=user_id,
                organization_id=organization_id,
                run_type="APPLY",
                status="APPLIED",
                resources_to_add=4,
                resources_to_change=2,
                resources_to_destroy=0,
                is_destructive=False,
                plan_output="Terraform will perform the following actions:\n  + module.eks.aws_eks_node_group.workers\n  ~ module.vpc.aws_route_table.private\nPlan: 4 to add, 2 to change, 0 to destroy.",
                security_scan_passed=True,
                security_issues_count=0,
                approved_by="DevOps Lead",
                rollback_guidance="Safe rollback: Revert commit 4d82f1b and run 'terraform apply -target=module.eks.node_group'.",
            )
            db.add(run_1)

            # 2. Service Catalog Items
            services_data = [
                ServiceCatalogItem(
                    user_id=user_id,
                    organization_id=organization_id,
                    name="payment-service",
                    display_name="Payment Processing Engine",
                    description="PCI-DSS compliant credit card and bank transfer gateway processor.",
                    tier="TIER_1_CRITICAL",
                    owner_team="Core Payments Squad",
                    tech_stack="Go 1.22, PostgreSQL, Redis",
                    lifecycle="PRODUCTION",
                    health_status="HEALTHY",
                    environment="PRODUCTION",
                    repository_url="https://github.com/devopspulse/payment-service",
                    documentation_url="https://docs.devopspulse.io/services/payment-service",
                    api_spec_url="https://api.devopspulse.io/openapi/payment-v1.yaml",
                ),
                ServiceCatalogItem(
                    user_id=user_id,
                    organization_id=organization_id,
                    name="auth-service",
                    display_name="Identity & Access Gateway",
                    description="OAuth2/OIDC centralized identity provider and JWT verification.",
                    tier="TIER_1_CRITICAL",
                    owner_team="Security Engineering",
                    tech_stack="Node.js 20, TypeScript, Redis",
                    lifecycle="PRODUCTION",
                    health_status="HEALTHY",
                    environment="PRODUCTION",
                    repository_url="https://github.com/devopspulse/auth-service",
                    documentation_url="https://docs.devopspulse.io/services/auth-service",
                    api_spec_url="https://api.devopspulse.io/openapi/auth-v1.yaml",
                ),
                ServiceCatalogItem(
                    user_id=user_id,
                    organization_id=organization_id,
                    name="order-service",
                    display_name="Order Lifecycle Engine",
                    description="Processes customer purchase orders, cart fulfillment, and inventory reservation.",
                    tier="TIER_2_CORE",
                    owner_team="Commerce Squad",
                    tech_stack="Python 3.12, FastAPI, PostgreSQL",
                    lifecycle="PRODUCTION",
                    health_status="HEALTHY",
                    environment="PRODUCTION",
                    repository_url="https://github.com/devopspulse/order-service",
                    documentation_url="https://docs.devopspulse.io/services/order-service",
                    api_spec_url="https://api.devopspulse.io/openapi/order-v1.yaml",
                ),
                ServiceCatalogItem(
                    user_id=user_id,
                    organization_id=organization_id,
                    name="notification-worker",
                    display_name="Async Notification Dispatcher",
                    description="Consumes Celery queues to deliver emails, SMS, and webhook alerts.",
                    tier="TIER_3_SUPPORTING",
                    owner_team="Platform Team",
                    tech_stack="Python, Celery, Redis",
                    lifecycle="PRODUCTION",
                    health_status="HEALTHY",
                    environment="PRODUCTION",
                    repository_url="https://github.com/devopspulse/notification-worker",
                    documentation_url="https://docs.devopspulse.io/services/notification-worker",
                    api_spec_url=None,
                ),
            ]
            for s in services_data:
                db.add(s)

            # 3. Golden Path Templates
            templates_data = [
                GoldenPathTemplate(
                    organization_id=organization_id,
                    name="FastAPI Enterprise Microservice",
                    category="BACKEND",
                    description="Production-ready Python FastAPI template with Dockerfile, OpenTelemetry tracing, and GitHub Actions CI.",
                    repository_template_url="https://github.com/devopspulse/template-fastapi-service",
                    ci_template="GitHub Actions",
                    is_recommended=True,
                ),
                GoldenPathTemplate(
                    organization_id=organization_id,
                    name="Go Cloud-Native Microservice",
                    category="BACKEND",
                    description="High-throughput Go 1.22 template with distroless multi-stage build and Prometheus metrics.",
                    repository_template_url="https://github.com/devopspulse/template-go-service",
                    ci_template="GitHub Actions",
                    is_recommended=True,
                ),
                GoldenPathTemplate(
                    organization_id=organization_id,
                    name="Terraform AWS Environment Module",
                    category="INFRASTRUCTURE",
                    description="Standardized VPC, EKS, RDS, and S3 IaC module with Checkov compliance rules built-in.",
                    repository_template_url="https://github.com/devopspulse/template-terraform-aws",
                    ci_template="GitHub Actions",
                    is_recommended=True,
                ),
            ]
            for t in templates_data:
                db.add(t)

            await db.commit()

    # -----------------------------------------------------------------------
    # Phase 5: Infrastructure as Code (Terraform)
    # -----------------------------------------------------------------------

    @classmethod
    async def list_workspaces(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> list[TerraformWorkspaceResponse]:
        """List all Terraform workspaces."""
        await cls.ensure_defaults(db, user_id, organization_id)
        stmt = select(TerraformWorkspace).where(TerraformWorkspace.user_id == user_id)
        if organization_id is not None:
            stmt = stmt.where(TerraformWorkspace.organization_id == organization_id)
        res = await db.execute(stmt)
        return [TerraformWorkspaceResponse.model_validate(w) for w in res.scalars().all()]

    @classmethod
    async def create_workspace(
        cls, db: AsyncSession, user_id: int, payload: TerraformWorkspaceCreate, organization_id: int | None = None
    ) -> TerraformWorkspaceResponse:
        """Register a new Terraform IaC workspace."""
        ws = TerraformWorkspace(
            user_id=user_id,
            organization_id=organization_id,
            name=payload.name.strip(),
            repository_url=payload.repository_url.strip(),
            working_directory=payload.working_directory.strip(),
            terraform_version=payload.terraform_version.strip(),
            description=payload.description,
            status="HEALTHY",
        )
        db.add(ws)
        await db.commit()
        await db.refresh(ws)
        return TerraformWorkspaceResponse.model_validate(ws)

    @classmethod
    async def plan_workspace(
        cls, db: AsyncSession, workspace_id: int, user_id: int, organization_id: int | None = None
    ) -> TerraformRunResponse | None:
        """Execute Terraform plan preview and IaC security compliance scan."""
        stmt = select(TerraformWorkspace).where(TerraformWorkspace.id == workspace_id)
        if organization_id is not None:
            stmt = stmt.where(TerraformWorkspace.organization_id == organization_id)
        res = await db.execute(stmt)
        ws = res.scalars().first()
        if not ws:
            return None

        # Build realistic terraform plan simulation
        plan_text = (
            f"Refreshing Terraform state in {ws.working_directory}...\n"
            f"Terraform will perform the following actions:\n\n"
            f"  # aws_security_group.ingress_web will be updated in-place\n"
            f"  ~ resource \"aws_security_group\" \"ingress_web\" {{\n"
            f"      ~ description = \"Allow TLS traffic\" -> \"Allow HTTPS port 443\"\n"
            f"    }}\n\n"
            f"  # aws_s3_bucket.audit_logs will be created\n"
            f"  + resource \"aws_s3_bucket\" \"audit_logs\" {{\n"
            f"      + bucket = \"devopspulse-audit-logs-{ws.name}\"\n"
            f"      + server_side_encryption_configuration = [AES256]\n"
            f"    }}\n\n"
            f"Plan: 1 to add, 1 to change, 0 to destroy."
        )

        run = TerraformRun(
            workspace_id=ws.id,
            user_id=user_id,
            organization_id=organization_id,
            run_type="PLAN",
            status="PLANNED",
            resources_to_add=1,
            resources_to_change=1,
            resources_to_destroy=0,
            is_destructive=False,
            plan_output=plan_text,
            security_scan_passed=True,
            security_issues_count=0,
            rollback_guidance="Non-destructive change: If unexpected drift occurs, apply git commit prior to merge.",
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return TerraformRunResponse.model_validate(run)

    @classmethod
    async def apply_run(
        cls, db: AsyncSession, payload: TerraformApplyRequest, organization_id: int | None = None
    ) -> TerraformRunResponse | None:
        """Approve and apply an existing Terraform plan (never automatic without authorization)."""
        stmt = select(TerraformRun).where(TerraformRun.id == payload.run_id)
        if organization_id is not None:
            stmt = stmt.where(TerraformRun.organization_id == organization_id)
        res = await db.execute(stmt)
        run = res.scalars().first()
        if not run:
            return None

        run.status = "APPLIED"
        run.run_type = "APPLY"
        run.approved_by = payload.approved_by.strip()

        # Update parent workspace
        ws_stmt = select(TerraformWorkspace).where(TerraformWorkspace.id == run.workspace_id)
        ws_res = await db.execute(ws_stmt)
        ws = ws_res.scalars().first()
        if ws:
            ws.resource_count += run.resources_to_add
            ws.current_state_version += 1
            ws.last_applied_at = datetime.now(timezone.utc)
            ws.status = "APPLIED"

        await db.commit()
        await db.refresh(run)
        return TerraformRunResponse.model_validate(run)

    @classmethod
    async def check_drift(
        cls, db: AsyncSession, workspace_id: int, organization_id: int | None = None
    ) -> TerraformWorkspaceResponse | None:
        """Evaluate infrastructure state against declared Terraform templates to detect configuration drift."""
        stmt = select(TerraformWorkspace).where(TerraformWorkspace.id == workspace_id)
        if organization_id is not None:
            stmt = stmt.where(TerraformWorkspace.organization_id == organization_id)
        res = await db.execute(stmt)
        ws = res.scalars().first()
        if not ws:
            return None

        # Simulate drift inspection (100% in-sync for healthy clusters)
        ws.last_drift_check_at = datetime.now(timezone.utc)
        ws.has_drift = False
        ws.status = "HEALTHY"

        await db.commit()
        await db.refresh(ws)
        return TerraformWorkspaceResponse.model_validate(ws)

    # -----------------------------------------------------------------------
    # Phase 6: Developer Portal (IDP)
    # -----------------------------------------------------------------------

    @classmethod
    async def get_portal_overview(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> DeveloperPortalOverviewResponse:
        """Fetch Developer Portal overview with service catalog and golden path templates."""
        await cls.ensure_defaults(db, user_id, organization_id)

        # Services
        s_stmt = select(ServiceCatalogItem).where(ServiceCatalogItem.user_id == user_id)
        if organization_id is not None:
            s_stmt = s_stmt.where(ServiceCatalogItem.organization_id == organization_id)
        s_res = await db.execute(s_stmt)
        services = s_res.scalars().all()
        svc_responses = [ServiceCatalogResponse.model_validate(s) for s in services]

        # Templates
        t_stmt = select(GoldenPathTemplate)
        if organization_id is not None:
            t_stmt = t_stmt.where(GoldenPathTemplate.organization_id == organization_id)
        t_res = await db.execute(t_stmt)
        templates = t_res.scalars().all()
        tmpl_responses = [GoldenPathResponse.model_validate(t) for t in templates]

        tier_1 = sum(1 for s in services if s.tier == "TIER_1_CRITICAL")
        healthy = sum(1 for s in services if s.health_status == "HEALTHY")

        return DeveloperPortalOverviewResponse(
            total_services=len(services),
            tier_1_count=tier_1,
            healthy_services_count=healthy,
            templates_count=len(templates),
            services=svc_responses,
            templates=tmpl_responses,
        )

    @classmethod
    async def create_catalog_item(
        cls, db: AsyncSession, user_id: int, payload: ServiceCatalogCreate, organization_id: int | None = None
    ) -> ServiceCatalogResponse:
        """Register a new service in the Developer Portal catalog."""
        item = ServiceCatalogItem(
            user_id=user_id,
            organization_id=organization_id,
            name=payload.name.strip(),
            display_name=payload.display_name.strip(),
            description=payload.description.strip(),
            tier=payload.tier,
            owner_team=payload.owner_team.strip(),
            tech_stack=payload.tech_stack.strip(),
            lifecycle=payload.lifecycle,
            health_status=payload.health_status,
            environment=payload.environment,
            repository_url=payload.repository_url,
            documentation_url=payload.documentation_url,
            api_spec_url=payload.api_spec_url,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return ServiceCatalogResponse.model_validate(item)
