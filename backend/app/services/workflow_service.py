"""Workflow runs and deployment tracking business logic with webhook handling."""

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.models.deployment import Deployment
from app.models.github_account import GitHubAccount
from app.models.notification import Notification
from app.models.repository import Repository
from app.models.workflow_run import WorkflowRun
from app.repositories.repository_repo import RepositoryRepo
from app.repositories.user_repo import UserRepository
from app.repositories.workflow_repo import WorkflowRepo
from app.schemas.workflow import (
    DeploymentListResponse,
    DeploymentResponse,
    WorkflowDispatchRequest,
    WorkflowRunListResponse,
    WorkflowRunResponse,
)
from app.services.github_service import GitHubService

logger = get_logger("workflow_service")


class WorkflowService:
    """Service handling CI/CD workflow runs, deployments, and webhook processing."""

    @staticmethod
    async def get_workflow_runs(
        db: AsyncSession,
        user_id: int,
        repo_id: int | None = None,
        page: int = 1,
        per_page: int = 20,
        status: str | None = None,
        conclusion: str | None = None,
    ) -> WorkflowRunListResponse:
        """Fetch paginated workflow runs for a repository or for all user repositories."""
        repo_workflow = WorkflowRepo(db)
        skip = (page - 1) * per_page

        if repo_id:
            runs, total = await repo_workflow.get_by_repository(
                repo_id=repo_id,
                skip=skip,
                limit=per_page,
                status=status,
                conclusion=conclusion,
            )
        else:
            # Query across all repositories owned by user
            subq = (
                select(Repository.id)
                .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
                .where(GitHubAccount.user_id == user_id)
            ).subquery()

            filters: list[Any] = [WorkflowRun.repository_id.in_(select(subq))]
            if status:
                filters.append(WorkflowRun.status == status)
            if conclusion:
                filters.append(WorkflowRun.conclusion == conclusion)

            count_q = select(func.count()).select_from(WorkflowRun)
            for f in filters:
                count_q = count_q.where(f)
            count_result = await db.execute(count_q)
            total = count_result.scalar() or 0

            query = select(WorkflowRun)
            for f in filters:
                query = query.where(f)
            query = (
                query.order_by(WorkflowRun.id.desc())
                .offset(skip)
                .limit(per_page)
            )
            result = await db.execute(query)
            runs = list(result.scalars().all())

        return WorkflowRunListResponse(
            workflow_runs=[WorkflowRunResponse.model_validate(r) for r in runs],
            total=total,
            page=page,
            per_page=per_page,
        )

    @staticmethod
    async def sync_workflow_runs(
        db: AsyncSession, repo_id: int, user_id: int
    ) -> list[WorkflowRunResponse]:
        """Fetch recent workflow runs from GitHub and update database."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(repo_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")

        user_repo = UserRepository(db)
        gh_account = await user_repo.get_github_account_by_user_id(user_id)
        token = gh_account.access_token if gh_account else None
        gh_client = GitHubService(access_token=token)

        owner, repo_name = repo.full_name.split("/")
        runs_data = await gh_client.get_workflow_runs(owner, repo_name, per_page=50)

        workflow_records = []
        for r in runs_data:
            started_at = None
            if r.get("run_started_at"):
                started_at = datetime.fromisoformat(r["run_started_at"].replace("Z", "+00:00"))
            elif r.get("created_at"):
                started_at = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))

            completed_at = None
            if r.get("updated_at") and r.get("status") == "completed":
                completed_at = datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00"))

            duration = None
            if started_at and completed_at:
                duration = int((completed_at - started_at).total_seconds())

            workflow_records.append({
                "repository_id": repo.id,
                "github_id": r["id"],
                "workflow_name": r.get("name", "CI/CD"),
                "workflow_id": r.get("workflow_id"),
                "run_number": r.get("run_number", 0),
                "status": r.get("status", "completed"),
                "conclusion": r.get("conclusion"),
                "branch": r.get("head_branch"),
                "event": r.get("event"),
                "url": r.get("html_url"),
                "started_at": started_at,
                "completed_at": completed_at,
                "duration_seconds": duration,
            })

        workflow_repo = WorkflowRepo(db)
        await workflow_repo.bulk_upsert_workflow_runs(workflow_records)
        await db.commit()

        runs, _ = await workflow_repo.get_by_repository(repo.id, limit=50)
        return [WorkflowRunResponse.model_validate(r) for r in runs]

    @staticmethod
    async def get_deployments(
        db: AsyncSession,
        user_id: int,
        repo_id: int | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> DeploymentListResponse:
        """Fetch deployments paginated."""
        skip = (page - 1) * per_page
        workflow_repo = WorkflowRepo(db)

        if repo_id:
            items, total = await workflow_repo.get_deployments_by_repository(
                repo_id, skip=skip, limit=per_page
            )
        else:
            subq = (
                select(Repository.id)
                .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
                .where(GitHubAccount.user_id == user_id)
            ).subquery()

            count_res = await db.execute(
                select(func.count())
                .select_from(Deployment)
                .where(Deployment.repository_id.in_(select(subq)))
            )
            total = count_res.scalar() or 0

            res = await db.execute(
                select(Deployment)
                .where(Deployment.repository_id.in_(select(subq)))
                .order_by(Deployment.id.desc())
                .offset(skip)
                .limit(per_page)
            )
            items = list(res.scalars().all())

        return DeploymentListResponse(
            deployments=[DeploymentResponse.model_validate(d) for d in items],
            total=total,
            page=page,
            per_page=per_page,
        )

    @staticmethod
    async def sync_deployments(
        db: AsyncSession, repo_id: int, user_id: int
    ) -> list[DeploymentResponse]:
        """Fetch deployments from GitHub and record in database."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(repo_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")

        user_repo = UserRepository(db)
        gh_account = await user_repo.get_github_account_by_user_id(user_id)
        token = gh_account.access_token if gh_account else None
        gh_client = GitHubService(access_token=token)

        owner, repo_name = repo.full_name.split("/")
        dep_data = await gh_client.get_deployments(owner, repo_name, per_page=30)

        workflow_repo = WorkflowRepo(db)
        synced = []
        for d in dep_data:
            deployed_at = None
            if d.get("created_at"):
                deployed_at = datetime.fromisoformat(d["created_at"].replace("Z", "+00:00"))

            creator = d.get("creator", {}).get("login") if d.get("creator") else None
            dep_record = await workflow_repo.upsert_deployment({
                "repository_id": repo.id,
                "github_id": d["id"],
                "environment": d.get("environment", "production"),
                "status": "success",
                "description": d.get("description"),
                "ref": d.get("ref"),
                "sha": d.get("sha"),
                "url": d.get("url"),
                "deployed_at": deployed_at,
                "creator": creator,
            })
            synced.append(dep_record)

        await db.commit()
        return [DeploymentResponse.model_validate(d) for d in synced]

    @staticmethod
    async def process_webhook(
        db: AsyncSession, event_type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle incoming GitHub webhooks (workflow_run, push, deployment, etc.)."""
        logger.info("Processing webhook event", webhook_event=event_type)

        if event_type == "workflow_run":
            wr = payload.get("workflow_run", {})
            repo_info = payload.get("repository", {})
            repo_github_id = repo_info.get("id")

            if not repo_github_id or not wr.get("id"):
                return {"status": "ignored", "reason": "Missing identifiers"}

            repo_db = RepositoryRepo(db)
            repo = await repo_db.get_by_github_id(repo_github_id)
            if not repo:
                return {"status": "ignored", "reason": "Repository not tracked"}

            started_at = None
            if wr.get("run_started_at"):
                started_at = datetime.fromisoformat(wr["run_started_at"].replace("Z", "+00:00"))
            completed_at = None
            if wr.get("updated_at") and wr.get("status") == "completed":
                completed_at = datetime.fromisoformat(wr["updated_at"].replace("Z", "+00:00"))

            duration = None
            if started_at and completed_at:
                duration = int((completed_at - started_at).total_seconds())

            workflow_repo = WorkflowRepo(db)
            await workflow_repo.bulk_upsert_workflow_runs([{
                "repository_id": repo.id,
                "github_id": wr["id"],
                "workflow_name": wr.get("name", "CI/CD"),
                "workflow_id": wr.get("workflow_id"),
                "run_number": wr.get("run_number", 0),
                "status": wr.get("status", "completed"),
                "conclusion": wr.get("conclusion"),
                "branch": wr.get("head_branch"),
                "event": wr.get("event"),
                "url": wr.get("html_url"),
                "started_at": started_at,
                "completed_at": completed_at,
                "duration_seconds": duration,
            }])

            # Create notification if workflow completed and failed/succeeded
            if wr.get("status") == "completed":
                conclusion = wr.get("conclusion")
                # Look up repository owner
                gh_acc_res = await db.execute(
                    select(GitHubAccount).where(GitHubAccount.id == repo.github_account_id)
                )
                gh_acc = gh_acc_res.scalars().first()
                if gh_acc:
                    notif_type = "build_failure" if conclusion == "failure" else "build_success"
                    title = f"Build {conclusion.capitalize()}: {repo.name}"
                    message = f"Workflow '{wr.get('name')}' #{wr.get('run_number')} {conclusion} on branch {wr.get('head_branch')}."
                    notif = Notification(
                        user_id=gh_acc.user_id,
                        title=title,
                        message=message,
                        type=notif_type,
                        reference_type="workflow_run",
                        reference_id=wr["id"],
                    )
                    db.add(notif)

            await db.commit()
            return {"status": "processed", "event": event_type, "run_id": wr.get("id")}

        elif event_type == "push":
            repo_info = payload.get("repository", {})
            repo_github_id = repo_info.get("id")
            if not repo_github_id:
                return {"status": "ignored", "reason": "Missing repository"}

            repo_db = RepositoryRepo(db)
            repo = await repo_db.get_by_github_id(repo_github_id)
            if not repo:
                return {"status": "ignored", "reason": "Repository not tracked"}

            raw_commits = payload.get("commits", [])
            commit_records = []
            for c in raw_commits:
                date_str = c.get("timestamp")
                parsed_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if date_str else datetime.now(timezone.utc)
                author_info = c.get("author", {})
                commit_records.append({
                    "repository_id": repo.id,
                    "sha": c.get("id") or c.get("sha"),
                    "message": (c.get("message") or "")[:2000],
                    "author_name": (author_info.get("name") or "Unknown")[:255],
                    "author_email": author_info.get("email")[:255] if author_info.get("email") else None,
                    "author_date": parsed_date,
                    "url": c.get("url"),
                    "additions": len(c.get("added", [])),
                    "deletions": len(c.get("removed", [])),
                })
            if commit_records:
                await repo_db.bulk_upsert_commits(commit_records)
                await db.commit()
            return {"status": "processed", "event": event_type, "commits_count": len(commit_records)}

        elif event_type == "pull_request":
            pr_data = payload.get("pull_request", {})
            repo_info = payload.get("repository", {})
            repo_github_id = repo_info.get("id")
            if not repo_github_id or not pr_data.get("id"):
                return {"status": "ignored", "reason": "Missing pull request info"}

            repo_db = RepositoryRepo(db)
            repo = await repo_db.get_by_github_id(repo_github_id)
            if not repo:
                return {"status": "ignored", "reason": "Repository not tracked"}

            created_at_gh = None
            if pr_data.get("created_at"):
                created_at_gh = datetime.fromisoformat(pr_data["created_at"].replace("Z", "+00:00"))
            closed_at = None
            if pr_data.get("closed_at"):
                closed_at = datetime.fromisoformat(pr_data["closed_at"].replace("Z", "+00:00"))
            merged_at = None
            if pr_data.get("merged_at"):
                merged_at = datetime.fromisoformat(pr_data["merged_at"].replace("Z", "+00:00"))

            author_user = pr_data.get("user", {})
            author = author_user.get("login") if author_user else None

            await repo_db.bulk_upsert_pull_requests([{
                "repository_id": repo.id,
                "github_id": pr_data["id"],
                "number": pr_data["number"],
                "title": pr_data.get("title", "")[:500],
                "state": pr_data.get("state", "open"),
                "author": author[:255] if author else None,
                "url": pr_data.get("html_url"),
                "created_at_gh": created_at_gh,
                "closed_at": closed_at,
                "merged_at": merged_at,
                "additions": pr_data.get("additions", 0),
                "deletions": pr_data.get("deletions", 0),
            }])
            await db.commit()
            return {"status": "processed", "event": event_type, "pr_number": pr_data.get("number")}

        return {"status": "received", "event": event_type}

    @staticmethod
    async def dispatch_workflow(
        db: AsyncSession, user_id: int, data: WorkflowDispatchRequest
    ) -> WorkflowRunResponse:
        """Trigger an on-demand CI/CD workflow pipeline dispatch via real GitHub Actions API."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(data.repository_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")

        user_repo = UserRepository(db)
        gh_account = await user_repo.get_github_account_by_user_id(user_id)
        token = gh_account.access_token if gh_account else None
        gh_client = GitHubService(access_token=token)

        owner, repo_name = repo.full_name.split("/")
        now = datetime.now(timezone.utc)

        # Call real GitHub Actions API when credentials exist
        if token and not token.startswith("demo_") and not token.startswith("ghp_demo_") and token not in ("public_viewer", "none"):
            await gh_client.dispatch_workflow(
                owner=owner,
                repo=repo_name,
                workflow_id_or_name=data.workflow_name,
                ref=data.branch,
            )

        # Query max run number for this repository
        max_run_res = await db.execute(
            select(func.max(WorkflowRun.run_number)).where(WorkflowRun.repository_id == repo.id)
        )
        current_max = max_run_res.scalar() or 0
        new_run_number = current_max + 1
        record_id = int(now.timestamp())

        new_run = WorkflowRun(
            repository_id=repo.id,
            github_id=record_id,
            workflow_name=data.workflow_name,
            workflow_id=repo.id * 1000 + new_run_number,
            run_number=new_run_number,
            status="queued",
            conclusion=None,
            branch=data.branch,
            event="workflow_dispatch",
            url=f"{repo.html_url}/actions",
            started_at=now,
            duration_seconds=None,
        )
        db.add(new_run)

        notif = Notification(
            user_id=user_id,
            title="Pipeline Triggered",
            message=f"Manual workflow '{data.workflow_name}' #{new_run_number} queued on {repo.name} ({data.branch}).",
            type="info",
            reference_type="workflow_run",
            reference_id=record_id,
        )
        db.add(notif)
        await db.commit()
        await db.refresh(new_run)
        return WorkflowRunResponse.model_validate(new_run)

