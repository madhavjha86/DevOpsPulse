"""WorkflowRun and Deployment data-access repository."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deployment import Deployment
from app.models.github_account import GitHubAccount
from app.models.repository import Repository
from app.models.workflow_run import WorkflowRun
from app.repositories.base import BaseRepository


class WorkflowRepo(BaseRepository[WorkflowRun]):
    """Data-access layer for WorkflowRun and Deployment records."""

    model = WorkflowRun

    async def get_by_github_id(self, github_id: int) -> WorkflowRun | None:
        """Look up a workflow run by its GitHub numeric id."""
        result = await self.db.execute(
            select(WorkflowRun).where(WorkflowRun.github_id == github_id)
        )
        return result.scalars().first()

    async def get_by_repository(
        self,
        repo_id: int,
        skip: int = 0,
        limit: int = 20,
        status: str | None = None,
        conclusion: str | None = None,
    ) -> tuple[list[WorkflowRun], int]:
        """Return paginated workflow runs, optionally filtered."""
        filters: list[Any] = [WorkflowRun.repository_id == repo_id]
        if status:
            filters.append(WorkflowRun.status == status)
        if conclusion:
            filters.append(WorkflowRun.conclusion == conclusion)

        count_q = select(func.count()).select_from(WorkflowRun)
        for f in filters:
            count_q = count_q.where(f)
        count_result = await self.db.execute(count_q)
        total = count_result.scalar() or 0

        query = select(WorkflowRun)
        for f in filters:
            query = query.where(f)
        query = query.order_by(WorkflowRun.id.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        return items, total

    async def get_all_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        status: str | None = None,
        conclusion: str | None = None,
        repo_id: int | None = None,
    ) -> tuple[list[WorkflowRun], int]:
        """Return workflow runs across all of a user's repositories."""
        subq = (
            select(Repository.id)
            .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
            .where(GitHubAccount.user_id == user_id)
        ).subquery()

        filters: list[Any] = [WorkflowRun.repository_id.in_(select(subq))]
        if repo_id:
            filters.append(WorkflowRun.repository_id == repo_id)
        if status:
            filters.append(WorkflowRun.status == status)
        if conclusion:
            filters.append(WorkflowRun.conclusion == conclusion)

        count_q = select(func.count()).select_from(WorkflowRun)
        for f in filters:
            count_q = count_q.where(f)
        count_result = await self.db.execute(count_q)
        total = count_result.scalar() or 0

        query = select(WorkflowRun)
        for f in filters:
            query = query.where(f)
        query = query.order_by(WorkflowRun.id.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        return items, total

    # ---------- Deployments ----------

    async def get_deployments_by_repository(
        self, repo_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[Deployment], int]:
        """Return paginated deployments for a repository."""
        count_result = await self.db.execute(
            select(func.count())
            .select_from(Deployment)
            .where(Deployment.repository_id == repo_id)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(Deployment)
            .where(Deployment.repository_id == repo_id)
            .order_by(Deployment.id.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    async def get_all_deployments_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Deployment], int]:
        """Return all deployments across a user's repositories."""
        subq = (
            select(Repository.id)
            .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
            .where(GitHubAccount.user_id == user_id)
        ).subquery()

        count_result = await self.db.execute(
            select(func.count())
            .select_from(Deployment)
            .where(Deployment.repository_id.in_(select(subq)))
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(Deployment)
            .where(Deployment.repository_id.in_(select(subq)))
            .order_by(Deployment.id.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    # ---------- Bulk upsert ----------

    async def bulk_upsert_workflow_runs(
        self, runs: list[dict[str, Any]]
    ) -> None:
        """Upsert workflow runs based on github_id uniqueness."""
        if not runs:
            return
        stmt = pg_insert(WorkflowRun).values(runs)
        stmt = stmt.on_conflict_do_update(
            index_elements=["github_id"],
            set_={
                "status": stmt.excluded.status,
                "conclusion": stmt.excluded.conclusion,
                "completed_at": stmt.excluded.completed_at,
                "duration_seconds": stmt.excluded.duration_seconds,
            },
        )
        await self.db.execute(stmt)
        await self.db.flush()

    async def upsert_deployment(self, data: dict[str, Any]) -> Deployment:
        """Insert or update a single deployment by github_id."""
        stmt = pg_insert(Deployment).values(**data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["github_id"],
            set_={
                "status": stmt.excluded.status,
                "description": stmt.excluded.description,
                "deployed_at": stmt.excluded.deployed_at,
            },
        )
        await self.db.execute(stmt)
        await self.db.flush()

        result = await self.db.execute(
            select(Deployment).where(Deployment.github_id == data["github_id"])
        )
        return result.scalars().one()

    # ---------- Stats ----------

    async def get_build_stats(self, user_id: int) -> dict[str, int]:
        """Return aggregate build counts (success/failure/total) for a user."""
        subq = (
            select(Repository.id)
            .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
            .where(GitHubAccount.user_id == user_id)
        ).subquery()

        base = select(WorkflowRun).where(
            WorkflowRun.repository_id.in_(select(subq))
        )

        total_result = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_result.scalar() or 0

        success_result = await self.db.execute(
            select(func.count())
            .select_from(WorkflowRun)
            .where(
                WorkflowRun.repository_id.in_(select(subq)),
                WorkflowRun.conclusion == "success",
            )
        )
        success = success_result.scalar() or 0

        failure_result = await self.db.execute(
            select(func.count())
            .select_from(WorkflowRun)
            .where(
                WorkflowRun.repository_id.in_(select(subq)),
                WorkflowRun.conclusion == "failure",
            )
        )
        failure = failure_result.scalar() or 0

        return {"total": total, "success": success, "failure": failure}
