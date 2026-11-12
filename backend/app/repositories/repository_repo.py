"""Repository, Commit, PullRequest, and Issue data-access repository."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commit import Commit
from app.models.github_account import GitHubAccount
from app.models.issue import Issue
from app.models.pull_request import PullRequest
from app.models.repository import Repository
from app.repositories.base import BaseRepository


class RepositoryRepo(BaseRepository[Repository]):
    """Data-access layer for Repository and its child entities."""

    model = Repository

    async def get_by_github_id(self, github_id: int) -> Repository | None:
        """Look up a repository by its GitHub numeric id."""
        result = await self.db.execute(
            select(Repository).where(Repository.github_id == github_id)
        )
        return result.scalars().first()

    async def get_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        organization_id: int | None = None,
    ) -> tuple[list[Repository], int]:
        """Return repositories belonging to a user or scoped to an organization."""
        if organization_id is not None:
            base_filter = Repository.organization_id == organization_id
        else:
            subq = select(GitHubAccount.id).where(
                GitHubAccount.user_id == user_id
            ).subquery()
            base_filter = Repository.github_account_id.in_(select(subq))

        count_result = await self.db.execute(
            select(func.count())
            .select_from(Repository)
            .where(base_filter)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(Repository)
            .where(base_filter)
            .order_by(Repository.id.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    # ---------- Commits ----------

    async def get_commits(
        self, repo_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[Commit], int]:
        """Return paginated commits for a repository."""
        count_result = await self.db.execute(
            select(func.count())
            .select_from(Commit)
            .where(Commit.repository_id == repo_id)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(Commit)
            .where(Commit.repository_id == repo_id)
            .order_by(Commit.author_date.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    async def bulk_upsert_commits(self, commits: list[dict[str, Any]]) -> None:
        """Insert commits, skipping duplicates on sha conflict."""
        if not commits:
            return
        stmt = pg_insert(Commit).values(commits)
        stmt = stmt.on_conflict_do_nothing(index_elements=["sha"])
        await self.db.execute(stmt)
        await self.db.flush()

    # ---------- Pull Requests ----------

    async def get_pull_requests(
        self, repo_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[PullRequest], int]:
        """Return paginated pull requests for a repository."""
        count_result = await self.db.execute(
            select(func.count())
            .select_from(PullRequest)
            .where(PullRequest.repository_id == repo_id)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(PullRequest)
            .where(PullRequest.repository_id == repo_id)
            .order_by(PullRequest.number.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    async def bulk_upsert_pull_requests(
        self, prs: list[dict[str, Any]]
    ) -> None:
        """Upsert pull requests based on repo+number constraint."""
        if not prs:
            return
        stmt = pg_insert(PullRequest).values(prs)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_pr_repo_number",
            set_={
                "title": stmt.excluded.title,
                "state": stmt.excluded.state,
                "closed_at": stmt.excluded.closed_at,
                "merged_at": stmt.excluded.merged_at,
                "additions": stmt.excluded.additions,
                "deletions": stmt.excluded.deletions,
            },
        )
        await self.db.execute(stmt)
        await self.db.flush()

    # ---------- Issues ----------

    async def get_issues(
        self, repo_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[Issue], int]:
        """Return paginated issues for a repository."""
        count_result = await self.db.execute(
            select(func.count())
            .select_from(Issue)
            .where(Issue.repository_id == repo_id)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(Issue)
            .where(Issue.repository_id == repo_id)
            .order_by(Issue.number.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    async def bulk_upsert_issues(
        self, issues: list[dict[str, Any]]
    ) -> None:
        """Upsert issues based on repo+number constraint."""
        if not issues:
            return
        stmt = pg_insert(Issue).values(issues)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_issue_repo_number",
            set_={
                "title": stmt.excluded.title,
                "state": stmt.excluded.state,
                "labels": stmt.excluded.labels,
                "closed_at": stmt.excluded.closed_at,
            },
        )
        await self.db.execute(stmt)
        await self.db.flush()
